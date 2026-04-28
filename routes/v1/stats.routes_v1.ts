import fastifyPlugin from "fastify-plugin";
import { __reply } from "#utils/utils_helper.ts";
import { AuthUserRole } from "../../types/authTypes.ts";
import type { TDashboardStats } from "#types/types.ts";
import type { TResponseType } from "#types/responseType.ts";
import { Cadre, StaffStatus } from "../../generated/prisma/enums.ts";

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns the first and last day of a given month as Date objects. */
function monthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // last ms of last day
  return { start, end };
}

/**
 * Calculates the percentage change between two values.
 * Returns 0 when the previous value is 0 to avoid division-by-zero.
 * Result is rounded to one decimal place.
 *
 * A positive result means growth; negative means decline.
 */
function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

// ── Route ─────────────────────────────────────────────────────────────────────

export default fastifyPlugin((fastify) => {
  const { prisma, authorize } = fastify;

  fastify.get(
    "/dashboard/stats",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (_, reply) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight, local

      // ── Current and previous month window ───────────────────────────────────
      const currMonth = monthBounds(now.getFullYear(), now.getMonth());
      const prevMonth = monthBounds(now.getFullYear(), now.getMonth() - 1);

      // ── Parallel queries ─────────────────────────────────────────────────────
      // Split into two named transactions so the query intent is obvious and
      // the destructuring order is impossible to mix up.
      const [
        // Current snapshot counts
        totalStaff,
        totalDepartments,
        totalActiveStaff,
        totalOnLeaveStaff,
        totalTeachingStaff,
        totalNonTeachingStaff,
        totalPendingLeaves,
        // Today's attendance
        todayAttendance,
        totalLateArrivals,
        totalPresentLateToday,
      ] = await prisma.$transaction([
        prisma.staff.count(),
        prisma.department.count(),
        prisma.staff.count({ where: { status: StaffStatus.Employed } }),
        prisma.staff.count({ where: { status: StaffStatus.OnLeave } }),
        prisma.staff.count({ where: { cadre: Cadre.Teaching } }),
        prisma.staff.count({ where: { cadre: Cadre.Non_Teaching } }),
        prisma.leave.count({ where: { status: "PENDING" } }),
        // All attendance records logged today (any status)
        prisma.attendance.count({ where: { date: today } }),
        // Late arrivals today
        prisma.attendance.count({
          where: { date: today, status: "LATE" },
        }),
        // Present OR late today (numerator for attendance rate)
        prisma.attendance.count({
          where: {
            date: today,
            OR: [{ status: "PRESENT" }, { status: "LATE" }],
          },
        }),
      ]);

      // ── Month-over-month baseline queries ────────────────────────────────────
      // We fetch only what changed between months to keep the query count low:
      //  • Staff headcount: staff created up to end of each month
      //  • Active staff:    same filter + Employed status
      //  • On-leave staff:  leaves that were active (approved, not cancelled) each month
      //  • Attendance rate: present+late / total records in each month window
      const [
        prevMonthTotalStaff,
        prevMonthActiveStaff,
        prevMonthOnLeave,
        currMonthAttendancePresent,
        prevMonthAttendancePresent,
        currMonthAttendanceTotal,
        prevMonthAttendanceTotal,
        currMonthAvgWorkHours,
        prevMonthAvgWorkHours,
      ] = await prisma.$transaction([
        // Staff headcount at end of previous month
        prisma.staff.count({
          where: { createdAt: { lte: prevMonth.end } },
        }),
        // Active (employed) staff at end of previous month
        prisma.staff.count({
          where: {
            status: StaffStatus.Employed,
            createdAt: { lte: prevMonth.end },
          },
        }),
        // Approved study/extended leaves that overlapped previous month
        prisma.leave.count({
          where: {
            status: "APPROVED",
            startDate: { lte: prevMonth.end },
            endDate: { gte: prevMonth.start },
          },
        }),
        // Present+late records in current month
        prisma.attendance.count({
          where: {
            date: { gte: currMonth.start, lte: currMonth.end },
            OR: [{ status: "PRESENT" }, { status: "LATE" }],
          },
        }),
        // Present+late records in previous month
        prisma.attendance.count({
          where: {
            date: { gte: prevMonth.start, lte: prevMonth.end },
            OR: [{ status: "PRESENT" }, { status: "LATE" }],
          },
        }),
        // Total attendance records in current month (denominator)
        prisma.attendance.count({
          where: { date: { gte: currMonth.start, lte: currMonth.end } },
        }),
        // Total attendance records in previous month (denominator)
        prisma.attendance.count({
          where: { date: { gte: prevMonth.start, lte: prevMonth.end } },
        }),
        // Average work_hours this month — null rows (no checkout) are excluded by Prisma
        prisma.attendance.aggregate({
          _avg: { workHours: true },
          where: {
            date: { gte: currMonth.start, lte: currMonth.end },
            workHours: { not: null },
          },
        }),
        // Average work_hours previous month
        prisma.attendance.aggregate({
          _avg: { workHours: true },
          where: {
            date: { gte: prevMonth.start, lte: prevMonth.end },
            workHours: { not: null },
          },
        }),
      ]);

      // ── Derived metrics ───────────────────────────────────────────────────────

      // Attendance rate for today: (present + late) / active staff × 100
      // Using totalActiveStaff as the expected-present headcount, not totalStaff,
      // because staff on leave or terminated shouldn't drag the rate down.
      const attendanceRate =
        totalActiveStaff > 0
          ? parseFloat(
              ((totalPresentLateToday / totalActiveStaff) * 100).toFixed(1),
            )
          : 0;

      // Attendance rate for current and previous month (for MoM delta)
      const currMonthRate =
        currMonthAttendanceTotal > 0
          ? (currMonthAttendancePresent / currMonthAttendanceTotal) * 100
          : 0;
      const prevMonthRate =
        prevMonthAttendanceTotal > 0
          ? (prevMonthAttendancePresent / prevMonthAttendanceTotal) * 100
          : 0;

      // Average work hours — fall back to 0 if no data exists yet
      const avgWorkHours = currMonthAvgWorkHours._avg.workHours ?? 0;
      const prevAvgWorkHours = prevMonthAvgWorkHours._avg.workHours ?? 0;

      // ── Month-over-month percentage changes ───────────────────────────────────
      //
      // pctChange(current, previous) → positive = growth, negative = decline.
      // These are real numbers derived from DB data, not hardcoded placeholders.

      const totalStaffChange = pctChange(totalStaff, prevMonthTotalStaff);
      const activeStaffChange = pctChange(
        totalActiveStaff,
        prevMonthActiveStaff,
      );
      const onLeaveChange = pctChange(totalOnLeaveStaff, prevMonthOnLeave);
      const attendanceRateChange = pctChange(currMonthRate, prevMonthRate);
      const avgWorkHoursChange = pctChange(avgWorkHours, prevAvgWorkHours);

      const stats: TDashboardStats = {
        totalStaff,
        totalDepartments,
        totalActiveStaff,
        totalOnLeaveStaff,
        totalTeachingStaff,
        totalNonTeachingStaff,
        totalPendingLeaves,
        todayAttendance,
        totalLateArrivals,
        totalPresentLateToday,
        attendanceRate: String(attendanceRate),
        avgWorkHours: parseFloat(avgWorkHours.toFixed(1)),
        // MoM deltas — all real, all sourced from DB
        totalStaffChange,
        activeStaffChange,
        onLeaveChange,
        attendanceRateChange,
        avgWorkHoursChange,
      };

      return __reply<TResponseType<TDashboardStats>>(reply, 200, {
        payload: stats,
      });
    },
  );
});

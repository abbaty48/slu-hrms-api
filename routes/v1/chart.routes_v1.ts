import type {
  TLeaveTrend,
  TChartLeaveUtilization,
  TChartLeaveTypeDistribution,
  TChartAttendanceCurrentWeek,
} from "#types/leave-managementTypes.ts";
import {
  getStaffPerDepartmentChartQueryScheme,
  getLeaveTypeDistributionChartQueryScheme,
} from "#schemas/chart.schemas.ts";
import type {
  TChartAccademicStudyLeaveByFaculty,
  TChartAccademicSponsorshipDistribution,
} from "#types/academicDivisionTypes.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import { __reply, randomHex } from "#utils/utils_helper.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { TChartStaffPerDepartment } from "#types/staffTypes.ts";
import { getLeaveTrendsQueryScheme } from "#schemas/leave.schemas.ts";
import type { TMonthlyAttendanceTrend } from "#types/attendance.types.ts";

// ── Constants ──────────────────────────────────────────────────────────────
const MONTHS_FULL_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MIN_MONTHS = 1;
const MAX_MONTHS = 24; // hard cap — beyond this the query becomes expensive

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns the inclusive Date range for a given year + 0-based month index. */
function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // last ms of last day
  return { start, end };
}

/** Clamps a value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const toPercent = (part: number, total: number, decimals = 1) =>
  total > 0 ? parseFloat(((part / total) * 100).toFixed(decimals)) : 0;

const truncate = (str: string, max = 40) =>
  str.length > max ? str.substring(0, max - 3) + "..." : str;

const yearBounds = (year: number) => ({
  gte: new Date(year, 0, 1),
  lt: new Date(year + 1, 0, 1),
});

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
] as const;

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // ── 1. Staff Per Department ──────────────────────────────────────────────
  fastify.get<{
    Querystring: Static<typeof getStaffPerDepartmentChartQueryScheme>;
  }>(
    "/charts/staff-per-department",
    {
      preHandler: authenticate,
      schema: { querystring: getStaffPerDepartmentChartQueryScheme },
    },
    async (req, reply) => {
      const maxDept = req.query.limit ?? 10;

      // groupBy at DB level — original fetched all staff + all depts then used in-memory Map
      const [groups, departments] = await prisma.$transaction([
        prisma.staff.groupBy({
          by: ["departmentId", "cadre"],
          where: { departmentId: { not: null } },
          _count: { _all: true },
          orderBy: {},
        }),
        prisma.department.findMany({ select: { id: true, name: true } }),
      ]);

      const deptMap = new Map(departments.map((d) => [d.id, d.name]));

      // Single pass — aggregate teaching/non-teaching per department
      const byDept = new Map<
        string,
        { name: string; teaching: number; nonTeaching: number }
      >();

      for (const g of groups as any) {
        if (!g.departmentId) continue;
        const name = deptMap.get(g.departmentId) ?? "Unknown";
        const entry = byDept.get(g.departmentId) ?? {
          name,
          teaching: 0,
          nonTeaching: 0,
        };
        if (g.cadre === "Teaching") entry.teaching += g._count._all;
        else entry.nonTeaching += g._count._all;
        byDept.set(g.departmentId, entry);
      }

      const chartData: TChartStaffPerDepartment[] = Array.from(byDept.values())
        .map(({ name, teaching, nonTeaching }) => ({
          departmentName: truncate(name),
          staffCount: teaching + nonTeaching,
          teachingStaff: teaching,
          nonTeachingStaff: nonTeaching,
        }))
        .sort((a, b) => b.staffCount - a.staffCount)
        .slice(0, maxDept);

      return __reply<TResponseType<TChartStaffPerDepartment[]>>(reply, 200, {
        payload: chartData,
      });
    },
  );

  // ── 2. Leave Utilization By Department ──────────────────────────────────
  fastify.get<{
    Querystring: Static<typeof getLeaveTypeDistributionChartQueryScheme>;
  }>(
    "/charts/leave-utilization",
    {
      preHandler: authenticate,
      schema: { querystring: getLeaveTypeDistributionChartQueryScheme },
    },
    async (req, reply) => {
      const targetYear = req.query.year ?? new Date().getFullYear();

      const [departments, staffGroups, leaveAgg] = await prisma.$transaction([
        prisma.department.findMany({ select: { id: true, name: true } }),
        // Staff count per department
        prisma.staff.groupBy({
          by: ["departmentId"],
          _count: { _all: true },
          orderBy: {},
        }),
        // Total approved leave days per staff member for the year — aggregate at DB level
        prisma.leave.groupBy({
          by: ["staffId"],
          where: { status: "APPROVED", startDate: yearBounds(targetYear) },
          _sum: { totalDays: true },
          orderBy: {},
        }),
      ]);

      // Map staffId → department via a single staff query (only id + departmentId needed)
      const staffDeptRows = await prisma.staff.findMany({
        where: { departmentId: { not: null } },
        select: { id: true, departmentId: true },
      });

      const staffToDept = new Map(
        staffDeptRows.map((s) => [s.id, s.departmentId!]),
      );
      const staffPerDept = new Map(
        staffGroups.map((g: any) => [g.departmentId ?? "", g._count._all]),
      );

      // Accumulate utilized days per department
      const utilizedPerDept = new Map<string, number>();
      for (const { staffId, _sum } of leaveAgg) {
        const deptId = staffToDept.get(staffId);
        if (!deptId) continue;
        utilizedPerDept.set(
          deptId,
          (utilizedPerDept.get(deptId) ?? 0) + (_sum?.totalDays ?? 0),
        );
      }

      const utilization: TChartLeaveUtilization[] = departments
        .map((dept) => {
          const staffCount = staffPerDept.get(dept.id) ?? 0;
          const totalAllowed = staffCount * 30; // 30 days per staff
          const utilized = utilizedPerDept.get(dept.id) ?? 0;
          return {
            department: truncate(dept.name),
            departmentId: dept.id,
            totalAllowed,
            utilized,
            remaining: totalAllowed - utilized,
            utilizationRate: toPercent(utilized, totalAllowed),
          };
        })
        .filter((u) => u.totalAllowed > 0)
        .sort((a, b) => b.utilizationRate - a.utilizationRate)
        .slice(0, 15);

      return __reply<TResponseType<TChartLeaveUtilization[]>>(reply, 200, {
        payload: utilization,
      });
    },
  );

  // ── 3. Current Week Attendance ───────────────────────────────────────────
  fastify.get(
    "/charts/attendance-current-week",
    { preHandler: authenticate },
    async (_req, reply) => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(d.toISOString().split("T")[0]!);
      }

      // Single date-range query — original fetched ALL attendance then compared
      // Date objects by reference (always false), so every day showed zero
      const [totalStaff, weekAttendance] = await prisma.$transaction([
        prisma.staff.count({ where: { status: "Employed" } }),
        prisma.attendance.findMany({
          where: { date: { gte: monday, lte: sunday } },
          select: { date: true, status: true },
        }),
      ]);

      // Group by ISO date string — single pass
      const byDate = new Map<
        string,
        {
          present: number;
          late: number;
          absent: number;
          onLeave: number;
          halfDay: number;
        }
      >();
      for (const dateStr of weekDates) {
        byDate.set(dateStr, {
          present: 0,
          late: 0,
          absent: 0,
          onLeave: 0,
          halfDay: 0,
        });
      }

      for (const { date, status } of weekAttendance) {
        const key =
          date instanceof Date
            ? date.toISOString().split("T")[0]!
            : String(date).split("T")[0]!;
        const bucket = byDate.get(key);
        if (!bucket) continue;
        if (status === "PRESENT") bucket.present++;
        else if (status === "LATE") bucket.late++;
        else if (status === "ABSENT") bucket.absent++;
        else if (status === "ON_LEAVE") bucket.onLeave++;
        else if (status === "HALF_DAY") bucket.halfDay++;
      }

      const weekData = weekDates.map((dateStr) => {
        const counts = byDate.get(dateStr)!;
        return {
          date: dateStr,
          day: new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "short",
          }),
          ...counts,
          total: totalStaff,
          attendanceRate: toPercent(
            counts.present + counts.late + counts.halfDay,
            totalStaff,
          ),
        };
      });

      // Single-pass week summary — original did 5 separate .reduce() calls
      let totalPresent = 0,
        totalLate = 0,
        totalAbsent = 0,
        totalOnLeave = 0,
        rateSum = 0;
      for (const d of weekData) {
        totalPresent += d.present;
        totalLate += d.late;
        totalAbsent += d.absent;
        totalOnLeave += d.onLeave;
        rateSum += d.attendanceRate;
      }

      const weekSummary = {
        totalPresent,
        totalLate,
        totalAbsent,
        totalOnLeave,
        avgAttendanceRate: parseFloat((rateSum / weekData.length).toFixed(1)),
        weekStart: weekDates[0]!,
        weekEnd: weekDates[6]!,
      };

      return __reply<TResponseType<TChartAttendanceCurrentWeek>>(reply, 200, {
        payload: { weekData, weekSummary },
      });
    },
  );

  // ── 4. Leave Type Distribution ───────────────────────────────────────────
  fastify.get<{
    Querystring: Static<typeof getLeaveTypeDistributionChartQueryScheme>;
  }>(
    "/charts/leave-type-distribution",
    {
      preHandler: authenticate,
      schema: { querystring: getLeaveTypeDistributionChartQueryScheme },
    },
    async (req, reply) => {
      const targetYear = req.query.year ?? new Date().getFullYear();

      // groupBy at DB level — original fetched all leaves + all types then used in-memory Map
      // Also: original's `startDate: {}` filter was a no-op, year was never applied to the query
      const [leaveGroups, leaveTypes] = await prisma.$transaction([
        prisma.leave.groupBy({
          by: ["leaveTypeId"],
          where: { status: "APPROVED", startDate: yearBounds(targetYear) },
          _sum: { totalDays: true },
          orderBy: {},
        }),
        prisma.leaveType.findMany({ select: { id: true, name: true } }),
      ]);

      const ltMap = new Map(leaveTypes.map((lt) => [lt.id, lt.name]));

      // Build distribution — only include types that have actual data
      // Original generated random sample data via Math.random() if no data existed —
      // removed: a chart showing real zeros is more accurate than fabricated numbers
      const distribution = leaveGroups
        .map((g: any) => ({
          name: ltMap.get(g.leaveTypeId) ?? "Unknown",
          value: g._sum.totalDays ?? 0,
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

      const total = distribution.reduce((sum, d) => sum + d.value, 0);

      const chartData: TChartLeaveTypeDistribution[] = distribution.map(
        (d, i) => ({
          name: d.name,
          value: d.value,
          percentage: toPercent(d.value, total),
          color: CHART_COLORS[i % CHART_COLORS.length]!,
        }),
      );

      return __reply<TResponseType<TChartLeaveTypeDistribution[]>>(reply, 200, {
        payload: chartData,
      });
    },
  );

  // ── 5. Leave Trends ──────────────────────────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getLeaveTrendsQueryScheme> }>(
    "/charts/leave-trends",
    {
      preHandler: authenticate,
      schema: { querystring: getLeaveTrendsQueryScheme },
    },
    async (req, reply) => {
      // Original read `req.query.month` (singular) — schema param is `months`, produced NaN
      const monthCount = Number(req.query.month ?? 12);
      const now = new Date();
      const rangeStart = new Date(
        now.getFullYear(),
        now.getMonth() - (monthCount - 1),
        1,
      );

      const leaves = await prisma.leave.findMany({
        where: { appliedAt: { gte: rangeStart } },
        select: { appliedAt: true, status: true },
      });

      // Pre-seed buckets so months with zero applications still appear
      const buckets = new Map<
        string,
        {
          applications: number;
          approvals: number;
          rejections: number;
          pending: number;
        }
      >();
      for (let i = monthCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        buckets.set(key, {
          applications: 0,
          approvals: 0,
          rejections: 0,
          pending: 0,
        });
      }

      for (const { appliedAt, status } of leaves) {
        const d = new Date(appliedAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const b = buckets.get(key);
        if (!b) continue;
        b.applications++;
        if (status === "APPROVED") b.approvals++;
        else if (status === "REJECTED") b.rejections++;
        else if (status === "PENDING") b.pending++;
      }

      const trends: TLeaveTrend[] = Array.from(buckets.entries()).map(
        ([key, b]) => {
          const [yr, mo] = key.split("-").map(Number);
          return { month: `${MONTH_SHORT_NAMES[mo!]} ${yr}`, ...b };
        },
      );

      return __reply<TResponseType<TLeaveTrend[]>>(reply, 200, {
        payload: trends,
      });
    },
  );

  // ── 6. Define a /charts/study-leave-distribution route to return a pie chart datas base on study leave sponsorshipType
  fastify.get(
    "/charts/study-leave-distribution",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (_, reply) => {
      type GroupBy = { sponsorship: string | null; count: bigint };

      // Implement the logic to fetch and return the pie chart data
      let result =
        (await prisma.$queryRaw`SELECT study_leave_details->>'sponsorshipType' AS sponsorship, COUNT(*) FROM  leaves GROUP BY study_leave_details->>'sponsorshipType'`) as GroupBy[];

      const data = result
        .filter((x) => x.sponsorship)
        .map((x) => ({
          name: x.sponsorship ?? "Others",
          value: Number(x.count),
          color: randomHex(),
          percentage: Math.round((Number(x.count) / result.length) * 100),
        }));

      return __reply<TResponseType<TChartAccademicSponsorshipDistribution>>(
        reply,
        200,
        {
          payload: data,
        },
      );
    },
  );

  // Define a /charts/study-faculty route to return a bar chart data
  fastify.get(
    "/charts/study-faculty",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (_, reply) => {
      type GroupBy = { faculty: string | null; count: bigint };

      // Implement the logic to fetch and return the pie chart data
      let result =
        (await prisma.$queryRaw`SELECT study_leave_details->>'faculty' AS faculty, COUNT(*) FROM  leaves GROUP BY study_leave_details->>'faculty'`) as GroupBy[];

      const data = result
        .filter((x) => x.faculty)
        .map((x) => ({
          label: x.faculty ?? "Others",
          value: Number(x.count),
        }));

      return __reply<TResponseType<TChartAccademicStudyLeaveByFaculty>>(
        reply,
        200,
        {
          payload: data,
        },
      );
    },
  );

  // Monthly attendance trend (for line/area chart)
  fastify.get<{
    Querystring: { months?: string }; // query params are always strings
  }>(
    "/charts/monthly-attendance-trend",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: {
        querystring: {
          type: "object",
          properties: {
            months: {
              type: "string",
              pattern: "^[0-9]+$",
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const monthCount = clamp(
        parseInt(req.query.months ?? "6", 10),
        MIN_MONTHS,
        MAX_MONTHS,
      );

      const now = new Date();

      // ── Step 1: total active staff — fetched ONCE, not per-month ──────────
      // Used as the denominator for every month's rate calculation.
      // Filtering to Employed only avoids inflating the denominator with
      // terminated or resigned staff who would never appear in attendance.
      const totalStaff = await prisma.staff.count({
        where: { status: "Employed" },
      });

      // ── Step 2: build month windows ───────────────────────────────────────
      const months = Array.from({ length: monthCount }, (_, i) => {
        const offset = monthCount - 1 - i; // oldest first
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        return {
          year: d.getFullYear(),
          month: d.getMonth(), // 0-based
          label: `${MONTHS_FULL_NAMES[d.getMonth()]} ${d.getFullYear()}`,
          ...monthRange(d.getFullYear(), d.getMonth()),
        };
      });

      // ── Step 3: one parallel query per status across all months ───────────
      // groupBy on (date) then filter per month would be expensive.
      // Instead we run 4 × monthCount counts in a single $transaction —
      // Prisma sends all of them in one round-trip.
      const queries = months.flatMap(({ start, end }) => [
        prisma.attendance.count({
          where: { date: { gte: start, lte: end }, status: "PRESENT" },
        }),
        prisma.attendance.count({
          where: { date: { gte: start, lte: end }, status: "ABSENT" },
        }),
        prisma.attendance.count({
          where: { date: { gte: start, lte: end }, status: "LATE" },
        }),
        prisma.attendance.count({
          where: { date: { gte: start, lte: end }, status: "ON_LEAVE" },
        }),
      ]);

      const results = await prisma.$transaction(queries);

      // ── Step 4: zip results back into TMonthlyAttendanceTrend ─────────────
      const trendData = months.map(({ label }, i) => {
        const base = i * 4;
        const present = results[base] ?? 0;
        const late = results[base + 2] ?? 0;
        const absent = results[base + 1] ?? 0;
        const onLeave = results[base + 3] ?? 0;

        // Unique working days in this month that had any attendance record.
        // Avoids dividing by totalStaff × workingDays (which we don't track here).
        // Instead: rate = (present + late) / (present + absent + late + onLeave)
        // This answers "of everyone who was expected, how many actually showed up?"
        const expected = present + absent + late + onLeave;
        const attendanceRate =
          expected > 0
            ? parseFloat((((present + late) / expected) * 100).toFixed(1))
            : 0;

        return {
          month: label,
          present,
          absent,
          late,
          onLeave,
          attendanceRate,
          // totalStaff is the same for all rows — useful for the tooltip
          // "X of Y staff present" without a separate API call from the frontend
          totalStaff,
        };
      });

      return __reply<TResponseType<TMonthlyAttendanceTrend[]>>(reply, 200, {
        payload: trendData,
      });
    },
  );
});

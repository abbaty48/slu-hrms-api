import type {
  AnalyticsSummary,
  ExportReportData,
  MonthlyLeaveData,
  StaffCategoryData,
  YearOverYearGrowth,
  StaffDepartmentData,
  PayrollBreakdownData,
  LeaveTypeDistribution,
  DepartmentPerformance,
  StaffStrengthYearData,
} from "#types/analyticTypes.ts";
import fastifyPlugin from "fastify-plugin";
import { __reply } from "#utils/utils_helper.ts";
import type { TResponseType } from "#types/responseType.ts";
import { Cadre, StaffStatus } from "../../generated/prisma/enums.ts";

// ── Helpers ────────────────────────────────────────────────────────────────

function clampMonths(raw: string | undefined, def = 6, max = 24): number {
  const n = parseInt(raw ?? String(def), 10);
  return isNaN(n) ? def : Math.min(Math.max(1, n), max);
}

function monthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function pct(num: number, den: number, dp = 1): number {
  return den > 0 ? parseFloat(((num / den) * 100).toFixed(dp)) : 0;
}

function toMillions(n: number | null, dp = 2): number {
  return parseFloat(((n ?? 0) / 1_000_000).toFixed(dp));
}

// ── Plugin ─────────────────────────────────────────────────────────────────

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // ── 1. Staff Strength Over Years ─────────────────────────────────────────
  fastify.get<{
    Querystring: { startYear?: string; endYear?: string };
  }>(
    "/analytics/staff-strength-years",
    { preHandler: authenticate },
    async (request, reply) => {
      const currentYear = new Date().getFullYear();
      const start = Math.max(
        2000,
        parseInt(request.query.startYear ?? String(currentYear - 4), 10),
      );
      const end = Math.min(
        currentYear,
        parseInt(request.query.endYear ?? String(currentYear), 10),
      );

      // One query per year using $transaction — no full table scan in JS
      const queries = [];
      for (let yr = start; yr <= end; yr++) {
        const yearEnd = new Date(yr, 11, 31, 23, 59, 59, 999);
        queries.push(
          prisma.staff.count({
            where: {
              status: StaffStatus.Employed,
              createdAt: { lte: yearEnd },
              gender: "Male",
            },
          }),
          prisma.staff.count({
            where: {
              status: StaffStatus.Employed,
              createdAt: { lte: yearEnd },
              gender: "Female",
            },
          }),
        );
      }

      const results = await prisma.$transaction(queries);

      const yearData: StaffStrengthYearData[] = [];
      for (let i = 0; i <= end - start; i++) {
        const male = results[i * 2]!;
        const female = results[i * 2 + 1]!;
        yearData.push({
          year: String(start + i),
          Male: male,
          Female: female,
          total: male + female,
        });
      }

      return __reply<TResponseType<StaffStrengthYearData[]>>(reply, 200, {
        payload: yearData,
      });
    },
  );

  // ── 2. Staff by Category ─────────────────────────────────────────────────
  fastify.get<{
    Querystring: { departmentId?: string };
  }>(
    "/analytics/staff-by-category",
    { preHandler: authenticate },
    async (request, reply) => {
      const { departmentId } = request.query;
      const deptFilter = departmentId ? { departmentId } : {};

      const [teaching, nonTeaching, administrative, technical] =
        await prisma.$transaction([
          prisma.staff.count({
            where: {
              status: StaffStatus.Employed,
              cadre: Cadre.Teaching,
              ...deptFilter,
            },
          }),
          prisma.staff.count({
            where: {
              status: StaffStatus.Employed,
              cadre: Cadre.Non_Teaching,
              ...deptFilter,
            },
          }),
          prisma.staff.count({
            where: {
              status: StaffStatus.Employed,
              cadre: Cadre.Administrative,
              ...deptFilter,
            },
          }),
          prisma.staff.count({
            where: {
              status: StaffStatus.Employed,
              cadre: Cadre.Technical,
              ...deptFilter,
            },
          }),
        ]);

      const data: StaffCategoryData[] = [
        { name: "Academic", value: teaching, fill: "#f59e0b" },
        { name: "Non-Academic", value: nonTeaching, fill: "#ef4444" },
        { name: "Administrative", value: administrative, fill: "#3b82f6" },
        { name: "Technical", value: technical, fill: "#10b981" },
      ].filter((d) => d.value > 0); // omit empty slices from the pie

      return __reply<TResponseType<StaffCategoryData[]>>(reply, 200, {
        payload: data,
      });
    },
  );

  // ── 3. Staff by Department ───────────────────────────────────────────────
  fastify.get<{
    Querystring: { limit?: string };
  }>(
    "/analytics/staff-by-department",
    { preHandler: authenticate },
    async (request, reply) => {
      const limit = Math.min(
        50,
        Math.max(1, parseInt(request.query.limit ?? "10", 10)),
      );

      // groupBy pushes the counting to Postgres — no JS iteration over all rows
      const grouped = await prisma.staff.groupBy({
        by: ["departmentId"],
        where: { status: StaffStatus.Employed, departmentId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { departmentId: "desc" } },
        take: limit,
      });

      const deptIds = grouped
        .map((g) => g.departmentId)
        .filter((id): id is string => id !== null);

      const departments = await prisma.department.findMany({
        where: { id: { in: deptIds } },
        select: { id: true, name: true },
      });

      const nameMap = new Map(departments.map((d) => [d.id, d.name]));

      const data: StaffDepartmentData[] = grouped.map((g) => ({
        department: nameMap.get(g.departmentId!) ?? "Unknown",
        staffCount: g._count._all,
      }));

      return __reply<TResponseType<StaffDepartmentData[]>>(reply, 200, {
        payload: data,
      });
    },
  );

  // ── 4. Monthly Leave Usage Trend ─────────────────────────────────────────
  fastify.get<{
    Querystring: { months?: string };
  }>(
    "/analytics/monthly-leave-usage",
    { preHandler: authenticate },
    async (request, reply) => {
      const monthCount = clampMonths(request.query.months);
      const now = new Date();

      const months = Array.from({ length: monthCount }, (_, i) => {
        const offset = monthCount - 1 - i;
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        return {
          label: d.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          ...monthBounds(d.getFullYear(), d.getMonth()),
        };
      });

      // Fetch only approved leaves that overlap the full window in one query
      const windowStart = months[0]!.start;
      const windowEnd = months[months.length - 1]!.end;

      const approvedLeaves = await prisma.leave.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: windowEnd },
          endDate: { gte: windowStart },
        },
        select: { startDate: true, endDate: true, totalDays: true },
      });

      const data: MonthlyLeaveData[] = months.map(({ label, start, end }) => {
        let leaveDays = 0;

        for (const leave of approvedLeaves) {
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);

          // Only count days that fall within this specific month
          if (leaveStart > end || leaveEnd < start) continue;

          const clampedStart = leaveStart < start ? start : leaveStart;
          const clampedEnd = leaveEnd > end ? end : leaveEnd;
          const days =
            Math.floor(
              (clampedEnd.getTime() - clampedStart.getTime()) / 86_400_000,
            ) + 1;
          leaveDays += Math.max(0, days);
        }

        return { month: label, "Leave Days Used": leaveDays };
      });

      return __reply<TResponseType<MonthlyLeaveData[]>>(reply, 200, {
        payload: data,
      });
    },
  );

  // ── 5. Payroll Breakdown (Monthly) ───────────────────────────────────────
  fastify.get<{
    Querystring: { months?: string };
  }>(
    "/analytics/payroll-breakdown",
    { preHandler: authenticate },
    async (request, reply) => {
      const monthCount = clampMonths(request.query.months);
      const now = new Date();

      const months = Array.from({ length: monthCount }, (_, i) => {
        const offset = monthCount - 1 - i;
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        return {
          label: d.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          ...monthBounds(d.getFullYear(), d.getMonth()),
        };
      });

      const windowStart = months[0]!.start;
      const windowEnd = months[months.length - 1]!.end;

      // Aggregate real payroll totals per month from the payrolls table
      const payrolls = await prisma.payroll.findMany({
        where: {
          month: { gte: windowStart, lte: windowEnd },
          status: { not: "DRAFT" }, // only processed/paid payrolls
        },
        select: {
          month: true,
          totalAllowances: true,
          totalDeductions: true,
          grossSalary: true,
          netSalary: true,
        },
      });

      const data: PayrollBreakdownData[] = months.map(
        ({ label, start, end }) => {
          const monthPayrolls = payrolls.filter((p) => {
            const d = new Date(p.month);
            return d >= start && d <= end;
          });

          const sumField = (
            field: "grossSalary" | "totalAllowances" | "totalDeductions",
          ) => monthPayrolls.reduce((acc, p) => acc + Number(p[field]), 0);

          return {
            month: label,
            Salary: toMillions(sumField("grossSalary")),
            Allowances: toMillions(sumField("totalAllowances")),
            Deductions: toMillions(sumField("totalDeductions")),
          };
        },
      );

      return __reply<TResponseType<PayrollBreakdownData[]>>(reply, 200, {
        payload: data,
      });
    },
  );

  // ── 6. Analytics Summary ─────────────────────────────────────────────────
  fastify.get<{
    Querystring: { departmentId?: string; year?: string };
  }>(
    "/analytics/summary",
    { preHandler: authenticate },
    async (request, reply) => {
      const { departmentId } = request.query;
      const currentYear = parseInt(
        request.query.year ?? String(new Date().getFullYear()),
        10,
      );

      const deptFilter = departmentId ? { departmentId } : {};
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

      const [
        totalStaff,
        maleStaff,
        femaleStaff,
        teachingStaff,
        nonTeachingStaff,
        adminStaff,
        totalLeaves,
        approvedLeaves,
        pendingLeaves,
        rejectedLeaves,
        payrollAgg,
      ] = await prisma.$transaction([
        prisma.staff.count({
          where: { status: StaffStatus.Employed, ...deptFilter },
        }),
        prisma.staff.count({
          where: {
            status: StaffStatus.Employed,
            gender: "Male",
            ...deptFilter,
          },
        }),
        prisma.staff.count({
          where: {
            status: StaffStatus.Employed,
            gender: "Female",
            ...deptFilter,
          },
        }),
        prisma.staff.count({
          where: {
            status: StaffStatus.Employed,
            cadre: Cadre.Teaching,
            ...deptFilter,
          },
        }),
        prisma.staff.count({
          where: {
            status: StaffStatus.Employed,
            cadre: Cadre.Non_Teaching,
            ...deptFilter,
          },
        }),
        prisma.staff.count({
          where: {
            status: StaffStatus.Employed,
            cadre: Cadre.Administrative,
            ...deptFilter,
          },
        }),
        // Leave counts scoped to the selected year
        prisma.leave.count({
          where: {
            startDate: { gte: yearStart, lte: yearEnd },
            ...(departmentId ? { staff: { departmentId } } : {}),
          },
        }),
        prisma.leave.count({
          where: {
            status: "APPROVED",
            startDate: { gte: yearStart, lte: yearEnd },
            ...(departmentId ? { staff: { departmentId } } : {}),
          },
        }),
        prisma.leave.count({
          where: {
            status: "PENDING",
            startDate: { gte: yearStart, lte: yearEnd },
            ...(departmentId ? { staff: { departmentId } } : {}),
          },
        }),
        prisma.leave.count({
          where: {
            status: "REJECTED",
            startDate: { gte: yearStart, lte: yearEnd },
            ...(departmentId ? { staff: { departmentId } } : {}),
          },
        }),
        // Real payroll aggregates for the year — not fabricated averages
        prisma.payroll.aggregate({
          _sum: {
            grossSalary: true,
            totalAllowances: true,
            totalDeductions: true,
            netSalary: true,
          },
          where: {
            month: { gte: yearStart, lte: yearEnd },
            status: { not: "DRAFT" },
            ...(departmentId ? { staff: { departmentId } } : {}),
          },
        }),
      ]);

      // Total leave days for approved leaves — aggregate in DB, not JS reduce
      const leaveDaysAgg = await prisma.leave.aggregate({
        _sum: { totalDays: true },
        where: {
          status: "APPROVED",
          startDate: { gte: yearStart, lte: yearEnd },
          ...(departmentId ? { staff: { departmentId } } : {}),
        },
      });

      const summary: AnalyticsSummary = {
        staff: {
          total: totalStaff,
          male: maleStaff,
          female: femaleStaff,
          teaching: teachingStaff,
          nonTeaching: nonTeachingStaff,
          admin: adminStaff,
        },
        leave: {
          total: totalLeaves,
          approved: approvedLeaves,
          pending: pendingLeaves,
          rejected: rejectedLeaves,
          totalDays: leaveDaysAgg._sum.totalDays ?? 0,
        },
        payroll: {
          annualSalary: toMillions(Number(payrollAgg._sum.grossSalary)),
          annualAllowances: toMillions(Number(payrollAgg._sum.totalAllowances)),
          annualDeductions: toMillions(Number(payrollAgg._sum.totalDeductions)),
          netPayroll: toMillions(Number(payrollAgg._sum.netSalary)),
        },
        year: currentYear,
      };

      return __reply<TResponseType<AnalyticsSummary>>(reply, 200, {
        payload: summary,
      });
    },
  );

  // ── 7. Department Performance ────────────────────────────────────────────
  fastify.get(
    "/analytics/department-performance",
    { preHandler: authenticate },
    async (_request, reply) => {
      // All data resolved in Postgres — no JS cross-filtering of two large arrays
      const departments = await prisma.department.findMany({
        select: {
          id: true,
          name: true,
          staff: {
            where: { status: StaffStatus.Employed },
            select: { gender: true, cadre: true, id: true },
          },
          _count: {
            select: { staff: { where: { status: StaffStatus.Employed } } },
          },
        },
        orderBy: { staff: { _count: "desc" } },
      });

      // Leave counts per department — one query, not one per dept
      const leaveCounts = await prisma.leave.groupBy({
        by: ["staffId"],
        _count: { _all: true },
        where: {
          status: { in: ["APPROVED", "PENDING", "REJECTED", "CANCELLED"] },
        },
      });

      // Build staffId → departmentId lookup from the dept query result above
      const staffDeptMap = new Map<string, string>();
      for (const d of departments) {
        for (const s of d.staff) staffDeptMap.set(s.id, d.id);
      }

      // Aggregate leave counts per department
      const deptLeaveTotal = new Map<string, number>();
      const deptLeaveApproved = new Map<string, number>();

      const allLeaveStats = await prisma.leave.groupBy({
        by: ["staffId"],
        _count: { _all: true },
        where: {},
      });
      const approvedLeaveStats = await prisma.leave.groupBy({
        by: ["staffId"],
        _count: { _all: true },
        where: { status: "APPROVED" },
      });

      for (const row of allLeaveStats) {
        const deptId = staffDeptMap.get(row.staffId);
        if (deptId)
          deptLeaveTotal.set(
            deptId,
            (deptLeaveTotal.get(deptId) ?? 0) + row._count._all,
          );
      }
      for (const row of approvedLeaveStats) {
        const deptId = staffDeptMap.get(row.staffId);
        if (deptId)
          deptLeaveApproved.set(
            deptId,
            (deptLeaveApproved.get(deptId) ?? 0) + row._count._all,
          );
      }

      const data: DepartmentPerformance[] = departments.map((dept) => {
        const total = deptLeaveTotal.get(dept.id) ?? 0;
        const approved = deptLeaveApproved.get(dept.id) ?? 0;

        return {
          department: dept.name,
          staffCount: dept._count.staff,
          male: dept.staff.filter((s) => s.gender === "Male").length,
          female: dept.staff.filter((s) => s.gender === "Female").length,
          teaching: dept.staff.filter((s) => s.cadre === Cadre.Teaching).length,
          nonTeaching: dept.staff.filter((s) => s.cadre === Cadre.Non_Teaching)
            .length,
          totalLeaves: total,
          approvedLeaves: approved,
          leaveApprovalRate: pct(approved, total),
        };
      });

      return __reply<TResponseType<DepartmentPerformance[]>>(reply, 200, {
        payload: data,
      });
    },
  );

  // ── 8. Year-over-Year Growth ─────────────────────────────────────────────
  fastify.get<{
    Querystring: { years?: string };
  }>(
    "/analytics/year-over-year-growth",
    { preHandler: authenticate },
    async (request, reply) => {
      const currentYear = new Date().getFullYear();
      const span = Math.min(
        10,
        Math.max(2, parseInt(request.query.years ?? "3", 10)),
      );
      const years = Array.from(
        { length: span },
        (_, i) => currentYear - (span - 1) + i,
      );

      // One count per year in a single $transaction
      const counts = await prisma.$transaction(
        years.map((yr) =>
          prisma.staff.count({
            where: {
              createdAt: { lte: new Date(yr, 11, 31, 23, 59, 59, 999) },
            },
          }),
        ),
      );

      const growthData: YearOverYearGrowth[] = years.map((yr, i) => {
        const totalStaff = counts[i]!;
        const prev = i > 0 ? counts[i - 1]! : null;
        return {
          year: String(yr),
          totalStaff,
          growth: prev !== null ? totalStaff - prev : 0,
          growthRate: prev !== null ? pct(totalStaff - prev, prev, 2) : 0,
        };
      });

      return __reply<TResponseType<YearOverYearGrowth[]>>(reply, 200, {
        payload: growthData,
      });
    },
  );

  // ── 9. Leave Type Distribution ───────────────────────────────────────────
  fastify.get<{
    Querystring: { year?: string };
  }>(
    "/analytics/leave-type-distribution",
    { preHandler: authenticate },
    async (request, reply) => {
      const yr = parseInt(
        request.query.year ?? String(new Date().getFullYear()),
        10,
      );
      const yearStart = new Date(yr, 0, 1);
      const yearEnd = new Date(yr, 11, 31, 23, 59, 59, 999);

      // groupBy in Postgres — no full table scan in JS
      const grouped = await prisma.leave.groupBy({
        by: ["leaveTypeId"],
        _count: { _all: true },
        where: {
          status: "APPROVED",
          startDate: { gte: yearStart, lte: yearEnd },
        },
        orderBy: { _count: { leaveTypeId: "desc" } },
      });

      if (grouped.length === 0) {
        return __reply<TResponseType<LeaveTypeDistribution[]>>(reply, 200, {
          payload: [],
        });
      }

      const total = grouped.reduce((s, g) => s + g._count._all, 0);
      const typeIds = grouped.map((g) => g.leaveTypeId);
      const types = await prisma.leaveType.findMany({
        where: { id: { in: typeIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(types.map((t) => [t.id, t.name]));

      const data: LeaveTypeDistribution[] = grouped.map((g) => ({
        type: nameMap.get(g.leaveTypeId) ?? g.leaveTypeId,
        count: g._count._all,
        percentage: pct(g._count._all, total),
      }));

      return __reply<TResponseType<LeaveTypeDistribution[]>>(reply, 200, {
        payload: data,
      });
    },
  );

  // ── 10. Export Report Data ────────────────────────────────────────────────
  fastify.get<{
    Querystring: {
      departmentId?: string;
      startDate?: string;
      endDate?: string;
    };
  }>(
    "/analytics/export",
    { preHandler: authenticate },
    async (request, reply) => {
      const { departmentId, startDate, endDate } = request.query;

      const dateFilter =
        startDate && endDate
          ? { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }
          : {};

      // Select only the fields needed — avoid loading full staff rows
      const staff = await prisma.staff.findMany({
        where: {
          status: StaffStatus.Employed,
          ...(departmentId ? { departmentId } : {}),
          ...dateFilter,
        },
        select: {
          staffNo: true,
          firstName: true,
          lastName: true,
          email: true,
          gender: true,
          rank: true,
          cadre: true,
          staffCategory: true,
          status: true,
          createdAt: true,
          department: { select: { name: true } },
        },
        orderBy: { lastName: "asc" },
      });

      const enriched = staff.map((s) => ({
        staffNo: s.staffNo,
        name: `${s.firstName} ${s.lastName}`.trim(),
        email: s.email,
        gender: s.gender ?? "N/A",
        department: s.department?.name ?? "N/A",
        rank: s.rank,
        cadre: s.cadre,
        category: s.staffCategory,
        status: s.status,
        joinDate: s.createdAt.toLocaleDateString("en-GB"),
      }));

      const payload: ExportReportData = {
        generatedAt: new Date().toISOString(),
        totalRecords: enriched.length,
        filters: { departmentId, startDate, endDate },
        data: enriched,
      };

      return __reply<TResponseType<ExportReportData>>(reply, 200, { payload });
    },
  );
});

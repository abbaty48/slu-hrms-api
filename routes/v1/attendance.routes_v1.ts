import type {
  TAttendanceDeptStats,
  TAttendanceListPayload,
  TAttendanceMark,
  TAttendanceRecord,
  TAttendanceReport,
  TAttendanceStats,
  TStaffReportEntry,
  TTodayStats,
} from "#types/attendance.types.ts";
import {
  putAttendanceBodySchema,
  getAttendanceQueryScheme,
  postAttendanceMarkBodyScheme,
  getAttendanceStaffQueryScheme,
  getAttendanceReportQueryScheme,
  postAttendanceBulkMarkBodyScheme,
  getAttendanceDeptStatsQueryScheme,
} from "#schemas/attendance.schemas.ts";
import {
  __pagination,
  __reply,
  errReply,
  idGenerator,
} from "#utils/utils_helper.ts";
import type { AttendanceStatus } from "../../generated/prisma/enums.ts";
import type { ErrorResponseType } from "#types/errorResponseType.ts";
import type { TResponseType } from "#types/responseType.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { Static } from "@sinclair/typebox";
import fastifyPlugin from "fastify-plugin";

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const toDate = (v: string) => new Date(v);

/**
 * Calculates work hours between checkIn and checkOut.
 * Handles both time strings ("09:00") and full Date objects.
 */
const calcWorkHours = (
  date: string | Date,
  checkIn: string | Date | null,
  checkOut: string | Date | null,
): number => {
  if (!checkIn || !checkOut) return 0;
  const inTime =
    checkIn instanceof Date ? checkIn : new Date(`${date}T${checkIn}`);
  const outTime =
    checkOut instanceof Date ? checkOut : new Date(`${date}T${checkOut}`);
  return parseFloat(
    ((outTime.getTime() - inTime.getTime()) / 3_600_000).toFixed(2),
  );
};

const toPercent = (part: number, total: number) =>
  total > 0 ? parseFloat(((part / total) * 100).toFixed(2)) : 0;

const toAvg = (total: number, count: number) =>
  count > 0 ? parseFloat((total / count).toFixed(2)) : 0;

const newAttId = () => idGenerator("att_").toLowerCase();

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // ── 1. Mark Attendance (Single) ──────────────────────────────────────────
  fastify.post<{ Body: Static<typeof postAttendanceMarkBodyScheme> }>(
    "/attendance/mark",
    {
      preHandler: authorize(["admin"]),
      schema: { body: postAttendanceMarkBodyScheme },
    },
    async (req, reply) => {
      const { staffId, date, status, checkIn, checkOut, remarks } = req.body;

      try {
        const exists = await prisma.attendance.findFirst({
          where: { staffId, date },
          select: { id: true },
        });

        if (exists) {
          return errReply(
            reply,
            409,
            "Conflict",
            "Attendance is already marked for this date.",
          );
        }

        await prisma.attendance.create({
          data: {
            id: newAttId(),
            staffId,
            date,
            checkIn: checkIn ?? null,
            remarks: remarks ?? null,
            checkOut: checkOut ?? null,
            status: status as AttendanceStatus,
            workHours: calcWorkHours(date, checkIn ?? null, checkOut ?? null),
          },
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: "Attendance marked successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to mark attendance. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 2. Bulk Mark Attendance ──────────────────────────────────────────────
  fastify.post<{ Body: Static<typeof postAttendanceBulkMarkBodyScheme> }>(
    "/attendance/mark/bulk",
    {
      preHandler: authorize(["admin"]),
      schema: { body: postAttendanceBulkMarkBodyScheme },
    },
    async (req, reply) => {
      const records = req.body;

      try {
        // Batch duplicate check — single query instead of findMany() + in-memory scan
        const existing = await prisma.attendance.findMany({
          where: {
            OR: records.map(({ staffId, date }) => ({
              staffId,
              date: toDate(date),
            })),
          },
          select: { staffId: true, date: true },
        });

        const existingSet = new Set(
          existing.map(
            (a) => `${a.staffId}::${a.date.toISOString().split("T")[0]}`,
          ),
        );

        const failures: { index: number; reason: string }[] = [];
        const toCreate: Parameters<
          typeof prisma.attendance.createMany
        >["0"]["data"] = [];

        for (let i = 0; i < records.length; i++) {
          const { staffId, date, status, checkIn, checkOut, remarks } =
            records[i];

          if (!staffId || !date || !status) {
            failures.push({
              index: i,
              reason: "Missing required fields (staffId, date, status).",
            });
            continue;
          }

          if (existingSet.has(`${staffId}::${date}`)) {
            failures.push({
              index: i,
              reason: "Attendance already marked for this date.",
            });
            continue;
          }

          toCreate.push({
            id: newAttId(),
            staffId,
            date: toDate(date),
            status: status as AttendanceStatus,
            checkIn: checkIn ? toDate(checkIn) : null,
            checkOut: checkOut ? toDate(checkOut) : null,
            remarks: remarks ?? null,
            workHours: calcWorkHours(date, checkIn ?? null, checkOut ?? null),
          });
        }

        if (failures.length > 0) {
          return __reply<ErrorResponseType>(reply, 400, {
            errorCode: 400,
            errorTitle: "Bulk Mark Partially Failed",
            errorMessage: `${failures.length} record(s) could not be processed.`,
            // Pass `failures` here if ErrorResponseType supports an `errorDetails` field
          });
        }

        await prisma.attendance.createMany({
          data: toCreate,
          skipDuplicates: true,
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: `${toCreate.length} attendance record(s) marked successfully.`,
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Bulk mark failed. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 3. Update Attendance ─────────────────────────────────────────────────
  fastify.patch<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putAttendanceBodySchema>;
  }>(
    "/attendance/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { body: putAttendanceBodySchema, params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { status, checkIn, checkOut, remarks } = req.body;

      try {
        const existing = await prisma.attendance.findUnique({
          where: { id },
          select: { date: true, checkIn: true, checkOut: true },
        });

        if (!existing) {
          return errReply(
            reply,
            404,
            "Not Found",
            "Attendance record not found.",
          );
        }

        // Resolve updated check times — fall back to existing DB values
        const resolvedCheckIn = checkIn ? toDate(checkIn) : existing.checkIn;
        const resolvedCheckOut = checkOut
          ? toDate(checkOut)
          : existing.checkOut;

        await prisma.attendance.update({
          where: { id },
          data: {
            ...(status && { status: status as AttendanceStatus }),
            ...(remarks !== undefined && { remarks }),
            checkIn: resolvedCheckIn,
            checkOut: resolvedCheckOut,
            workHours: calcWorkHours(
              existing.date,
              resolvedCheckIn,
              resolvedCheckOut,
            ),
          },
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Attendance updated.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to update attendance. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 4. Get Attendance Records (filtered + paginated) ─────────────────────
  fastify.get<{ Querystring: Static<typeof getAttendanceQueryScheme> }>(
    "/attendance",
    {
      preHandler: authenticate,
      schema: { querystring: getAttendanceQueryScheme },
    },
    async (req, reply) => {
      const {
        departmentId,
        startDate,
        endDate,
        staffId,
        status,
        page = 1,
        limit = 20,
      } = req.query;
      const skip = (page - 1) * limit;

      // Resolve staffId filter — departmentId lookup stays at DB level
      const staffIdFilter = departmentId
        ? (
            await prisma.staff.findMany({
              where: { departmentId },
              select: { id: true },
            })
          ).map((s) => s.id)
        : staffId
          ? [staffId]
          : undefined;

      const where = {
        ...(staffIdFilter && { staffId: { in: staffIdFilter } }),
        ...(status && { status: status as AttendanceStatus }),
        ...((startDate || endDate) && {
          date: {
            ...(startDate && { gte: toDate(startDate) }),
            ...(endDate && { lte: toDate(endDate) }),
          },
        }),
      };

      const [records, total, staffs, departments] = await prisma.$transaction([
        prisma.attendance.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: "desc" },
        }),
        prisma.attendance.count({ where }),
        prisma.staff.findMany({
          select: {
            id: true,
            staffNo: true,
            email: true,
            firstName: true,
            lastName: true,
            departmentId: true,
          },
        }),
        prisma.department.findMany({ select: { id: true, name: true } }),
      ]);

      const deptMap = new Map(departments.map((d) => [d.id, d]));
      const staffMap = new Map(staffs.map((s) => [s.id, s]));

      const data: TAttendanceRecord[] = records.map((record) => {
        const staff = staffMap.get(record.staffId);
        const dept = staff?.departmentId
          ? deptMap.get(staff.departmentId)
          : null;
        return {
          ...record,
          staff: staff
            ? {
                id: staff.id,
                staffNo: staff.staffNo,
                email: staff.email,
                name: `${staff.firstName} ${staff.lastName}`,
                department: dept ? { id: dept.id, name: dept.name } : null,
              }
            : null,
        };
      });

      return __reply<TResponseType<TAttendanceListPayload>>(reply, 200, {
        payload: {
          data,
          pagination: total > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // ── 5. Get Staff Attendance History ──────────────────────────────────────
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getAttendanceStaffQueryScheme>;
  }>(
    "/attendance/staff/:id",
    {
      preHandler: authenticate,
      schema: {
        params: getIdParamScheme,
        querystring: getAttendanceStaffQueryScheme,
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { month, year, page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      // Push month/year filter to DB instead of fetching all and slicing
      const dateFilter =
        month && year
          ? { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
          : undefined;

      const where = { staffId: id, ...(dateFilter && { date: dateFilter }) };

      const [records, total] = await prisma.$transaction([
        prisma.attendance.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: "desc" },
        }),
        prisma.attendance.count({ where }),
      ]);

      return __reply<TResponseType<TAttendanceListPayload>>(reply, 200, {
        payload: {
          data: records as TAttendanceRecord[],
          pagination: total > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // ── 7. Get Department Attendance Statistics ───────────────────────────────
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getAttendanceDeptStatsQueryScheme>;
  }>(
    "/attendance/department/:id/stats",
    {
      preHandler: authenticate,
      schema: {
        params: getIdParamScheme,
        querystring: getAttendanceDeptStatsQueryScheme,
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const [deptStaffIds, totalStaff, department] = await prisma.$transaction([
        prisma.staff.findMany({
          where: { departmentId: id },
          select: { id: true },
        }),
        prisma.staff.count({ where: { departmentId: id } }),
        prisma.department.findUnique({
          where: { id },
          select: { id: true, name: true },
        }),
      ]);

      if (!department) {
        return errReply(reply, 404, "Not Found", "Department not found.");
      }

      // Filters are AND — original had OR which was a bug
      const records = await prisma.attendance.findMany({
        where: {
          staffId: { in: deptStaffIds.map((s) => s.id) },
          ...((startDate || endDate) && {
            date: {
              ...(startDate && { gte: toDate(startDate) }),
              ...(endDate && { lte: toDate(endDate) }),
            },
          }),
        },
        select: { status: true, workHours: true },
      });

      // Single-pass count
      let present = 0,
        late = 0,
        absent = 0,
        onLeave = 0,
        halfDay = 0,
        totalWorkHours = 0;
      for (const { status, workHours } of records) {
        if (status === "PRESENT") present++;
        else if (status === "LATE") late++;
        else if (status === "ABSENT") absent++;
        else if (status === "ON_LEAVE") onLeave++;
        else if (status === "HALF_DAY") halfDay++;
        totalWorkHours += workHours ?? 0;
      }

      const stats: TAttendanceDeptStats = {
        department,
        totalStaff,
        totalRecords: records.length,
        present,
        late,
        absent,
        onLeave,
        halfDay,
        attendanceRate: toPercent(present + late + halfDay, records.length),
        avgWorkHours: toAvg(totalWorkHours, records.length),
      };

      return __reply<TResponseType<TAttendanceDeptStats>>(reply, 200, {
        payload: stats,
      });
    },
  );

  // ── 8. Get Today's Attendance Overview ───────────────────────────────────
  fastify.get(
    "/attendance/today",
    { preHandler: authenticate }, // was missing auth
    async (_req, reply) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayRecords, totalStaff, staffs, departments] =
        await prisma.$transaction([
          prisma.attendance.findMany({ where: { date: today } }),
          prisma.staff.count({ where: { status: "Employed" } }),
          prisma.staff.findMany({
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffNo: true,
              email: true,
              departmentId: true,
            },
          }),
          prisma.department.findMany({ select: { id: true, name: true } }),
        ]);

      const deptMap = new Map(departments.map((d) => [d.id, d]));
      const staffMap = new Map(staffs.map((s) => [s.id, s]));

      // Single-pass: count statuses + enrich records simultaneously
      let present = 0,
        late = 0,
        absent = 0,
        onLeave = 0,
        halfDay = 0;

      const records: TAttendanceRecord[] = todayRecords.map((record) => {
        if (record.status === "PRESENT") present++;
        else if (record.status === "LATE") late++;
        else if (record.status === "ABSENT") absent++;
        else if (record.status === "ON_LEAVE") onLeave++;
        else if (record.status === "HALF_DAY") halfDay++;

        const staff = staffMap.get(record.staffId);
        const dept = staff?.departmentId
          ? deptMap.get(staff.departmentId)
          : null;
        return {
          ...record,
          staff: staff
            ? {
                id: staff.id,
                staffNo: staff.staffNo,
                email: staff.email,
                name: `${staff.firstName} ${staff.lastName}`,
                department: dept ? { id: dept.id, name: dept.name } : null,
              }
            : null,
        };
      });

      const stats: TTodayStats = {
        date: today.toISOString().split("T")[0],
        totalStaff,
        marked: todayRecords.length,
        unmarked: totalStaff - todayRecords.length,
        present,
        late,
        absent,
        onLeave,
        halfDay,
        attendanceRate: toPercent(present + late + halfDay, totalStaff),
      };

      return __reply<TResponseType<TTodayOverview>>(reply, 200, {
        payload: { stats, records },
      });
    },
  );

  // ── 9. Delete Attendance Record ──────────────────────────────────────────
  fastify.delete<{ Params: Static<typeof getIdParamScheme> }>(
    "/attendance/:id",
    { preHandler: authorize(["admin"]), schema: { params: getIdParamScheme } },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const exists = await prisma.attendance.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!exists) {
          return errReply(
            reply,
            404,
            "Not Found",
            "Attendance record not found.",
          );
        }

        await prisma.attendance.delete({ where: { id } });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Attendance record deleted.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to delete attendance. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 10. Get Attendance Report ─────────────────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getAttendanceReportQueryScheme> }>(
    "/attendance/report",
    {
      preHandler: authenticate,
      schema: { querystring: getAttendanceReportQueryScheme },
    },
    async (req, reply) => {
      const { startDate, endDate, departmentId } = req.query;

      const [staffs, departments] = await prisma.$transaction([
        prisma.staff.findMany({
          where: departmentId ? { departmentId } : {},
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffNo: true,
            departmentId: true,
          },
        }),
        prisma.department.findMany({ select: { id: true, name: true } }),
      ]);

      const deptMap = new Map(departments.map((d) => [d.id, d]));
      const staffMap = new Map(staffs.map((s) => [s.id, s]));

      // Original used `equals` for both dates — bug; should be gte/lte
      const attendance = await prisma.attendance.findMany({
        where: {
          staffId: { in: staffs.map((s) => s.id) },
          ...((startDate || endDate) && {
            date: {
              ...(startDate && { gte: toDate(startDate) }),
              ...(endDate && { lte: toDate(endDate) }),
            },
          }),
        },
        select: { staffId: true, status: true, workHours: true },
      });

      const reportMap = new Map<string, TStaffReportEntry>();

      for (const record of attendance) {
        if (!reportMap.has(record.staffId)) {
          const staff = staffMap.get(record.staffId);
          const dept = staff?.departmentId
            ? deptMap.get(staff.departmentId)
            : null;
          reportMap.set(record.staffId, {
            staff: staff
              ? {
                  id: staff.id,
                  name: `${staff.firstName} ${staff.lastName}`,
                  staffNo: staff.staffNo,
                  department: dept ? { id: dept.id, name: dept.name } : null,
                }
              : null,
            totalDays: 0,
            present: 0,
            late: 0,
            absent: 0,
            onLeave: 0,
            halfDay: 0,
            totalWorkHours: 0,
            attendanceRate: 0,
            avgWorkHours: 0,
          });
        }

        const entry = reportMap.get(record.staffId)!;
        entry.totalDays++;
        entry.totalWorkHours += record.workHours ?? 0;
        if (record.status === "PRESENT") entry.present++;
        else if (record.status === "LATE") entry.late++;
        else if (record.status === "ABSENT") entry.absent++;
        else if (record.status === "ON_LEAVE") entry.onLeave++;
        else if (record.status === "HALF_DAY") entry.halfDay++;
      }

      const report = Array.from(reportMap.values())
        .map((d) => ({
          ...d,
          attendanceRate: toPercent(
            d.present + d.late + d.halfDay,
            d.totalDays,
          ),
          avgWorkHours: toAvg(d.totalWorkHours, d.totalDays),
        }))
        .sort((a, b) => b.attendanceRate - a.attendanceRate);

      return __reply<TResponseType<TAttendanceReport>>(reply, 200, {
        payload: {
          report,
          summary: {
            totalStaff: report.length,
            dateRange: { startDate, endDate },
            avgAttendanceRate: toAvg(
              report.reduce((sum, r) => sum + r.attendanceRate, 0),
              report.length,
            ),
          },
        },
      });
    },
  );

  // ── 11. Get Attendance Stats ──────────────────────────────────────────────
  fastify.get(
    "/attendance/stats",
    { preHandler: authenticate },
    async (_req, reply) => {
      // groupBy at DB level — avoids fetching all rows just to count
      const groups = await prisma.attendance.groupBy({
        by: ["status"],
        _count: { status: true },
      });

      const byStatus = Object.fromEntries(
        groups.map((g) => [g.status, g._count.status]),
      );

      const stats: TAttendanceStats = {
        presentToday: byStatus["PRESENT"] ?? 0,
        lateArrivals: byStatus["LATE"] ?? 0,
        onLeave: byStatus["ON_LEAVE"] ?? 0,
        absent: byStatus["ABSENT"] ?? 0,
      };

      return __reply<TResponseType<TAttendanceStats>>(reply, 200, {
        payload: stats,
      });
    },
  );
});

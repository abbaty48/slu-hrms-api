import type {
  TCadre,
  TStaffList,
  TStaffStatus,
  TStaffDetails,
  TStaffStatistics,
  TStaffEmploymentList,
} from "#types/staffTypes.ts";
import type {
  TLeaveList,
  TLeaveBalanceList,
} from "#types/leave-managementTypes.ts";
import {
  getIdParamScheme,
  getPaginQueryScheme,
  getStaffPaginQueryScheme,
  getStaffAttendanceSummaryPaginQueryScheme,
} from "#schemas/schemas.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import type { TUserRole } from "#types/userTypes.ts";
import type { TQaualificationList } from "#types/types.ts";
import type { TResponseType } from "#types/responseType.ts";
import { __pagination, __reply } from "#utils/utils_helper.ts";
import type { TAttendanceSummaryList } from "#types/attendance.types.ts";
import type { Cadre, StaffStatus } from "../../generated/prisma/enums.ts";

export default fastifyPlugin((fastify) => {
  const { prisma } = fastify;
  // Retrieve a paginated list of staffs. - GET /staffs
  fastify.get<{
    Querystring: Static<typeof getStaffPaginQueryScheme>;
  }>(
    "/staffs",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: getStaffPaginQueryScheme,
      },
    },
    async (req, reply) => {
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const { q, cadre, state, status, departmentId } = req.query;

      const skip = (page - 1) * limit;
      const clean = (v: string) => v.replace(/^"|"$/g, "").trim();

      console.log("Q: ", q);
      const where = {
        ...(q && {
          OR: [
            { rank: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { staffNo: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
          ],
        }),
        ...(state && { state: clean(state) }),
        ...(departmentId && { departmentId: clean(departmentId) }),
        ...(cadre && { cadre: clean(cadre) as Cadre }),
        ...(status && { status: clean(status) as StaffStatus }),
      };
      const [data, total] = await prisma.$transaction([
        prisma.staff.findMany({ where, skip, take: limit }),
        prisma.staff.count({ where }), // ← filtered count
      ]);

      return __reply<TResponseType<TStaffList>>(reply, 200, {
        payload: {
          data: data.map((staff) => ({
            ...staff,
            cadre: staff.cadre as TCadre,
            status: staff.status as TStaffStatus,
          })),
          pagination: __pagination(page, limit, total, skip),
        },
      });
    },
  );

  // Retrieve Staff details with department and rank details. - GET /staffs/:id/details
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/staffs/:id/details",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const staff = await fastify.prisma.staff.findUnique({
        where: { id: req.params.id },
      });

      if (!staff) {
        __reply(reply, 404, {
          payload: null,
          message: "Staff could not be found with that id.",
        });
        return;
      }

      const [department, staffCount, user, rankDetails] =
        await fastify.prisma.$transaction([
          fastify.prisma.department.findUnique({
            where: { id: staff.departmentId || "" },
          }),
          fastify.prisma.user.count({
            where: { departmentId: staff.departmentId },
          }),
          fastify.prisma.user.findUnique({
            where: { staffId: staff.id },
          }),
          fastify.prisma.rank.findUnique({
            where: { id: staff.rankId },
          }),
        ]);

      const details: TStaffDetails = {
        ...staff,
        cadre: staff.cadre as TCadre,
        status: staff.status as TStaffStatus,
        rankDetails,
        department: department
          ? {
              ...department,
              staffCount,
              headOfDepartment: department.headId,
            }
          : null,
        user: user
          ? {
              ...user,
              role: user.role as TUserRole,
            }
          : null,
      };

      return __reply<TResponseType<TStaffDetails>>(reply, 200, {
        payload: details,
      });
    },
  );

  // Retrieve a paginated list of Staff employements. - GET /staffs/:id/employment
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/:id/employment",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme, querystring: getPaginQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.params.id;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const start = (page - 1) * limit;

      const [data, total] = await fastify.prisma.$transaction([
        fastify.prisma.employmentHistory.findMany({
          where: { staffId },
          take: limit,
          skip: start,
        }),
        fastify.prisma.employmentHistory.count({
          where: { staffId },
        }),
      ]);

      return __reply<TResponseType<TStaffEmploymentList>>(reply, 200, {
        payload: {
          data,
          pagination: __pagination(page, limit, total, start),
        },
      });
    },
  );

  // Retrieve a paginated list of Staff leave balances. - GET /staffs/:id/leave-balances
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/:id/leave-balances",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme, querystring: getPaginQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.params.id;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const leaves = await prisma.leave.findMany({ where: { staffId } });
      const balances = (await prisma.leaveType.findMany({})).map((type) => {
        const used = leaves
          .filter((l) => l.leaveTypeId === type.id && l.status === "APPROVED")
          .reduce((sum, l) => sum + l.totalDays, 0);

        return {
          leaveTypeId: type.id,
          name: type.name,
          used,
          allowed: type.allowedDays,
          remaining: type.allowedDays - used,
        };
      });

      const total = balances.length;
      const start = (page - 1) * limit;
      const endIndex = start + limit;
      const data = balances.slice(start, endIndex);

      return __reply<TResponseType<TLeaveBalanceList>>(reply, 200, {
        payload: {
          data,
          pagination: __pagination(page, limit, total, start),
        },
      });
    },
  );

  // Retrieve a paginated list of Staff leaves history - GET /staffs/:id/leaves
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/:id/leaves",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme, querystring: getPaginQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.params.id;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const start = (page - 1) * limit;
      const [data, total] = await prisma.$transaction([
        prisma.leave.findMany({
          where: { staffId },
          take: limit,
          skip: start,
          orderBy: { startDate: "asc" },
        }),
        prisma.leave.count({
          where: { staffId },
        }),
      ]);

      return __reply<TResponseType<TLeaveList>>(reply, 200, {
        payload: {
          data,
          pagination: __pagination(page, limit, total, start),
        },
      });
    },
  );

  // Retrieve a paginated list of Staff Attendance summary - GET /staffs/:id/attendance/summary
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getStaffAttendanceSummaryPaginQueryScheme>;
  }>(
    "/staffs/:id/attendance/summary",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme, querystring: getPaginQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.params.id;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const month = Number(req.query.month);
      const year = Number(req.query.year);

      let attendanceRecords = await prisma.attendance.findMany({
        where: { staffId },
      });

      if (!attendanceRecords.length) {
        return __reply<TResponseType<TAttendanceSummaryList>>(reply, 200, {
          payload: {
            data: null,
          },
        });
      }

      if (month && year) {
        attendanceRecords = attendanceRecords.filter((a) => {
          const date = new Date(a.date);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        });
      }

      // ---------- SUMMARY ----------
      const summary = {
        totalDays: attendanceRecords.length,
        present: attendanceRecords.filter((a) => a.status === "PRESENT").length,
        absent: attendanceRecords.filter((a) => a.status === "ABSENT").length,
        late: attendanceRecords.filter((a) => a.status === "LATE").length,
        onLeave: attendanceRecords.filter((a) => a.status === "ON_LEAVE")
          .length,
        avgWorkHours:
          attendanceRecords.length > 0
            ? (
                attendanceRecords.reduce(
                  (sum, a) => sum + (a.workHours || 0),
                  0,
                ) / attendanceRecords.length
              ).toFixed(2)
            : "0",
      };

      const start = (page - 1) * limit;
      const end = start + limit;
      const total = attendanceRecords.length;
      const attendances = attendanceRecords.slice(start, end);

      return __reply<TResponseType<TAttendanceSummaryList>>(reply, 200, {
        payload: {
          data: {
            summary,
            attendances,
          },
          pagination: __pagination(page, limit, total, start),
        },
      });
    },
  );

  // Retrieve Staff statistics - GET /staffs/statistics
  fastify.get<{
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/statistics",
    {
      preHandler: fastify.authenticate,
    },
    async (_, reply) => {
      const [allStaff, allDepts] = await Promise.all([
        prisma.staff.findMany({}),
        prisma.department.findMany({ select: { id: true, name: true } }),
      ]);

      const deptMap = new Map(allDepts.map((d) => [d.id, d.name]));

      const count = <T extends string | null | undefined>(
        map: Map<string, number>,
        key: T,
      ) => {
        if (!key) return;
        map.set(key, (map.get(key) ?? 0) + 1);
      };

      const deptCounts = new Map<string, number>();
      const rankCounts = new Map<string, number>();
      const cadreCounts = new Map<string, number>();
      const stateCounts = new Map<string, number>();
      const statusCounts = new Map<string, number>();

      for (const staff of allStaff) {
        count(
          deptCounts,
          staff.departmentId ? deptMap.get(staff.departmentId) : null,
        );
        count(rankCounts, staff.rank);
        count(cadreCounts, staff.cadre);
        count(stateCounts, staff.state);
        count(statusCounts, staff.status);
      }

      const toArray = (map: Map<string, number>, keyName: string) =>
        Array.from(map.entries()).map(([k, c]) => ({ [keyName]: k, count: c }));

      const sorted = (arr: { count: number }[], limit?: number) => {
        const s = [...arr].sort((a, b) => b.count - a.count);
        return limit ? s.slice(0, limit) : s;
      };

      const stats: TStaffStatistics = {
        byDepartment: sorted(toArray(deptCounts, "departmentName"), 20),
        byRank: sorted(toArray(rankCounts, "rank"), 20),
        byCadre: toArray(cadreCounts, "cadre"),
        byState: sorted(toArray(stateCounts, "state")),
        byStatus: toArray(statusCounts, "status"),
      } as TStaffStatistics;

      return __reply<TResponseType<TStaffStatistics>>(reply, 200, {
        payload: stats,
      });
    },
  );

  // Retrieve a staff quantification by highest - GET /staffs/:id/qualifications/highest
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/:id/qualifications/highest",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme, querystring: getPaginQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.params.id;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const skip = (page - 1) * limit;

      const where = { AND: [{ staffId }, { isHighest: true }] };
      const [highestQualifications, total] = await prisma.$transaction([
        prisma.qualification.findMany({
          where,
          take: limit,
          skip,
        }),
        prisma.qualification.count({ where }),
      ]);

      return __reply<TResponseType<TQaualificationList>>(reply, 200, {
        payload: {
          data: highestQualifications || [],
          pagination:
            highestQualifications.length > 0
              ? __pagination(page, limit, total, skip)
              : null,
        },
      });
    },
  );

  // Retreive a Staff paginated list of qualifications - GET /staffs/:id/qualifications
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/:id/qualifications",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme, querystring: getPaginQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.params.id;
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const skip = (page - 1) * limit;

      const where = { AND: [{ staffId }] };
      const [data, total] = await prisma.$transaction([
        prisma.qualification.findMany({
          where,
          take: limit,
          skip,
        }),
        prisma.qualification.count({ where }),
      ]);

      return __reply<TResponseType<TQaualificationList>>(reply, 200, {
        payload: {
          data,
          pagination:
            data.length > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  fastify.log.info("Api: Staff endpoints routes loaded.");
});

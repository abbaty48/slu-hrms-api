import type {
  TCadre,
  TGender,
  TStaffList,
  TStaffStats,
  TStaffStatus,
  TStaffDetails,
  TStaffStatistics,
  TStaffEmploymentList,
} from "#types/staffTypes.ts";
import type {
  TLeave,
  TLeaveBalanceList,
  TLeaveStudyDetails,
} from "#types/leave-managementTypes.ts";
import {
  putStaffDetailScheme,
  postStaffDetailScheme,
  getStaffPaginQueryScheme,
  getStaffIdStatusParamScheme,
  getStaffAttendanceSummaryPaginQueryScheme,
} from "#schemas/staff.schemas.ts";
import type {
  Cadre,
  StaffStatus,
  StaffCategory,
} from "../../generated/prisma/enums.ts";
import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import type { TUserRole } from "#types/userTypes.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { TQualification } from "#types/qualificationTypes.ts";
import type { TAttendanceSummaryList } from "#types/attendance.types.ts";
import { getIdParamScheme, getPaginQueryScheme } from "#schemas/schemas.ts";
import { getAttendanceStaffQueryScheme } from "#schemas/attendance.schemas.ts";

export default fastifyPlugin((fastify) => {
  const { prisma } = fastify;
  // Retrieve a paginated list of staffs. - GET /staffs
  fastify.get<{
    Params: { all?: string };
    Querystring: Static<typeof getStaffPaginQueryScheme>;
  }>(
    "/staffs/:all?",
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

      const query = req.params.all
        ? prisma.staff.findMany({
            where,
            include: { department: { select: { name: true } } },
          })
        : prisma.staff.findMany({
            where,
            skip,
            take: limit,
            include: { department: { select: { name: true } } },
          });

      const [data, total] = await prisma.$transaction([
        query,
        prisma.staff.count({ where }), // ← filtered count
      ]);

      return __reply<TResponseType<TStaffList>>(reply, 200, {
        payload: {
          data: data.map((staff) => ({
            ...staff,
            cadre: staff.cadre as TCadre,
            gender: staff.gender as TGender,
            status: staff.status as TStaffStatus,
          })),
          pagination: __pagination(page, limit, total, skip),
        },
      });
    },
  );

  // Retrieve Staff details with department and rank details. - GET /staffs/details
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/staffs/:id/details",
    {
      preHandler: fastify.authenticate,
    },
    async (req, reply) => {
      const id = req.params.id;
      // use the :id otherwise if it's current,then use the loggin user
      const staffId = id === "current" ? req.user.sId : id;
      const staff = await fastify.prisma.staff.findUnique({
        where: { id: staffId },
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
        gender: staff.gender as TGender,
        status: staff.status as TStaffStatus,
        rankDetails,
        department: department
          ? {
              ...department,
              staffCount,
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

  // Retrieve Staff Study Leave details. - GET /staffs/:id/details/study
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/staffs/:id/details/study",
    {
      preHandler: fastify.authenticate,
    },
    async (req, reply) => {
      const staffId = req.params.id;
      const staff = await fastify.prisma.staff.findUnique({
        where: { id: staffId },
      });

      if (!staff) {
        __reply(reply, 404, {
          payload: null,
          message: "Staff could not be found with that id.",
        });
        return;
      }

      const studyLeaveDetails = (await prisma.leave.findFirst({
        where: {
          AND: [{ staffId }, { studyLeaveDetails: { not: "{}" } }],
        },
        select: { studyLeaveDetails: true },
      })) as TLeaveStudyDetails | null;

      return __reply<TResponseType<TLeaveStudyDetails | null>>(reply, 200, {
        payload: studyLeaveDetails,
      });
    },
  );

  // Retrieve a paginated list of Staff employements. - GET /staffs/employment
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/employment",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: getPaginQueryScheme,
      },
    },
    async (req, reply) => {
      const staffId = req.user.sId;
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

  // Retrieve a paginated list of Staff leave balances. - GET /staffs/leave-balances
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs/leave-balances",
    {
      preHandler: fastify.authenticate,
      schema: {
        querystring: getPaginQueryScheme,
      },
    },
    async (req, reply) => {
      const staffId = req.user.sId;
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

  // Retrieve a paginated list of Staff Attendance summary - GET /staffs/attendance/summary
  fastify.get<{
    Querystring: Static<typeof getStaffAttendanceSummaryPaginQueryScheme>;
  }>(
    "/staffs/attendance/summary",
    {
      preHandler: fastify.authenticate,
      schema: { querystring: getAttendanceStaffQueryScheme },
    },
    async (req, reply) => {
      const staffId = req.user.sId;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 5);
      const month = Number(req.query.month);
      const year = Number(req.query.year);

      let attendanceRecords = await prisma.attendance.findMany({
        where: { staffId },
        orderBy: { checkIn: "desc" },
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
            todayAttendance:
              attendances.find(
                (a) => a.checkIn?.toDateString() === new Date().toDateString(),
              ) ?? null,
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

      return __reply<TResponseType<TQualification[]>>(reply, 200, {
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
    "/staffs/qualifications",
    {
      preHandler: fastify.authenticate,
    },
    async (req, reply) => {
      const staffId = req.user.sId;

      const data = await prisma.qualification.findMany({
        where: { staffId },
      });

      return __reply<TResponseType<TQualification[]>>(reply, 200, {
        payload: data,
      });
    },
  );

  // Retrieve a Staff stats - GET /staffs/:id/stats
  fastify.get(
    "/staffs/stats",
    {
      preHandler: fastify.authenticate,
    },
    async (req, reply) => {
      // ✅ Get staffId from URL
      console.log("TOKEN: ", req.headers.authorization);
      const staffId = req.user.sId;

      const [staffRankDepts, leaves] = await prisma.$transaction([
        prisma.staff.findUnique({
          where: { id: staffId },
          include: { department: true, rankDetails: true },
        }),
        prisma.leave.findMany({ where: { staffId } }),
      ]);

      const leaveBalances = (await prisma.leaveType.findMany()).map((type) => {
        const used = leaves
          .filter((l) => l.leaveTypeId === type.id && l.status === "APPROVED")
          .reduce((sum, l) => sum + l.totalDays, 0);

        return {
          leaveTypeId: type.id,
          name: type.name,
          used,
          allowed: type.allowedDays,
          paidLeave: type.paidLeave,
          carryForward: type.carryForward,
          remaining: (type.allowedDays || 0) - used,
        };
      });

      const totalLeaveBalance = {
        breakdown: leaveBalances,
        totalUsed: leaveBalances.reduce((sum, b) => sum + b.used, 0),
        totalAllowed: leaveBalances.reduce((sum, b) => sum + b.allowed, 0),
        totalRemaining: leaveBalances.reduce((sum, b) => sum + b.remaining, 0),
      };

      // ── ATTENDANCE (CURRENT MONTH) ────────────────────
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const monthAttendance = (
        await prisma.attendance.findMany({
          where: { staffId },
        })
      ).filter((attend) => {
        const d = new Date(attend.date);

        return (
          d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear
        );
      });

      const presentDays = monthAttendance.filter(
        (a) => a.status === "PRESENT" || a.status === "LATE",
      ).length;

      const attendanceRate =
        monthAttendance.length > 0
          ? Number(((presentDays / monthAttendance.length) * 100).toFixed(1))
          : 0;

      const attendance = {
        totalDays: monthAttendance.length,
        present: monthAttendance.filter((a) => a.status === "PRESENT").length,
        absent: monthAttendance.filter((a) => a.status === "ABSENT").length,
        late: monthAttendance.filter((a) => a.status === "LATE").length,
        onLeave: monthAttendance.filter((a) => a.status === "ON_LEAVE").length,
        rate: `${attendanceRate}%`,
        workHours:
          monthAttendance.length > 0
            ? Number(
                (
                  monthAttendance.reduce(
                    (sum, a) => sum + (a.workHours || 0),
                    0,
                  ) / monthAttendance.length
                ).toFixed(2),
              )
            : 0,
      };

      // ── SALARY ────────────────────────────────────────
      // const latestPayroll =
      //   db.payrolls
      //     .filter((p) => p.staffId === staffId)
      //     .sort(
      //       (a, b) => new Date(b.month).getTime() - new Date(a.month).getTime(),
      //     )[0] ?? null;

      // const salary = latestPayroll
      //   ? {
      //       netSalary: latestPayroll.netSalary,
      //       month: latestPayroll.month,
      //       status: latestPayroll.status,
      //     }
      //   : null;

      // ── RECENT LEAVES ─────────────────────────────────
      const recentLeaves = leaves
        .sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
        )
        .slice(0, 5)
        .map((l) => {
          const type = leaveBalances.find(
            (t) => t.leaveTypeId === l.leaveTypeId,
          );

          return {
            id: l.id,
            staff: {
              name: staffRankDepts?.firstName ?? "N/A",
              staffNo: staffRankDepts?.staffNo ?? "N/A",
              department: staffRankDepts?.department?.name ?? "N/A",
            },
            reason: l.reason,
            status: l.status,
            endDate: l.endDate,
            startDate: l.startDate,
            allowedDays: type?.allowed ?? 0,
            leaveType: type?.name ?? "N/A",
            duration: l.totalDays.toString(),
            studyLeaveDetails: l.studyLeaveDetails as TLeaveStudyDetails,
          };
        });

      return __reply<TResponseType<TStaffStats>>(reply, 200, {
        payload: {
          staffId,
          name: `${staffRankDepts?.firstName}  ${staffRankDepts?.lastName}`,
          department: staffRankDepts?.department?.name ?? "N/A",
          rank:
            staffRankDepts?.rankDetails.title ?? staffRankDepts?.rank ?? "N/A",
          attendance,
          recentLeaves,
          leaveBalances: totalLeaveBalance,
          leavePercent:
            totalLeaveBalance.totalAllowed > 0
              ? (totalLeaveBalance.totalUsed / totalLeaveBalance.totalAllowed) *
                100
              : 0,
        },
      });
    },
  );

  // Update new staff
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putStaffDetailScheme>;
  }>(
    "/staffs/:id/details",
    {
      preHandler: fastify.authenticate,
      schema: { params: getIdParamScheme, body: putStaffDetailScheme },
    },
    async (req, reply) => {
      const {
        cadre,
        status,
        dateOfBirth,
        staffCategory,
        dateOfLastPromotion,
        dateOfFirstAppointment,
        ...payload
      } = req.body;
      const staffId = req.params.id;

      const targetStaff = await prisma.staff.findFirst({
        where: { id: staffId },
      });

      if (!targetStaff) {
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: false,
          message: "Staff could be found with that profile.",
        });
      }

      const data = Object.assign(
        { ...targetStaff },
        {
          ...payload,
          cadre: cadre ? (cadre as Cadre) : targetStaff.cadre,
          // status
          status: status ? (status as StaffStatus) : targetStaff.status,
          // dateOfFirstAppointment
          dateOfFirstAppointment: dateOfFirstAppointment
            ? new Date(req.body.dateOfFirstAppointment!).toISOString()
            : targetStaff.dateOfFirstAppointment,
          // dateOfLastPromotion
          dateOfLastPromotion: dateOfLastPromotion
            ? new Date(dateOfLastPromotion).toISOString()
            : targetStaff.dateOfLastPromotion,
          // staffCategory
          staffCategory: staffCategory
            ? (req.body.staffCategory as StaffCategory)
            : targetStaff.staffCategory,
          // dateOfBirth
          dateOfBirth: dateOfBirth
            ? new Date(dateOfBirth).toISOString()
            : targetStaff.dateOfBirth,
        },
      );

      await prisma.staff.update({
        where: { id: req.params.id },
        data: {
          ...data,
          updatedAt: new Date().toISOString(),
        },
      });

      return __reply<TResponseType<boolean>>(reply, 200, {
        payload: true,
        message: "Staff profile updated successfully.",
      });
    },
  );

  // Update Staff status - PATCH /staffs/:id/:status
  fastify.patch<{
    Params: Static<typeof getStaffIdStatusParamScheme>;
  }>("/staffs/:id/:status", async (req, reply) => {
    const { id, status } = req.params;

    // Update status
    await prisma.staff.update({
      where: { id },
      data: { status: status as StaffStatus },
    });
    return __reply<TResponseType<boolean>>(reply, 200, {
      payload: true,
      message: "Staff status changed.",
    });
  });

  // Create new staff - POST /staffs
  fastify.post<{
    Body: Static<typeof postStaffDetailScheme>;
  }>(
    "/staffs",
    {
      preHandler: fastify.authorize([
        AuthUserRole.DEPT_ADMIN,
        AuthUserRole.HR_ADMIN,
      ]),
      schema: { body: postStaffDetailScheme },
    },
    async (req, reply) => {
      const { email, rankId, dateOfLastPromotion } = req.body;
      // Check if staff number already exists with email
      const [existedStaff, existedUser, rankName] = await prisma.$transaction([
        prisma.staff.findUnique({ where: { email } }),
        prisma.user.findUnique({ where: { email } }),
        prisma.rank.findUnique({
          where: { id: rankId },
          select: { title: true },
        }),
      ]);

      if (existedStaff || existedUser) {
        return __reply<TResponseType<boolean>>(reply, 400, {
          payload: false,
          message:
            "Could not proceed the action, the user already exist, check the email address provided.",
        });
      }

      if (!rankName?.title) {
        return __reply<TResponseType<boolean>>(reply, 400, {
          payload: false,
          message: "Could not proceed with unknown rank.",
        });
      }

      const staffNo = idGenerator("ST/");
      try {
        await prisma.staff.create({
          data: {
            ...req.body,
            staffNo,
            id: idGenerator("st_").toLowerCase(),
            rank: rankName.title,
            cadre: req.body.cadre as Cadre,
            status: req.body.status as StaffStatus,
            dateOfFirstAppointment: new Date(
              req.body.dateOfFirstAppointment!,
            ).toISOString(),
            dateOfLastPromotion: dateOfLastPromotion
              ? new Date(dateOfLastPromotion).toISOString()
              : null,
            staffCategory: req.body.staffCategory as StaffCategory,
            dateOfBirth: new Date(req.body.dateOfBirth!).toISOString(),
          },
        });
        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: `Staff with ${staffNo} created.`,
        });
      } catch (err: any) {
        return errReply(reply, 400, "Something went wrong.", err.message);
      }
    },
  );

  fastify.log.info("Api: Staff endpoints routes loaded.");
});

import type {
  TStaff,
  TCadre,
  TStaffStatus,
  TStaffDetails,
  TEnrichedStaff,
  TStaffStatistics,
  TStaffPerDepartment,
  TStaffUpdateStatusRequest,
  TStaffUpdateStatusResponse,
  TStaffEmploymentList,
  TStaffList,
} from "#types/staffTypes.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { __pagination, __reply } from "#utils/utils_helper.ts";
import type { TUser, TUserRole } from "#types/userTypes.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { ErrorResponseType } from "#types/errorResponseType.ts";
import { getIdParamScheme, getPaginQueryScheme } from "#schemas/schemas.ts";
import type {
  TLeaveBalance,
  TLeaveBalanceList,
} from "#types/leave-managementTypes.ts";

export default fastifyPlugin((fastify) => {
  const { prisma } = fastify;
  //
  fastify.get<{
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs",
    {
      preHandler: fastify.authenticate,
      schema: { querystring: getPaginQueryScheme },
    },
    async (req, reply) => {
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const start = (page - 1) * limit;
      const [data, total] = await fastify.prisma.$transaction([
        fastify.prisma.staff.findMany({
          take: limit,
          skip: start,
        }),
        fastify.prisma.staff.count(),
      ]);

      return __reply<TResponseType<TStaffList>>(reply, 200, {
        payload: {
          data: data.map((staff) => ({
            ...staff,
            cadre: staff.cadre as TCadre,
            status: staff.status as TStaffStatus,
          })),
          pagination: __pagination(page, limit, total, start),
        },
      });
    },
  );

  // Staff with department and rank details
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

  //
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

  // trying to get leave balance for a staff member
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

  fastify.log.info("Api: Staff endpoints routes loaded.");
});

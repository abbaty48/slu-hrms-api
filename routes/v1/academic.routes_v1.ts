import type {
  TAcademicStats,
  TExtensionRequest,
  TExtensionRequestList,
  TStaffOnStudyLeaveList,
} from "#types/academicDivisionTypes.ts";
import {
  getStudyLeaveQuerySchema,
  getExtensionRequestQueryScheme,
  postExtensionRequestBodyScheme,
  patchExtensionRequestStatusParamScheme,
} from "#schemas/academic.schemas.ts";
import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { TLeaveStudyDetails } from "#types/leave-managementTypes.ts";

const extensionDuration = (commencingDate: Date, durationMonths: number) => {
  const startDate = new Date(commencingDate);
  const endDate = new Date(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth() + durationMonths,
    startDate.getUTCDate(),
  );

  return {
    startDate,
    endDate,
  };
};

export default fastifyPlugin((fastify) => {
  const { prisma, authorize } = fastify;

  // Retrive Academic board stats
  fastify.get(
    "/academic/stats",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (_, reply) => {
      let studyLeavesDetails = (
        await prisma.leave.findMany({
          where: { studyLeaveDetails: { not: "{}" } },
          select: { studyLeaveDetails: true },
        })
      ).flatMap((f) => f.studyLeaveDetails as TLeaveStudyDetails);

      const statsMap = {
        OnStudyLeave: 0,
        PhdCandidate: 0,
        PgdCandidate: 0,
        MscCandidate: 0,
        BscCandidate: 0,
        StudyAbroad: 0,
      };

      studyLeavesDetails.forEach((detail) => {
        if (detail.degreeType === "PHD") statsMap.PhdCandidate++;
        if (detail.degreeType === "MSC") statsMap.MscCandidate++;
        if (detail.degreeType === "BSC") statsMap.BscCandidate++;
        if (detail.degreeType === "PGD") statsMap.PgdCandidate++;
        if (detail.country !== "Nigeria") statsMap.StudyAbroad++;
        if (detail.leaveCategory == "Study") statsMap.OnStudyLeave++;
      });

      return __reply<TResponseType<TAcademicStats>>(reply, 200, {
        payload: statsMap,
      });
    },
  );

  // Retrive Staff with Study leave
  fastify.get<{
    Querystring: Static<typeof getStudyLeaveQuerySchema>;
  }>(
    "/academic/study-leave",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { querystring: getStudyLeaveQuerySchema },
    },
    async (request, reply) => {
      const {
        sponsorship,
        degreeType,
        limit = 5,
        page = 1,
        type,
        q,
      } = request.query;

      const where = {
        studyLeaveDetails: { not: "{}" },
      };

      const leaves = await prisma.leave.findMany({
        where,
        include: {
          staff: {
            select: {
              firstName: true,
              lastName: true,
              department: {
                select: { name: true },
              },
            },
          },
        },
      });

      const filteredLeaves = leaves
        .filter(
          (s) =>
            (s.studyLeaveDetails as TLeaveStudyDetails).leaveCategory ===
            "Study",
        )
        .filter((s) => {
          const details = s.studyLeaveDetails as TLeaveStudyDetails;

          if (sponsorship || degreeType || type || q) {
            const isMatch = (s: string, k: string) =>
              s.toLowerCase().includes(k.toLowerCase());

            return (
              (sponsorship && isMatch(details.sponsorshipType, sponsorship)) ||
              (degreeType && isMatch(details.degreeType, degreeType)) ||
              (q &&
                (isMatch(details.institution, q) ||
                  isMatch(details.programme, q)))
            );
          }
          return s;
        });

      const total = filteredLeaves.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const data = filteredLeaves.slice(startIndex, endIndex);

      return __reply<TResponseType<TStaffOnStudyLeaveList>>(reply, 200, {
        payload: {
          data: data.map((s) => ({
            ...(s.studyLeaveDetails as any),
            staff: {
              id: s.staffId,
              firstName: s.staff.firstName,
              lastName: s.staff.lastName,
              department: s.staff.department?.name || "N/A",
              faculty: "N/A",
            },
          })),
          pagination:
            total > 0 ? __pagination(page, limit, total, startIndex) : null,
        },
      });
    },
  );

  // Retrieve Extension Requests /academic/extension-request - GET
  fastify.get<{
    Querystring: Static<typeof getExtensionRequestQueryScheme>;
  }>(
    "/academic/extension-request",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { querystring: getExtensionRequestQueryScheme },
    },
    async (req, reply) => {
      const { page = 1, limit = 5, status } = req.query;
      const skip = (page - 1) * limit;

      // Implement a prisma query to fetch extension requests
      const where = {
        ...(status && { status }),
      };
      const [total, extensionRequests] = await prisma.$transaction([
        prisma.academicExtensionRequest.count({ where }),
        prisma.academicExtensionRequest.findMany({
          skip,
          where,
          take: limit,
          orderBy: {
            createdAt: "desc"
          },
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: {
                  select: { name: true },
                },
              },
            },
          },
        }),
      ]);

      return __reply<TResponseType<TExtensionRequestList>>(reply, 200, {
        payload: {
          data: extensionRequests.map((extensionRequest) => ({
            ...extensionRequest,
            duration: {
              ...extensionDuration(
                new Date(extensionRequest.createdAt),
                extensionRequest.durationMonths,
              ),
            },
            staff: {
              id: extensionRequest.staff.id,
              firstName: extensionRequest.staff.firstName,
              lastName: extensionRequest.staff.lastName,
              department: extensionRequest.staff.department?.name || "N/A",
              faculty: "N/A",
            },
          })),
          pagination:
            extensionRequests.length > 0
              ? __pagination(page, limit, total, skip)
              : null,
        },
      });
    },
  );

  // Add Extension Request /academic/extension-request - POST
  fastify.post<{
    Body: Static<typeof postExtensionRequestBodyScheme>;
  }>(
    "/academic/extension-request",
    {
      preHandler: authorize([AuthUserRole.HR_ADMIN, AuthUserRole.DEPT_ADMIN]),
      schema: {
        body: postExtensionRequestBodyScheme,
      },
    },
    async (request, reply) => {
      // Implement a prisma query to create an extension request
      try {
        await prisma.academicExtensionRequest.create({
          data: {
            id: idGenerator("req_"),
            ...request.body,
          },
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: {
                  select: { name: true },
                },
              },
            },
          },
        });
        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to upsert preference. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // Change Extension Request /academic/extension-request status - POST
  fastify.patch<{
    Params: Static<typeof patchExtensionRequestStatusParamScheme>;
  }>(
    "/academic/extension-request/:id/:status",
    {
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: {
        params: patchExtensionRequestStatusParamScheme,
      },
    },
    async (request, reply) => {
      const { id, status } = request.params;
      // Implement a prisma query to create an extension request
      try {
        await prisma.academicExtensionRequest.update({
          where: { id },
          data: { status },
        });
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to upsert preference. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );
});

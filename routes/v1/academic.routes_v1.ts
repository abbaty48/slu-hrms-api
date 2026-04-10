import type {
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
      preHandler: authorize(["hr_admin", "dept_admin"]),
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
        MscCandidate: 0,
        StudyAbroad: 0,
      };

      studyLeavesDetails.forEach((detail) => {
        if (detail.degreeType === "PHD") statsMap.PhdCandidate++;
        if (detail.degreeType === "MSC") statsMap.MscCandidate++;
        if (detail.country !== "Nigeria") statsMap.StudyAbroad++;
        if (detail.leaveCategory == "Study") statsMap.OnStudyLeave++;
      });

      return __reply<TResponseType<any>>(reply, 200, {
        payload: statsMap,
      });
    },
  );

  // Retrive Staff with Study leave
  fastify.get<{
    Querystring: typeof getStudyLeaveQuerySchema;
  }>(
    "/academic/study-leave",
    {
      preHandler: authorize(["hr_admin", "dept_admin"]),
      schema: { querystring: getStudyLeaveQuerySchema },
    },
    async (request, reply) => {
      const {
        sponsorship,
        institution,
        programme,
        country,
        limit = 5,
        page = 1,
      } = request.query;

      const skip = (page - 1) * limit;

      let staffs = await prisma.leave.findMany({
        where: {
          studyLeaveDetails: { not: "{}" },
        },
        skip,
        take: limit,
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

      staffs = staffs.filter((s) => {
        const details = s.studyLeaveDetails as TLeaveStudyDetails;

        if (sponsorship || institution || programme || country) {
          const isMatch = (s: string, k: string) =>
            s.toLowerCase().includes(k.toLowerCase());

          return (
            (sponsorship && isMatch(details.sponsorshipType, sponsorship)) ||
            (institution && isMatch(details.institution, institution)) ||
            (programme && isMatch(details.programme, programme)) ||
            (country && isMatch(details.country!, country))
          );
        }
        return s;
      });

      return __reply<TResponseType<TStaffOnStudyLeaveList>>(reply, 200, {
        payload: {
          data: staffs.map((s) => ({
            ...(s.studyLeaveDetails as any),
            staff: {
              firstName: s.staff.firstName,
              lastName: s.staff.lastName,
              department: s.staff.department?.name || "N/A",
              faculty: "N/A",
            },
          })),
          pagination:
            staffs.length > 0
              ? __pagination(page, limit, staffs.length, skip)
              : null,
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
      preHandler: authorize(["hr_admin", "dept_admin"]),
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
      preHandler: authorize(["hr_admin", "dept_admin"]),
      schema: {
        body: postExtensionRequestBodyScheme,
      },
    },
    async (request, reply) => {
      // Implement a prisma query to create an extension request
      try {
        const extensionRequest = await prisma.academicExtensionRequest.create({
          data: {
            id: idGenerator("req_"),
            ...request.body,
          },
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
        return __reply<TResponseType<TExtensionRequest>>(reply, 201, {
          payload: {
            ...extensionRequest,
            duration: {
              ...extensionDuration(
                new Date(extensionRequest.createdAt),
                extensionRequest.durationMonths,
              ),
            },
            staff: {
              firstName: extensionRequest.staff.firstName,
              lastName: extensionRequest.staff.lastName,
              department: extensionRequest.staff.department?.name || "N/A",
              faculty: "N/A",
            },
          },
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
      preHandler: authorize(["hr_admin", "dept_admin"]),
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

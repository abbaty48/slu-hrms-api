import { getResponsibilityPaginQuerySchema } from "#schemas/responsibility.schemas.ts";
import type { TResponsibilitiesList } from "#types/responsibilityTypes.ts";
import { __pagination, __reply } from "#utils/utils_helper.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { Static } from "@sinclair/typebox";
import fastifyPlugin from "fastify-plugin";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // Get All Responsibilities
  fastify.get<{
    Querystring: Static<typeof getResponsibilityPaginQuerySchema>;
  }>(
    "/settings/responsibilities",
    {
      preHandler: authenticate,
      schema: { querystring: getResponsibilityPaginQuerySchema },
    },
    async (req, reply) => {
      const { limit = 10, page = 1, active, department } = req.query;

      const where = {
        ...(active && { isActive: active }),
        ...(department && { department }),
      };

      const skip = (page - 1) * limit;
      const [data, total] = await prisma.$transaction([
        prisma.responsibility.findMany({
          where,
          skip,
          take: limit,
          include: {
            assignedTo: {
              select: { staffId: true },
            },
          },
        }),
        prisma.responsibility.count({ where }),
      ]);

      return __reply<TResponseType<TResponsibilitiesList>>(reply, 200, {
        payload: {
          data: data.map((_) => ({
            ..._,
            assignedTo: _.assignedTo.map((a) => a.staffId),
          })),
          pagination:
            data.length > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );
});

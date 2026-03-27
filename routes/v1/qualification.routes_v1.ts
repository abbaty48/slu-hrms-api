import { getQualificationPaginQuerySchema } from "#schemas/qualification.schemas.ts";
import type { TQaualificationList } from "#types/qualificationTypes.ts";
import { __pagination, __reply } from "#utils/utils_helper.ts";
import type { Static } from "@fastify/type-provider-typebox";
import type { TResponseType } from "#types/responseType.ts";
import fastifyPlugin from "fastify-plugin";

export default fastifyPlugin((fastify) => {
  const { prisma, authorize, authenticate } = fastify;

  // Retrieve a paginated list of staff qualifications -  GET /api/qualifications
  fastify.get<{
    Querystring: Static<typeof getQualificationPaginQuerySchema>;
  }>(
    "/qualifications",
    {
      preHandler: authenticate,
      schema: { querystring: getQualificationPaginQuerySchema },
    },
    async (req, reply) => {
      const { staffId, level, year, page = 1, limit = 10 } = req.query;

      const where = {
        ...(year && { year }),
        ...(staffId && { staffId }),
        ...(level && {
          level: { contains: level, mode: "insensitive" as const },
        }),
      };

      const skip = (page - 1) * limit;
      const [qualifications, total] = await prisma.$transaction([
        prisma.qualification.findMany({
          where,
          skip,
          take: limit,
        }),
        prisma.qualification.count({ where }),
      ]);

      return __reply<TResponseType<TQaualificationList>>(reply, 200, {
        payload: {
          data: qualifications,
          pagination:
            qualifications.length > 0
              ? __pagination(page, limit, total, skip)
              : null,
        },
      });
    },
  );
});

import { getRankPaginQuerySchema } from "#schemas/rank.schemas.ts";
import { __pagination, __reply } from "#utils/utils_helper.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { TRanksList } from "#types/rankTypes.ts";
import type { Static } from "@sinclair/typebox";
import fastifyPlugin from "fastify-plugin";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // Retrieve a paginated list of ranks with optional filtering
  fastify.get<{
    Querystring: Static<typeof getRankPaginQuerySchema>;
  }>(
    "/ranks",
    {
      preHandler: authenticate,
      schema: { querystring: getRankPaginQuerySchema },
    },
    async (req, reply) => {
      const { page = 1, limit = 10, level, q } = req.query;

      const where = {
        ...(q && {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }),
        ...(level && { level }),
      };

      const skip = (page - 1) * limit;
      let [ranks, total] = await prisma.$transaction([
        prisma.rank.findMany({
          where,
          skip,
          take: limit,
        }),
        prisma.rank.count({ where }),
      ]);

      // Sort by level (ascending)
      ranks = ranks.sort((a, b) => a.level - b.level);

      return __reply<TResponseType<TRanksList>>(reply, 200, {
        payload: {
          data: ranks,
          pagination:
            ranks.length > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );
  
  
});

import {
  putRankBodySchema,
  postRankBodySchema,
  getRankPaginQuerySchema,
} from "#schemas/rank.schemas.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import type { TRanksList } from "#types/rankTypes.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { ErrorResponseType } from "#types/errorResponseType.ts";
import { __pagination, __reply, idGenerator } from "#utils/utils_helper.ts";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // Retrieve a paginated list of ranks with optional filtering - GET /ranks?q&level
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

  // Add a new rank - POST /ranks
  fastify.post<{
    Body: Static<typeof postRankBodySchema>;
  }>(
    "/ranks",
    {
      preHandler: authorize(["admin"]),
      schema: { body: postRankBodySchema },
    },
    async (req, reply) => {
      const { level, title, description } = req.body;

      try {
        const existedRank = await prisma.rank.findFirst({
          where: { title: { contains: title, mode: "insensitive" as const } },
        });

        if (existedRank) {
          return __reply<TResponseType<boolean>>(reply, 201, {
            payload: true,
            message: `Rank already existed, but done.`,
          });
        }

        await prisma.rank.create({
          data: {
            level,
            title,
            description,
            id: idGenerator("rank_").toLowerCase(),
          },
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: `Rank "(${title})" is created.`,
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 500, {
          errorCode: 400,
          errorTitle: "Failed to create",
          errorMessage: `Failed, something went wrong, ${err.message}`,
        });
      }
    },
  );

  // Update a rank - POST /ranks/:id
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putRankBodySchema>;
  }>(
    "/ranks/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { body: putRankBodySchema, params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { title } = req.body;

      try {
        let existedRank = await prisma.rank.findFirst({
          where: { id },
        });

        if (title) {
          if (title === existedRank?.title) {
            return __reply<TResponseType<boolean>>(reply, 400, {
              payload: true,
              message: `Rank already existed, operation aborted.`,
            });
          }
        }

        const data = Object.assign({ ...existedRank }, req.body);

        await prisma.rank.update({
          where: { id },
          data,
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Rank "(${data.title})" is updated.`,
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 400, {
          errorCode: 400,
          errorTitle: "Failed to update",
          errorMessage: `Failed, something went wrong, ${err.message}`,
        });
      }
    },
  );
});

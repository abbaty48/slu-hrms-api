import {
  putRankBodySchema,
  postRankBodySchema,
  getRankPaginQuerySchema,
} from "#schemas/rank.schemas.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import type { TRanksList } from "#types/rankTypes.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { ErrorResponseType } from "#types/errorResponseType.ts";
import {
  __pagination,
  __reply,
  errReply,
  idGenerator,
} from "#utils/utils_helper.ts";

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // Retrieve a paginated list of ranks with optional filtering - GET /ranks?q&level
  fastify.get<{
    Querystring: Static<typeof getRankPaginQuerySchema>;
    Params: { all?: string };
  }>(
    "/ranks/:all?",
    {
      preHandler: authenticate,
      schema: { querystring: getRankPaginQuerySchema },
    },
    async (req, reply) => {
      const { page = 1, limit = 10, level, q } = req.query;
      const all = req.params.all;

      const where = {
        ...(q && {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      };

      const skip = (page - 1) * limit;
      const filter = all
        ? prisma.rank.findMany({ where, orderBy: { title: "desc" } })
        : prisma.rank.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
          });

      let [ranks, total] = await prisma.$transaction([
        filter,
        prisma.rank.count({ where }),
      ]);

      return __reply<TResponseType<TRanksList>>(reply, 200, {
        payload: {
          data: ranks,
          pagination:
            ranks.length > 0 && !all
              ? __pagination(page, limit, total, skip)
              : null,
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
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
      schema: { body: postRankBodySchema },
    },
    async (req, reply) => {
      const { title, description } = req.body;

      try {
        const existedRank = await prisma.rank.findFirst({
          where: { title: { contains: title, mode: "insensitive" as const } },
        });

        if (existedRank) {
          return errReply(
            reply,
            201,
            "Aborted",
            `Rank already existed, but done.`,
          );
        }

        await prisma.rank.create({
          data: {
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
        return errReply(
          reply,
          500,
          "Failed to create",
          `Failed, something went wrong, ${err.message}`,
        );
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
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
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
            return errReply(
              reply,
              400,
              "Operation Aborted",
              `Rank already existed, operation aborted.`,
            );
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
        return errReply(
          reply,
          400,
          "Failed to update",
          `Failed, something went wrong, ${err.message}`,
        );
      }
    },
  );

  // Delete Responsibility
  fastify.delete<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/ranks/:id",
    {
      schema: { params: getIdParamScheme },
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const rank = await prisma.rank.findUnique({
          where: { id },
        });

        if (!rank) {
          return errReply(
            reply,
            404,
            "",
            `Could not procees with the operation, Rank does not exist.`,
          );
        }

        await prisma.rank.delete({ where: { id } });
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Rank "${rank.title} is deleted.".`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          500,
          "Failed to delete.",
          `Failed, something went wrong, ${err.message}`,
        );
      }
    },
  );
});

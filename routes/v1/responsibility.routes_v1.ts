import {
  putResponsibilityBodySchema,
  postResponsibilityBodySchema,
  getResponsibilityPaginQuerySchema,
} from "#schemas/responsibility.schemas.ts";
import type { TResponsibilitiesList } from "#types/responsibilityTypes.ts";
import { __pagination, __reply, idGenerator } from "#utils/utils_helper.ts";
import type { ErrorResponseType } from "#types/errorResponseType.ts";
import type { TResponseType } from "#types/responseType.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
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
      const { limit = 5, page = 1, active, term } = req.query;

      const where = {
        ...(active && { isActive: active }),
        ...(term && {
          title: { contains: term, mode: "insensitive" as const },
        }),
      };

      const skip = (page - 1) * limit;
      const [data, total] = await prisma.$transaction([
        prisma.responsibility.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.responsibility.count({ where }),
      ]);

      return __reply<TResponseType<TResponsibilitiesList>>(reply, 200, {
        payload: {
          data,
          pagination:
            data.length > 0 ? __pagination(page, limit, total, skip) : null,
        },
      });
    },
  );

  // Create Responsibility
  fastify.post<{
    Body: Static<typeof postResponsibilityBodySchema>;
  }>(
    "/settings/responsibilities",
    {
      preHandler: authorize(["admin"]),
      schema: { body: postResponsibilityBodySchema },
    },
    async (req, reply) => {
      try {
        await prisma.responsibility.create({
          data: {
            ...req.body,
            id: idGenerator("resp_").toLowerCase(),
          },
        });
        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: `Responsibility "${req.body.title}" is created.`,
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 500, {
          errorCode: 500,
          errorTitle: "Failed to create.",
          errorMessage: `Failed, something went wrong, ${err.message}`,
        });
      }
    },
  );

  // Update Responsibility
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putResponsibilityBodySchema>;
  }>(
    "/settings/responsibilities/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { body: putResponsibilityBodySchema },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const responsibility = await prisma.responsibility.findUnique({
          where: { id },
        });

        if (!responsibility) {
          return __reply<TResponseType<boolean>>(reply, 404, {
            payload: false,
            message: `Could not procees with the operation, Responsibility does not exist.`,
          });
        }

        const data = Object.assign(responsibility, {
          ...req.body,
          updatedAt: new Date().toISOString(),
        });

        await prisma.responsibility.update({ where: { id }, data });
        return __reply<TResponseType<boolean>>(reply, 404, {
          payload: true,
          message: `Responsibility "${data.title} updated.".`,
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 500, {
          errorCode: 500,
          errorTitle: "Failed to create.",
          errorMessage: `Failed, something went wrong, ${err.message}`,
        });
      }
    },
  );

  // Delete Responsibility
  fastify.delete<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/settings/responsibilities/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const responsibility = await prisma.responsibility.findUnique({
          where: { id },
        });

        if (!responsibility) {
          return __reply<TResponseType<boolean>>(reply, 404, {
            payload: false,
            message: `Could not procees with the operation, Responsibility does not exist.`,
          });
        }

        await prisma.responsibility.delete({ where: { id } });
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Responsibility "${responsibility.title} is deleted.".`,
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 500, {
          errorCode: 500,
          errorTitle: "Failed to delete.",
          errorMessage: `Failed, something went wrong, ${err.message}`,
        });
      }
    },
  );
});

import type {
  TQualification,
  TQaualificationList,
  TQualificationLevelStats,
} from "#types/qualificationTypes.ts";
import {
  putQualificationSchema,
  postQualificationSchema,
  getQualificationPaginQuerySchema,
} from "#schemas/qualification.schemas.ts";
import fastifyPlugin from "fastify-plugin";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { Static } from "@fastify/type-provider-typebox";
import type { ErrorResponseType } from "#types/errorResponseType.ts";
import { __pagination, __reply, idGenerator } from "#utils/utils_helper.ts";

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

  // Retrieve a single qualification - GET /api/qualifications/:id
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/qualifications/:id",
    {
      preHandler: authenticate,
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        const qualification = await prisma.qualification.findFirst({
          where: { id },
        });
        return __reply<TResponseType<TQualification | null>>(reply, 200, {
          payload: qualification,
          message: !qualification ? "Query not found." : "",
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 400, {
          errorCode: 400,
          errorTitle: "",
          errorMessage: err.message,
        });
      }
    },
  );

  // Retrieve qualification stats by highest - GET /api/qualifications/stats/by-level
  fastify.get(
    "/qualifications/stats/by-level",
    { preHandler: authenticate },
    async (_, reply) => {
      const qualByHigest =
        (await prisma.qualification.findMany({
          where: { isHighest: true },
        })) || [];

      let levelCounts = new Map<string, number>();
      qualByHigest.forEach((q) =>
        levelCounts.set(q.level, (levelCounts.get(q.level) || 0) + 1),
      );

      const result = Array.from(levelCounts.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count);

      return __reply<TResponseType<TQualificationLevelStats>>(reply, 200, {
        payload: result,
      });
    },
  );

  // Add a new qualification - POST /api/staff/:id/qualifications
  fastify.post<{
    Body: Static<typeof postQualificationSchema>;
  }>(
    "/qualifications",
    {
      preHandler: authorize(["admin"]),
      schema: { body: postQualificationSchema },
    },
    async (req, reply) => {
      try {
        await prisma.qualification.create({
          data: {
            ...req.body,
            id: idGenerator("qual_").toLowerCase(),
          },
        });
        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: "Qualification is created.",
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 400, {
          errorTitle: "Failed",
          errorCode: 400,
          errorMessage: `Failed, something went wrong, ${err.message}`,
        });
      }
    },
  );

  // Update an existing qualification details -  PUT /api/qualifications/:id
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putQualificationSchema>;
  }>(
    "/qualifications/:id",
    {
      preHandler: authorize(["admin"]),
      schema: { body: putQualificationSchema, params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const targetQual = await prisma.qualification.findUnique({
        where: { id },
      });

      if (!targetQual) {
        return __reply<TResponseType<boolean>>(reply, 404, {
          payload: false,
          message: `Qualification not found.`,
        });
      }

      const data = Object.assign(targetQual, req.body);

      try {
        await prisma.qualification.update({ where: { id }, data });
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Qualification updated.`,
        });
      } catch (err: any) {
        return __reply<ErrorResponseType>(reply, 400, {
          errorCode: 400,
          errorTitle: "Failed to add.",
          errorMessage: `Failed, something went wrong, ${err.message}`,
        });
      }
    },
  );
});

import {
  getComitteeQueryScheme,
  postComitteeBodyScheme,
  putComitteeBodyScheme,
} from "#schemas/committee.schemas.ts";
import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { AuthUserRole } from "#types/authTypes.ts";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { TCommitteesList } from "#types/committeeTypes.ts";

export default fastifyPlugin((fastify) => {
  const { prisma, authorize } = fastify;

  // Get All Committees
  fastify.get<{
    Querystring: Static<typeof getComitteeQueryScheme>;
  }>(
    "/settings/committees",
    {
      preHandler: authorize([AuthUserRole.HR_ADMIN, AuthUserRole.DEPT_ADMIN]),
      schema: { querystring: getComitteeQueryScheme },
    },
    async (req, reply) => {
      const { page = 1, limit = 5, actives, term } = req.query;

      const where = {
        ...(actives && { isActive: actives }),
        ...(term && { name: { contains: term, mode: "insensitive" as const } }),
      };

      const skip = (page - 1) * limit;

      let [committees, total] = await prisma.$transaction([
        prisma.committee.findMany({
          where,
          skip,
          take: limit,
        }),
        prisma.committee.count({ where }),
      ]);

      return __reply<TResponseType<TCommitteesList>>(reply, 200, {
        payload: {
          data: committees,
          pagination:
            committees.length > 0
              ? __pagination(page, limit, total, skip)
              : null,
        },
      });
    },
  );

  // Create a Committee
  fastify.post<{
    Body: Static<typeof postComitteeBodyScheme>;
  }>(
    "/settings/committees",
    {
      schema: { body: postComitteeBodyScheme },
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (req, reply) => {
      const { name, ...payload } = req.body;
      try {
        const committeeId = idGenerator("comm_");
        await prisma.committee.create({
          data: {
            ...payload,
            name,
            id: committeeId,
          },
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: `Committee "${name}" is created.`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          400,
          "Failed to create.",
          `Something went wrong, ${err.message}`,
        );
      }
    },
  );

  // Update Committee
  fastify.put<{
    Params: Static<typeof getIdParamScheme>;
    Body: Static<typeof putComitteeBodyScheme>;
  }>(
    "/settings/committees/:id",
    {
      schema: { params: getIdParamScheme, body: putComitteeBodyScheme },
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (req, reply) => {
      const { id } = req.params;
      const { active } = req.body;

      const committee = await prisma.committee.findFirst({ where: { id } });

      if (!committee) {
        return errReply(
          reply,
          404,
          "Could not proceed",
          `Could not proceed, The committee does not exist.`,
        );
      }

      const data = Object.assign(committee, {
        ...req.body,
        isActive: active !== undefined ? active : committee.isActive,
        updatedAt: new Date().toISOString(),
      });

      try {
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Committee "${data.name}" is updated`,
        });
      } catch (err: any) {
        return errReply(
          reply,
          400,
          "Failed to update.",
          `Something went wrong, ${err.message}`,
        );
      }
    },
  );

  // Delete Committee
  fastify.delete<{
    Params: Static<typeof getIdParamScheme>;
  }>(
    "/settings/committees/:id",
    {
      schema: { params: getIdParamScheme },
      preHandler: authorize([AuthUserRole.DEPT_ADMIN, AuthUserRole.HR_ADMIN]),
    },
    async (req, reply) => {
      const { id } = req.params;

      try {
        await prisma.committee.delete({ where: { id } });
        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: `Committee deleted." `,
        });
      } catch (err: any) {
        return errReply(
          reply,
          400,
          "Failed to delete.",
          `Something went wrong, ${err.message}`,
        );
      }
    },
  );
});

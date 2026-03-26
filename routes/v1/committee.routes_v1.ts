import {
  getComitteeQueryScheme,
  postComitteeBodyScheme,
} from "#schemas/committee.schemas.ts";
import type { TCommitteesList } from "#types/committeeTypes.ts";
import { __pagination, __reply, idGenerator } from "#utils/utils_helper.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { Static } from "@sinclair/typebox";
import fastifyPlugin from "fastify-plugin";
import type { JsonArray } from "@prisma/client/runtime/client";

export default fastifyPlugin((fastify) => {
  const { prisma, authorize } = fastify;

  // Get All Committees
  fastify.get<{
    Querystring: Static<typeof getComitteeQueryScheme>;
  }>(
    "/settings/committees",
    {
      preHandler: authorize(["admin"]),
      schema: { querystring: getComitteeQueryScheme },
    },
    async (req, reply) => {
      const { page = 1, limit = 5, active } = req.query;

      const where = {
        ...(active && {
          OR: [{ isActive: active }],
        }),
      };

      const skip = (page - 1) * limit;

      let [committee, total] = await prisma.$transaction([
        prisma.committee.findMany({
          where,
          include: {
            members: {
              select: { staffs: true },
            },
          },
          skip,
          take: limit,
        }),
        prisma.committee.count({ where }),
      ]);

      const data =
        committee.length > 0
          ? committee.map((c) => {
              return {
                ...c,
                members: c.members.flatMap((m) => m.staffs as string),
              };
            })
          : [];

      return __reply<TResponseType<TCommitteesList>>(reply, 200, {
        payload: {
          data,
          pagination:
            data.length > 0 ? __pagination(page, limit, total, skip) : null,
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
      preHandler: authorize(["admin"]),
      schema: { body: postComitteeBodyScheme },
    },
    async (req, reply) => {
      const { name, active, members, ...payload } = req.body;

      try {
        const committeeId = idGenerator("comm_");
        await prisma.committee.create({
          data: {
            ...payload,
            name,
            isActive: active,
            id: committeeId,
            members: { create: { staffs: members } },
          },
        });

        return __reply<TResponseType<boolean>>(reply, 201, {
          payload: true,
          message: `Committee "${name}" is created.`,
        });
      } catch (err: any) {
        return __reply<TResponseType<boolean>>(reply, 400, {
          payload: false,
          message: `Something went wrong, ${err.message}`,
        });
      }
    },
  );
});

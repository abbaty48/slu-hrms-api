import { getComitteeQueryScheme } from "#schemas/committee.schemas.ts";
import type { TCommitteesList } from "#types/committeeTypes.ts";
import { __pagination, __reply } from "#utils/utils_helper.ts";
import type { TResponseType } from "#types/responseType.ts";
import type { Static } from "@sinclair/typebox";
import fastifyPlugin from "fastify-plugin";

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
              select: { staffId: true },
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
                members: c.members.map((m) => m.staffId),
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
});

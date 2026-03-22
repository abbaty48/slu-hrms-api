import type {
  TStaff,
  TStaffDetails,
  TEnrichedStaff,
  TStaffStatistics,
  TStaffPerDepartment,
  TStaffUpdateStatusRequest,
  TStaffUpdateStatusResponse,
} from "#types/staffTypes.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { getPaginQueryScheme } from "#schemas/schemas.ts";

export default fastifyPlugin((fastify) => {
  //
  fastify.get<{
    Querystring: Static<typeof getPaginQueryScheme>;
  }>(
    "/staffs",
    { schema: { querystring: getPaginQueryScheme } },
    async (req) => {
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);

      const start = (page - 1) * limit;

      const paginated = await fastify.prisma.staff.findMany({
        take: limit,
        skip: start,
      });

      return {
        data: paginated,
        nextPage: start + limit < paginated.length ? page + 1 : null,
      };
    },
  );

  //

  fastify.log.info("Api: Staff endpoints routes loaded.");
});

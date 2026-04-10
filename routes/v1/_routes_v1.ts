import fastifyPlugin from "fastify-plugin";

export default fastifyPlugin(
  async (fastify) => {
    await fastify
      .get("/", async (_request, _reply) => {
        return {
          name: "SLU HRMS API-Gateway.",
          version: fastify.env.SERVER_VERSION,
          current_date: new Date(Date.now()),
          docs: `${fastify.IP_ENDPOINT}/docs`,
        };
      })
      .register(import("#routes/v1/auth.routes_v1.ts"))
      .register(import("#routes/v1/rank.routes_v1.ts"))
      .register(import("#routes/v1/staff.routes_v1.ts"))
      .register(import("#routes/v1/leave.routes_v1.ts"))
      .register(import("#routes/v1/chart.routes_v1.ts"))
      .register(import("#routes/v1/setting.routes_v1.ts"))
      .register(import("#routes/v1/document.routes_v1.ts"))
      .register(import("#routes/v1/academic.routes_v1.ts"))
      .register(import("#routes/v1/committee.routes_v1.ts"))
      .register(import("#routes/v1/department.routes_v1.ts"))
      .register(import("#routes/v1/attendance.routes_v1.ts"))
      .register(import("#routes/v1/notification.routes_v1.ts"))
      .register(import("#routes/v1/qualification.routes_v1.ts"))
      .register(import("#routes/v1/responsibility.routes_v1.ts"));

    fastify.log.info("Api: routes endpoints version 1 loaded.");
  },
  { name: "routes:endpoint:1", encapsulate: true },
);

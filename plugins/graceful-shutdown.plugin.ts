import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { setTimeout } from "node:timers/promises";

const gracefulShutdown = async function (
  fastify: FastifyInstance,
  signal: string,
) {
  fastify.log.info(`CMD: Received ${signal}, starting graceful shutdown...`);
  try {
    // close server (stop accepting new connections)
    await fastify.close();
    fastify.log.info("Server closed successfully.");

    // wait for in-flight requests to complete
    await setTimeout(5000);
    fastify.log.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error: any) {
    fastify.log.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

export default fastifyPlugin(async (fastify) => {
  // listen for termination signals
  process.on("SIGTERM", () => gracefulShutdown(fastify, "SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown(fastify, "SIGINT"));
  fastify.decorate("gracefulShutdown", gracefulShutdown);

  fastify.log.info(
    "Graceful Shutdown handling registered with SIGTERM, SIGINT events.",
  );
});

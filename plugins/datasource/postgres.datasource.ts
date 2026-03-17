import fastifyPlugin from "fastify-plugin";
import fastifyPostgres from "@fastify/postgres";

export default fastifyPlugin(async (fastify) => {
  fastify.log.info("Datasource: Initiating datasources connections.");

  await fastify.register(fastifyPostgres, {
    host: fastify.env.POSTGRES_HOST,
    port: fastify.env.POSTGRES_PORT,
    database: fastify.env.POSTGRES_DATABASE,
  });
  try {
    await fastify.pg.connect();
    fastify.log.info(
      `POSTGRES: postgres database connected on -> ${fastify.env.POSTGRES_HOST}:${fastify.env.POSTGRES_PORT}/${fastify.env.POSTGRES_DATABASE}`,
    );
  } catch (err) {
    fastify.log.error(
      `POSTGRES: failed to establish a postgres database connection to ${fastify.env.POSTGRES_HOST}:${fastify.env.POSTGRES_PORT}/${fastify.env.POSTGRES_DATABASE}`,
    );
  }
});

export const postgresSources = {};

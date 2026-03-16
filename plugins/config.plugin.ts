import fastifyEnv from "@fastify/env";
import fastifyPlugin from 'fastify-plugin'
import envSchema from '#schemas/env.schema.ts';

export default fastifyPlugin(async (fastify) => {
    await fastify.register(fastifyEnv, {
        dotenv: true,
        confKey: 'env',
        data: process.env,
        schema: envSchema,
    });
    fastify.decorate('IS_PROD', fastify.env.NODE_ENV === 'production');
    fastify.decorate('NODE_ENV', fastify.env.NODE_ENV || 'development');
    fastify.decorate('IP_ENDPOINT', `http://${fastify.env.HOST}:${fastify.env.PORT || 3500}`);
});

import fastifyPlugin from "fastify-plugin";
import formbody from "@fastify/formbody";

export default fastifyPlugin(async (fastify) => {
    // prefer explicit env var, fall back to app config BODY_LIMIT or sensible default (1MB)
    const configured = Number(fastify.env.FORM_BODY_LIMIT);
    const bodyLimit = Math.max(1024, Math.floor(configured)); // at least 1KB

    await fastify.register(formbody, {
        bodyLimit, // bytes; prevents very large urlencoded bodies
    });

    fastify.log.info(`formbody: initialized (bodyLimit=${bodyLimit} bytes)`);
});

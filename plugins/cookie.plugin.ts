import fastifyPlugin from "fastify-plugin";
import cookie from "@fastify/cookie";

export default fastifyPlugin((fastify) => {
  fastify.register(cookie, { secret: fastify.env.COOKIE_SECRET });
  fastify.log.info("cookie: plugin initialized.");
});

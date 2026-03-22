import fastify from "fastify";
import appConfigs from "#configs/app.configs.ts";
import authPlugin from "#plugins/auth.plugin.ts";
import _routes_v1 from "#routes/v1/_routes_v1.ts";
import corsPlugins from "#plugins/cors.plugins.ts";
import cachePlugin from "#plugins/cache.plugin.ts";
import prismaPlugin from "#plugins/prisma.plugin.ts";
import bcryptPlugin from "#plugins/bcrypt.plugin.ts";
import staticPlugin from "#plugins/static.plugin.ts";
import cookiePlugin from "#plugins/cookie.plugin.ts";
import configPlugin from "#plugins/config.plugin.ts";
import swaggerPlugin from "#plugins/swagger.plugin.ts";
import formBodyPlugin from "#plugins/form-body.plugin.ts";
import rateLimitPlugin from "#plugins/rate-limit.plugin.ts";
import errorHandlerPlugin from "#plugins/error-handler.plugin.ts";
import gracefulShutdownPlugin from "#plugins/graceful-shutdown.plugin.ts";
import { type TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

let app = fastify({
  ...appConfigs,
}).withTypeProvider<TypeBoxTypeProvider>();

// NOTE: the order of plugin register chain matters.
app
  .register(gracefulShutdownPlugin)
  .register(errorHandlerPlugin)
  .register(configPlugin)
  .register(cachePlugin)
  .register(corsPlugins)
  .register(cookiePlugin)
  .register(rateLimitPlugin)
  .register(formBodyPlugin)
  .register(staticPlugin)
  .register(bcryptPlugin)
  .register(prismaPlugin)
  .register(authPlugin)
  .register(_routes_v1, { prefix: "/api/v1/" })
  .register(swaggerPlugin)
  .after((err) => {
    if (err) {
      app.log.error("Error during plugin registration: " + err);
      process.exit(1);
    }
  });

app.listen({
  port: Number(process.env.PORT) || 3500,
  host: process.env.HOST || "0.0.0.0",
});

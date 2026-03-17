import fastify from "fastify";
import appConfigs from "#configs/app.configs.ts";
import corsPlugins from "#plugins/cors.plugins.ts";
import cachePlugin from "#plugins/cache.plugin.ts";
import configPlugin from "#plugins/config.plugin.ts";
import bcryptPlugin from "#plugins/bcrypt.plugin.ts";
import staticPlugin from "#plugins/static.plugin.ts";
import formBodyPlugin from "#plugins/form-body.plugin.ts";
import rateLimitPlugin from "#plugins/rate-limit.plugin.ts";
import errorHandlerPlugin from "#plugins/error-handler.plugin.ts";
import pgDatasources from "#plugins/datasource/postgres.datasource.ts";

const app = fastify({ ...appConfigs });
app
  .register(errorHandlerPlugin)
  .register(configPlugin)
  .register(cachePlugin)
  .register(corsPlugins)
  .register(rateLimitPlugin)
  .register(formBodyPlugin)
  .register(staticPlugin)
  .register(bcryptPlugin)
  .register(pgDatasources)
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

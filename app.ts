import fastify from "fastify";
import appConfigs from "#configs/app.configs.ts";
import cachePlugin from "#plugins/cache.plugin.ts";
import configPlugin from "#plugins/config.plugin.ts";
import errorHandlerPlugin from "#plugins/error-handler.plugin.ts";

const app = fastify({ ...appConfigs });
app
  .register(errorHandlerPlugin)
  .register(configPlugin)
  .register(cachePlugin)
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

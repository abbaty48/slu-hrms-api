import fastify from "fastify";
import appConfigs from "#configs/app.configs.ts";

const app = fastify({ ...appConfigs });
await app
    .after(err => {
        if (err) {
            app.log.error("Error during plugin registration: " + err);
            process.exit(1);
        }
    });

app.listen({ port: Number(process.env.PORT) || 3000, host: process.env.HOST || '0.0.0.0' });

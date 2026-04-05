import swaggerUI from "@fastify/swagger-ui";
import fastifyPlugin from "fastify-plugin";
import swagger from "@fastify/swagger";

export default fastifyPlugin(async (fastify) => {
  const {
    SWAGGER_TITLE = "SLU HRMS API-Backend",
    SWAGGER_DESCRIPTION = "Sule Lamido University Human Resource Management System API.",
    SWAGGER_VERSION = "1.0.0",
    SWAGGER_PREFIX = "/docs",
    SWAGGER_HIDE_UNTAGGED = false,
  } = fastify.env;

  // ── Schema (OpenAPI 2 / Swagger) ─────────────────────────────────────────
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: SWAGGER_TITLE,
        description: SWAGGER_DESCRIPTION,
        version: SWAGGER_VERSION,
        contact: {
          name: "SLU Support",
          url: "https://slu.edu.ng",
          email: "support@slu.edu.ng",
        },
        license: { name: "ISC" },
      },
      host: fastify.env.SWAGGER_HOST ?? "localhost:3000",
      basePath: "/api/v1",
      schemes: fastify.IS_PROD ? ["https"] : ["http", "https"],
      consumes: ["application/json"],
      produces: ["application/json"],
      securityDefinitions: {
        bearerAuth: {
          type: "apiKey",
          name: "Authorization",
          in: "header",
          description:
            "JWT Bearer token. Enter value as: **Bearer &lt;your_token&gt;**",
        },
      },
      security: [{ bearerAuth: [] }],
    },
    hideUntagged: SWAGGER_HIDE_UNTAGGED === true,
    refResolver: {
      buildLocalReference: (json, _baseUri, _fragment, i) =>
        (json.$id as string | undefined) ?? `def-${i}`,
    },
  });

  // ── UI ───────────────────────────────────────────────────────────────────
  await fastify.register(swaggerUI, {
    staticCSP: true,
    routePrefix: SWAGGER_PREFIX,
    transformSpecificationClone: true,
    uiConfig: {
      filter: true,
      deepLinking: true,
      docExpansion: "list",
      layout: "StandaloneLayout",
      tryItOutEnabled: !fastify.IS_PROD,
      supportedSubmitMethods: [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "options",
        "head",
      ],
      // Persist the bearer token across page refreshes
      persistAuthorization: true,
    },
  });

  fastify.log.info(
    `swagger: docs available at ${fastify.IP_ENDPOINT}${SWAGGER_PREFIX}`,
  );
});

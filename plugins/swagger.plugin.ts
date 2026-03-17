import swaggerUI from "@fastify/swagger-ui";
import fastifyPlugin from "fastify-plugin";
import swagger from "@fastify/swagger";

export default fastifyPlugin(async (fastify) => {
  const {
    SWAGGER_TITLE = "SLU HRMS API-Backend",
    SWAGGER_DESCRIPTION = "Sule lamido university Human Resource Management System API.",
    SWAGGER_VERSION = "1.0.0",
    SWAGGER_PREFIX = "/docs",
    SWAGGER_HIDE_UNTAGGED = "false",
  } = fastify.env;

  // register @fastify/swagger (generates OpenAPI schema)
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
        license: {
          name: "ISC",
        },
      },
      host: fastify.env.SWAGGER_HOST || "localhost:3000",
      basePath: "/api",
      schemes: fastify.IS_PROD ? ["https"] : ["http", "https"],
      consumes: ["application/json", "application/x-www-form-urlencoded"],
      produces: ["application/json"],
      securityDefinitions: {
        bearerAuth: {
          type: "apiKey",
          name: "Authorization",
          in: "header",
          description: "JWT Bearer token",
        },
      },
      tags: [
        { name: "Auth", description: "Authentication endpoints" },
        { name: "Users", description: "User management" },
        { name: "Leave", description: "Leave management" },
        { name: "Employee", description: "Employee management" },
        { name: "Attendance", description: "Attendance management" },
        { name: "Health", description: "Health check endpoints" },
      ],
    },
    hideUntagged: String(SWAGGER_HIDE_UNTAGGED).toLowerCase() === "true",
    refResolver: {
      buildLocalReference: (json, baseUri, fragment, i) => {
        return `${baseUri}#${fragment}`;
      },
    },
  });

  // register @fastify/swagger-ui (serves Swagger UI)
  await fastify.register(swaggerUI, {
    staticCSP: true,
    routePrefix: SWAGGER_PREFIX,
    transformSpecificationClone: true,
    uiConfig: {
      filter: true,
      deepLinking: true,
      docExpansion: "list",
      // presets: ["SwaggerUIBundle.presets.apis", "SwaggerUIStandalonePreset"],
      layout: "StandaloneLayout",
      tryItOutEnabled: !fastify.IS_PROD, // disable try-it-out in production
      supportedSubmitMethods: [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "options",
        "head",
      ],
    },
    transformSpecification: (spec) => spec,
  });

  fastify.log.info(
    `swagger: UI available at ${fastify.IP_ENDPOINT}${SWAGGER_PREFIX}`,
  );
});

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fastifyPlugin from "fastify-plugin";
import fastifyStatic from "@fastify/static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default fastifyPlugin(async (fastify) => {
  const {
    STATIC_SERVE_ROOT = "/", // root URL to serve from
    STATIC_DIR_LIST = "false", // enable directory listings
    STATIC_PREFIX = "/public", // URL prefix (e.g., /public/*)
    STATIC_CONSTRAINTS = "true", // restrict to registered routes
    STATIC_ROOT = join(__dirname, "../public"), // base directory for static files
    STATIC_MAX_AGE = fastify.IS_PROD ? "86400000" : "0", // cache max-age in ms (1 day prod, 0 dev)
    STATIC_CACHE_CONTROL = fastify.IS_PROD
      ? "public, max-age=86400"
      : "no-cache",
  } = fastify.env;

  const maxAge =
    Number.parseInt(STATIC_MAX_AGE, 10) || (fastify.IS_PROD ? 86400000 : 0);
  const dirList = String(STATIC_DIR_LIST).toLowerCase() === "true";
  const constraints = String(STATIC_CONSTRAINTS).toLowerCase() === "true";

  await fastify.register(fastifyStatic, {
    // absolute path to static files directory
    root: STATIC_SERVE_ROOT,
    // URL prefix for static routes
    prefix: STATIC_PREFIX,
    // restrict to registered routes
    constraints: constraints ? {} : undefined,
    // browser cache duration (ms)
    maxAge,
    // send Cache-Control header
    cacheControl: !fastify.IS_PROD,
    // enable ETag for conditional requests
    etag: true,
    // enable Last-Modified header
    lastModified: true,
    // default file in directories
    index: ["index.html"],
    // allow directory listings (disable in prod)
    list: dirList,
    // immutable flag for versioned assets
    immutable: fastify.IS_PROD && maxAge > 0,
    // decorate reply with notFound() method
    decorateReply: true,
    // don't serve hidden files (.env, .git, etc)
    serveDotFiles: false,
    // enable wildcard routes
    wildcard: true,
    // expose routes in swagger (optional)
    schemaHide: false,
    serve: true,
    setHeaders: (reply, pathName) => {
      // custom header logic per file type
      if (pathName.endsWith(".js")) {
        reply.setHeader("Content-Type", "application/javascript");
        reply.setHeader("Cache-Control", "public, max-age=31536000, immutable"); // 1 year for versioned JS
      } else if (pathName.endsWith(".css")) {
        reply.setHeader("Content-Type", "text/css");
        reply.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (pathName.endsWith(".woff2") || pathName.endsWith(".woff")) {
        reply.setHeader("Content-Type", "font/woff2");
        reply.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (pathName.endsWith(".svg")) {
        reply.setHeader("Content-Type", "image/svg+xml");
        reply.setHeader("Cache-Control", STATIC_CACHE_CONTROL);
      } else if (
        pathName.endsWith(".png") ||
        pathName.endsWith(".jpg") ||
        pathName.endsWith(".jpeg")
      ) {
        reply.setHeader("Cache-Control", "public, max-age=604800"); // 7 days for images
      } else {
        reply.setHeader("Cache-Control", STATIC_CACHE_CONTROL);
      }
    },
  });

  fastify.setNotFoundHandler(
    // { preValidation: fastify.basicAuth },
    (request, reply) => {
      reply.statusCode = 404;
      reply.send({ error: "Not Found", statusCode: 404, url: request.url });
    },
  );

  fastify.log.info(
    `static: initialized (root=${STATIC_ROOT}, prefix=${STATIC_PREFIX}, maxAge=${maxAge}ms)`,
  );
});

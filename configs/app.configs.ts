import crypto from "node:crypto";
import logger from "#configs/app.logger.ts";
import type { FastifySchemaValidationError } from "fastify";

const genReqId = () =>
  "api-" +
  crypto
    .randomBytes(6)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export default {
  logger,
  genReqId,
  bodyLimit: 1048576,
  // bodyLimit: 1024,
  forceCloseConnections: true,
  requestIdHeader: "slukhrms-request-id",
  ajv: {
    customOptions: {
      allErrors: true,
      coerceTypes: true,
      removeAdditional: true,
    },
  },
  routerOptions: {
    caseSensitive: true,
    ignoreDuplicateSlashes: true,
    ignoreTrailingSlash: true,
  },
  schemaErrorFormatter: (errors: FastifySchemaValidationError[]) => {
    const error = errors[0];
    switch (error?.keyword) {
      case "minLength": {
        const property = error.instancePath.replace(/^\//, "");
        const message = error.message;
        return Error(`${property} ${message}.`);
      }
      default:
        return Error(
          error?.message ||
            "You have a validation error, something is mistaken.",
        );
    }
  },
};

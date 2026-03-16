import crypto from "node:crypto";
import logger from "#configs/app.logger.ts";

const genReqId = () => 'api-' + crypto.randomBytes(6)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export default {
    logger,
    genReqId,
    bodyLimit: 1024,
    requestIdHeader: "slukhrms-request-id",
    forceCloseConnections: true,
    ajv: {
        customOptions: {
            allErrors: false,
            coerceTypes: true,
            removeAdditional: true,
        }
    },
    routerOptions: {
        caseSensitive: true,
        ignoreDuplicateSlashes: true,
        ignoreTrailingSlash: true,
    },
};

import type { HttpCodes } from "fastify/types/utils.js";

export type ErrorResponseType = {
  errorTitle: string;
  errorMessage: string;
  errorCode: HttpCodes;
};

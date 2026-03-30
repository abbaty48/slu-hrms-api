import type { HttpCodes } from "fastify/types/utils.js";
import { type FastifyReply } from "fastify";
import type { ErrorResponseType } from "#types/errorResponseType.ts";

export function __reply<T>(
  fastifyReply: FastifyReply,
  code: HttpCodes,
  payload: T,
) {
  fastifyReply.code(code);
  return payload;
}

export function __pagination(
  page: number,
  limit: number,
  total: number,
  start: number,
) {
  return {
    page,
    limit,
    total,
    hasPrevPage: page > 1,
    hasNextPage: start + limit < total,
    totalPages: Math.ceil(total / limit),
  };
}

export function idGenerator(prefix?: string) {
  return `${prefix ?? ""}${(Math.random() * Date.now()).toString(32).slice(0, 7).toWellFormed()}`;
}

export const errReply = (
  reply: Parameters<typeof __reply>[0],
  code: HttpCodes,
  title: string,
  message: string,
) =>
  __reply<ErrorResponseType>(reply, code, {
    errorCode: code,
    errorTitle: title,
    errorMessage: message,
  });

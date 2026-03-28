import type { HttpCodes } from "fastify/types/utils.js";
import { type FastifyReply } from "fastify";

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

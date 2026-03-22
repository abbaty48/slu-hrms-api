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

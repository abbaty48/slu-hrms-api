import type {
  RawServerDefault,
  FastifyBaseLogger,
  RouteGenericInterface,
  FastifyTypeProviderDefault,
} from "fastify";
import type { IncomingMessage } from "http";
import type { LRUCache } from "lru-cache/raw";
import type { ENVIRONMENT, NODE_ENVIRONMENT } from "./env.type.ts";
import type { ResolveFastifyRequestType } from "fastify/types/type-provider.js";

/**
 *
 */
declare module "fastify" {
  //
  interface FastifyInstance {
    IS_PROD: boolean;
    IP_ENDPOINT: string;
    NODE_ENV: NODE_ENVIRONMENT;
    circuitBreakerOpen: boolean;
    env: ENVIRONMENT & NodeJS.ProcessEnv;
    cacheClient: () => LRUCache<{}, {}, unknown>;
    cacheKeyFor: (request: any, extra?: string) => void;
    // CACHERESPONSE
    cacheResponse: (
      request: FastifyRequest,
      reply: FastifyReply,
      payload: any,
    ) => void;
    // CACHEPREHANDLER
    cachePreHandler: () => (
      request: FastifyRequest<
        RouteGenericInterface,
        RawServerDefault,
        IncomingMessage,
        FastifySchema,
        FastifyTypeProviderDefault,
        unknown,
        FastifyBaseLogger,
        ResolveFastifyRequestType<
          FastifyTypeProviderDefault,
          FastifySchema,
          RouteGenericInterface
        >
      >,
      reply: FastifyReply,
    ) => Promise<undefined>;
    //
    circuitBreakerHandler: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => void;
    alertError: (errorType: any, details: any) => void;
    attemptRecovery: (service: string) => Promise<boolean>;
    //
    bcrypt: {
      compare: (source: string, target: string) => Promise<boolean>;
      hash: (data: string, salt?: number) => Promise<string>;
      salt: (round: number) => Promise<string>;
    };
    //
    gracefulShutdown: (fastify: FastifyInstance, signal: string) => void;
  }
}

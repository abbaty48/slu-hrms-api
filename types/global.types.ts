import type { ENVIRONMENT, NODE_ENVIRONMENT } from "./env.type.ts"

/**
 *
 */
declare module 'fastify' {
    interface FastifyInstance {
        IS_PROD: boolean
        IP_ENDPOINT: string
        NODE_ENV: NODE_ENVIRONMENT
        env: ENVIRONMENT & NodeJS.ProcessEnv
    }
}

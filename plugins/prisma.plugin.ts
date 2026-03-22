import fp from "fastify-plugin";
import { PrismaPg } from "@prisma/adapter-pg";
import type { FastifyPluginAsync } from "fastify";
import { PrismaClient } from "../generated/prisma/client.ts";

// Use TypeScript module augmentation to declare the type of server.prisma to be PrismaClient
declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (server, options) => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: server.env.DATABASE_URL }),
  });

  try {
    await prisma.$connect();
    server.log.info(
      `POSTGRES: postgres database connected on -> ${server.env.DATABASE_URL}`,
    );
  } catch (error) {
    server.log.error(
      `POSTGRES: failed to establish a postgres database connection to ${server.env.DATABASE_URL}, REASON: ${error} `,
    );
  }

  // Make Prisma Client available through the fastify server instance: server.prisma
  server.decorate("prisma", prisma);
  server.addHook("onClose", async (server) => {
    await prisma.$disconnect();
  });
});

export default prismaPlugin;

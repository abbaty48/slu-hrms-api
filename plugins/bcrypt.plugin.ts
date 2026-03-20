import fastifyPlugin from "fastify-plugin";
import bcrypt from "bcrypt";

export default fastifyPlugin(async (fastify) => {
  fastify.decorate("bcrypt", {
    compare: async (source: string, target: string) =>
      await bcrypt.compare(source, target),
    hash: async (data: string, salt: number = 10) =>
      await bcrypt.hash(data, salt),
    salt: async (round: number) => await bcrypt.genSalt(round),
  });
});

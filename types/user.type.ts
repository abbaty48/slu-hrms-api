import type { UserType } from "@fastify/jwt";

export type TUser = UserType & {
  role: string;
  permissions: string[];
};

export type TAccessToken = TUser & {
  jti: string;
  type: string;
};

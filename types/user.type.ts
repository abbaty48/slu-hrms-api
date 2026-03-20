import type { UserType } from "@fastify/jwt";

export type TUser = UserType & {
  sub: string;
  sId?: string;
  email: string;
  role: string;
};

export type TAccessToken = TUser & {
  jti: string;
  type: string;
};

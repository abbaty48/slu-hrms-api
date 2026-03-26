import { Type } from "@sinclair/typebox";

export const getComitteeQueryScheme = Type.Object({
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 5 })),
  active: Type.Optional(Type.Boolean()),
});

export const postComitteeBodyScheme = Type.Object({
  meetingSchedule: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  active: Type.Boolean({ default: true }),
  chairman: Type.Optional(Type.String()),
  purpose: Type.Optional(Type.String()),
  members: Type.Array(Type.String()),
  name: Type.String(),
});

export const putComitteeBodyScheme = Type.Object({
  active: Type.Optional(Type.Boolean({ default: true })),
  members: Type.Optional(Type.Array(Type.String())),
  meetingSchedule: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  chairman: Type.Optional(Type.String()),
  purpose: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
});

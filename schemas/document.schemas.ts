import { Type } from "@sinclair/typebox";

export const getDocumentQueryScheme = Type.Object({
  status: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const getStaffDocumentQueryScheme = Type.Object({
  status: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const patchDocumentVerifyBodyScheme = Type.Object({
  verifiedBy: Type.String(),
});

export const postDocumentBodyScheme = Type.Object({
  description: Type.String(),
  year: Type.Optional(Type.String()),
  degree: Type.Optional(Type.String()),
  institution: Type.Optional(Type.String()),
});

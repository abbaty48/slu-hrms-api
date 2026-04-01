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
});

export const patchDocumentVerifyBodyScheme = Type.Object({
  verifiedBy: Type.String(),
});

export const postDocumentBodyScheme = Type.Object({
  title: Type.String(),
  fileName: Type.String(),
  mimeType: Type.String(),
  category: Type.String(),
  description: Type.String(),
  year: Type.Optional(Type.String()),
  degree: Type.Optional(Type.String()),
  fileSize: Type.Optional(Type.Number()),
  institution: Type.Optional(Type.String()),
});

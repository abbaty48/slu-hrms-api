import { Type } from "@sinclair/typebox";

const extensionRequestStatus = Type.Union([
  Type.Literal("Pending"),
  Type.Literal("Approved"),
  Type.Literal("Rejected"),
]);

export const getStudyLeaveQuerySchema = Type.Object({
  country: Type.Optional(Type.String()),
  programme: Type.Optional(Type.String()),
  institution: Type.Optional(Type.String()),
  sponsorship: Type.Optional(Type.String()),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const getExtensionRequestQueryScheme = Type.Object({
  status: Type.Optional(extensionRequestStatus),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});

export const patchExtensionRequestStatusParamScheme = Type.Object({
  id: Type.String(),
  status: extensionRequestStatus,
});

export const postExtensionRequestBodyScheme = Type.Object({
  staffId: Type.String(),
  reason: Type.String(),
  durationMonths: Type.Number(),
  status: extensionRequestStatus,
  extension: Type.Union([
    Type.Literal("First"),
    Type.Literal("Second"),
    Type.Literal("Final"),
  ]),
});

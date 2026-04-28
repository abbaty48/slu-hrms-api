import { Type } from "@sinclair/typebox";

const extensionRequestStatus = Type.Union([
  Type.Literal("Pending"),
  Type.Literal("Approved"),
  Type.Literal("Rejected"),
]);

const defaultExtensionRequestStatus = Type.Union([extensionRequestStatus], {
  default: "Pending",
});

export const getStudyLeaveQuerySchema = Type.Object({
  q: Type.Optional(Type.String()),
  type: Type.Optional(Type.String()),
  degreeType: Type.Optional(Type.String()),
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
  status: Type.Optional(defaultExtensionRequestStatus),
  extension: Type.Union([
    Type.Literal("First"),
    Type.Literal("Second"),
    Type.Literal("Final"),
  ]),
});

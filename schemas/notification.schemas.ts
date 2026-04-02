import { Type } from "@sinclair/typebox";

// getNotificationQueryScheme
export const getNotificationQueryScheme = Type.Object({
  read: Type.Optional(Type.Boolean()),
  type: Type.Optional(Type.String()),
  priority: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String({ format: "date" })),
  startDate: Type.Optional(Type.String({ format: "date" })),
  page: Type.Optional(Type.Number({ default: 1, minimum: 0 })),
  limit: Type.Optional(Type.Number({ default: 5, minimum: 1 })),
});
// postNotificationBodyScheme
export const postNotificationBodyScheme = Type.Object({
  type: Type.String(),
  title: Type.String(),
  userId: Type.String(),
  message: Type.String(),
  icon: Type.Optional(Type.String()),
  priority: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.String()),
  actionUrl: Type.Optional(Type.String()),
});

export const patchMarkReadBodyScheme = Type.Object({
  notificationIds: Type.Array(Type.String()),
});

const notificationTypes = Type.Object({
  leave_approved: Type.Boolean({ default: true }),
  leave_rejected: Type.Boolean({ default: true }),
  leave_pending: Type.Boolean({ default: true }),
  payroll: Type.Boolean({ default: true }),
  contract: Type.Boolean({ default: true }),
  system: Type.Boolean({ default: true }),
  profile: Type.Boolean({ default: true }),
  attendance: Type.Boolean({ default: true }),
  general: Type.Boolean({ default: true }),
});

export const patchPreferencesBodyScheme = Type.Object({
  emailNotifications: Type.Optional(Type.Boolean({ default: false })),
  pushNotifications: Type.Optional(Type.Boolean({ default: true })),
  notificationTypes: Type.Optional(notificationTypes),
  quietHours: Type.Optional(
    Type.Object({
      enabled: Type.Optional(Type.Boolean({ default: "true" })),
      end: Type.Optional(Type.String({ default: "22:00" })),
      start: Type.Optional(Type.String({ default: "08:00" })),
    }),
  ),
});

import {
  patchMarkReadBodyScheme,
  getNotificationQueryScheme,
  postNotificationBodyScheme,
  patchPreferencesBodyScheme,
} from "#schemas/notification.schemas.ts";
import {
  __reply,
  errReply,
  idGenerator,
  __pagination,
} from "#utils/utils_helper.ts";
import type {
  NotificationType,
  NotificationPriority,
} from "../../generated/prisma/enums.ts";
import type {
  TNotification,
  TMarkReadPayload,
  TNotificationList,
  TNotificationStats,
  TNotificationPriority,
  TNotificationPreferences,
} from "#types/notificationsTypes.ts";
import fastifyPlugin from "fastify-plugin";
import type { Static } from "@sinclair/typebox";
import { getIdParamScheme } from "#schemas/schemas.ts";
import type { TResponseType } from "#types/responseType.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_NOTIFICATION_TYPES: Record<string, boolean> = {
  leave_approved: true,
  leave_rejected: true,
  leave_pending: true,
  payroll: true,
  contract: true,
  system: true,
  profile: true,
  attendance: true,
  general: true,
};

const DEFAULT_PREFERENCES = (userId: string): TNotificationPreferences => ({
  userId,
  emailNotifications: true,
  pushNotifications: true,
  notificationTypes: { ...DEFAULT_NOTIFICATION_TYPES },
  quietHours: { enabled: false, start: "22:00", end: "08:00" },
});

// ─── Shared query builder ─────────────────────────────────────────────────────

const buildNotifWhere = (
  userId: string,
  query: {
    read: boolean | undefined;
    endDate: string | undefined;
    startDate: string | undefined;
    type: NotificationType | undefined;
    priority: NotificationPriority | undefined;
  },
) => ({
  userId,
  ...(query.read !== undefined && { read: query.read === true }),
  ...(query.type && { type: query.type }),
  ...(query.priority && { priority: query.priority }),
  ...((query.startDate || query.endDate) && {
    createdAt: {
      ...(query.startDate && { gte: new Date(query.startDate) }),
      ...(query.endDate && { lte: new Date(query.endDate) }),
    },
  }),
});

export default fastifyPlugin((fastify) => {
  const { prisma, authenticate, authorize } = fastify;

  // ── 1. List Notifications (current user) ────────────────────────────────
  fastify.get<{ Querystring: Static<typeof getNotificationQueryScheme> }>(
    "/notifications",
    {
      preHandler: authenticate,
      schema: { querystring: getNotificationQueryScheme },
    },
    async (req, reply) => {
      const {
        read,
        type,
        priority,
        endDate,
        startDate,
        page = 1,
        limit = 5,
      } = req.query;

      const userId = req.user.sub;
      const skip = (page - 1) * limit;

      const where = buildNotifWhere(userId, {
        read,
        endDate,
        startDate,
        type: type as NotificationType,
        priority: priority as NotificationPriority,
      });

      const [notifications, total, unreadCount] = await prisma.$transaction([
        prisma.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, read: false } }),
      ]);

      return __reply<TResponseType<TNotificationList>>(reply, 200, {
        payload: {
          data: notifications as TNotification[],
          pagination: {
            ...__pagination(page, limit, total, skip),
            unreadCount,
          },
        },
      });
    },
  );

  // ── 2. List Notifications (by staff — Admin) ─────────────────────────────
  fastify.get<{
    Params: Static<typeof getIdParamScheme>;
    Querystring: Static<typeof getNotificationQueryScheme>;
  }>(
    "notifications/users/:id",
    {
      preHandler: authenticate,
      schema: {
        params: getIdParamScheme,
        querystring: getNotificationQueryScheme,
      },
    },
    async (req, reply) => {
      const { id: userId } = req.params;
      const {
        read,
        type,
        priority,
        endDate,
        startDate,
        page = 1,
        limit = 20,
      } = req.query;
      const skip = (page - 1) * limit;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user)
        return errReply(reply, 404, "Not Found", "User member not found.");

      const where = buildNotifWhere(userId, {
        read,
        endDate,
        startDate,
        type: type as NotificationType,
        priority: type as NotificationPriority,
      });

      const [notifications, total, unreadCount] = await prisma.$transaction([
        prisma.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, read: false } }),
      ]);

      return __reply<TResponseType<TNotificationList>>(reply, 200, {
        payload: {
          data: notifications as TNotification[],
          pagination: {
            ...__pagination(page, limit, total, skip),
            unreadCount,
          },
        },
      });
    },
  );

  // ── 3. Get Notification by ID ────────────────────────────────────────────
  fastify.get<{ Params: Static<typeof getIdParamScheme> }>(
    "/notifications/:id",
    {
      preHandler: authenticate,
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user.sub;

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });
      if (!notification)
        return errReply(reply, 404, "Not Found", "Notification not found.");

      return __reply<TResponseType<TNotification>>(reply, 200, {
        payload: notification as TNotification,
      });
    },
  );

  // ── 4. Create Notification (Admin / System) ──────────────────────────────
  fastify.post<{ Body: Static<typeof postNotificationBodyScheme> }>(
    "/notifications",
    {
      preHandler: authorize(["admin"]),
      schema: { body: postNotificationBodyScheme },
    },
    async (req, reply) => {
      const {
        userId,
        type,
        title,
        message,
        actionUrl,
        icon = "User",
        metadata = "{}",
        priority = "medium",
      } = req.body;

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user)
          return errReply(
            reply,
            404,
            "Not Found",
            "Target staff member not found.",
          );

        const notification = await prisma.notification.create({
          data: {
            id: idGenerator("notif_").toLowerCase(),
            userId,
            title,
            message,
            read: false,
            readAt: null,
            icon: icon ?? null,
            metadata: metadata ?? null,
            actionUrl: actionUrl ?? null,
            type: type as NotificationType,
            priority: priority as TNotificationPriority,
          },
        });

        return __reply<TResponseType<TNotification>>(reply, 201, {
          payload: notification as TNotification,
          message: "Notification created successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to create notification. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 5. Mark Notification(s) as Read ─────────────────────────────────────
  fastify.patch<{ Body: Static<typeof patchMarkReadBodyScheme> }>(
    "/notifications/mark-read",
    {
      preHandler: authenticate,
      schema: { body: patchMarkReadBodyScheme },
    },
    async (req, reply) => {
      const { notificationIds } = req.body;
      const userId = req.user.sub;

      const { count } = await prisma.notification.updateMany({
        where: { id: { in: notificationIds }, userId, read: false },
        data: { read: true, readAt: new Date() },
      });

      return __reply<TResponseType<TMarkReadPayload>>(reply, 200, {
        payload: { count },
        message: `${count} notification(s) marked as read.`,
      });
    },
  );

  // ── 6. Mark All as Read ──────────────────────────────────────────────────
  fastify.patch(
    "/notifications/mark-all-read",
    { preHandler: authenticate },
    async (req, reply) => {
      const userId = req.user.sub;

      const { count } = await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      });

      return __reply<TResponseType<TMarkReadPayload>>(reply, 200, {
        payload: { count },
        message: `${count} notification(s) marked as read.`,
      });
    },
  );

  // ── 7. Mark as Unread ────────────────────────────────────────────────────
  fastify.patch<{ Params: Static<typeof getIdParamScheme> }>(
    "/notifications/:id/mark-unread",
    {
      preHandler: authenticate,
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user.sub;

      try {
        const existing = await prisma.notification.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!existing)
          return errReply(reply, 404, "Not Found", "Notification not found.");

        await prisma.notification.update({
          where: { id },
          data: { read: false, readAt: null },
        });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Notification marked as unread.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to update notification. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 8. Delete Notification ───────────────────────────────────────────────
  fastify.delete<{ Params: Static<typeof getIdParamScheme> }>(
    "/notifications/:id",
    { preHandler: authenticate, schema: { params: getIdParamScheme } },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user.sub;

      try {
        const existing = await prisma.notification.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!existing)
          return errReply(reply, 404, "Not Found", "Notification not found.");

        await prisma.notification.delete({ where: { id } });

        return __reply<TResponseType<boolean>>(reply, 200, {
          payload: true,
          message: "Notification deleted.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to delete notification. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ── 9. Delete All Read Notifications ────────────────────────────────────
  fastify.delete(
    "/notifications/delete-read",
    { preHandler: authenticate },
    async (req, reply) => {
      const userId = req.user.sub;

      const { count } = await prisma.notification.deleteMany({
        where: { userId, read: true },
      });

      return __reply<TResponseType<{ count: number }>>(reply, 200, {
        payload: { count },
        message: `${count} read notification(s) deleted.`,
      });
    },
  );

  // ── 10. Get Notification Stats (current user) ────────────────────────────
  fastify.get(
    "/notifications/stats",
    { preHandler: authenticate },
    async (req, reply) => {
      const userId = req.user.sub;
      return _getStats(userId, reply);
    },
  );

  // ── 11. Get Notification Stats (by staff — Admin) ────────────────────────
  fastify.get<{ Params: Static<typeof getIdParamScheme> }>(
    "notifications/users/:id/stats",
    {
      preHandler: authorize(["admin"]),
      schema: { params: getIdParamScheme },
    },
    async (req, reply) => {
      const { id: userId } = req.params;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user)
        return errReply(reply, 404, "Not Found", "User member not found.");
      return _getStats(userId, reply);
    },
  );

  // ── 12. Get Notification Preferences ────────────────────────────────────
  fastify.get(
    "/notifications/preferences",
    { preHandler: authenticate },
    async (req, reply) => {
      const userId = req.user.sub;

      const prefs = await prisma.notificationPreferences.findUnique({
        where: { userId },
      });

      return __reply<TResponseType<TNotificationPreferences>>(reply, 200, {
        payload: prefs
          ? (prefs as unknown as TNotificationPreferences)
          : DEFAULT_PREFERENCES(userId),
      });
    },
  );

  // ── 13. Update Notification Preferences ─────────────────────────────────
  fastify.patch<{ Body: Static<typeof patchPreferencesBodyScheme> }>(
    "/notifications/preferences",
    {
      preHandler: authenticate,
      schema: { body: patchPreferencesBodyScheme },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const {
        quietHours,
        pushNotifications,
        notificationTypes,
        emailNotifications,
      } = req.body;

      try {
        // upsert — creates default row if preferences don't yet exist, then patches
        const prefs = await prisma.notificationPreferences.upsert({
          where: { userId },
          create: {
            ...DEFAULT_PREFERENCES(userId),
            ...(emailNotifications !== undefined && { emailNotifications }),
            ...(pushNotifications !== undefined && { pushNotifications }),
            ...(notificationTypes !== undefined && { notificationTypes }),
            ...(quietHours !== undefined && { quietHours }),
          },
          update: {
            ...(emailNotifications !== undefined && { emailNotifications }),
            ...(pushNotifications !== undefined && { pushNotifications }),
            ...(notificationTypes !== undefined && { notificationTypes }),
            ...(quietHours !== undefined && { quietHours }),
          },
        });

        return __reply<TResponseType<TNotificationPreferences>>(reply, 200, {
          payload: prefs as unknown as TNotificationPreferences,
          message: "Preferences updated successfully.",
        });
      } catch (err) {
        return errReply(
          reply,
          500,
          "Internal Server Error",
          `Failed to update preferences. ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
  );

  // ─── Private: shared stats logic ────────────────────────────────────────
  async function _getStats(
    userId: string,
    reply: Parameters<typeof __reply>[0],
  ) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week = new Date(today.getTime() - 7 * 86_400_000);
    // groupBy for read/unread + type breakdown — no row fetching
    const [statusGroups, typeGroups, todayCount, weekCount] =
      await prisma.$transaction([
        prisma.notification.groupBy({
          by: ["read"],
          where: { userId },
          _count: { _all: true },
          orderBy: {},
        }),
        prisma.notification.groupBy({
          by: ["type"],
          where: { userId },
          _count: { _all: true },
          orderBy: {},
        }),
        prisma.notification.count({
          where: { userId, createdAt: { gte: today } },
        }),
        prisma.notification.count({
          where: { userId, createdAt: { gte: week } },
        }),
      ]);

    const read = (statusGroups.find((g) => g.read)?._count as any)._all ?? 0;
    const unread = (statusGroups.find((g) => !g.read)?._count as any)._all ?? 0;
    const byType = Object.fromEntries(
      typeGroups.map((g) => [g.type, (g._count as any)._all]),
    );

    const stats: TNotificationStats = {
      total: read + unread,
      read,
      unread,
      todayCount,
      weekCount,
      byType,
    };

    return __reply<TResponseType<TNotificationStats>>(reply, 200, {
      payload: stats,
    });
  }
});

import type { __pagination } from "#utils/utils_helper.ts";

export type TNotificationType =
  | "leave_approved"
  | "leave_rejected"
  | "leave_pending"
  | "payroll"
  | "contract"
  | "system"
  | "profile"
  | "attendance"
  | "general";

export type TNotificationPriority = "low" | "medium" | "high" | "urgent";

export type TNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  read: boolean;
  message: string;
  readAt: Date | null;
  icon: string | null;
  actionUrl: string | null;
  priority: TNotificationPriority;
  metadata: Record<string, any> | null;
  createdAt: Date;
};

export type TNotificationStats = {
  total: number;
  read: number;
  unread: number;
  todayCount: number;
  weekCount: number;
  byType: Record<string, number>;
};

export type TNotificationList = {
  data: TNotification[];
  pagination: ReturnType<typeof __pagination> & { unreadCount: number };
};

export type TMarkReadPayload = {
  count: number;
};

export type TNotificationPreferences = {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationTypes: Record<string, boolean>;
  quietHours: { enabled: boolean; start: string; end: string };
};

export type TNotificationQueryParams = {
  page?: string;
  read?: string;
  limit?: string;
  type?: TNotificationType;
  priority?: TNotificationPriority;
  startDate?: string;
  endDate?: string;
};

export type TMarkNotificationAsReadRequest = {
  notificationIds: string[];
};

export type TMarkNotificationAsReadResponse = {
  success: boolean;
  count: number;
  notifications: TNotification[];
};

export type TNotificationIconColor =
  | "text-success"
  | "text-primary"
  | "text-warning"
  | "text-danger"
  | "text-info"
  | "text-accent";

export type TNotificationConfig = {
  icon: string;
  color: TNotificationIconColor;
  borderColor: string;
};

/*
export type TNotificationPreferences = {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationTypes: {
    leave_approved: boolean;
    leave_rejected: boolean;
    leave_pending: boolean;
    payroll: boolean;
    contract: boolean;
    system: boolean;
    profile: boolean;
    attendance: boolean;
    general: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
};
*/

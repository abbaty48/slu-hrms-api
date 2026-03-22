export type TNotificationType =
  | "leave_approved"
  | "leave_rejected"
  | "leave_pending"
  | "payroll"
  | "contract"
  | "system"
  | "profile"
  | "attendance"
  | "general"

export type TNotificationPriority = "low" | "medium" | "high" | "urgent"

export type TNotification = {
  id: string
  userId: string
  type: TNotificationType
  title: string
  message: string
  priority: TNotificationPriority
  read: boolean
  icon?: string
  actionUrl?: string | null
  metadata?: Record<string, any>
  createdAt: string
  readAt?: string | null
}

export type TNotificationPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  unreadCount: number
}

export type TNotificationListResponse = {
  data: TNotification[]
  pagination: TNotificationPagination
}

export type TNotificationStats = {
  total: number
  unread: number
  read: number
  todayCount: number
  weekCount: number
  byType: Record<TNotificationType, number>
}

export type TNotificationQueryParams = {
  page?: string
  limit?: string
  read?: string
  type?: TNotificationType
  priority?: TNotificationPriority
  startDate?: string
  endDate?: string
}

export type TMarkNotificationAsReadRequest = {
  notificationIds: string[]
}

export type TMarkNotificationAsReadResponse = {
  success: boolean
  count: number
  notifications: TNotification[]
}

export type TNotificationIconColor =
  | "text-success"
  | "text-primary"
  | "text-warning"
  | "text-danger"
  | "text-info"
  | "text-accent"

export type TNotificationConfig = {
  icon: string
  color: TNotificationIconColor
  borderColor: string
}

export type TNotificationPreferences = {
  userId: string,
  emailNotifications: boolean,
  pushNotifications: boolean,
  notificationTypes: {
    leave_approved: boolean,
    leave_rejected: boolean,
    leave_pending: boolean,
    payroll: boolean,
    contract: boolean,
    system: boolean,
    profile: boolean,
    attendance: boolean,
    general: boolean,
  },
  quietHours: {
    enabled: boolean,
    start: string,
    end: string,
  },
}
//

export interface TimeSlot {
  id: string
  hour: number
  externalId: string
  displayName: string
  createdAt: string
}

export interface Schedule {
  id: string
  name: string
  timeSlotId: string
  timeSlot?: TimeSlot
  reservationDayOfWeek: number // 0-6 (dom-sáb)
  triggerDayOfWeek: number // 0-6 (dom-sáb)
  triggerTime: string // '00:01:00'
  triggerMode: "reservation_date" | "trigger_date" // modo de cálculo do disparo
  triggerDatetime?: string // data/hora específica quando trigger_mode = 'trigger_date'
  cronExpression: string
  pgCronJobId?: number
  frequency: "once" | "weekly" | "biweekly" | "monthly"
  isActive: boolean
  startDate?: string
  endDate?: string
  notifyOnSuccess: boolean
  notifyOnFailure: boolean
  // Campos de Pre-flight (Teste de Voo)
  preflightEnabled: boolean
  preflightHoursBefore: number
  preflightNotifyOnSuccess: boolean
  preflightNotifyOnFailure: boolean
  lastPreflightAt?: string
  createdAt: string
  updatedAt: string
}

// Interface para entrada de log estruturado (step-by-step)
export interface LogEntry {
  step: string
  message: string
  details?: Record<string, unknown>
  timestamp: string
}

export interface ExecutionLog {
  id: string
  scheduleId?: string
  schedule?: Schedule
  userId?: string
  status: "success" | "error" | "pending"
  message?: string
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  reservationDate?: string
  executedAt: string
  durationMs?: number
  isTest?: boolean
  testHour?: number
  // Tipo de execução: reserva real, pre-flight, teste ou auto-cancel
  executionType: "reservation" | "preflight" | "test" | "auto_cancel"
  // Campos para log estruturado
  errorStep?: string
  executionLog?: LogEntry[]
}

export interface Reservation {
  id: string
  scheduleId?: string
  schedule?: Schedule
  executionLogId?: string
  executionLog?: ExecutionLog
  timeSlotId?: string
  timeSlot?: TimeSlot
  reservationDate: string
  status: "confirmed" | "cancelled" | "failed"
  externalId?: string
  createdAt: string
}

export interface AppConfig {
  id: string
  key: string
  value?: string
  ssmParameterName?: string
  lastSyncedAt?: string
  updatedAt: string
}

export interface Notification {
  id: string
  type: "email" | "push"
  subject?: string
  body?: string
  status: "sent" | "failed" | "pending"
  relatedLogId?: string
  sentAt: string
}

// Form types
export interface ScheduleFormData {
  name: string
  timeSlotHour: number
  reservationDayOfWeek: number
  frequency: "once" | "weekly" | "biweekly" | "monthly"
  notifyOnSuccess: boolean
  notifyOnFailure: boolean
  startDate?: string
  endDate?: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Dashboard stats
export interface DashboardStats {
  activeSchedules: number
  successRate: number
  nextReservation?: {
    date: string
    time: string
    scheduleName: string
  }
  tokenStatus: "valid" | "expiring" | "expired" | "unknown"
}

// Supabase Integration types
export interface SpeedAuthToken {
  token: string
  expiresAt: string
  userId: string
}

export interface SpeedReservationRequest {
  token: string
  timeSlotId: string
  date: string // YYYY-MM-DD
  userId: string
}

export interface SpeedReservationResponse {
  success: boolean
  reservationId?: string
  message?: string
  error?: string
}

// Edge Function Payloads
export interface CreateSchedulePayload {
  scheduleId: string
  cronExpression: string
  scheduleName: string
}

export interface ExecuteReservationPayload {
  scheduleId: string
  executionDate: string
  timeSlotId: string
}

// pg_cron job info
export interface PgCronJob {
  jobid: number
  schedule: string
  command: string
  nodename: string
  nodeport: number
  database: string
  username: string
  active: boolean
  jobname: string
}

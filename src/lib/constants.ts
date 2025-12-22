// Time slots based on the existing system
export const TIME_SLOTS = [
  { hour: 6, externalId: "455", displayName: "06:00" },
  { hour: 7, externalId: "440", displayName: "07:00" },
  { hour: 8, externalId: "441", displayName: "08:00" },
  { hour: 9, externalId: "442", displayName: "09:00" },
  { hour: 10, externalId: "443", displayName: "10:00" },
  { hour: 11, externalId: "444", displayName: "11:00" },
  { hour: 12, externalId: "445", displayName: "12:00" },
  { hour: 13, externalId: "446", displayName: "13:00" },
  { hour: 14, externalId: "447", displayName: "14:00" },
  { hour: 15, externalId: "448", displayName: "15:00" },
  { hour: 16, externalId: "449", displayName: "16:00" },
  { hour: 17, externalId: "450", displayName: "17:00" },
  { hour: 18, externalId: "451", displayName: "18:00" },
  { hour: 19, externalId: "452", displayName: "19:00" },
  { hour: 20, externalId: "453", displayName: "20:00" },
  { hour: 21, externalId: "454", displayName: "21:00" },
] as const

export type TimeSlot = (typeof TIME_SLOTS)[number]

export function getTimeSlotByHour(hour: number): TimeSlot | undefined {
  return TIME_SLOTS.find((slot) => slot.hour === hour)
}

export function getTimeSlotByExternalId(
  externalId: string
): TimeSlot | undefined {
  return TIME_SLOTS.find((slot) => slot.externalId === externalId)
}

// Navigation items
export const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "Home" },
  { path: "/schedules", label: "Agendamentos", icon: "Calendar" },
  { path: "/logs", label: "Logs", icon: "FileText" },
  { path: "/settings", label: "Configurações", icon: "Settings" },
] as const

// Status types
export const EXECUTION_STATUS = {
  SUCCESS: "success",
  ERROR: "error",
  PENDING: "pending",
} as const

export type ExecutionStatus =
  (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS]

// Frequency options
export const FREQUENCY_OPTIONS = [
  { value: "once", label: "Uma vez" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
] as const

export type Frequency = (typeof FREQUENCY_OPTIONS)[number]["value"]

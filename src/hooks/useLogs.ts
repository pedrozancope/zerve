import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import type { Database } from "@/types/supabase"
import type { ExecutionLog, Schedule, LogEntry } from "@/types"

type ExecutionLogRow = Database["public"]["Tables"]["execution_logs"]["Row"]
type ScheduleRow = Database["public"]["Tables"]["schedules"]["Row"]

// Converter do formato do banco para o formato da aplicação
function mapExecutionLogFromDB(
  row: ExecutionLogRow & { schedule: ScheduleRow | null }
): ExecutionLog {
  // Tentar extrair log estruturado do flow_steps (prioridade) ou response_payload.log (fallback)
  const responsePayload = row.response_payload as
    | Record<string, unknown>
    | undefined
  const executionLog =
    (row.flow_steps as LogEntry[]) ||
    (responsePayload?.log as LogEntry[]) ||
    undefined

  // Extrair errorStep do response_payload.step ou tentar parsear da mensagem
  let errorStep = (responsePayload?.step as string) || undefined
  if (!errorStep && row.status === "error" && row.message) {
    // Tentar extrair step da mensagem formato: "[TESTE] [step_name] Error..."
    const stepMatch = row.message.match(/\[([a-z_]+)\]/i)
    if (stepMatch) {
      errorStep = stepMatch[1]
    }
  }

  return {
    id: row.id,
    scheduleId: row.schedule_id || undefined,
    schedule: row.schedule
      ? ({
          id: row.schedule.id,
          name: row.schedule.name,
          timeSlotId: row.schedule.time_slot_id,
          reservationDayOfWeek: row.schedule.reservation_day_of_week,
          triggerDayOfWeek: row.schedule.trigger_day_of_week,
          triggerTime: row.schedule.trigger_time,
          cronExpression: row.schedule.cron_expression,
          frequency: row.schedule.frequency,
          isActive: row.schedule.is_active,
          notifyOnSuccess: row.schedule.notify_on_success,
          notifyOnFailure: row.schedule.notify_on_failure,
          createdAt: row.schedule.created_at,
          updatedAt: row.schedule.updated_at,
        } as Schedule)
      : undefined,
    status: row.status,
    message: row.message || undefined,
    requestPayload: row.request_payload as Record<string, unknown> | undefined,
    responsePayload: row.response_payload as
      | Record<string, unknown>
      | undefined,
    reservationDate: row.reservation_date || undefined,
    executedAt: row.executed_at,
    durationMs: row.duration_ms || undefined,
    isTest: (row as any).is_test || false,
    testHour: (row as any).test_hour || undefined,
    // Tipo de execução
    executionType: (row as any).execution_type || "reservation",
    // Novos campos para log estruturado
    errorStep,
    executionLog,
  }
}

// Hook para listar todos os logs do usuário
export function useLogs(filters?: {
  status?: "success" | "error" | "pending"
  scheduleId?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ["execution_logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("execution_logs")
        .select(
          `
          *,
          schedule:schedules(*)
        `
        )
        .order("executed_at", { ascending: false })

      // Aplicar filtros
      if (filters?.status) {
        query = query.eq("status", filters.status)
      }

      if (filters?.scheduleId) {
        query = query.eq("schedule_id", filters.scheduleId)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) throw error

      return (
        data as unknown as (ExecutionLogRow & {
          schedule: ScheduleRow | null
        })[]
      ).map(mapExecutionLogFromDB)
    },
  })
}

// Hook para buscar um log específico
export function useLog(id: string | undefined) {
  return useQuery({
    queryKey: ["execution_logs", id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from("execution_logs")
        .select(
          `
          *,
          schedule:schedules(*)
        `
        )
        .eq("id", id)
        .single()

      if (error) throw error

      return mapExecutionLogFromDB(
        data as unknown as ExecutionLogRow & { schedule: ScheduleRow | null }
      )
    },
    enabled: !!id,
  })
}

// Hook para estatísticas de logs
export function useLogStats() {
  return useQuery({
    queryKey: ["execution_logs", "stats"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado")

      // Buscar estatísticas da view
      const { data, error } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 = sem dados encontrados
        throw error
      }

      return (
        data || {
          user_id: user.id,
          active_schedules: 0,
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0,
          success_rate: 0,
        }
      )
    },
  })
}

// Hook para logs recentes (dashboard)
export function useRecentLogs(limit: number = 5) {
  return useLogs({ limit })
}

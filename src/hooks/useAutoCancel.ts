import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { toast } from "sonner"

// =============================================================================
// Types
// =============================================================================
export interface AutoCancelConfig {
  id: string
  userId?: string
  isActive: boolean
  triggerTime: string // HH:MM:SS format
  cancellationReason: string
  notifyOnSuccessNoReservations: boolean
  notifyOnSuccessWithReservations: boolean
  notifyOnFailure: boolean
  pgCronJobId?: number
  lastExecutedAt?: string
  createdAt: string
  updatedAt: string
}

interface AutoCancelConfigRow {
  id: string
  user_id: string | null
  is_active: boolean
  trigger_time: string // HH:MM:SS format
  cancellation_reason: string
  notify_on_success_no_reservations: boolean
  notify_on_success_with_reservations: boolean
  notify_on_failure: boolean
  pg_cron_job_id: number | null
  last_executed_at: string | null
  created_at: string
  updated_at: string
}

interface UpdateAutoCancelConfigParams {
  isActive?: boolean
  triggerTime?: string // HH:MM:SS format
  cancellationReason?: string
  notifyOnSuccessNoReservations?: boolean
  notifyOnSuccessWithReservations?: boolean
  notifyOnFailure?: boolean
}

interface RunAutoCancelParams {
  dryRun?: boolean
  adHoc?: boolean
}

// =============================================================================
// Mappers
// =============================================================================
function mapAutoCancelConfigFromDB(row: AutoCancelConfigRow): AutoCancelConfig {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    isActive: row.is_active,
    triggerTime: row.trigger_time,
    cancellationReason: row.cancellation_reason,
    notifyOnSuccessNoReservations: row.notify_on_success_no_reservations,
    notifyOnSuccessWithReservations: row.notify_on_success_with_reservations,
    notifyOnFailure: row.notify_on_failure,
    pgCronJobId: row.pg_cron_job_id || undefined,
    lastExecutedAt: row.last_executed_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook para buscar a configuração do auto-cancel do usuário
 */
export function useAutoCancelConfig() {
  return useQuery({
    queryKey: ["auto_cancel_config"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado")

      const { data, error } = await supabase
        .from("auto_cancel_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error) throw error

      return data
        ? mapAutoCancelConfigFromDB(data as AutoCancelConfigRow)
        : null
    },
  })
}

/**
 * Hook para criar ou atualizar a configuração do auto-cancel
 */
export function useUpsertAutoCancelConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: UpdateAutoCancelConfigParams) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado")

      // Verificar se já existe configuração
      const { data: existing } = await supabase
        .from("auto_cancel_config")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      let result

      const payload: any = {
        user_id: user.id,
      }

      // Adicionar apenas os campos que foram fornecidos
      if (params.isActive !== undefined) payload.is_active = params.isActive
      if (params.triggerTime !== undefined)
        payload.trigger_time = params.triggerTime
      if (params.cancellationReason !== undefined)
        payload.cancellation_reason = params.cancellationReason
      if (params.notifyOnSuccessNoReservations !== undefined)
        payload.notify_on_success_no_reservations =
          params.notifyOnSuccessNoReservations
      if (params.notifyOnSuccessWithReservations !== undefined)
        payload.notify_on_success_with_reservations =
          params.notifyOnSuccessWithReservations
      if (params.notifyOnFailure !== undefined)
        payload.notify_on_failure = params.notifyOnFailure

      if (existing) {
        // Atualizar
        const { data, error } = await supabase
          .from("auto_cancel_config")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single()

        if (error) throw error
        result = data
      } else {
        // Criar
        const { data, error } = await supabase
          .from("auto_cancel_config")
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        result = data
      }

      return mapAutoCancelConfigFromDB(result as AutoCancelConfigRow)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto_cancel_config"] })
      toast.success("Configuração do Auto-Cancel atualizada!")
    },
    onError: (error) => {
      console.error("Erro ao atualizar configuração do Auto-Cancel:", error)
      toast.error("Erro ao atualizar configuração")
    },
  })
}

/**
 * Hook para executar o auto-cancel manualmente
 */
export function useRunAutoCancel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: RunAutoCancelParams = {}) => {
      const { dryRun = false, adHoc = true } = params

      // Buscar o configId primeiro
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado")

      const { data: config } = await supabase
        .from("auto_cancel_config")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!config) throw new Error("Configuração não encontrada")

      // Chamar a Edge Function usando fetch (mesmo padrão das outras functions)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(
        `${supabaseUrl}/functions/v1/run-auto-cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            configId: config.id,
            dryRun,
            adHoc,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      return data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["auto_cancel_config"] })
      queryClient.invalidateQueries({ queryKey: ["execution_logs"] })

      if (variables.dryRun) {
        toast.success(
          "🔍 Simulação concluída! Verifique os logs para detalhes."
        )
      } else {
        const cancelledCount = data?.execution?.successfulCancellations || 0
        if (cancelledCount === 0) {
          toast.success("✅ Auto-Cancel executado: Nenhuma reserva encontrada")
        } else {
          toast.success(
            `🎾 Auto-Cancel executado: ${cancelledCount} ${
              cancelledCount === 1 ? "reserva cancelada" : "reservas canceladas"
            }`
          )
        }
      }
    },
    onError: (error) => {
      console.error("Erro ao executar Auto-Cancel:", error)
      toast.error("Erro ao executar Auto-Cancel")
    },
  })
}

/**
 * Hook para deletar a configuração do auto-cancel
 */
export function useDeleteAutoCancelConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("auto_cancel_config")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto_cancel_config"] })
      toast.success("Configuração do Auto-Cancel removida!")
    },
    onError: (error) => {
      console.error("Erro ao deletar configuração do Auto-Cancel:", error)
      toast.error("Erro ao deletar configuração")
    },
  })
}

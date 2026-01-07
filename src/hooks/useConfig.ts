import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import type { Database } from "@/types/supabase"
import type { AppConfig } from "@/types"

type AppConfigRow = Database["public"]["Tables"]["app_config"]["Row"]
// type AppConfigInsert = Database["public"]["Tables"]["app_config"]["Insert"]
// type AppConfigUpdate = Database["public"]["Tables"]["app_config"]["Update"]

// Converter do formato do banco para o formato da aplicação
function mapConfigFromDB(row: AppConfigRow): AppConfig {
  return {
    id: row.id,
    key: row.key,
    value: row.value || undefined,
    ssmParameterName: row.ssm_parameter_name || undefined,
    lastSyncedAt: row.last_synced_at || undefined,
    updatedAt: row.updated_at,
  }
}

// Hook para buscar todas as configurações do usuário
export function useConfig() {
  return useQuery({
    queryKey: ["app_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("*")
        .order("key", { ascending: true })

      if (error) throw error

      return data.map(mapConfigFromDB)
    },
  })
}

// Hook para buscar uma configuração específica por chave
export function useConfigByKey(key: string) {
  return useQuery({
    queryKey: ["app_config", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("*")
        .eq("key", key)
        .maybeSingle()

      if (error) throw error

      return data ? mapConfigFromDB(data) : null
    },
  })
}

// Hook para criar ou atualizar configuração (upsert)
export function useUpsertConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      key,
      value,
      ssmParameterName,
    }: {
      key: string
      value?: string
      ssmParameterName?: string
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado")

      console.log("Upsert Config:", { user_id: user.id, key, value })

      // Primeiro, tentar buscar se já existe
      const { data: existing } = await supabase
        .from("app_config")
        .select("id")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle()

      let result

      if (existing) {
        // Atualizar existente
        console.log("Atualizando config existente:", existing.id)
        const { data, error } = await supabase
          .from("app_config")
          .update({
            value: value || null,
            ssm_parameter_name: ssmParameterName || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single()

        if (error) {
          console.error("Erro ao atualizar:", error)
          throw error
        }
        result = data
      } else {
        // Inserir novo
        console.log("Inserindo novo config")
        const { data, error } = await supabase
          .from("app_config")
          .insert({
            user_id: user.id,
            key,
            value: value || null,
            ssm_parameter_name: ssmParameterName || null,
          })
          .select()
          .single()

        if (error) {
          console.error("Erro ao inserir:", error)
          throw error
        }
        result = data
      }

      console.log("Config salvo com sucesso:", result)
      return mapConfigFromDB(result)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["app_config"] })
      queryClient.invalidateQueries({ queryKey: ["app_config", variables.key] })
    },
    onError: (error) => {
      console.error("Erro ao atualizar configuração:", error)
    },
  })
}

// Hook para deletar configuração
export function useDeleteConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("app_config").delete().eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_config"] })
    },
    onError: (error) => {
      console.error("Erro ao deletar configuração:", error)
    },
  })
}

// Hook para atualizar token de autenticação
export function useUpdateToken() {
  const upsertConfig = useUpsertConfig()

  return {
    ...upsertConfig,
    mutate: (token: string) => {
      upsertConfig.mutate({
        key: "auth_token",
        value: token,
      })
    },
    mutateAsync: async (token: string) => {
      return upsertConfig.mutateAsync({
        key: "auth_token",
        value: token,
      })
    },
  }
}

// Hook para verificar status do token
export function useTokenStatus() {
  const { data: tokenConfig, isLoading } = useConfigByKey("auth_token")

  return {
    hasToken: !!tokenConfig?.value,
    lastUpdated: tokenConfig?.updatedAt,
    lastSynced: tokenConfig?.lastSyncedAt,
    isLoading,
  }
}

// Hook para configuração de dias consecutivos entre reservas
export function useConsecutiveDaysConfig() {
  const { data: warningEnabledConfig, isLoading: loadingWarning } =
    useConfigByKey("consecutive_days_warning")
  const { data: minDaysConfig, isLoading: loadingMinDays } = useConfigByKey(
    "min_days_between_reservations"
  )

  return {
    warningEnabled: warningEnabledConfig?.value !== "false", // Padrão: true
    minDaysBetween: parseInt(minDaysConfig?.value || "1", 10), // Padrão: 1 dia
    isLoading: loadingWarning || loadingMinDays,
  }
}

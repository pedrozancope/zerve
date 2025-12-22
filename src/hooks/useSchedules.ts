import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import type { Database } from "@/types/supabase"
import type { Schedule } from "@/types"
import { toast } from "sonner"

type ScheduleRow = Database["public"]["Tables"]["schedules"]["Row"]
type ScheduleInsert = Database["public"]["Tables"]["schedules"]["Insert"]
type ScheduleUpdate = Database["public"]["Tables"]["schedules"]["Update"]
type TimeSlotRow = Database["public"]["Tables"]["time_slots"]["Row"]

// Converter do formato do banco para o formato da aplicação
function mapScheduleFromDB(
  row: ScheduleRow & { time_slot: TimeSlotRow }
): Schedule {
  return {
    id: row.id,
    name: row.name,
    timeSlotId: row.time_slot_id,
    timeSlot: {
      id: row.time_slot.id,
      hour: row.time_slot.hour,
      externalId: row.time_slot.external_id,
      displayName: row.time_slot.display_name,
      createdAt: row.time_slot.created_at,
    },
    reservationDayOfWeek: row.reservation_day_of_week,
    triggerDayOfWeek: row.trigger_day_of_week,
    triggerTime: row.trigger_time,
    triggerMode: (row as any).trigger_mode || "reservation_date",
    triggerDatetime: (row as any).trigger_datetime || undefined,
    cronExpression: row.cron_expression,
    pgCronJobId: row.pg_cron_job_id || undefined,
    frequency: row.frequency,
    isActive: row.is_active,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    notifyOnSuccess: row.notify_on_success,
    notifyOnFailure: row.notify_on_failure,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Hook para listar todos os agendamentos do usuário
export function useSchedules() {
  return useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select(
          `
          *,
          time_slot:time_slots(*)
        `
        )
        .order("created_at", { ascending: false })

      if (error) throw error

      return (
        data as unknown as (ScheduleRow & { time_slot: TimeSlotRow })[]
      ).map(mapScheduleFromDB)
    },
  })
}

// Hook para buscar um agendamento específico
export function useSchedule(id: string | undefined) {
  return useQuery({
    queryKey: ["schedules", id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from("schedules")
        .select(
          `
          *,
          time_slot:time_slots(*)
        `
        )
        .eq("id", id)
        .single()

      if (error) throw error

      return mapScheduleFromDB(
        data as unknown as ScheduleRow & { time_slot: TimeSlotRow }
      )
    },
    enabled: !!id,
  })
}

// Hook para criar novo agendamento
export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (schedule: Omit<ScheduleInsert, "user_id">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado")

      // 1. Create schedule in database
      const { data, error } = await supabase
        .from("schedules")
        .insert([
          {
            ...schedule,
            user_id: user.id,
          } as any,
        ])
        .select(
          `
          *,
          time_slot:time_slots(*)
        `
        )
        .single()

      if (error) throw error

      const newSchedule = mapScheduleFromDB(
        data as unknown as ScheduleRow & { time_slot: TimeSlotRow }
      )

      // O job pg_cron é criado automaticamente via Database Trigger
      // (ver migration 006_auto_manage_cron_jobs.sql)

      return newSchedule
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
      toast.success("Agendamento criado com sucesso!")
    },
    onError: (error) => {
      console.error("Erro ao criar agendamento:", error)
      toast.error("Erro ao criar agendamento")
    },
  })
}

// Hook para atualizar agendamento
export function useUpdateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: ScheduleUpdate & { id: string }) => {
      // Sempre limpar last_executed_at ao editar para permitir nova execução
      const updateData: any = {
        ...updates,
        last_executed_at: null,
      }

      const { data, error } = await supabase
        .from("schedules")
        .update(updateData)
        .eq("id", id)
        .select(
          `
          *,
          time_slot:time_slots(*)
        `
        )
        .single()

      if (error) throw error

      return mapScheduleFromDB(
        data as unknown as ScheduleRow & { time_slot: TimeSlotRow }
      )
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
      queryClient.invalidateQueries({ queryKey: ["schedules", variables.id] })
      toast.success("Agendamento atualizado com sucesso!")
    },
    onError: (error) => {
      console.error("Erro ao atualizar agendamento:", error)
      toast.error("Erro ao atualizar agendamento")
    },
  })
}

// Hook para alternar status ativo/inativo
export function useToggleSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from("schedules")
        .update({ is_active: isActive } as any)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
      toast.success("Status atualizado!")
    },
    onError: (error) => {
      console.error("Erro ao alterar status:", error)
      toast.error("Erro ao alterar status")
    },
  })
}

// Hook para deletar agendamento
export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
      toast.success("Agendamento excluído com sucesso!")
    },
    onError: (error) => {
      console.error("Erro ao excluir agendamento:", error)
      toast.error("Erro ao excluir agendamento")
    },
  })
}

// Hook para buscar time slots disponíveis
export function useTimeSlots() {
  return useQuery({
    queryKey: ["time_slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_slots")
        .select("*")
        .order("hour", { ascending: true })

      if (error) throw error
      return data
    },
  })
}

import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Plus,
  Calendar,
  Clock,
  Trash2,
  Edit,
  PlayCircle,
  Loader2,
  Zap,
  Target,
  Repeat,
  CalendarClock,
  Plane,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DAY_NAMES_PT } from "@/lib/cron"
import { TIME_SLOTS } from "@/lib/constants"
import {
  useSchedules,
  useToggleSchedule,
  useDeleteSchedule,
} from "@/hooks/useSchedules"
import { supabase } from "@/services/supabase"
import { toast } from "sonner"

export default function Schedules() {
  const { data: schedules, isLoading } = useSchedules()
  const toggleSchedule = useToggleSchedule()
  const deleteSchedule = useDeleteSchedule()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null)
  const [testingScheduleId, setTestingScheduleId] = useState<string | null>(
    null
  )

  const getTimeSlotDisplay = (externalId: string) => {
    const slot = TIME_SLOTS.find((s) => s.externalId === externalId)
    return slot?.displayName || "-"
  }

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      once: "Uma vez",
      weekly: "Semanal",
      biweekly: "Quinzenal",
      monthly: "Mensal",
    }
    return labels[frequency] || frequency
  }

  const getNextTriggerDate = (schedule: any) => {
    if (!schedule.isActive) {
      return null
    }

    const now = new Date()

    // MODO: Data/hora específica (trigger_date)
    // O usuário definiu uma data/hora específica, sem regra dos 10 dias
    if (schedule.triggerMode === "trigger_date" && schedule.triggerDatetime) {
      const triggerDate = new Date(schedule.triggerDatetime)

      // Se frequência é "once", apenas retorna se ainda não passou
      if (schedule.frequency === "once") {
        return triggerDate > now ? triggerDate : null
      }

      // Para frequências recorrentes, calcula próximo disparo baseado na data/hora específica
      // Se ainda não passou, retorna a data original
      if (triggerDate > now) {
        return triggerDate
      }

      // Se já passou, calcula próximo disparo baseado na frequência
      const dayOfWeek = triggerDate.getDay()
      const hours = triggerDate.getHours()
      const minutes = triggerDate.getMinutes()

      let daysUntilTrigger = (dayOfWeek - now.getDay() + 7) % 7
      if (daysUntilTrigger === 0) {
        // Se é hoje, verifica se já passou o horário
        const todayTrigger = new Date(now)
        todayTrigger.setHours(hours, minutes, 0, 0)
        if (todayTrigger <= now) {
          daysUntilTrigger = 7
        }
      }

      const nextTrigger = new Date(now)
      nextTrigger.setDate(now.getDate() + daysUntilTrigger)
      nextTrigger.setHours(hours, minutes, 0, 0)
      return nextTrigger
    }

    // MODO: Baseado na reserva (reservation_date)
    // Horário sempre 00:01, dia baseado no dia da reserva com regra dos 10 dias
    if (schedule.triggerMode === "reservation_date") {
      // Se frequência é "once" e não há triggerDatetime, não há próximo disparo definido
      if (schedule.frequency === "once") {
        return null
      }

      // Para frequências recorrentes, calcula baseado no triggerDayOfWeek (que já considera os 10 dias)
      const triggerDay = schedule.triggerDayOfWeek
      const [hours, minutes] = schedule.triggerTime.split(":").map(Number)

      let daysUntilTrigger = (triggerDay - now.getDay() + 7) % 7
      if (daysUntilTrigger === 0) {
        const todayTrigger = new Date(now)
        todayTrigger.setHours(hours, minutes, 0, 0)
        if (todayTrigger <= now) {
          daysUntilTrigger = 7
        }
      }

      const nextTrigger = new Date(now)
      nextTrigger.setDate(now.getDate() + daysUntilTrigger)
      nextTrigger.setHours(hours, minutes, 0, 0)
      return nextTrigger
    }

    return null
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getNextReservationDates = (
    reservationDayOfWeek: number,
    count: number = 3
  ) => {
    const results: Date[] = []
    const now = new Date()
    const currentDay = now.getDay()

    // Calcula dias até a próxima ocorrência do dia da semana
    let daysUntil = (reservationDayOfWeek - currentDay + 7) % 7
    if (daysUntil === 0) {
      daysUntil = 7 // Se é hoje, pega próxima semana
    }

    // Gera as próximas N datas
    for (let i = 0; i < count; i++) {
      const nextDate = new Date(now)
      nextDate.setDate(now.getDate() + daysUntil + i * 7)
      nextDate.setHours(0, 0, 0, 0)
      results.push(nextDate)
    }

    return results
  }

  const handleToggle = (id: string, isActive: boolean) => {
    toggleSchedule.mutate({ id, isActive: !isActive })
  }

  const handleDeleteClick = (id: string) => {
    setScheduleToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (scheduleToDelete) {
      deleteSchedule.mutate(scheduleToDelete)
    }
    setDeleteDialogOpen(false)
    setScheduleToDelete(null)
  }

  const handleDryRunTest = async (scheduleId: string, scheduleName: string) => {
    setTestingScheduleId(scheduleId)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-reservation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            scheduleId,
            dryRun: true,
          }),
        }
      )

      const result = await response.json()

      if (result.success) {
        toast.success(`✅ Dry Run concluído para "${scheduleName}"`, {
          description:
            "Todos os passos executaram corretamente. A reserva real funcionará!",
          duration: 5000,
        })
      } else {
        toast.error(`❌ Erro no Dry Run: ${result.error}`, {
          description: `Etapa com falha: ${result.step}`,
          duration: 8000,
        })
      }
    } catch (error) {
      toast.error("Erro ao executar Dry Run", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setTestingScheduleId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Agendamentos
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus triggers de reserva
            </p>
          </div>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Novo
          </Button>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agendamentos
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus triggers de reserva
          </p>
        </div>
        <Link to="/schedules/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        </Link>
      </div>

      {!schedules || schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">
                Nenhum agendamento criado
              </h3>
              <p className="text-sm mb-4">
                Crie seu primeiro agendamento para começar a reservar
                automaticamente.
              </p>
              <Link to="/schedules/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Agendamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules
            .sort((a, b) => {
              // Ativos primeiro, inativos depois
              if (a.isActive === b.isActive) return 0
              return a.isActive ? -1 : 1
            })
            .map((schedule) => {
              const nextReservations = getNextReservationDates(
                schedule.reservationDayOfWeek,
                3
              )
              const nextTrigger = getNextTriggerDate(schedule)

              return (
                <Card
                  key={schedule.id}
                  className={!schedule.isActive ? "opacity-50" : ""}
                >
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          {schedule.name}
                        </h3>
                        {schedule.isActive && (
                          <Badge variant="success">Ativo</Badge>
                        )}
                        {schedule.preflightEnabled && (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
                          >
                            <Plane className="h-3 w-3" />
                            Pre-flight
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDryRunTest(schedule.id, schedule.name)
                          }
                          disabled={testingScheduleId === schedule.id}
                          className="gap-1"
                          title="Testar agendamento sem fazer reserva real"
                        >
                          {testingScheduleId === schedule.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlayCircle className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">Dry Run</span>
                        </Button>
                        <Switch
                          checked={schedule.isActive}
                          onCheckedChange={() =>
                            handleToggle(schedule.id, schedule.isActive)
                          }
                          disabled={toggleSchedule.isPending}
                        />
                        <Link to={`/schedules/${schedule.id}`}>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(schedule.id)}
                          disabled={deleteSchedule.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Destaque: Reserva */}
                    <div className="mb-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 text-xs text-primary font-semibold mb-2">
                        <Target className="h-4 w-4" />
                        <span>RESERVA CONFIGURADA</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">
                          {DAY_NAMES_PT[schedule.reservationDayOfWeek]}
                        </span>
                        <span className="text-lg text-muted-foreground">•</span>
                        <span className="text-xl font-semibold">
                          {schedule.timeSlot?.displayName ||
                            getTimeSlotDisplay(schedule.timeSlotId)}
                        </span>
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Frequência */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <Repeat className="h-3.5 w-3.5" />
                          <span>FREQUÊNCIA</span>
                        </div>
                        <p className="text-sm font-medium">
                          {getFrequencyLabel(schedule.frequency)}
                        </p>
                      </div>

                      {/* Próximo Disparo */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <Zap className="h-3.5 w-3.5" />
                          <span>PRÓXIMO DISPARO</span>
                        </div>
                        {nextTrigger ? (
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {formatDateTime(nextTrigger)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {schedule.isActive
                              ? "Sem próximo disparo"
                              : "Inativo"}
                          </p>
                        )}
                      </div>

                      {/* Modo */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <CalendarClock className="h-3.5 w-3.5" />
                          <span>MODO</span>
                        </div>
                        <p className="text-sm font-medium">
                          {schedule.triggerMode === "trigger_date"
                            ? "Data Específica"
                            : "Recorrente"}
                        </p>
                      </div>
                    </div>

                    {/* Próximas Reservas */}
                    {schedule.triggerMode === "reservation_date" &&
                      schedule.isActive && (
                        <div className="pt-3 border-t">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-2">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>PRÓXIMAS RESERVAS</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {nextReservations.map((date, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                {date.toLocaleDateString("pt-BR", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "2-digit",
                                })}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Data Específica para modo trigger_date */}
                    {schedule.triggerMode === "trigger_date" &&
                      schedule.triggerDatetime && (
                        <div className="pt-3 border-t">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-2">
                            <Clock className="h-3.5 w-3.5" />
                            <span>DISPARO PROGRAMADO</span>
                          </div>
                          <p className="text-sm">
                            {new Date(schedule.triggerDatetime).toLocaleString(
                              "pt-BR",
                              {
                                dateStyle: "full",
                                timeStyle: "short",
                              }
                            )}
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              )
            })}
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

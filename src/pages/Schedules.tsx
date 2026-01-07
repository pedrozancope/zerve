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
  Power,
  ChevronRight,
  MoreVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DAY_NAMES_PT } from "@/lib/cron"
import { TIME_SLOTS } from "@/lib/constants"
import {
  useSchedules,
  useToggleSchedule,
  useDeleteSchedule,
} from "@/hooks/useSchedules"
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
    // O trigger_time e trigger_day_of_week estão em UTC no banco
    // Precisamos converter para horário local para exibição
    if (schedule.triggerMode === "reservation_date") {
      // Se frequência é "once" e não há triggerDatetime, não há próximo disparo definido
      if (schedule.frequency === "once") {
        return null
      }

      // Converter de UTC para BRT (subtrai 3 horas)
      const [utcHours, minutes] = schedule.triggerTime.split(":").map(Number)
      const brtHours = (utcHours - 3 + 24) % 24

      // Se a conversão voltou um dia (ex: 02:00 UTC → 23:00 BRT do dia anterior)
      const dayShift = utcHours - 3 < 0 ? -1 : 0
      const triggerDayBRT = (schedule.triggerDayOfWeek + dayShift + 7) % 7

      let daysUntilTrigger = (triggerDayBRT - now.getDay() + 7) % 7
      if (daysUntilTrigger === 0) {
        const todayTrigger = new Date(now)
        todayTrigger.setHours(brtHours, minutes, 0, 0)
        if (todayTrigger <= now) {
          daysUntilTrigger = 7
        }
      }

      const nextTrigger = new Date(now)
      nextTrigger.setDate(now.getDate() + daysUntilTrigger)
      nextTrigger.setHours(brtHours, minutes, 0, 0)
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-reservation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
              Gerencie suas automações de reserva
            </p>
          </div>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agendamentos
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas automações de reserva
          </p>
        </div>
        <Link to="/schedules/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </Link>
      </div>

      {!schedules || schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhum agendamento criado
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Crie seu primeiro agendamento para começar a reservar
                automaticamente suas quadras favoritas.
              </p>
              <Link to="/schedules/new">
                <Button size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Agendamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/50 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Power className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {schedules.filter((s) => s.isActive).length}
                    </p>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80">
                      Ativos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/50 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Repeat className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {
                        schedules.filter(
                          (s) => s.triggerMode === "reservation_date"
                        ).length
                      }
                    </p>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                      Recorrentes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950 dark:to-purple-900/50 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <CalendarClock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                      {
                        schedules.filter(
                          (s) => s.triggerMode === "trigger_date"
                        ).length
                      }
                    </p>
                    <p className="text-xs text-purple-600/80 dark:text-purple-400/80">
                      Data Específica
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950 dark:to-sky-900/50 border-sky-200 dark:border-sky-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10">
                    <Plane className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                      {schedules.filter((s) => s.preflightEnabled).length}
                    </p>
                    <p className="text-xs text-sky-600/80 dark:text-sky-400/80">
                      Com Pre-flight
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    className={`overflow-hidden transition-all duration-200 hover:shadow-md ${
                      !schedule.isActive ? "opacity-60" : ""
                    }`}
                  >
                    {/* Card Header with gradient */}
                    <div
                      className={`px-5 py-4 border-b ${
                        schedule.isActive
                          ? "bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-lg ${
                              schedule.isActive ? "bg-primary/10" : "bg-muted"
                            }`}
                          >
                            <Target
                              className={`h-4 w-4 ${
                                schedule.isActive
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">
                              {schedule.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              {schedule.isActive ? (
                                <Badge
                                  variant="success"
                                  className="text-xs px-1.5 py-0"
                                >
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-xs px-1.5 py-0"
                                >
                                  Inativo
                                </Badge>
                              )}
                              {schedule.preflightEnabled && (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-xs px-1.5 py-0 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
                                >
                                  <Plane className="h-2.5 w-2.5" />
                                  Pre-flight
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Switch
                            checked={schedule.isActive}
                            onCheckedChange={() =>
                              handleToggle(schedule.id, schedule.isActive)
                            }
                            disabled={toggleSchedule.isPending}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDryRunTest(schedule.id, schedule.name)
                                }
                                disabled={testingScheduleId === schedule.id}
                              >
                                {testingScheduleId === schedule.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <PlayCircle className="h-4 w-4 mr-2" />
                                )}
                                Dry Run
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <Link to={`/schedules/${schedule.id}`}>
                                <DropdownMenuItem>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              </Link>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteClick(schedule.id)}
                                disabled={deleteSchedule.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-5 space-y-4">
                      {/* Reservation Target - Hero Section */}
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-primary">
                            {DAY_NAMES_PT[
                              schedule.reservationDayOfWeek
                            ].substring(0, 3)}
                          </p>
                          <p className="text-xs text-primary/70 uppercase tracking-wider">
                            {DAY_NAMES_PT[schedule.reservationDayOfWeek].split(
                              "-"
                            )[1] || ""}
                          </p>
                        </div>
                        <div className="h-12 w-px bg-primary/20" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                            Horário
                          </p>
                          <p className="text-lg font-semibold">
                            {schedule.timeSlot?.displayName ||
                              getTimeSlotDisplay(schedule.timeSlotId)}
                          </p>
                        </div>
                      </div>

                      {/* Info Row */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Trigger Mode */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                            {schedule.triggerMode === "trigger_date" ? (
                              <CalendarClock className="h-3 w-3" />
                            ) : (
                              <Repeat className="h-3 w-3" />
                            )}
                            <span>Modo</span>
                          </div>
                          <p className="text-sm font-medium">
                            {schedule.triggerMode === "trigger_date"
                              ? "Data Específica"
                              : getFrequencyLabel(schedule.frequency)}
                          </p>
                        </div>

                        {/* Next Trigger */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                            <Zap className="h-3 w-3" />
                            <span>Próximo Disparo</span>
                          </div>
                          {nextTrigger ? (
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                              {formatDateTime(nextTrigger)}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {schedule.isActive ? "—" : "Inativo"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Next Reservations or Specific Date */}
                      {schedule.triggerMode === "reservation_date" &&
                        schedule.isActive && (
                          <div className="pt-3 border-t">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                              <Calendar className="h-3 w-3" />
                              <span>Próximas Reservas</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {nextReservations.map((date, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs font-normal"
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

                      {schedule.triggerMode === "trigger_date" &&
                        schedule.triggerDatetime && (
                          <div className="pt-3 border-t">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                              <Clock className="h-3 w-3" />
                              <span>Disparo Programado</span>
                            </div>
                            <p className="text-sm font-medium">
                              {new Date(
                                schedule.triggerDatetime
                              ).toLocaleString("pt-BR", {
                                dateStyle: "full",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                        )}

                      {/* Quick Actions */}
                      <div className="pt-3 border-t flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDryRunTest(schedule.id, schedule.name)
                          }
                          disabled={testingScheduleId === schedule.id}
                          className="gap-1.5"
                        >
                          {testingScheduleId === schedule.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5" />
                          )}
                          Testar
                        </Button>
                        <Link to={`/schedules/${schedule.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1.5">
                            Editar
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </>
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

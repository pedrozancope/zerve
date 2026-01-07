import { Link } from "react-router-dom"
import {
  Calendar,
  CheckCircle2,
  Clock,
  Key,
  Plus,
  Zap,
  CalendarCheck,
  ArrowRight,
  TrendingUp,
  Activity,
  Target,
  Sparkles,
  ChevronRight,
  CalendarDays,
  Timer,
  AlertCircle,
  XCircle,
  Rocket,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { useSchedules } from "@/hooks/useSchedules"
import { useLogStats, useRecentLogs } from "@/hooks/useLogs"
import { useTokenStatus } from "@/hooks/useConfig"
import {
  useExternalReservations,
  extractTimeFromAreaName,
  isReservationToday,
  parseReservationDate,
} from "@/hooks/useExternalReservations"
import { DAY_NAMES_PT_SHORT } from "@/lib/cron"

export default function Dashboard() {
  const { data: schedules = [], isLoading: loadingSchedules } = useSchedules()
  const { data: stats, isLoading: loadingStats } = useLogStats()
  const { data: recentLogs = [] } = useRecentLogs(5)
  const { hasToken, isLoading: loadingToken } = useTokenStatus()
  const { data: externalReservations, isLoading: loadingReservations } =
    useExternalReservations()

  const activeSchedules = schedules.filter((s) => s.isActive).length
  const totalSchedules = schedules.length
  const successRate = stats?.success_rate || 0
  const totalExecutions = stats?.total_executions || 0
  const successfulExecutions = stats?.successful_executions || 0

  // Reservas de hoje
  const todayReservations =
    externalReservations?.data?.reservations.filter((r) =>
      isReservationToday(r.reservationDate)
    ) || []

  // Próximas reservas (não hoje)
  const upcomingReservations =
    externalReservations?.data?.reservations
      .filter((r) => !isReservationToday(r.reservationDate))
      .sort((a, b) => {
        const dateA = parseReservationDate(a.reservationDate)
        const dateB = parseReservationDate(b.reservationDate)
        return dateA.getTime() - dateB.getTime()
      })
      .slice(0, 3) || []

  // Função para calcular próximo disparo
  const getNextTriggerDate = (schedule: any) => {
    if (!schedule.isActive) return null

    const now = new Date()

    if (schedule.triggerMode === "trigger_date" && schedule.triggerDatetime) {
      const triggerDate = new Date(schedule.triggerDatetime)
      if (schedule.frequency === "once") {
        return triggerDate > now ? triggerDate : null
      }

      const dayOfWeek = triggerDate.getDay()
      const hours = triggerDate.getHours()
      const minutes = triggerDate.getMinutes()

      let daysUntilTrigger = (dayOfWeek - now.getDay() + 7) % 7
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

    if (schedule.triggerMode === "reservation_date") {
      if (schedule.frequency === "once") {
        return null
      }

      const [utcHours, minutes] = schedule.triggerTime.split(":").map(Number)
      const brtHours = (utcHours - 3 + 24) % 24
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

  // Calcular próximo agendamento
  const now = new Date()
  const activeSchedulesWithDates = schedules
    .filter((s) => s.isActive)
    .map((s) => {
      const nextTrigger = getNextTriggerDate(s)
      return { schedule: s, nextTrigger }
    })
    .filter((item) => item.nextTrigger !== null)
    .sort((a, b) => a.nextTrigger!.getTime() - b.nextTrigger!.getTime())

  const nextScheduleItem = activeSchedulesWithDates[0]

  const isLoading =
    loadingSchedules || loadingStats || loadingToken || loadingReservations

  // Calcular tempo até próximo disparo
  const getTimeUntilTrigger = (triggerDate: Date) => {
    const diff = triggerDate.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Hero Skeleton */}
        <Skeleton className="h-48 rounded-2xl" />

        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com saudação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="hidden sm:inline">👋</span> Olá, bem-vindo!
          </h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Link to="/schedules/new" className="hidden sm:block">
          <Button className="gap-2 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            Nova Automação
          </Button>
        </Link>
      </div>

      {/* Hero Card - Próximo Disparo */}
      {nextScheduleItem ? (
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/20">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              {/* Countdown Section */}
              <div className="flex-1 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-white/80">
                    Próxima Automação
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-bold mb-2">
                  {nextScheduleItem.schedule.name}
                </h2>

                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 gap-1">
                    <Clock className="h-3 w-3" />
                    {nextScheduleItem.schedule.timeSlot?.displayName}
                  </Badge>
                  <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 gap-1">
                    <Calendar className="h-3 w-3" />
                    {DAY_NAMES_PT_SHORT[
                      nextScheduleItem.schedule.reservationDayOfWeek
                    ] || ""}
                  </Badge>
                </div>

                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">
                      Dispara em
                    </p>
                    <p className="text-3xl md:text-4xl font-bold">
                      {getTimeUntilTrigger(nextScheduleItem.nextTrigger!)}
                    </p>
                  </div>
                  <Link to={`/schedules/${nextScheduleItem.schedule.id}`}>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1 mb-1"
                    >
                      Ver detalhes
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Visual/Pattern Section - Hidden on mobile */}
              <div className="hidden md:flex items-center justify-center w-64 bg-white/5 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-8 border-white" />
                  <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full border-4 border-white" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white" />
                </div>
                <Timer className="h-20 w-20 text-white/30" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-2 border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Comece a automatizar!
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Crie seu primeiro agendamento e deixe o Zerve fazer suas
                reservas automaticamente.
              </p>
              <Link to="/schedules/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Agendamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - Responsivo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Agendamentos */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  Agendamentos
                </p>
                <p className="text-2xl md:text-3xl font-bold">
                  {activeSchedules}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  de {totalSchedules} total
                </p>
              </div>
              <div className="p-2 md:p-2.5 rounded-xl bg-primary/10">
                <Target className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
            </div>
            {totalSchedules > 0 && (
              <Progress
                value={(activeSchedules / totalSchedules) * 100}
                className="h-1.5 mt-3"
              />
            )}
          </CardContent>
        </Card>

        {/* Taxa de Sucesso */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  Taxa de Sucesso
                </p>
                <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">
                  {successRate.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {successfulExecutions}/{totalExecutions} exec.
                </p>
              </div>
              <div className="p-2 md:p-2.5 rounded-xl bg-green-500/10">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <Progress
              value={successRate}
              className="h-1.5 mt-3 [&>div]:bg-green-500"
            />
          </CardContent>
        </Card>

        {/* Reservas Hoje */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  Reservas Hoje
                </p>
                <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {todayReservations.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayReservations.length > 0
                    ? extractTimeFromAreaName(todayReservations[0].areaName) ||
                      "Ver detalhes"
                    : "Nenhuma hoje"}
                </p>
              </div>
              <div className="p-2 md:p-2.5 rounded-xl bg-blue-500/10">
                <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Status */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  Token
                </p>
                <p
                  className={`text-2xl md:text-3xl font-bold ${
                    hasToken
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {hasToken ? "OK" : "!"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasToken ? "Configurado" : "Pendente"}
                </p>
              </div>
              <div
                className={`p-2 md:p-2.5 rounded-xl ${
                  hasToken ? "bg-green-500/10" : "bg-amber-500/10"
                }`}
              >
                <Key
                  className={`h-4 w-4 md:h-5 md:w-5 ${
                    hasToken
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                />
              </div>
            </div>
            {!hasToken && (
              <Link to="/settings">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 text-xs gap-1 px-2"
                >
                  <Settings className="h-3 w-3" />
                  Configurar
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content - 2 Columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Próximas Reservas Confirmadas */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">Reservas Confirmadas</h3>
              </div>
              <Link to="/reservations">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Ver todas
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            {externalReservations?.data?.reservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma reserva confirmada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Reservas de hoje destacadas */}
                {todayReservations.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      HOJE
                    </p>
                    {todayReservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-bold text-sm">
                          {extractTimeFromAreaName(reservation.areaName)?.split(
                            " - "
                          )[0] || "🎾"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {reservation.areaName
                              .replace(
                                /\s*-?\s*\d{1,2}\s*hr?\s*[àa]s?\s*\d{1,2}\s*hr?\s*/i,
                                ""
                              )
                              .trim()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {extractTimeFromAreaName(reservation.areaName)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700 shrink-0"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Hoje
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Próximas reservas */}
                {upcomingReservations.length > 0 && (
                  <div>
                    {todayReservations.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        PRÓXIMAS
                      </p>
                    )}
                    {upcomingReservations.map((reservation) => {
                      const date = parseReservationDate(
                        reservation.reservationDate
                      )
                      return (
                        <div
                          key={reservation.id}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground">
                            <span className="text-[10px] font-medium leading-none">
                              {DAY_NAMES_PT_SHORT[date.getDay()]}
                            </span>
                            <span className="text-sm font-bold leading-tight">
                              {date.getDate()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {extractTimeFromAreaName(reservation.areaName)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {reservation.areaName
                                .replace(
                                  /\s*-?\s*\d{1,2}\s*hr?\s*[àa]s?\s*\d{1,2}\s*hr?\s*/i,
                                  ""
                                )
                                .trim()}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividade Recente */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">Atividade Recente</h3>
              </div>
              <Link to="/logs">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Ver logs
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma atividade ainda</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        log.status === "success"
                          ? "bg-green-100 dark:bg-green-900/50"
                          : log.status === "error"
                          ? "bg-red-100 dark:bg-red-900/50"
                          : "bg-amber-100 dark:bg-amber-900/50"
                      }`}
                    >
                      {log.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : log.status === "error" ? (
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {log.schedule?.name ||
                          (log.executionType === "test_token"
                            ? "Teste de Token"
                            : log.executionType === "auto_cancel"
                            ? "Auto-Cancel"
                            : "Execução")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.executedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        log.status === "success"
                          ? "success"
                          : log.status === "error"
                          ? "destructive"
                          : "outline"
                      }
                      className="shrink-0 text-xs"
                    >
                      {log.status === "success"
                        ? "OK"
                        : log.status === "error"
                        ? "Erro"
                        : "..."}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Mobile */}
      <div className="sm:hidden">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Ações Rápidas
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/schedules/new" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-auto py-3"
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span className="text-sm">Nova Automação</span>
                </Button>
              </Link>
              <Link to="/reservations" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-auto py-3"
                >
                  <CalendarCheck className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Reservas</span>
                </Button>
              </Link>
              <Link to="/schedules" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-auto py-3"
                >
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Automações</span>
                </Button>
              </Link>
              <Link to="/settings" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-auto py-3"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Configurar</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

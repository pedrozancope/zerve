import { Calendar, CheckCircle2, Clock, Key } from "lucide-react"
import { StatCard } from "@/components/dashboard/StatCard"
import { UpcomingReservations } from "@/components/dashboard/UpcomingReservations"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { useSchedules } from "@/hooks/useSchedules"
import { useLogStats, useRecentLogs } from "@/hooks/useLogs"
import { useTokenStatus } from "@/hooks/useConfig"
import { Skeleton } from "@/components/ui/skeleton"

export default function Dashboard() {
  const { data: schedules = [], isLoading: loadingSchedules } = useSchedules()
  const { data: stats, isLoading: loadingStats } = useLogStats()
  const { data: recentLogs = [], isLoading: loadingLogs } = useRecentLogs(5)
  const { hasToken, lastUpdated, isLoading: loadingToken } = useTokenStatus()

  const activeSchedules = schedules.filter((s) => s.isActive).length
  const successRate = stats?.success_rate || 0
  const totalExecutions = stats?.total_executions || 0
  const successfulExecutions = stats?.successful_executions || 0

  // Função para calcular próximo disparo
  const getNextTriggerDate = (schedule: any) => {
    if (!schedule.isActive) return null

    const now = new Date()

    // MODO: Data/hora específica (trigger_date)
    if (schedule.triggerMode === "trigger_date" && schedule.triggerDatetime) {
      const triggerDate = new Date(schedule.triggerDatetime)

      if (schedule.frequency === "once") {
        return triggerDate > now ? triggerDate : null
      }

      if (triggerDate > now) {
        return triggerDate
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

    // MODO: Baseado na reserva (reservation_date)
    if (schedule.triggerMode === "reservation_date") {
      if (schedule.frequency === "once") {
        return null
      }

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

  // Calcular data da reserva baseado no modo e no próximo disparo
  const getReservationDate = (schedule: any, nextTrigger: Date | null) => {
    if (!nextTrigger) return null

    // Modo Data Específica: reserva no mesmo dia do disparo
    if (schedule.triggerMode === "trigger_date") {
      return new Date(nextTrigger)
    }

    // Modo Baseado na Reserva: +10 dias do disparo
    const reservationDate = new Date(nextTrigger)
    reservationDate.setDate(reservationDate.getDate() + 10)
    return reservationDate
  }

  // Próximo agendamento ativo com data de disparo mais próxima
  const activeSchedulesWithDates = schedules
    .filter((s) => s.isActive)
    .map((s) => {
      const nextTrigger = getNextTriggerDate(s)
      return { schedule: s, nextTrigger }
    })
    .filter((item) => item.nextTrigger !== null)
    .sort((a, b) => a.nextTrigger!.getTime() - b.nextTrigger!.getTime())

  const nextSchedule = activeSchedulesWithDates[0]?.schedule
  const nextTime = nextSchedule?.timeSlot?.displayName || "-"
  const nextReservationDate = activeSchedulesWithDates[0]
    ? getReservationDate(
        activeSchedulesWithDates[0].schedule,
        activeSchedulesWithDates[0].nextTrigger
      )
    : null

  // Formatar descrição com nome e data
  const nextReservationDescription = nextSchedule
    ? nextReservationDate
      ? `${nextSchedule.name} • ${nextReservationDate.toLocaleDateString(
          "pt-BR",
          {
            weekday: "short",
            day: "2-digit",
            month: "short",
          }
        )}`
      : nextSchedule.name
    : "Nenhuma"

  const isLoading = loadingSchedules || loadingStats || loadingToken

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral dos seus agendamentos
          </p>
        </div>
        <Link to="/schedules/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Novo Agendamento
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Agendamentos"
              value={activeSchedules}
              icon={Calendar}
              description="Ativos"
              variant="default"
            />
            <StatCard
              title="Taxa de Sucesso"
              value={`${successRate.toFixed(1)}%`}
              icon={CheckCircle2}
              description={`${successfulExecutions}/${totalExecutions} execuções`}
              variant="success"
            />
            <StatCard
              title="Próxima Reserva"
              value={nextTime}
              icon={Clock}
              description={nextReservationDescription}
              variant="warning"
            />
            <StatCard
              title="Token"
              value={hasToken ? "OK" : "Pendente"}
              icon={Key}
              description={
                hasToken && lastUpdated
                  ? `Atualizado ${new Date(lastUpdated).toLocaleDateString()}`
                  : "Configure seu token"
              }
              variant={hasToken ? "success" : "default"}
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <UpcomingReservations
          reservations={activeSchedulesWithDates.slice(0, 4).map((item) => {
            const reservationDate = getReservationDate(
              item.schedule,
              item.nextTrigger
            )
            return {
              id: item.schedule.id,
              scheduleName: item.schedule.name,
              triggerDate: item.nextTrigger!,
              reservationDate: reservationDate!,
              time: item.schedule.timeSlot?.displayName || "",
              dayOfWeek: item.schedule.reservationDayOfWeek,
              triggerMode: item.schedule.triggerMode,
            }
          })}
          isLoading={loadingSchedules}
        />
        <RecentActivity logs={recentLogs} isLoading={loadingLogs} />
      </div>
    </div>
  )
}

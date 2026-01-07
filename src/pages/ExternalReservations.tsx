import { useState } from "react"
import {
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Loader2,
  CalendarCheck,
  CalendarX,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useExternalReservations,
  formatReservationDateDisplay,
  extractTimeFromAreaName,
  isReservationToday,
  getDayOfWeekName,
  type ExternalReservation,
} from "@/hooks/useExternalReservations"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"

export default function ExternalReservations() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch, isFetching } =
    useExternalReservations()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ["external-reservations"] })
    await refetch()
    setIsRefreshing(false)
  }

  // Agrupar reservas por data
  const groupedReservations = data?.data?.reservations.reduce(
    (acc, reservation) => {
      const dateKey = formatReservationDateDisplay(reservation.reservationDate)
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(reservation)
      return acc
    },
    {} as Record<string, ExternalReservation[]>
  )

  // Ordenar datas
  const sortedDates = Object.keys(groupedReservations || {}).sort((a, b) => {
    const [dayA, monthA, yearA] = a.split("/").map(Number)
    const [dayB, monthB, yearB] = b.split("/").map(Number)
    const dateA = new Date(yearA, monthA - 1, dayA)
    const dateB = new Date(yearB, monthB - 1, dayB)
    return dateA.getTime() - dateB.getTime()
  })

  // Calcular estatísticas
  const todayReservations =
    data?.data?.reservations.filter((r) =>
      isReservationToday(r.reservationDate)
    ).length || 0
  const inQueueCount =
    data?.data?.reservations.filter((r) => r.queuePosition > 0).length || 0
  const confirmedCount =
    data?.data?.reservations.filter((r) => r.queuePosition === 0).length || 0

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Minhas Reservas
            </h1>
            <p className="text-muted-foreground">Carregando suas reservas...</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Minhas Reservas
          </h1>
          <p className="text-muted-foreground">
            Visualize suas reservas ativas na quadra de tênis
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing || isFetching}
          variant="outline"
          className="gap-2"
        >
          {isRefreshing || isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-destructive">
                  Erro ao carregar reservas
                </p>
                <p className="text-sm text-destructive/80">
                  {error instanceof Error
                    ? error.message
                    : "Ocorreu um erro inesperado. Tente novamente."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      {data?.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {data.data.total}
                  </p>
                  <p className="text-xs text-primary/70">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/50 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CalendarCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {todayReservations}
                  </p>
                  <p className="text-xs text-green-600/80 dark:text-green-400/80">
                    Hoje
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/50 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {confirmedCount}
                  </p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                    Confirmadas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950 dark:to-amber-900/50 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {inQueueCount}
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                    Na Fila
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {data?.data?.reservations.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CalendarX className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma reserva encontrada
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Você não possui reservas ativas no momento. Crie um agendamento
                para começar a fazer reservas automáticas!
              </p>
              <Link to="/schedules/new">
                <Button size="lg" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Criar Agendamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservations List */}
      {sortedDates.length > 0 && (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const reservations = groupedReservations![dateKey]
            const firstReservation = reservations[0]
            const isToday = isReservationToday(firstReservation.reservationDate)
            const dayName = getDayOfWeekName(firstReservation.reservationDate)

            return (
              <div key={dateKey} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                      isToday
                        ? "bg-gradient-to-r from-green-100 to-green-50 text-green-700 dark:from-green-900/50 dark:to-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold">
                      {isToday ? "Hoje" : dayName}
                    </span>
                    <span className="font-normal opacity-70">• {dateKey}</span>
                  </div>
                  {isToday && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
                      Próximo
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {reservations.length} reserva
                    {reservations.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Reservation Cards */}
                <div className="grid gap-3">
                  {reservations.map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      isToday={isToday}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Response time info */}
      {data?.duration && (
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          Tempo de resposta: {data.duration}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Reservation Card Component
// =============================================================================
function ReservationCard({
  reservation,
  isToday,
}: {
  reservation: ExternalReservation
  isToday: boolean
}) {
  const timeSlot = extractTimeFromAreaName(reservation.areaName)
  const areaNameClean = reservation.areaName
    .replace(/\s*-?\s*\d{1,2}\s*hr?\s*[àa]s?\s*\d{1,2}\s*hr?\s*/i, "")
    .trim()

  const isInQueue = reservation.queuePosition > 0

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 hover:shadow-md ${
        isToday
          ? "border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-background"
          : ""
      }`}
    >
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Time Badge - Left Side */}
          <div
            className={`flex flex-col items-center justify-center px-5 py-4 ${
              isToday
                ? "bg-gradient-to-b from-green-100 to-green-50 dark:from-green-900/50 dark:to-green-900/30"
                : "bg-gradient-to-b from-primary/10 to-primary/5"
            }`}
          >
            <Clock
              className={`h-4 w-4 mb-1 ${
                isToday ? "text-green-600 dark:text-green-400" : "text-primary"
              }`}
            />
            <span
              className={`text-lg font-bold ${
                isToday ? "text-green-700 dark:text-green-300" : "text-primary"
              }`}
            >
              {timeSlot || "—"}
            </span>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate">
                  {areaNameClean}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{reservation.condoName}</span>
                  </span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>
                    Unidade {reservation.unit}
                    {reservation.block &&
                      ` / Bloco ${reservation.block.trim()}`}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              {isInQueue ? (
                <Badge
                  variant="secondary"
                  className="shrink-0 gap-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                >
                  <Users className="h-3 w-3" />
                  Fila: {reservation.queuePosition}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={`shrink-0 gap-1.5 ${
                    isToday
                      ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700"
                      : "bg-primary/10 text-primary border-primary/30"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Confirmada
                </Badge>
              )}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">ID: {reservation.id}</span>
              <span>
                Reservado em:{" "}
                {reservation.createdAt
                  ? formatReservationDateDisplay(reservation.createdAt)
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

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
  List,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  useExternalReservations,
  formatReservationDateDisplay,
  extractTimeFromAreaName,
  isReservationToday,
  getDayOfWeekName,
  type ExternalReservation,
} from "@/hooks/useExternalReservations"
import { useQueryClient } from "@tanstack/react-query"

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <List className="h-6 w-6 text-primary" />
            Minhas Reservas
          </h1>
          <p className="text-muted-foreground">
            Visualize suas reservas ativas na quadra de tênis
          </p>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing || isFetching}
          variant="outline"
          className="gap-2"
        >
          {isRefreshing || isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Status/Info Card */}
      {data?.data && !isLoading && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total de reservas ativas
                  </p>
                  <p className="text-2xl font-bold">{data.data.total}</p>
                </div>
              </div>
              <div className="sm:ml-auto text-sm text-muted-foreground">
                <p>Reservas para hoje</p>
                {data.duration && <p>Tempo de resposta: {data.duration}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar reservas</AlertTitle>
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "Ocorreu um erro inesperado"}
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {data?.data?.reservations.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              Nenhuma reserva encontrada
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              Você não possui reservas ativas no momento. Crie um agendamento
              para começar a fazer reservas automáticas!
            </p>
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
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      isToday
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    {isToday ? "Hoje" : dayName}
                    <span className="font-normal">• {dateKey}</span>
                  </div>
                  {isToday && (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Próximo
                    </Badge>
                  )}
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

  // Determinar cor do card baseado na proximidade
  const cardClasses = isToday
    ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
    : "border-border"

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md ${cardClasses}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Time Badge */}
          <div
            className={`flex items-center justify-center px-4 py-3 rounded-lg ${
              isToday ? "bg-green-100 dark:bg-green-900/40" : "bg-primary/10"
            }`}
          >
            <Clock
              className={`h-5 w-5 mr-2 ${
                isToday ? "text-green-600 dark:text-green-400" : "text-primary"
              }`}
            />
            <span
              className={`text-lg font-bold ${
                isToday ? "text-green-700 dark:text-green-300" : "text-primary"
              }`}
            >
              {timeSlot || "Horário"}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">
              {areaNameClean}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {reservation.condoName}
              </span>
              <span>
                Unidade: {reservation.unit}
                {reservation.block && ` | Bloco: ${reservation.block.trim()}`}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            {reservation.queuePosition > 0 ? (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Fila: {reservation.queuePosition}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={
                  isToday
                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700"
                    : "bg-primary/10 text-primary border-primary/30"
                }
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Confirmada
              </Badge>
            )}
          </div>
        </div>

        {/* Reservation ID */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>ID: {reservation.id}</span>
          <span>
            Reservado em:{" "}
            {reservation.createdAt
              ? formatReservationDateDisplay(reservation.createdAt)
              : "-"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

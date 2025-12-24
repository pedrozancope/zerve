import { Calendar, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DAY_NAMES_PT_SHORT } from "@/lib/cron"

interface UpcomingReservation {
  id: string
  scheduleName: string
  triggerDate: Date
  reservationDate: Date
  time: string
  dayOfWeek: number
  triggerMode: string
}

interface UpcomingReservationsProps {
  reservations: UpcomingReservation[]
  isLoading?: boolean
}

export function UpcomingReservations({
  reservations,
  isLoading,
}: UpcomingReservationsProps) {
  // Calcula diferença de tempo (minutos, horas, dias) entre agora e a data alvo
  const getTimeDiff = (target: Date) => {
    const now = new Date()
    const diffMs = target.getTime() - now.getTime()
    const diffMin = Math.round(diffMs / (1000 * 60))
    const diffH = Math.floor(diffMin / 60)
    const diffD = Math.floor(diffH / 24)
    return { diffMs, diffMin, diffH, diffD }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximas Reservas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximas Reservas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma reserva agendada</p>
            <p className="text-sm">Crie um agendamento para começar</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Próximas Reservas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reservations.map((reservation) => {
            const { diffMin, diffH, diffD } = getTimeDiff(
              reservation.triggerDate
            )
            const { diffD: diffDReservation } = getTimeDiff(
              reservation.reservationDate
            )

            // Badge: tempo até o disparo
            let badgeLabel = ""
            let badgeVariant: "warning" | "outline" | "default" = "outline"
            if (diffMin < 0) {
              badgeLabel = "Executando"
              badgeVariant = "warning"
            } else if (diffMin < 60) {
              badgeLabel = `${diffMin} min`
              badgeVariant = "warning"
            } else if (diffH < 24) {
              badgeLabel = `${diffH} h`
              badgeVariant = "warning"
            } else if (diffD === 1) {
              badgeLabel = "Amanhã"
              badgeVariant = "warning"
            } else {
              badgeLabel = `${diffD} dias`
              badgeVariant = "outline"
            }

            // Label da reserva baseado no tempo até a data da reserva
            let reservationLabel = ""
            if (diffDReservation < 0) {
              reservationLabel = "Passou"
            } else if (diffDReservation === 0) {
              reservationLabel = "Reserva hoje"
            } else if (diffDReservation === 1) {
              reservationLabel = "Reserva amanhã"
            } else {
              reservationLabel =
                reservation.triggerMode === "trigger_date"
                  ? "Reserva na data específica"
                  : `Reserva em ${diffDReservation} dias`
            }

            return (
              <div
                key={reservation.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                    <span className="text-xs font-medium">
                      {DAY_NAMES_PT_SHORT[reservation.dayOfWeek]}
                    </span>
                    <span className="text-lg font-bold">
                      {reservation.reservationDate.getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{reservation.scheduleName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {reservation.time}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {reservationLabel}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

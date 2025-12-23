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
  const getDaysUntil = (date: Date) => {
    const now = new Date()
    const target = new Date(date)
    const diffTime = target.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getHoursUntil = (date: Date) => {
    const now = new Date()
    const target = new Date(date)
    const diffTime = target.getTime() - now.getTime()
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    return diffHours
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
            const daysUntilReservation = getDaysUntil(
              reservation.reservationDate
            )
            const hoursUntilTrigger = getHoursUntil(reservation.triggerDate)
            const daysUntilTrigger = Math.floor(hoursUntilTrigger / 24)

            // Determinar label do badge baseado no tempo até o disparo
            let badgeLabel = ""
            let badgeVariant: "warning" | "outline" | "default" = "outline"

            if (hoursUntilTrigger < 0) {
              badgeLabel = "Passou"
              badgeVariant = "default"
            } else if (hoursUntilTrigger < 1) {
              const minutesUntil = Math.floor((hoursUntilTrigger * 60) % 60)
              badgeLabel = `${minutesUntil}min`
              badgeVariant = "warning"
            } else if (hoursUntilTrigger < 24) {
              badgeLabel = `${Math.floor(hoursUntilTrigger)}h`
              badgeVariant = "warning"
            } else if (daysUntilTrigger === 1) {
              badgeLabel = "Amanhã"
              badgeVariant = "warning"
            } else {
              badgeLabel = `${daysUntilTrigger} dias`
              badgeVariant = "outline"
            }

            // Label da reserva baseado no modo
            let reservationLabel = ""
            if (reservation.triggerMode === "trigger_date") {
              // Modo Data Específica: reserva no mesmo dia do disparo
              if (daysUntilReservation === 0 && hoursUntilTrigger >= 0) {
                reservationLabel = "Reserva hoje"
              } else if (daysUntilReservation === 1) {
                reservationLabel = "Reserva amanhã"
              } else if (daysUntilReservation > 1) {
                reservationLabel = `Reserva em ${daysUntilReservation} dias`
              } else {
                reservationLabel = "Reserva passou"
              }
            } else {
              // Modo Baseado na Reserva: +10 dias
              if (daysUntilReservation === 0) {
                reservationLabel = "Reserva hoje"
              } else if (daysUntilReservation === 1) {
                reservationLabel = "Reserva amanhã"
              } else {
                reservationLabel = `Reserva em ${daysUntilReservation} dias`
              }
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

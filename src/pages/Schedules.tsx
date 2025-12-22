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
import { DAY_NAMES_PT, getNextExecutionDates } from "@/lib/cron"
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
          {schedules.map((schedule) => {
            const nextDates = getNextExecutionDates(
              schedule.reservationDayOfWeek,
              2
            )

            return (
              <Card key={schedule.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          {schedule.name}
                        </h3>
                        <Badge
                          variant={schedule.isActive ? "success" : "secondary"}
                        >
                          {schedule.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {DAY_NAMES_PT[schedule.reservationDayOfWeek]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{getTimeSlotDisplay(schedule.timeSlotId)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {nextDates.map((date, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {date.reservationDate.toLocaleDateString("pt-BR")}
                          </Badge>
                        ))}
                      </div>
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

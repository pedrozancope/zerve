import { useState, useEffect } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Bell,
  Save,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Plane,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  Target,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { toast } from "sonner"
import {
  DAY_NAMES_PT,
  DAY_NAMES_PT_SHORT,
  getNextExecutionDates,
  generateCronExpression,
  getTriggerDayOfWeek,
} from "@/lib/cron"
import { TIME_SLOTS, FREQUENCY_OPTIONS } from "@/lib/constants"
import type { ScheduleFormData } from "@/types"
import {
  useCreateSchedule,
  useUpdateSchedule,
  useSchedule,
  useTimeSlots,
  useSchedules,
} from "@/hooks/useSchedules"
import { useLogs } from "@/hooks/useLogs"
import { useConsecutiveDaysConfig } from "@/hooks/useConfig"

// Horários disponíveis para disparo
const TRIGGER_HOURS = Array.from({ length: 24 }, (_, i) => i)
const TRIGGER_MINUTES = [0, 1, 5, 10, 15, 30, 45]

// Componente para mostrar últimos logs do schedule
function ScheduleLogsSection({ scheduleId }: { scheduleId: string }) {
  const { data: logs, isLoading } = useLogs({ scheduleId, limit: 5 })

  if (isLoading || !logs || logs.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Últimos Logs
          </CardTitle>
          <Link
            to={`/logs?schedule=${scheduleId}`}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Ver todos
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                {log.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  {new Date(log.executedAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <Badge
                variant={log.status === "success" ? "success" : "destructive"}
              >
                {log.status === "success" ? "Sucesso" : "Erro"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Seção colapsável com header estilizado
function Section({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = true,
  badge,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{title}</h3>
                  {badge}
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export default function NewSchedule() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const { data: schedule, isLoading: loadingSchedule } = useSchedule(id)
  const { data: timeSlots = [] } = useTimeSlots()
  const { data: allSchedules = [] } = useSchedules()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const { warningEnabled, minDaysBetween } = useConsecutiveDaysConfig()
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: "",
    timeSlotHour: 7,
    reservationDayOfWeek: 0,
    frequency: "weekly",
    notifyOnSuccess: true,
    notifyOnFailure: true,
  })

  // Novos campos para configuração avançada
  const [triggerHour, setTriggerHour] = useState(0)
  const [triggerMinute, setTriggerMinute] = useState(1)
  const [triggerMode, setTriggerMode] = useState<
    "reservation_date" | "trigger_date"
  >("reservation_date")
  const [triggerDatetime, setTriggerDatetime] = useState("")
  const [reservationDateOverride, setReservationDateOverride] = useState("")

  // Campos para Pre-flight (Teste de Voo)
  const [preflightEnabled, setPreflightEnabled] = useState(false)
  const [preflightHoursBefore, setPreflightHoursBefore] = useState(4)
  const [preflightNotifyOnSuccess, setPreflightNotifyOnSuccess] =
    useState(false)
  const [preflightNotifyOnFailure, setPreflightNotifyOnFailure] = useState(true)

  // Estado para o diálogo de confirmação de dias consecutivos
  const [showConsecutiveDaysDialog, setShowConsecutiveDaysDialog] =
    useState(false)
  const [consecutiveDaysConflicts, setConsecutiveDaysConflicts] = useState<
    Array<{ scheduleName: string; dayOfWeek: number; daysDiff: number }>
  >([])

  // Calcular dia da reserva automaticamente quando for trigger_date
  useEffect(() => {
    if (triggerMode === "trigger_date") {
      // Se houver override de data da reserva, usar ele; senão usar triggerDatetime
      const base = reservationDateOverride
        ? new Date(reservationDateOverride + "T00:00:00")
        : triggerDatetime
        ? new Date(triggerDatetime)
        : null
      if (!base) return
      const dayOfWeek = base.getDay()
      setFormData((prev) => ({
        ...prev,
        reservationDayOfWeek: dayOfWeek,
      }))
    }
  }, [triggerMode, triggerDatetime, reservationDateOverride])

  // Load schedule data if editing
  useEffect(() => {
    // Só carrega se tiver schedule e estiver em modo de edição
    if (!schedule || !isEditMode) return

    // Buscar o horário do timeSlot - primeiro tenta schedule.timeSlot (relacionamento), depois timeSlots array
    const timeSlotHour =
      schedule.timeSlot?.hour ??
      timeSlots.find((ts: any) => ts.id === schedule.timeSlotId)?.hour ??
      7 // valor padrão

    setFormData({
      name: schedule.name,
      timeSlotHour: timeSlotHour,
      reservationDayOfWeek: schedule.reservationDayOfWeek,
      frequency: schedule.frequency,
      notifyOnSuccess: schedule.notifyOnSuccess,
      notifyOnFailure: schedule.notifyOnFailure,
    })
    // Carregar configurações avançadas
    if (schedule.triggerTime) {
      const [h, m] = schedule.triggerTime.split(":")
      const utcHour = parseInt(h) || 0
      // Converter de UTC para BRT (subtrai 3 horas)
      const brtHour = (utcHour - 3 + 24) % 24
      setTriggerHour(brtHour)
      setTriggerMinute(parseInt(m) || 1)
    }
    setTriggerMode(schedule.triggerMode || "reservation_date")
    setReservationDateOverride(schedule.reservationDateOverride || "")
    if (schedule.triggerDatetime) {
      // Converter de ISO (UTC) para formato datetime-local (timezone local)
      const utcDate = new Date(schedule.triggerDatetime)
      const localDatetime = new Date(
        utcDate.getTime() - utcDate.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16)
      setTriggerDatetime(localDatetime)
    }
    // Carregar configurações de Pre-flight
    setPreflightEnabled(schedule.preflightEnabled ?? false)
    setPreflightHoursBefore(schedule.preflightHoursBefore ?? 4)
    setPreflightNotifyOnSuccess(schedule.preflightNotifyOnSuccess ?? false)
    setPreflightNotifyOnFailure(schedule.preflightNotifyOnFailure ?? true)
  }, [schedule?.id])

  // Calcular próximas datas baseado no modo
  const nextDates =
    triggerMode === "reservation_date"
      ? getNextExecutionDates(
          formData.reservationDayOfWeek,
          3,
          triggerHour,
          triggerMinute
        )
      : []

  const triggerDay = getTriggerDayOfWeek(formData.reservationDayOfWeek)
  const cronExpression = generateCronExpression(
    formData.reservationDayOfWeek,
    triggerHour,
    triggerMinute
  )
  const selectedTimeSlot = TIME_SLOTS.find(
    (s) => s.hour === formData.timeSlotHour
  )

  // Calcular próximos disparos (trigger + preflight)
  const getUpcomingTriggers = () => {
    const triggers: Array<{
      type: string
      date: Date
      reservationDate?: Date
    }> = []

    // Determinar quantos disparos mostrar baseado na frequência
    const count = formData.frequency === "once" ? 1 : 3

    if (triggerMode === "trigger_date" && triggerDatetime) {
      // Modo data específica
      const startDate = new Date(triggerDatetime)

      for (let i = 0; i < count; i++) {
        const mainTrigger = new Date(startDate)

        // Aplicar frequência
        if (formData.frequency === "weekly") {
          mainTrigger.setDate(mainTrigger.getDate() + i * 7)
        } else if (formData.frequency === "biweekly") {
          mainTrigger.setDate(mainTrigger.getDate() + i * 14)
        } else if (formData.frequency === "monthly") {
          mainTrigger.setMonth(mainTrigger.getMonth() + i)
        }
        // "once" não precisa de ajuste, só mostra 1 vez

        if (preflightEnabled && preflightHoursBefore > 0) {
          const preflightTrigger = new Date(mainTrigger)
          preflightTrigger.setHours(
            preflightTrigger.getHours() - preflightHoursBefore
          )
          triggers.push({
            type: "preflight",
            date: preflightTrigger,
          })
        }

        triggers.push({
          type: "main",
          date: mainTrigger,
          reservationDate: reservationDateOverride
            ? new Date(reservationDateOverride + "T00:00:00")
            : new Date(mainTrigger),
        })
      }
    } else if (triggerMode === "reservation_date") {
      // Modo baseado na reserva (+10 dias)
      const datesToShow = nextDates.slice(0, count)

      datesToShow.forEach((dateObj) => {
        if (preflightEnabled && preflightHoursBefore > 0) {
          const preflightTrigger = new Date(dateObj.triggerDate)
          preflightTrigger.setHours(
            preflightTrigger.getHours() - preflightHoursBefore
          )
          triggers.push({
            type: "preflight",
            date: preflightTrigger,
            reservationDate: dateObj.reservationDate,
          })
        }

        triggers.push({
          type: "main",
          date: dateObj.triggerDate,
          reservationDate: dateObj.reservationDate,
        })
      })
    }

    return triggers
  }

  const upcomingTriggers = getUpcomingTriggers()

  // Função para calcular a diferença de dias entre dois dias da semana (0-6)
  const getDaysDifference = (dayA: number, dayB: number): number => {
    // Calcula a menor distância entre os dias (considerando que a semana é circular)
    const diff = Math.abs(dayA - dayB)
    return Math.min(diff, 7 - diff)
  }

  // Função para verificar se há conflitos de dias consecutivos
  const checkConsecutiveDaysConflict = (): Array<{
    scheduleName: string
    dayOfWeek: number
    daysDiff: number
  }> => {
    if (!warningEnabled) return []

    const newDayOfWeek = formData.reservationDayOfWeek
    const conflicts: Array<{
      scheduleName: string
      dayOfWeek: number
      daysDiff: number
    }> = []

    // Filtrar apenas agendamentos ativos (excluindo o atual se for edição)
    const activeSchedules = allSchedules.filter(
      (s) => s.isActive && (!isEditMode || s.id !== id)
    )

    for (const schedule of activeSchedules) {
      const daysDiff = getDaysDifference(
        newDayOfWeek,
        schedule.reservationDayOfWeek
      )

      // Se a diferença de dias for menor que o mínimo configurado, é um conflito
      if (daysDiff > 0 && daysDiff <= minDaysBetween) {
        conflicts.push({
          scheduleName: schedule.name,
          dayOfWeek: schedule.reservationDayOfWeek,
          daysDiff,
        })
      }
    }

    return conflicts
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Digite um nome para o agendamento")
      return
    }

    // Validar data específica quando trigger_mode = 'trigger_date'
    if (triggerMode === "trigger_date" && !triggerDatetime) {
      toast.error("Selecione a data/hora de disparo")
      return
    }

    // Encontrar o time_slot_id correto
    const timeSlot = timeSlots.find(
      (ts: any) => ts.hour === formData.timeSlotHour
    )
    if (!timeSlot) {
      toast.error("Horário inválido")
      return
    }

    // Verificar conflitos de dias consecutivos antes de salvar
    const conflicts = checkConsecutiveDaysConflict()
    if (conflicts.length > 0) {
      setConsecutiveDaysConflicts(conflicts)
      setShowConsecutiveDaysDialog(true)
      return
    }

    // Se não houver conflitos, salvar normalmente
    await saveSchedule()
  }

  // Função para salvar o agendamento (chamada após confirmação ou se não houver conflitos)
  const saveSchedule = async () => {
    // Encontrar o time_slot_id correto
    const timeSlot = timeSlots.find(
      (ts: any) => ts.hour === formData.timeSlotHour
    )
    if (!timeSlot) {
      toast.error("Horário inválido")
      return
    }

    // Converter datetime local para ISO com timezone
    // O input datetime-local retorna formato "2025-12-22T20:25"
    // Precisamos converter para ISO 8601 com timezone local
    let triggerDatetimeISO: string | null = null
    if (triggerMode === "trigger_date" && triggerDatetime) {
      // Criar Date a partir do valor local e converter para ISO
      const localDate = new Date(triggerDatetime)
      triggerDatetimeISO = localDate.toISOString()
    }

    // Converter trigger_time de BRT para UTC (adiciona 3 horas)
    // Isso garante consistência com trigger_datetime que também é salvo em UTC
    const triggerHourUTC = (triggerHour + 3) % 24
    const triggerTimeUTC = `${triggerHourUTC
      .toString()
      .padStart(2, "0")}:${triggerMinute.toString().padStart(2, "0")}:00`

    // Se a conversão para UTC cruzou a meia-noite, o dia também muda
    // Ex: 21:00 BRT de Terça → 00:00 UTC de Quarta
    const dayShift = triggerHour + 3 >= 24 ? 1 : 0
    const triggerDayUTC = (triggerDay + dayShift) % 7

    const scheduleData: any = {
      name: formData.name,
      time_slot_id: timeSlot.id,
      reservation_day_of_week: formData.reservationDayOfWeek,
      trigger_day_of_week: triggerDayUTC,
      trigger_time: triggerTimeUTC,
      trigger_mode: triggerMode,
      trigger_datetime: triggerDatetimeISO,
      reservation_date_override:
        triggerMode === "trigger_date" && reservationDateOverride
          ? reservationDateOverride
          : null,
      cron_expression: cronExpression,
      frequency: formData.frequency,
      notify_on_success: formData.notifyOnSuccess,
      notify_on_failure: formData.notifyOnFailure,
      preflight_enabled: preflightEnabled,
      preflight_hours_before: preflightHoursBefore,
      preflight_notify_on_success: preflightNotifyOnSuccess,
      preflight_notify_on_failure: preflightNotifyOnFailure,
    }

    try {
      if (isEditMode && id) {
        await updateSchedule.mutateAsync({ id, ...scheduleData })
      } else {
        await createSchedule.mutateAsync(scheduleData)
      }
      navigate("/schedules")
    } catch (error) {
      // Error handling is done in the hooks
      console.error(error)
    }
  }

  // Handler para confirmar criação mesmo com conflitos
  const handleConfirmConsecutiveDays = async () => {
    setShowConsecutiveDaysDialog(false)
    await saveSchedule()
  }

  const isSubmitting = createSchedule.isPending || updateSchedule.isPending

  if (loadingSchedule && isEditMode) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">
            Carregando agendamento...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEditMode ? "Editar Agendamento" : "Novo Agendamento"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode
              ? "Atualize sua reserva recorrente"
              : "Configure sua reserva automática"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Formulário - 3 colunas */}
          <div className="lg:col-span-3 space-y-4">
            {/* SEÇÃO 1: O que reservar */}
            <Section
              icon={Target}
              title="O que reservar"
              description="Defina o dia e horário da quadra"
            >
              <div className="space-y-5">
                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do agendamento</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Tênis Domingo Manhã"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-11"
                  />
                </div>

                {/* Dia da Semana + Horário lado a lado */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dia da reserva</Label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {DAY_NAMES_PT_SHORT.map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          disabled={triggerMode === "trigger_date"}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              reservationDayOfWeek: index,
                            }))
                          }
                          className={`p-2 rounded-lg text-xs font-medium transition-all ${
                            formData.reservationDayOfWeek === index
                              ? "bg-primary text-primary-foreground shadow-md"
                              : triggerMode === "trigger_date"
                              ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    {triggerMode === "trigger_date" && (
                      <p className="text-xs text-muted-foreground">
                        Definido pela data de disparo
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Horário da quadra</Label>
                    <Select
                      key={`timeslot-${formData.timeSlotHour}`}
                      value={formData.timeSlotHour.toString()}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          timeSlotHour: parseInt(value),
                        }))
                      }
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem
                            key={slot.hour}
                            value={slot.hour.toString()}
                          >
                            {slot.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Section>

            {/* SEÇÃO 2: Quando Disparar */}
            <Section
              icon={CalendarClock}
              title="Quando disparar"
              description="Configure quando o sistema deve fazer a reserva"
            >
              <div className="space-y-5">
                {/* Modo de Disparo */}
                <RadioGroup
                  value={triggerMode}
                  onValueChange={(value) => {
                    const v = value as "reservation_date" | "trigger_date"
                    setTriggerMode(v)
                    if (v === "trigger_date") {
                      setFormData((prev) => ({ ...prev, frequency: "once" }))
                    }
                  }}
                  className="grid sm:grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="reservation_date"
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      triggerMode === "reservation_date"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/20"
                    }`}
                  >
                    <RadioGroupItem
                      value="reservation_date"
                      id="reservation_date"
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <span className="font-medium">Automático (+10 dias)</span>
                      <p className="text-xs text-muted-foreground">
                        Dispara 10 dias antes da reserva
                      </p>
                    </div>
                  </Label>

                  <Label
                    htmlFor="trigger_date"
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      triggerMode === "trigger_date"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/20"
                    }`}
                  >
                    <RadioGroupItem
                      value="trigger_date"
                      id="trigger_date"
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <span className="font-medium">Data específica</span>
                      <p className="text-xs text-muted-foreground">
                        Você escolhe quando disparar
                      </p>
                    </div>
                  </Label>
                </RadioGroup>

                {/* Campos condicionais por modo */}
                {triggerMode === "reservation_date" ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Horário do disparo</Label>
                      <div className="flex gap-2">
                        <Select
                          value={triggerHour.toString()}
                          onValueChange={(value) =>
                            setTriggerHour(parseInt(value))
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Hora" />
                          </SelectTrigger>
                          <SelectContent>
                            {TRIGGER_HOURS.map((h) => (
                              <SelectItem key={h} value={h.toString()}>
                                {h.toString().padStart(2, "0")}h
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="flex items-center text-muted-foreground">
                          :
                        </span>
                        <Select
                          value={triggerMinute.toString()}
                          onValueChange={(value) =>
                            setTriggerMinute(parseInt(value))
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Min" />
                          </SelectTrigger>
                          <SelectContent>
                            {TRIGGER_MINUTES.map((m) => (
                              <SelectItem key={m} value={m.toString()}>
                                {m.toString().padStart(2, "0")}min
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Recomendado: 00:01
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Frequência</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            frequency: value as typeof formData.frequency,
                          }))
                        }
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data e hora do disparo</Label>
                        <Input
                          type="datetime-local"
                          value={triggerDatetime}
                          onChange={(e) => setTriggerDatetime(e.target.value)}
                          className="h-11"
                          min={(() => {
                            const now = new Date()
                            now.setMinutes(now.getMinutes() + 1)
                            const year = now.getFullYear()
                            const month = String(now.getMonth() + 1).padStart(
                              2,
                              "0"
                            )
                            const day = String(now.getDate()).padStart(2, "0")
                            const hours = String(now.getHours()).padStart(
                              2,
                              "0"
                            )
                            const minutes = String(now.getMinutes()).padStart(
                              2,
                              "0"
                            )
                            return `${year}-${month}-${day}T${hours}:${minutes}`
                          })()}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Data da reserva{" "}
                          <span className="text-muted-foreground font-normal">
                            (opcional)
                          </span>
                        </Label>
                        <Input
                          type="date"
                          value={reservationDateOverride}
                          onChange={(e) =>
                            setReservationDateOverride(e.target.value)
                          }
                          className="h-11"
                          min={(() => {
                            const now = new Date()
                            const year = now.getFullYear()
                            const month = String(now.getMonth() + 1).padStart(
                              2,
                              "0"
                            )
                            const day = String(now.getDate()).padStart(2, "0")
                            return `${year}-${month}-${day}`
                          })()}
                        />
                        <p className="text-xs text-muted-foreground">
                          Se vazio, reserva para o mesmo dia
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Executa apenas uma vez. Ideal para testes ou reservas
                        pontuais.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* SEÇÃO 3: Notificações */}
            <Section
              icon={Bell}
              title="Notificações"
              description="Receba alertas por e-mail"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Reserva confirmada</p>
                      <p className="text-xs text-muted-foreground">
                        Quando for bem-sucedida
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.notifyOnSuccess}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        notifyOnSuccess: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">Erro na reserva</p>
                      <p className="text-xs text-muted-foreground">
                        Quando houver falha
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.notifyOnFailure}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        notifyOnFailure: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </Section>

            {/* SEÇÃO 4: Pre-flight */}
            <Section
              icon={Plane}
              title="Teste de Voo (Pre-flight)"
              description="Validação prévia do token"
              defaultOpen={preflightEnabled}
              badge={
                preflightEnabled ? (
                  <Badge variant="success" className="text-xs">
                    Ativo
                  </Badge>
                ) : null
              }
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Ativar Pre-flight</p>
                    <p className="text-xs text-muted-foreground">
                      Testa o token antes do disparo
                    </p>
                  </div>
                  <Switch
                    checked={preflightEnabled}
                    onCheckedChange={setPreflightEnabled}
                  />
                </div>

                {preflightEnabled && (
                  <div className="space-y-4 pt-3 border-t">
                    <div className="space-y-2">
                      <Label className="text-sm">Horas antes do disparo</Label>
                      <Select
                        value={preflightHoursBefore.toString()}
                        onValueChange={(value) =>
                          setPreflightHoursBefore(parseInt(value))
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 8, 12, 24].map((hours) => (
                            <SelectItem key={hours} value={hours.toString()}>
                              {hours} hora{hours > 1 ? "s" : ""} antes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">Notificar sucesso</span>
                        <Switch
                          checked={preflightNotifyOnSuccess}
                          onCheckedChange={setPreflightNotifyOnSuccess}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">Notificar falha</span>
                        <Switch
                          checked={preflightNotifyOnFailure}
                          onCheckedChange={setPreflightNotifyOnFailure}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* Logs - apenas em edição */}
            {isEditMode && id && (
              <div className="rounded-xl border bg-card p-4">
                <ScheduleLogsSection scheduleId={id} />
              </div>
            )}
          </div>

          {/* Preview - 2 colunas, sticky */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 space-y-4">
              <Card className="border-2 border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Resumo */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <h4 className="font-semibold text-sm mb-3">Resumo</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reserva:</span>
                        <span className="font-medium">
                          {DAY_NAMES_PT[formData.reservationDayOfWeek]} às{" "}
                          {selectedTimeSlot?.displayName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Disparo:</span>
                        <span className="font-medium text-right">
                          {triggerMode === "trigger_date" && triggerDatetime
                            ? new Date(triggerDatetime).toLocaleString(
                                "pt-BR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : `${DAY_NAMES_PT[triggerDay]} às ${triggerHour
                                .toString()
                                .padStart(2, "0")}:${triggerMinute
                                .toString()
                                .padStart(2, "0")}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Modo:</span>
                        <Badge
                          variant={
                            triggerMode === "trigger_date"
                              ? "warning"
                              : "default"
                          }
                          className="text-xs"
                        >
                          {triggerMode === "reservation_date"
                            ? "Automático"
                            : "Específico"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Frequência:
                        </span>
                        <span className="font-medium">
                          {
                            FREQUENCY_OPTIONS.find(
                              (f) => f.value === formData.frequency
                            )?.label
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline de Disparos */}
                  {upcomingTriggers.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Próximos Disparos
                      </h4>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {upcomingTriggers.map((trigger, index) => {
                          const isPreflight = trigger.type === "preflight"
                          const reservationDate = trigger.reservationDate
                            ? new Date(trigger.reservationDate)
                            : null

                          return (
                            <div
                              key={index}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                isPreflight
                                  ? "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800"
                                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                              }`}
                            >
                              <div
                                className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg text-xs ${
                                  isPreflight
                                    ? "bg-sky-200 dark:bg-sky-800 text-sky-700 dark:text-sky-300"
                                    : "bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {isPreflight ? (
                                  <Plane className="h-4 w-4" />
                                ) : (
                                  <>
                                    <span className="font-semibold">
                                      {trigger.date.getDate()}
                                    </span>
                                    <span className="text-[10px]">
                                      {
                                        DAY_NAMES_PT_SHORT[
                                          trigger.date.getDay()
                                        ]
                                      }
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium truncate">
                                    {isPreflight ? "Pre-flight" : "Disparo"}
                                  </p>
                                  {isPreflight && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      Teste
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {trigger.date.toLocaleDateString("pt-BR")} às{" "}
                                  {trigger.date.toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                              {reservationDate && !isPreflight && (
                                <Badge
                                  variant="success"
                                  className="text-xs whitespace-nowrap"
                                >
                                  🎾{" "}
                                  {reservationDate.toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                  })}
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Botão de Submit */}
                  <Button
                    type="submit"
                    className="w-full h-12 text-base"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        {isEditMode ? "Salvando..." : "Criando..."}
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-2" />
                        {isEditMode ? "Salvar Alterações" : "Criar Agendamento"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>

      {/* AlertDialog para confirmação de dias consecutivos */}
      <AlertDialog
        open={showConsecutiveDaysDialog}
        onOpenChange={setShowConsecutiveDaysDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Reservas em Dias Próximos
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Este agendamento cria reservas para{" "}
                <strong>{DAY_NAMES_PT[formData.reservationDayOfWeek]}</strong>,
                que está muito próximo de outros agendamentos ativos:
              </p>
              <div className="space-y-2 mt-3">
                {consecutiveDaysConflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                  >
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>{conflict.scheduleName}</strong> - reservas em{" "}
                      <strong>{DAY_NAMES_PT[conflict.dayOfWeek]}</strong>
                      <span className="text-muted-foreground ml-1">
                        (
                        {conflict.daysDiff === 1
                          ? "dia consecutivo"
                          : `${conflict.daysDiff} dias de diferença`}
                        )
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Você pode ajustar o número mínimo de dias entre reservas nas{" "}
                <strong>Configurações</strong>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmConsecutiveDays}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Criar Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

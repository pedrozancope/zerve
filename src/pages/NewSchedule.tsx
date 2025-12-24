import { useState, useEffect, useRef } from "react"
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
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
} from "@/hooks/useSchedules"
import { useLogs } from "@/hooks/useLogs"

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

export default function NewSchedule() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const { data: schedule, isLoading: loadingSchedule } = useSchedule(id)
  const { data: timeSlots = [] } = useTimeSlots()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const hasLoadedSchedule = useRef<string | null>(null)
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

  // Campos para Pre-flight (Teste de Voo)
  const [preflightEnabled, setPreflightEnabled] = useState(false)
  const [preflightHoursBefore, setPreflightHoursBefore] = useState(4)
  const [preflightNotifyOnSuccess, setPreflightNotifyOnSuccess] =
    useState(false)
  const [preflightNotifyOnFailure, setPreflightNotifyOnFailure] = useState(true)

  // Calcular dia da reserva automaticamente quando for trigger_date
  useEffect(() => {
    if (triggerMode === "trigger_date" && triggerDatetime) {
      const triggerDate = new Date(triggerDatetime)
      const dayOfWeek = triggerDate.getDay()
      setFormData((prev) => ({
        ...prev,
        reservationDayOfWeek: dayOfWeek,
      }))
    }
  }, [triggerMode, triggerDatetime])

  // Load schedule data if editing
  useEffect(() => {
    // Só carrega se tiver schedule e estiver em modo de edição
    if (!schedule || !isEditMode) return
    // Evita loop infinito - só carrega uma vez por schedule.id
    if (hasLoadedSchedule.current === schedule.id) return
    // Aguarda timeSlots carregar
    if (timeSlots.length === 0) return

    // Buscar o horário do timeSlot pelo ID (mais confiável)
    const foundSlot = timeSlots.find((ts: any) => ts.id === schedule.timeSlotId)
    const timeSlotHour = foundSlot?.hour || schedule.timeSlot?.hour

    if (!timeSlotHour) {
      return
    }

    // Marca como carregado para este schedule
    hasLoadedSchedule.current = schedule.id

    setFormData({
      name: schedule.name,
      timeSlotHour,
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
  }, [schedule, isEditMode, timeSlots])

  // Calculate preview data
  const triggerTime = `${triggerHour
    .toString()
    .padStart(2, "0")}:${triggerMinute.toString().padStart(2, "0")}:00`

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
              : "Configure sua reserva recorrente"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome do agendamento</Label>
                <Input
                  id="name"
                  placeholder="Ex: Tênis Domingo Manhã"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <Separator />

              {/* Day of Week */}
              <div className="space-y-3">
                <Label>
                  Dia da reserva
                  {triggerMode === "trigger_date" && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (definido automaticamente pela data de disparo)
                    </span>
                  )}
                </Label>
                <div className="grid grid-cols-7 gap-2">
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
                      className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.reservationDayOfWeek === index
                          ? "bg-primary text-primary-foreground"
                          : triggerMode === "trigger_date"
                          ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slot */}
              <div className="space-y-2">
                <Label>Horário</Label>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot.hour} value={slot.hour.toString()}>
                        {slot.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frequency */}
              <div className="space-y-3">
                <Label>Frequência</Label>
                <RadioGroup
                  value={formData.frequency}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      frequency: value as typeof formData.frequency,
                    }))
                  }
                  className="flex gap-4"
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="font-normal">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              {/* Trigger Mode */}
              <div className="space-y-3">
                <Label>Modo de Disparo</Label>
                <RadioGroup
                  value={triggerMode}
                  onValueChange={(value) =>
                    setTriggerMode(value as "reservation_date" | "trigger_date")
                  }
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-2 p-3 rounded-lg bg-muted/50 hover:bg-muted">
                    <RadioGroupItem
                      value="reservation_date"
                      id="reservation_date"
                      className="mt-1"
                    />
                    <div>
                      <Label
                        htmlFor="reservation_date"
                        className="font-medium cursor-pointer"
                      >
                        Baseado na reserva (+10 dias)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        O sistema calcula automaticamente: dispara 10 dias antes
                        da data da reserva
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-3 rounded-lg bg-muted/50 hover:bg-muted">
                    <RadioGroupItem
                      value="trigger_date"
                      id="trigger_date"
                      className="mt-1"
                    />
                    <div>
                      <Label
                        htmlFor="trigger_date"
                        className="font-medium cursor-pointer"
                      >
                        Data/hora específica
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Você define quando o disparo deve ocorrer (útil para
                        testes)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Trigger Time - só mostra no modo reservation_date */}
              {triggerMode === "reservation_date" && (
                <div className="space-y-2">
                  <Label>Horário do Disparo</Label>
                  <div className="flex gap-2">
                    <Select
                      value={triggerHour.toString()}
                      onValueChange={(value) => setTriggerHour(parseInt(value))}
                    >
                      <SelectTrigger className="w-24">
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
                    <span className="flex items-center">:</span>
                    <Select
                      value={triggerMinute.toString()}
                      onValueChange={(value) =>
                        setTriggerMinute(parseInt(value))
                      }
                    >
                      <SelectTrigger className="w-24">
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
                    Por padrão 00:01 (logo após a abertura das vagas)
                  </p>
                </div>
              )}

              {/* Trigger Datetime - só mostra no modo trigger_date */}
              {triggerMode === "trigger_date" && (
                <div className="space-y-2">
                  <Label>Data e Hora do Disparo</Label>
                  <Input
                    type="datetime-local"
                    value={triggerDatetime}
                    onChange={(e) => setTriggerDatetime(e.target.value)}
                    min={(() => {
                      const now = new Date()
                      // Adicionar 1 minuto ao horário atual
                      now.setMinutes(now.getMinutes() + 1)
                      // Formatar para datetime-local no timezone local
                      const year = now.getFullYear()
                      const month = String(now.getMonth() + 1).padStart(2, "0")
                      const day = String(now.getDate()).padStart(2, "0")
                      const hours = String(now.getHours()).padStart(2, "0")
                      const minutes = String(now.getMinutes()).padStart(2, "0")
                      return `${year}-${month}-${day}T${hours}:${minutes}`
                    })()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Selecione quando o disparo deve ocorrer. A reserva será
                    feita para o mesmo dia e horário escolhido.
                  </p>
                </div>
              )}

              <Separator />

              {/* Notifications */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notificações
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Sucesso</p>
                      <p className="text-xs text-muted-foreground">
                        Notificar quando a reserva for confirmada
                      </p>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Falha</p>
                      <p className="text-xs text-muted-foreground">
                        Notificar quando houver erro na reserva
                      </p>
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
              </div>

              <Separator />

              {/* Pre-flight (Teste de Voo) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Plane className="h-4 w-4" />
                    Teste de Voo (Pre-flight)
                  </Label>
                  <Switch
                    checked={preflightEnabled}
                    onCheckedChange={setPreflightEnabled}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Valida e atualiza o token de autenticação antes do disparo
                  agendado
                </p>

                {preflightEnabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label className="text-sm">Horas antes do disparo</Label>
                      <Select
                        value={preflightHoursBefore.toString()}
                        onValueChange={(value) =>
                          setPreflightHoursBefore(parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 24].map((hours) => (
                            <SelectItem key={hours} value={hours.toString()}>
                              {hours} hora{hours > 1 ? "s" : ""} antes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        O teste será executado {preflightHoursBefore} hora
                        {preflightHoursBefore > 1 ? "s" : ""} antes do horário
                        de disparo
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm">
                        Notificações do Pre-flight
                      </Label>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Sucesso</p>
                          <p className="text-xs text-muted-foreground">
                            Notificar quando o pre-flight for bem-sucedido
                          </p>
                        </div>
                        <Switch
                          checked={preflightNotifyOnSuccess}
                          onCheckedChange={setPreflightNotifyOnSuccess}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Falha</p>
                          <p className="text-xs text-muted-foreground">
                            Notificar quando houver erro no pre-flight
                          </p>
                        </div>
                        <Switch
                          checked={preflightNotifyOnFailure}
                          onCheckedChange={setPreflightNotifyOnFailure}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <h4 className="font-medium mb-2">Resumo do agendamento</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Reserva:</span>{" "}
                    <span className="font-medium">
                      {DAY_NAMES_PT[formData.reservationDayOfWeek]} às{" "}
                      {selectedTimeSlot?.displayName}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Disparo:</span>{" "}
                    <span className="font-medium">
                      {triggerMode === "trigger_date" && triggerDatetime
                        ? new Date(triggerDatetime).toLocaleString("pt-BR")
                        : `${DAY_NAMES_PT[triggerDay]} às ${triggerHour
                            .toString()
                            .padStart(2, "0")}:${triggerMinute
                            .toString()
                            .padStart(2, "0")}`}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Modo:</span>{" "}
                    <Badge
                      variant={
                        triggerMode === "trigger_date" ? "warning" : "default"
                      }
                      className="text-xs"
                    >
                      {triggerMode === "reservation_date"
                        ? "Automático (+10 dias)"
                        : "Data específica"}
                    </Badge>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Frequência:</span>{" "}
                    <span className="font-medium capitalize">
                      {formData.frequency}
                    </span>
                  </p>
                </div>
              </div>

              {/* Próximos Disparos - Para ambos os modos */}
              {upcomingTriggers.length > 0 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    {triggerMode === "trigger_date"
                      ? "Disparos Programados"
                      : "Próximos Disparos"}
                  </Label>
                  <div className="space-y-2">
                    {upcomingTriggers.map((trigger, index) => {
                      const isPreflight = trigger.type === "preflight"
                      const reservationDate = trigger.reservationDate
                        ? new Date(trigger.reservationDate)
                        : null

                      return (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                            isPreflight
                              ? "bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800"
                              : "bg-warning/10 border-warning/20"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg ${
                                isPreflight
                                  ? "bg-sky-200 dark:bg-sky-800 text-sky-700 dark:text-sky-300"
                                  : "bg-warning/20 text-warning"
                              }`}
                            >
                              {isPreflight ? (
                                <Plane className="h-5 w-5" />
                              ) : (
                                <>
                                  <span className="text-[10px] font-medium">
                                    {DAY_NAMES_PT_SHORT[trigger.date.getDay()]}
                                  </span>
                                  <span className="text-sm font-bold">
                                    {trigger.date.getDate()}
                                  </span>
                                </>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">
                                  {isPreflight ? "🧪 Pre-flight" : "🔔 Disparo"}
                                  : {trigger.date.toLocaleDateString("pt-BR")}
                                </p>
                                {isPreflight && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
                                  >
                                    Teste
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {trigger.date.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                BRT
                              </p>
                            </div>
                          </div>
                          {reservationDate && !isPreflight && (
                            <div className="text-right">
                              <Badge variant="success">
                                🎾{" "}
                                {reservationDate.toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                })}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {selectedTimeSlot?.displayName}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                {triggerMode === "reservation_date" ? (
                  <p>
                    ℹ️ O sistema dispara 10 dias antes da reserva, às{" "}
                    {triggerHour.toString().padStart(2, "0")}:
                    {triggerMinute.toString().padStart(2, "0")} (horário de
                    Brasília).
                  </p>
                ) : (
                  <p>
                    ⚠️ Modo de data específica: o disparo ocorrerá na data/hora
                    selecionada. A reserva será feita para +10 dias após o
                    disparo.
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Criar Agendamento
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Logs Section - Only in Edit Mode */}
        {isEditMode && id && (
          <div className="mt-6">
            <ScheduleLogsSection scheduleId={id} />
          </div>
        )}
      </form>
    </div>
  )
}

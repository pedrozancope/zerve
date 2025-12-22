import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Calendar, Clock, Bell, Save } from "lucide-react"
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

// Horários disponíveis para disparo
const TRIGGER_HOURS = Array.from({ length: 24 }, (_, i) => i)
const TRIGGER_MINUTES = [0, 1, 5, 10, 15, 30, 45]

export default function NewSchedule() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = !!id

  const { data: schedule, isLoading: loadingSchedule } = useSchedule(id)
  const { data: timeSlots = [] } = useTimeSlots()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
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
    if (schedule && isEditMode) {
      setFormData({
        name: schedule.name,
        timeSlotHour: schedule.timeSlot?.hour || 7,
        reservationDayOfWeek: schedule.reservationDayOfWeek,
        frequency: schedule.frequency,
        notifyOnSuccess: schedule.notifyOnSuccess,
        notifyOnFailure: schedule.notifyOnFailure,
      })
      // Carregar configurações avançadas
      if (schedule.triggerTime) {
        const [h, m] = schedule.triggerTime.split(":")
        setTriggerHour(parseInt(h) || 0)
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
    }
  }, [schedule, isEditMode])

  // Calculate preview data
  const triggerTime = `${triggerHour
    .toString()
    .padStart(2, "0")}:${triggerMinute.toString().padStart(2, "0")}:00`
  const nextDates = getNextExecutionDates(formData.reservationDayOfWeek, 3)
  const triggerDay = getTriggerDayOfWeek(formData.reservationDayOfWeek)
  const cronExpression = generateCronExpression(
    formData.reservationDayOfWeek,
    triggerHour,
    triggerMinute
  )
  const selectedTimeSlot = TIME_SLOTS.find(
    (s) => s.hour === formData.timeSlotHour
  )

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

    const scheduleData: any = {
      name: formData.name,
      time_slot_id: timeSlot.id,
      reservation_day_of_week: formData.reservationDayOfWeek,
      trigger_day_of_week: triggerDay,
      trigger_time: triggerTime,
      trigger_mode: triggerMode,
      trigger_datetime: triggerDatetimeISO,
      cron_expression: cronExpression,
      frequency: formData.frequency,
      notify_on_success: formData.notifyOnSuccess,
      notify_on_failure: formData.notifyOnFailure,
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

              {/* Cron Expression */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Cron Expression (AWS EventBridge)
                </Label>
                <code className="block p-3 rounded-lg bg-muted text-sm font-mono">
                  {cronExpression}
                </code>
              </div>

              {/* Next Executions */}
              <div className="space-y-3">
                <Label>Próximas execuções</Label>
                <div className="space-y-2">
                  {nextDates.map((date, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-warning/10 text-warning">
                          <span className="text-[10px] font-medium">
                            {DAY_NAMES_PT_SHORT[date.triggerDate.getDay()]}
                          </span>
                          <span className="text-sm font-bold">
                            {date.triggerDate.getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            🔔 Disparo:{" "}
                            {date.triggerDate.toLocaleDateString("pt-BR")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {triggerHour.toString().padStart(2, "0")}:
                            {triggerMinute.toString().padStart(2, "0")} BRT
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="success">
                          🎾{" "}
                          {date.reservationDate.toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedTimeSlot?.displayName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
      </form>
    </div>
  )
}

import { useState, useEffect } from "react"
import {
  Calendar,
  Clock,
  Bell,
  Power,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  TestTube2,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings2,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  useAutoCancelConfig,
  useUpsertAutoCancelConfig,
  useRunAutoCancel,
} from "@/hooks/useAutoCancel"

export default function AutoCancel() {
  const { data: config, isLoading } = useAutoCancelConfig()
  const upsertConfig = useUpsertAutoCancelConfig()
  const runAutoCancel = useRunAutoCancel()

  const [isActive, setIsActive] = useState(false)
  const [triggerTime, setTriggerTime] = useState("22:00")
  const [cancellationReason, setCancellationReason] = useState(
    "Cancelamento automático da reserva"
  )
  const [notifyOnSuccessNoReservations, setNotifyOnSuccessNoReservations] =
    useState(false)
  const [notifyOnSuccessWithReservations, setNotifyOnSuccessWithReservations] =
    useState(true)
  const [notifyOnFailure, setNotifyOnFailure] = useState(true)

  // Carregar configurações quando disponíveis
  useEffect(() => {
    if (config) {
      setIsActive(config.isActive)

      // Converter UTC→BRT (subtrai 3 horas)
      // O banco armazena em UTC, mas o usuário vê/configura em BRT
      if (config.triggerTime) {
        const [utcHour, minute] = config.triggerTime.split(":").map(Number)
        const brtHour = (utcHour - 3 + 24) % 24
        const brtTime = `${String(brtHour).padStart(2, "0")}:${String(
          minute
        ).padStart(2, "0")}`
        setTriggerTime(brtTime)
      }

      setCancellationReason(config.cancellationReason)
      setNotifyOnSuccessNoReservations(config.notifyOnSuccessNoReservations)
      setNotifyOnSuccessWithReservations(config.notifyOnSuccessWithReservations)
      setNotifyOnFailure(config.notifyOnFailure)
    }
  }, [config])

  const handleToggleEnabled = async (newIsActive: boolean) => {
    setIsActive(newIsActive)
    try {
      if (!triggerTime) {
        toast.error("Configure o horário antes de ativar")
        setIsActive(!newIsActive)
        return
      }

      // Converter BRT→UTC (adiciona 3 horas)
      const [brtHour, minute] = triggerTime.split(":").map(Number)
      const utcHour = (brtHour + 3) % 24
      const utcTime = `${String(utcHour).padStart(2, "0")}:${String(
        minute
      ).padStart(2, "0")}:00`

      await upsertConfig.mutateAsync({
        isActive: newIsActive,
        triggerTime: utcTime,
        cancellationReason,
        notifyOnSuccessNoReservations,
        notifyOnSuccessWithReservations,
        notifyOnFailure,
      })

      if (newIsActive) {
        toast.success("Auto-Cancel ativado!")
      } else {
        toast.success("Auto-Cancel desativado")
      }
    } catch (error) {
      console.error(error)
      setIsActive(!newIsActive)
      toast.error("Erro ao atualizar status")
    }
  }

  const handleSaveSettings = async () => {
    if (!cancellationReason.trim()) {
      toast.error("Digite um motivo para o cancelamento")
      return
    }

    if (!triggerTime) {
      toast.error("Configure o horário de execução")
      return
    }

    try {
      // Converter BRT→UTC (adiciona 3 horas)
      const [brtHour, minute] = triggerTime.split(":").map(Number)
      const utcHour = (brtHour + 3) % 24
      const utcTime = `${String(utcHour).padStart(2, "0")}:${String(
        minute
      ).padStart(2, "0")}:00`

      await upsertConfig.mutateAsync({
        isActive,
        triggerTime: utcTime,
        cancellationReason: cancellationReason.trim(),
        notifyOnSuccessNoReservations,
        notifyOnSuccessWithReservations,
        notifyOnFailure,
      })
    } catch (error) {
      console.error(error)
    }
  }

  const handleRunNow = async () => {
    try {
      await runAutoCancel.mutateAsync({ dryRun: false, adHoc: true })
    } catch (error) {
      console.error(error)
    }
  }

  const handleDryRun = async () => {
    try {
      await runAutoCancel.mutateAsync({ dryRun: true, adHoc: true })
    } catch (error) {
      console.error(error)
    }
  }

  const formatScheduleTime = () => {
    return triggerTime
  }

  const getNextRunTime = () => {
    if (!isActive || !config?.lastExecutedAt || !triggerTime) {
      return "Aguardando primeira execução"
    }

    const now = new Date()
    const next = new Date(now)
    const [hour, minute] = triggerTime.split(":").map(Number)
    next.setHours(hour, minute, 0, 0)

    // Se já passou hoje, vai para amanhã
    if (next < now) {
      next.setDate(next.getDate() + 1)
    }

    return next.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Componente de seção colapsável
  const Section = ({
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
  }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{title}</h3>
                    {badge}
                  </div>
                  {description && (
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-5">{children}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auto-Cancel</h1>
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const hasConfig = !!config

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auto-Cancel</h1>
          <p className="text-muted-foreground">
            Cancele automaticamente suas reservas após o uso
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleToggleEnabled(!isActive)}
            disabled={upsertConfig.isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
              isActive
                ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Power
              className={`h-4 w-4 ${
                isActive ? "text-green-600 dark:text-green-400" : ""
              }`}
            />
            <span className="text-sm font-medium">
              {isActive ? "Ligado" : "Desligado"}
            </span>
            <div
              className={`w-2 h-2 rounded-full ${
                isActive
                  ? "bg-green-500 animate-pulse"
                  : "bg-muted-foreground/50"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 shrink-0">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Como funciona?
              </p>
              <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
                O sistema verifica diariamente se você tem reservas para o dia
                atual e as cancela automaticamente no horário configurado.
              </p>
              <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                <strong>Por quê?</strong> A API externa não permite fazer
                agendamentos em dias seguidos. Cancelando as reservas do dia,
                você libera a possibilidade de fazer novas reservas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Coluna Principal - Formulário */}
        <div className="lg:col-span-3 space-y-4">
          {/* Status */}
          <Section
            icon={Power}
            title="Status do Sistema"
            description={
              isActive
                ? "O cancelamento automático está ativo"
                : "O cancelamento automático está desativado"
            }
            badge={
              <Badge
                variant={isActive ? "success" : "secondary"}
                className="text-xs"
              >
                {isActive ? "Ativo" : "Inativo"}
              </Badge>
            }
          >
            <div className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-full ${
                      isActive
                        ? "bg-green-100 dark:bg-green-900/50"
                        : "bg-muted"
                    }`}
                  >
                    {isActive ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {isActive ? "Sistema Ativo" : "Sistema Inativo"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isActive
                        ? `Próxima execução: ${getNextRunTime()}`
                        : "Ative o sistema para começar"}
                    </p>
                  </div>
                </div>
              </div>

              {hasConfig && config.lastExecutedAt && (
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Última execução:{" "}
                  {new Date(config.lastExecutedAt).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </Section>

          {/* Horário de Execução */}
          <Section
            icon={Clock}
            title="Horário de Execução"
            description="Defina quando o cancelamento deve ser executado"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="triggerTime" className="text-sm font-medium">
                  Horário (HH:MM)
                </Label>
                <input
                  id="triggerTime"
                  type="time"
                  value={triggerTime}
                  onChange={(e) => setTriggerTime(e.target.value)}
                  className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full font-mono"
                />
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    Horário configurado:{" "}
                    <span className="font-mono font-semibold">
                      {formatScheduleTime()}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  O sistema executará o cancelamento todos os dias neste horário
                </p>
              </div>
            </div>
          </Section>

          {/* Motivo do Cancelamento */}
          <Section
            icon={Calendar}
            title="Motivo do Cancelamento"
            description="Justificativa que será enviada para a API"
          >
            <div className="space-y-3">
              <Textarea
                id="cancellationReason"
                value={cancellationReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCancellationReason(e.target.value)
                }
                placeholder="Digite o motivo do cancelamento..."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Este texto será enviado como justificativa do cancelamento
              </p>
            </div>
          </Section>

          {/* Notificações */}
          <Section
            icon={Bell}
            title="Notificações por E-mail"
            description="E-mail e IDs configurados em Settings serão usados"
          >
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Quando notificar?
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      Sucesso (sem reservas)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Notificar quando não houver reservas para cancelar
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnSuccessNoReservations}
                    onCheckedChange={setNotifyOnSuccessNoReservations}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      Sucesso (com reservas)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Notificar quando reservas forem canceladas
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnSuccessWithReservations}
                    onCheckedChange={setNotifyOnSuccessWithReservations}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Erros</p>
                    <p className="text-xs text-muted-foreground">
                      Notificar quando houver falhas na execução
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnFailure}
                    onCheckedChange={setNotifyOnFailure}
                  />
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Coluna Lateral - Preview & Ações */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Preview Card */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-br from-primary/5 to-primary/10">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Configuração Atual</h3>
                </div>
              </div>
              <CardContent className="p-4 space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={isActive ? "success" : "secondary"}>
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {/* Horário */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Horário</span>
                  <span className="font-mono font-semibold">
                    {triggerTime || "—"}
                  </span>
                </div>

                {/* Próxima execução */}
                {isActive && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium uppercase">
                        Próxima Execução
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1 text-blue-900 dark:text-blue-100">
                      {getNextRunTime()}
                    </p>
                  </div>
                )}

                {/* Notificações ativas */}
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Notificações
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {notifyOnSuccessNoReservations && (
                      <Badge variant="outline" className="text-xs">
                        Sem reservas
                      </Badge>
                    )}
                    {notifyOnSuccessWithReservations && (
                      <Badge variant="outline" className="text-xs">
                        Com reservas
                      </Badge>
                    )}
                    {notifyOnFailure && (
                      <Badge variant="outline" className="text-xs">
                        Erros
                      </Badge>
                    )}
                    {!notifyOnSuccessNoReservations &&
                      !notifyOnSuccessWithReservations &&
                      !notifyOnFailure && (
                        <span className="text-xs text-muted-foreground">
                          Nenhuma
                        </span>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações Card */}
            <Card>
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Ações</h3>
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <Button
                  variant="outline"
                  onClick={handleDryRun}
                  disabled={runAutoCancel.isPending}
                  className="w-full justify-start gap-2"
                >
                  <TestTube2 className="h-4 w-4" />
                  Dry Run (Simular)
                </Button>

                <Button
                  onClick={handleRunNow}
                  disabled={runAutoCancel.isPending || !isActive}
                  className="w-full justify-start gap-2"
                  variant={isActive ? "default" : "secondary"}
                >
                  <PlayCircle className="h-4 w-4" />
                  Executar Agora
                </Button>

                <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Dry Run:</strong> Simula sem executar de verdade
                  </p>
                  <p>
                    <strong>Executar:</strong> Cancela reservas imediatamente
                  </p>
                </div>

                <div className="pt-3 border-t">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={upsertConfig.isPending}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Save className="h-4 w-4" />
                    {upsertConfig.isPending
                      ? "Salvando..."
                      : "Salvar Configurações"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  useAutoCancelConfig,
  useUpsertAutoCancelConfig,
  useRunAutoCancel,
} from "@/hooks/useAutoCancel"

export default function AutoCancel() {
  const { data: config, isLoading } = useAutoCancelConfig()
  const upsertConfig = useUpsertAutoCancelConfig()
  const runAutoCancel = useRunAutoCancel()

  const [enabled, setEnabled] = useState(false)
  const [runHour, setRunHour] = useState(22)
  const [runMinute, setRunMinute] = useState(0)
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
      setEnabled(config.enabled)

      // Converter UTC→BRT (subtrai 3 horas)
      // O banco armazena em UTC, mas o usuário vê/configura em BRT
      const hourBRT = (config.runHour - 3 + 24) % 24
      setRunHour(hourBRT)
      setRunMinute(config.runMinute)

      setCancellationReason(config.cancellationReason)
      setNotifyOnSuccessNoReservations(config.notifyOnSuccessNoReservations)
      setNotifyOnSuccessWithReservations(config.notifyOnSuccessWithReservations)
      setNotifyOnFailure(config.notifyOnFailure)
    }
  }, [config])

  const handleToggleEnabled = async (newEnabled: boolean) => {
    setEnabled(newEnabled)
    try {
      // Converter BRT→UTC (adiciona 3 horas)
      const runHourUTC = (runHour + 3) % 24

      await upsertConfig.mutateAsync({
        enabled: newEnabled,
        runHour: runHourUTC,
        runMinute,
        cancellationReason,
        notifyOnSuccessNoReservations,
        notifyOnSuccessWithReservations,
        notifyOnFailure,
      })

      if (newEnabled) {
        toast.success("Auto-Cancel ativado!")
      } else {
        toast.success("Auto-Cancel desativado")
      }
    } catch (error) {
      console.error(error)
      setEnabled(!newEnabled)
      toast.error("Erro ao atualizar status")
    }
  }

  const handleSaveSettings = async () => {
    if (!cancellationReason.trim()) {
      toast.error("Digite um motivo para o cancelamento")
      return
    }

    try {
      // Converter BRT→UTC (adiciona 3 horas)
      const runHourUTC = (runHour + 3) % 24

      await upsertConfig.mutateAsync({
        enabled,
        runHour: runHourUTC,
        runMinute,
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
    const h = runHour.toString().padStart(2, "0")
    const m = runMinute.toString().padStart(2, "0")
    return `${h}:${m}`
  }

  const getNextRunTime = () => {
    if (!enabled || !config?.lastRunAt) return "Aguardando primeira execução"

    const now = new Date()
    const next = new Date(now)
    next.setHours(runHour, runMinute, 0, 0)

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

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auto-Cancel</h1>
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const hasConfig = !!config

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auto-Cancel</h1>
        <p className="text-muted-foreground">
          Cancele automaticamente suas reservas após o uso
        </p>
      </div>

      {/* Alert explicativo */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona o Auto-Cancel?</AlertTitle>
        <AlertDescription className="text-sm space-y-2 mt-2">
          <p>
            O sistema verifica diariamente se você tem reservas para o dia atual
            e as cancela automaticamente no horário configurado.
          </p>
          <p className="text-muted-foreground">
            <strong>Por quê?</strong> A API externa não permite fazer
            agendamentos em dias seguidos. Cancelando as reservas do dia, você
            libera a possibilidade de fazer novas reservas a qualquer momento.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Power className="h-5 w-5" />
                Status do Auto-Cancel
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={upsertConfig.isPending}
              />
            </CardTitle>
            <CardDescription>
              {enabled
                ? "O cancelamento automático está ativo"
                : "O cancelamento automático está desativado"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${
                    enabled ? "bg-success/10" : "bg-muted"
                  }`}
                >
                  {enabled ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {enabled ? "Sistema Ativo" : "Sistema Inativo"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {enabled
                      ? `Próxima execução: ${getNextRunTime()}`
                      : "Ative o sistema para começar"}
                  </p>
                </div>
              </div>
              <Badge variant={enabled ? "success" : "outline"}>
                {enabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            {hasConfig && config.lastRunAt && (
              <div className="mt-4 text-sm text-muted-foreground">
                Última execução:{" "}
                {new Date(config.lastRunAt).toLocaleString("pt-BR")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuração de Horário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horário de Execução
            </CardTitle>
            <CardDescription>
              Defina quando o cancelamento automático deve ser executado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="runHour">Hora</Label>
                <Select
                  value={runHour.toString()}
                  onValueChange={(v) => setRunHour(parseInt(v))}
                >
                  <SelectTrigger id="runHour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i.toString().padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="runMinute">Minuto</Label>
                <Select
                  value={runMinute.toString()}
                  onValueChange={(v) => setRunMinute(parseInt(v))}
                >
                  <SelectTrigger id="runMinute">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 15, 30, 45].map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        :{m.toString().padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium">
                Horário configurado:{" "}
                <span className="font-mono">{formatScheduleTime()}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                O sistema executará o cancelamento todos os dias neste horário
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Motivo do Cancelamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Motivo do Cancelamento
            </CardTitle>
            <CardDescription>
              Justificativa que será enviada para a API ao cancelar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="cancellationReason">Motivo</Label>
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
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações por E-mail
            </CardTitle>
            <CardDescription>
              E-mail e IDs da API configurados em Settings serão usados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-medium">Quando notificar?</p>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sucesso (sem reservas)</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar quando não houver reservas para cancelar
                  </p>
                </div>
                <Switch
                  checked={notifyOnSuccessNoReservations}
                  onCheckedChange={setNotifyOnSuccessNoReservations}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sucesso (com reservas)</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar quando reservas forem canceladas
                  </p>
                </div>
                <Switch
                  checked={notifyOnSuccessWithReservations}
                  onCheckedChange={setNotifyOnSuccessWithReservations}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Erros</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar quando houver falhas na execução
                  </p>
                </div>
                <Switch
                  checked={notifyOnFailure}
                  onCheckedChange={setNotifyOnFailure}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Ações Manuais
            </CardTitle>
            <CardDescription>
              Teste e execute o cancelamento manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={handleDryRun}
                disabled={runAutoCancel.isPending}
                className="w-full"
              >
                <TestTube2 className="h-4 w-4 mr-2" />
                Dry Run (Simular)
              </Button>

              <Button
                onClick={handleRunNow}
                disabled={runAutoCancel.isPending || !enabled}
                className="w-full"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Executar Agora
              </Button>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Dry Run:</strong> Simula o cancelamento sem executar de
                verdade (para testes).
                <br />
                <strong>Executar Agora:</strong> Executa o cancelamento
                imediatamente (apenas se o sistema estiver ativo).
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Botão de Salvar */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSaveSettings}
            disabled={upsertConfig.isPending}
            size="lg"
          >
            {upsertConfig.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  )
}

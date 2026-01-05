import { useState, useEffect } from "react"
import {
  Key,
  RefreshCw,
  Bell,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  CalendarDays,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  useConfigByKey,
  useUpsertConfig,
  useConsecutiveDaysConfig,
} from "@/hooks/useConfig"

// Função utilitária para chamada da Edge Function
async function testarReservaAgora() {
  try {
    const res = await fetch("/functions/v1/execute-reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Se precisar passar parâmetros, adicione no body
      // body: JSON.stringify({ ... })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(`Erro ao executar reserva: ${data?.error || res.statusText}`)
    } else {
      toast.success("Reserva executada! Veja detalhes no log.")
    }
    // Opcional: exibir detalhes do log/execução
    if (data?.log) {
      toast(
        <pre style={{ maxWidth: 400, whiteSpace: "pre-wrap" }}>
          {typeof data.log === "string"
            ? data.log
            : JSON.stringify(data.log, null, 2)}
        </pre>
      )
    }
  } catch (err) {
    toast.error("Erro inesperado ao testar reserva")
  }
}

export default function Settings() {
  const [showToken, setShowToken] = useState(false)
  const [refreshToken, setRefreshToken] = useState("")
  const [notificationEmail, setNotificationEmail] = useState("")
  const [notifications, setNotifications] = useState({
    emailOnSuccess: true,
    emailOnFailure: true,
  })
  const [consecutiveDaysWarning, setConsecutiveDaysWarning] = useState(true)
  const [minDaysBetween, setMinDaysBetween] = useState(1)

  const { data: tokenConfig, isLoading: loadingToken } =
    useConfigByKey("auth_token")
  const { data: notifySuccessConfig } = useConfigByKey("notify_on_success")
  const { data: notifyFailureConfig } = useConfigByKey("notify_on_failure")
  const { data: emailConfig } = useConfigByKey("notification_email")
  const { warningEnabled, minDaysBetween: savedMinDays } =
    useConsecutiveDaysConfig()

  const upsertConfig = useUpsertConfig()

  useEffect(() => {
    if (notifySuccessConfig) {
      setNotifications((prev) => ({
        ...prev,
        emailOnSuccess: notifySuccessConfig.value === "true",
      }))
    }
    if (notifyFailureConfig) {
      setNotifications((prev) => ({
        ...prev,
        emailOnFailure: notifyFailureConfig.value === "true",
      }))
    }
  }, [notifySuccessConfig, notifyFailureConfig])

  useEffect(() => {
    if (emailConfig?.value) {
      setNotificationEmail(emailConfig.value)
    }
  }, [emailConfig])

  // Carregar configurações de dias consecutivos
  useEffect(() => {
    setConsecutiveDaysWarning(warningEnabled)
    setMinDaysBetween(savedMinDays)
  }, [warningEnabled, savedMinDays])

  const handleUpdateToken = async () => {
    if (!refreshToken.trim()) {
      toast.error("Digite o novo refresh token")
      return
    }

    try {
      await upsertConfig.mutateAsync({
        key: "auth_token",
        value: refreshToken,
      })
      setRefreshToken("")
      toast.success("Token atualizado com sucesso!")
    } catch (error) {
      console.error(error)
      toast.error("Erro ao atualizar token")
    }
  }

  const handleNotificationChange = async (key: string, value: boolean) => {
    try {
      await upsertConfig.mutateAsync({
        key,
        value: value.toString(),
      })
      toast.success("Preferência atualizada!")
    } catch (error) {
      console.error(error)
      toast.error("Erro ao atualizar preferência")
    }
  }

  const handleUpdateEmail = async () => {
    if (!notificationEmail.trim()) {
      toast.error("Digite um e-mail válido")
      return
    }

    try {
      await upsertConfig.mutateAsync({
        key: "notification_email",
        value: notificationEmail.trim(),
      })
      toast.success("E-mail de notificação atualizado!")
    } catch (error) {
      console.error(error)
      toast.error("Erro ao atualizar e-mail")
    }
  }

  const handleConsecutiveDaysWarningChange = async (enabled: boolean) => {
    setConsecutiveDaysWarning(enabled)
    try {
      await upsertConfig.mutateAsync({
        key: "consecutive_days_warning",
        value: enabled.toString(),
      })
      toast.success("Configuração atualizada!")
    } catch (error) {
      console.error(error)
      toast.error("Erro ao atualizar configuração")
    }
  }

  const handleMinDaysBetweenChange = async (days: number) => {
    setMinDaysBetween(days)
    try {
      await upsertConfig.mutateAsync({
        key: "min_days_between_reservations",
        value: days.toString(),
      })
      toast.success("Configuração atualizada!")
    } catch (error) {
      console.error(error)
      toast.error("Erro ao atualizar configuração")
    }
  }

  const maskToken = (token: string) => {
    if (!token) return "••••••••"
    if (token.length <= 12) return "••••••••"
    // Mostrar apenas primeiros 8 e últimos 8 caracteres
    return token.slice(0, 8) + "•••••••••••••••" + token.slice(-8)
  }

  if (loadingToken) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie tokens e preferências
          </p>
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const hasToken = !!tokenConfig?.value
  const tokenLastUpdated = tokenConfig?.updatedAt

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie tokens e preferências</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Token de Autenticação
            </CardTitle>
            <CardDescription>
              Gerencie o refresh_token usado para autenticação no sistema Speed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${
                    hasToken ? "bg-success/10" : "bg-destructive/10"
                  }`}
                >
                  {hasToken ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Shield className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Status do Token</p>
                  <p className="text-sm text-muted-foreground">
                    {tokenLastUpdated
                      ? `Atualizado em ${new Date(
                          tokenLastUpdated
                        ).toLocaleDateString("pt-BR")}`
                      : "Nenhum token configurado"}
                  </p>
                </div>
              </div>
              <Badge variant={hasToken ? "success" : "outline"}>
                {hasToken ? "Configurado" : "Pendente"}
              </Badge>
            </div>

            {hasToken && (
              <div className="space-y-2">
                <Label>Token Atual</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 rounded-md bg-muted overflow-hidden">
                    <code className="text-sm font-mono break-all">
                      {showToken
                        ? tokenConfig?.value
                        : maskToken(tokenConfig?.value || "")}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowToken(!showToken)}
                    className="shrink-0"
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newToken">
                  {hasToken ? "Atualizar" : "Novo"} Refresh Token
                </Label>
                <Input
                  id="newToken"
                  type="password"
                  placeholder="Cole o refresh_token aqui"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O token será armazenado de forma segura e usado para
                  autenticação nas reservas.
                </p>
              </div>
              <Button
                onClick={handleUpdateToken}
                disabled={upsertConfig.isPending || !refreshToken.trim()}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    upsertConfig.isPending ? "animate-spin" : ""
                  }`}
                />
                {upsertConfig.isPending ? "Atualizando..." : "Atualizar Token"}
              </Button>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Como obter o refresh_token?
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Acesse o site do Speed no navegador</li>
                <li>Abra as Ferramentas do Desenvolvedor (F12)</li>
                <li>Vá na aba "Application" ou "Armazenamento"</li>
                <li>Procure por "refresh_token" no LocalStorage</li>
                <li>Copie o valor e cole aqui</li>
              </ol>
              <div className="mt-6 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={testarReservaAgora}
                  className="gap-2"
                >
                  <span>Testar Reserva Agora</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure quando deseja receber alertas por e-mail
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campo de E-mail */}
            <div className="space-y-2">
              <Label
                htmlFor="notificationEmail"
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                E-mail para Notificações
              </Label>
              <div className="flex gap-2">
                <Input
                  id="notificationEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleUpdateEmail}
                  disabled={upsertConfig.isPending || !notificationEmail.trim()}
                  variant="secondary"
                >
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Você receberá notificações neste e-mail quando reservas forem
                realizadas ou falharem.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Reserva com Sucesso</p>
                <p className="text-sm text-muted-foreground">
                  Notificar quando a reserva for confirmada
                </p>
              </div>
              <Switch
                checked={notifications.emailOnSuccess}
                onCheckedChange={(checked) =>
                  handleNotificationChange("notify_on_success", checked)
                }
                disabled={upsertConfig.isPending}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Erro na Reserva</p>
                <p className="text-sm text-muted-foreground">
                  Notificar quando houver falha na reserva
                </p>
              </div>
              <Switch
                checked={notifications.emailOnFailure}
                onCheckedChange={(checked) =>
                  handleNotificationChange("notify_on_failure", checked)
                }
                disabled={upsertConfig.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuração de Dias Consecutivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Proteção de Reservas Consecutivas
            </CardTitle>
            <CardDescription>
              Configure alertas para evitar reservas em dias consecutivos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning">
                    Por que isso é importante?
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Reservas em dias consecutivos podem ser desnecessárias ou
                    até não permitidas. Ative este aviso para ser alertado antes
                    de criar agendamentos com datas muito próximas.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Aviso de Dias Consecutivos</p>
                <p className="text-sm text-muted-foreground">
                  Exibir confirmação ao criar reservas em dias muito próximos
                </p>
              </div>
              <Switch
                checked={consecutiveDaysWarning}
                onCheckedChange={handleConsecutiveDaysWarningChange}
                disabled={upsertConfig.isPending}
              />
            </div>

            {consecutiveDaysWarning && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label htmlFor="minDays">Dias mínimos entre reservas</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="minDays"
                      type="number"
                      min={1}
                      max={7}
                      value={minDaysBetween}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10)
                        if (value >= 1 && value <= 7) {
                          handleMinDaysBetweenChange(value)
                        }
                      }}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      {minDaysBetween === 1 ? "dia" : "dias"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Você será alertado se tentar criar uma reserva com menos de{" "}
                    <strong>{minDaysBetween}</strong>{" "}
                    {minDaysBetween === 1 ? "dia" : "dias"} de intervalo de uma
                    reserva existente.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

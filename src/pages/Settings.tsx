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
  Clipboard,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Info,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  useConfigByKey,
  useUpsertConfig,
  useConsecutiveDaysConfig,
} from "@/hooks/useConfig"
import { useTestToken } from "@/hooks/useTestToken"

export default function Settings() {
  const [showToken, setShowToken] = useState(false)
  const [refreshToken, setRefreshToken] = useState("")
  const [tokenError, setTokenError] = useState("")
  const [copiedToken, setCopiedToken] = useState(false)
  const [notificationEmail, setNotificationEmail] = useState("")
  const [notifications, setNotifications] = useState({
    emailOnSuccess: true,
    emailOnFailure: true,
  })
  const [consecutiveDaysWarning, setConsecutiveDaysWarning] = useState(true)
  const [minDaysBetween, setMinDaysBetween] = useState(1)
  const [unitId, setUnitId] = useState("")
  const [condoId, setCondoId] = useState("")

  const { data: tokenConfig, isLoading: loadingToken } =
    useConfigByKey("auth_token")
  const { data: unitIdConfig } = useConfigByKey("unit_id")
  const { data: condoIdConfig } = useConfigByKey("condo_id")
  const { data: notifySuccessConfig } = useConfigByKey("notify_on_success")
  const { data: notifyFailureConfig } = useConfigByKey("notify_on_failure")
  const { data: emailConfig } = useConfigByKey("notification_email")
  const { warningEnabled, minDaysBetween: savedMinDays } =
    useConsecutiveDaysConfig()

  const upsertConfig = useUpsertConfig()
  const testToken = useTestToken()

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
    if (unitIdConfig?.value) setUnitId(unitIdConfig.value)
  }, [unitIdConfig])

  useEffect(() => {
    if (condoIdConfig?.value) setCondoId(condoIdConfig.value)
  }, [condoIdConfig])

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

  // Função para processar e validar o token
  const processToken = (value: string): string => {
    // Remove espaços em branco (início, fim e meio)
    return value.replace(/\s/g, "")
  }

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const processedValue = processToken(rawValue)

    setRefreshToken(processedValue)

    // Verificar se havia espaços
    if (rawValue !== processedValue && rawValue.length > 0) {
      setTokenError("Espaços foram removidos automaticamente")
      setTimeout(() => setTokenError(""), 3000)
    } else {
      setTokenError("")
    }
  }

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const processedToken = processToken(text)
      setRefreshToken(processedToken)

      if (text !== processedToken) {
        toast.info("Token colado! Espaços removidos automaticamente.")
      } else {
        toast.success("Token colado!")
      }
    } catch (error) {
      toast.error("Não foi possível acessar a área de transferência")
    }
  }

  const handleCopyCurrentToken = async () => {
    if (tokenConfig?.value) {
      try {
        await navigator.clipboard.writeText(tokenConfig.value)
        setCopiedToken(true)
        toast.success("Token copiado!")
        setTimeout(() => setCopiedToken(false), 2000)
      } catch (error) {
        toast.error("Erro ao copiar token")
      }
    }
  }

  const handleUpdateToken = async () => {
    const cleanToken = processToken(refreshToken)

    if (!cleanToken) {
      toast.error("Digite o novo refresh token")
      return
    }

    try {
      await upsertConfig.mutateAsync({
        key: "auth_token",
        value: cleanToken,
      })
      setRefreshToken("")
      setTokenError("")
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

  const handleSaveApiConfig = async () => {
    if (!unitId || !condoId) {
      toast.error("Preencha ID da Unidade e ID do Condomínio")
      return
    }

    try {
      await Promise.all([
        upsertConfig.mutateAsync({ key: "unit_id", value: unitId }),
        upsertConfig.mutateAsync({ key: "condo_id", value: condoId }),
      ])
      toast.success("Configurações da API salvas!")
    } catch (error) {
      toast.error("Erro ao salvar configurações da API")
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{title}</h3>
                    {badge}
                  </div>
                  {description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie tokens e preferências</p>
      </div>

      <div className="space-y-4">
        {/* Token de Autenticação - Card Principal (Mobile-First) */}
        <Section
          icon={Key}
          title="Token de Autenticação"
          description="refresh_token para o sistema Speed"
          badge={
            <Badge
              variant={hasToken ? "success" : "secondary"}
              className="text-xs"
            >
              {hasToken ? "Configurado" : "Pendente"}
            </Badge>
          }
        >
          <div className="space-y-5">
            {/* Status atual */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted border">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-full ${
                    hasToken
                      ? "bg-green-100 dark:bg-green-900/50"
                      : "bg-red-100 dark:bg-red-900/50"
                  }`}
                >
                  {hasToken ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {hasToken ? "Token Ativo" : "Token Não Configurado"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tokenLastUpdated
                      ? `Atualizado em ${new Date(
                          tokenLastUpdated
                        ).toLocaleDateString("pt-BR")} às ${new Date(
                          tokenLastUpdated
                        ).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Configure um token para começar"}
                  </p>
                </div>
              </div>
            </div>

            {/* Token atual (se existir) */}
            {hasToken && (
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Token Atual
                </Label>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <code className="text-xs sm:text-sm font-mono break-all leading-relaxed block">
                    {showToken
                      ? tokenConfig?.value
                      : maskToken(tokenConfig?.value || "")}
                  </code>
                </div>

                {/* Botões de ação - Layout mobile-friendly */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                    className="gap-1.5"
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {showToken ? "Ocultar" : "Ver"}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCurrentToken}
                    className="gap-1.5"
                  >
                    {copiedToken ? (
                      <ClipboardCheck className="h-4 w-4" />
                    ) : (
                      <Clipboard className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {copiedToken ? "Copiado!" : "Copiar"}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const result = await testToken.mutateAsync()
                        if (result.success) {
                          toast.success(
                            `✅ Token válido! ${
                              result.data?.reservationsFound || 0
                            } reserva(s) encontrada(s).`
                          )
                        }
                      } catch (error: any) {
                        toast.error(
                          `❌ Falha: ${error?.message || "Erro desconhecido"}`
                        )
                      }
                    }}
                    disabled={testToken.isPending}
                    className="gap-1.5"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        testToken.isPending ? "animate-spin" : ""
                      }`}
                    />
                    <span className="hidden sm:inline">
                      {testToken.isPending ? "..." : "Testar"}
                    </span>
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Atualizar Token - Otimizado para Mobile */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">
                  {hasToken ? "Atualizar" : "Novo"} Refresh Token
                </Label>
              </div>

              {/* Campo de entrada otimizado para mobile */}
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    id="newToken"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="Cole o refresh_token aqui"
                    value={refreshToken}
                    onChange={handleTokenChange}
                    className="pr-12 font-mono text-sm h-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePasteToken}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-10 px-3 text-muted-foreground hover:text-foreground"
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </div>

                {tokenError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {tokenError}
                  </p>
                )}

                {refreshToken && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                      {refreshToken.length} caracteres
                    </span>
                    {refreshToken.length > 20 && (
                      <Badge
                        variant="outline"
                        className="text-xs text-green-600"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Parece válido
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleUpdateToken}
                disabled={upsertConfig.isPending || !refreshToken}
                className="w-full gap-2 h-11"
                size="lg"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    upsertConfig.isPending ? "animate-spin" : ""
                  }`}
                />
                {upsertConfig.isPending ? "Atualizando..." : "Atualizar Token"}
              </Button>
            </div>

            {/* Instruções - Colapsável */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="w-full p-3 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        Como obter o refresh_token?
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-4 rounded-lg bg-muted/50 border text-sm space-y-2">
                  <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>Acesse o site do Speed no navegador</li>
                    <li>Abra Ferramentas do Desenvolvedor (F12)</li>
                    <li>Vá na aba "Application" ou "Armazenamento"</li>
                    <li>Procure por "refresh_token" no LocalStorage</li>
                    <li>Copie o valor e cole aqui</li>
                  </ol>
                  <p className="text-xs text-muted-foreground/70 pt-2 border-t">
                    💡 No mobile, use o navegador Chrome ou Safari e acesse as
                    ferramentas de desenvolvedor.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Section>

        {/* Configurações da API */}
        <Section
          icon={Shield}
          title="Configurações da API"
          description="IDs da unidade e condomínio"
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitId">ID da Unidade</Label>
                <Input
                  id="unitId"
                  placeholder="Ex: 17686"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  ID da sua unidade no sistema
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condoId">ID do Condomínio</Label>
                <Input
                  id="condoId"
                  placeholder="Ex: 185"
                  value={condoId}
                  onChange={(e) => setCondoId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  ID do condomínio no sistema
                </p>
              </div>
            </div>
            <Button
              onClick={handleSaveApiConfig}
              disabled={upsertConfig.isPending || !unitId || !condoId}
              className="w-full sm:w-auto gap-2"
            >
              {upsertConfig.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </Section>

        {/* Notificações */}
        <Section
          icon={Bell}
          title="Notificações"
          description="Configure alertas por e-mail"
          defaultOpen={false}
        >
          <div className="space-y-4">
            {/* Campo de E-mail */}
            <div className="space-y-2">
              <Label
                htmlFor="notificationEmail"
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                E-mail para Notificações
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
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
                  className="w-full sm:w-auto"
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

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Reserva com Sucesso</p>
                  <p className="text-xs text-muted-foreground">
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

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Erro na Reserva</p>
                  <p className="text-xs text-muted-foreground">
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
            </div>
          </div>
        </Section>

        {/* Configuração de Dias Consecutivos */}
        <Section
          icon={CalendarDays}
          title="Proteção de Reservas"
          description="Alertas para dias consecutivos"
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Por que isso é importante?
                  </p>
                  <p className="text-amber-800/80 dark:text-amber-200/80 mt-1">
                    Reservas em dias consecutivos podem ser desnecessárias ou
                    até não permitidas. Ative este aviso para ser alertado antes
                    de criar agendamentos com datas muito próximas.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  Aviso de Dias Consecutivos
                </p>
                <p className="text-xs text-muted-foreground">
                  Exibir confirmação ao criar reservas próximas
                </p>
              </div>
              <Switch
                checked={consecutiveDaysWarning}
                onCheckedChange={handleConsecutiveDaysWarningChange}
                disabled={upsertConfig.isPending}
              />
            </div>

            {consecutiveDaysWarning && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
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
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    {minDaysBetween === 1 ? "dia" : "dias"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Você será alertado se tentar criar uma reserva com menos de{" "}
                  <strong>{minDaysBetween}</strong>{" "}
                  {minDaysBetween === 1 ? "dia" : "dias"} de intervalo.
                </p>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}

import { useState } from "react"
import {
  ChevronDown,
  CheckCircle2,
  XCircle,
  Minus,
  Copy,
  Check,
} from "lucide-react"
import type { ExecutionLog, LogEntry } from "@/types"
import { cn } from "@/lib/utils"

// Seção colapsável estilo Strapi Cloud
interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  count?: number
  status?: "success" | "error" | "pending" | "neutral"
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  count,
  status = "neutral",
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const statusColors = {
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    pending: "text-yellow-600 dark:text-yellow-400",
    neutral: "text-muted-foreground",
  }

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">{title}</span>
          {count !== undefined && (
            <span className={cn("text-xs", statusColors[status])}>
              {count} {count === 1 ? "item" : "itens"}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && <div className="px-6 pb-4">{children}</div>}
    </div>
  )
}

// Componente para exibir JSON formatado com botão de copiar
function JsonViewer({
  data,
  title,
  maxHeight = "max-h-64",
}: {
  data: unknown
  title?: string
  maxHeight?: string
}) {
  const [copied, setCopied] = useState(false)

  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
    return null
  }

  const jsonString = JSON.stringify(data, null, 2)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border bg-slate-950 dark:bg-slate-900 overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            title="Copiar conteúdo"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre
        className={cn(
          "p-4 text-xs text-slate-300 overflow-auto font-mono",
          maxHeight
        )}
      >
        <code>{jsonString}</code>
      </pre>
    </div>
  )
}

// Componente para exibir um step do log
function StepItem({ step, isLast }: { step: LogEntry; isLast: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Determinar status baseado no step
  const getStepStatus = () => {
    const stepName = step.step.toLowerCase()
    if (stepName.includes("error") || stepName.includes("erro")) return "error"
    if (stepName.includes("success") || stepName.includes("sucesso"))
      return "success"
    return "success" // Default para steps completados
  }

  const status = getStepStatus()
  const hasDetails = step.details && Object.keys(step.details).length > 0
  const hasRequest = (step as any).request
  const hasResponse = (step as any).response
  const hasExpandableContent = hasDetails || hasRequest || hasResponse

  const StatusIcon = status === "error" ? XCircle : CheckCircle2

  // Nome legível do step em português
  const getStepName = (stepId: string) => {
    const names: Record<string, string> = {
      // Geral
      start: "Início",
      initialization: "Inicialização",
      success: "Concluído com Sucesso",
      error: "Erro",

      // Conexão e Config
      connecting_database: "Conectando ao Banco de Dados",
      loading_config: "Carregando Configuração",
      loading_unit_condo_config: "Carregando Configuração de Unidade",
      validating_config: "Validando Configuração",

      // Autenticação
      getting_auth_token: "Buscando Token de Autenticação",
      getting_refresh_token: "Buscando Refresh Token",
      get_token: "Buscando Token",
      authenticating: "Autenticando na API",
      authenticate: "Autenticando na API",
      authenticating_superlogica: "Autenticando na SuperLógica",
      updating_token: "Salvando Novo Token",
      updating_refresh_token: "Salvando Novo Token",
      update_token: "Salvando Novo Token",

      // Reservas
      getting_schedule: "Carregando Agendamento",
      getting_api_config: "Carregando Configurações da API",
      making_reservation: "Enviando Reserva para API",
      processing_response: "Processando Resposta da Reserva",
      saving_reservation: "Salvando Reserva no Banco",

      // Auto-Cancel
      parsing_request: "Processando Requisição",
      calculating_date: "Calculando Data Atual (BRT)",
      listing_reservations: "Buscando Reservas na API",
      list_reservations: "Buscando Reservas na API",
      filtering_reservations: "Filtrando Reservas do Dia",
      filtering_today_reservations: "Identificando Reservas para Cancelar",
      cancelling_reservations: "Processando Cancelamentos",
      cancellation_summary: "Resumo dos Cancelamentos",
      updating_config: "Atualizando Configuração",

      // Logs e Notificações
      saving_execution_log: "Salvando Log de Execução",
      sending_notification: "Enviando Notificação por E-mail",
      getting_notification_email: "Obtendo E-mail de Notificação",

      // Teste E2E
      test_mode: "Modo de Teste E2E",
      parsing_payload: "Processando Payload",
    }
    return (
      names[stepId] ||
      stepId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    )
  }

  return (
    <div className="relative">
      {/* Linha conectora vertical */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />
      )}

      <div
        className={cn(
          "flex items-start gap-3 py-2",
          hasExpandableContent &&
            "cursor-pointer hover:bg-muted/30 rounded-lg px-2 -mx-2"
        )}
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
      >
        {/* Ícone de status */}
        <div
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
            status === "success" && "bg-green-100 dark:bg-green-900/30",
            status === "error" && "bg-red-100 dark:bg-red-900/30"
          )}
        >
          <StatusIcon
            className={cn(
              "h-3.5 w-3.5",
              status === "success" && "text-green-600 dark:text-green-400",
              status === "error" && "text-red-600 dark:text-red-400"
            )}
          />
        </div>

        {/* Conteúdo do step */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {getStepName(step.step)}
            </span>
            <div className="flex items-center gap-2">
              {step.timestamp && (
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(step.timestamp).toLocaleTimeString("pt-BR")}
                </span>
              )}
              {hasExpandableContent && (
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
              )}
            </div>
          </div>
          {step.message && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {step.message}
            </p>
          )}
        </div>
      </div>

      {/* Conteúdo expandido */}
      {isExpanded && hasExpandableContent && (
        <div className="ml-9 mt-2 mb-3 space-y-3">
          {hasRequest && (
            <JsonViewer
              data={(step as any).request}
              title="Request"
              maxHeight="max-h-48"
            />
          )}
          {hasResponse && (
            <JsonViewer
              data={(step as any).response}
              title="Response"
              maxHeight="max-h-48"
            />
          )}
          {hasDetails && !hasRequest && !hasResponse && (
            <JsonViewer
              data={step.details}
              title="Detalhes"
              maxHeight="max-h-48"
            />
          )}
        </div>
      )}
    </div>
  )
}

export function LogDetailsPanel({ log }: { log: ExecutionLog }) {
  const hasExecutionLog = log.executionLog && log.executionLog.length > 0
  const hasRequestPayload =
    log.requestPayload && Object.keys(log.requestPayload).length > 0
  const hasResponsePayload =
    log.responsePayload && Object.keys(log.responsePayload).length > 0

  // Calcular contagens para as seções
  const stepCount = log.executionLog?.length || 0

  return (
    <div className="border-t bg-muted/20">
      {/* Seção: Etapas de Execução */}
      {hasExecutionLog && (
        <CollapsibleSection
          title="Etapas de Execução"
          defaultOpen={true}
          count={stepCount}
          status={log.status === "error" ? "error" : "success"}
        >
          <div className="space-y-1">
            {log.executionLog!.map((step, index) => (
              <StepItem
                key={`${step.step}-${index}`}
                step={step}
                isLast={index === log.executionLog!.length - 1}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Seção: Request Payload */}
      {hasRequestPayload && (
        <CollapsibleSection
          title="Request Payload"
          defaultOpen={!hasExecutionLog}
        >
          <JsonViewer data={log.requestPayload} maxHeight="max-h-80" />
        </CollapsibleSection>
      )}

      {/* Seção: Response Payload */}
      {hasResponsePayload && (
        <CollapsibleSection
          title="Response Payload"
          defaultOpen={!hasExecutionLog && !hasRequestPayload}
          status={log.status === "error" ? "error" : "success"}
        >
          <JsonViewer data={log.responsePayload} maxHeight="max-h-80" />
        </CollapsibleSection>
      )}

      {/* Mensagem quando não há dados */}
      {!hasExecutionLog && !hasRequestPayload && !hasResponsePayload && (
        <div className="px-6 py-8 text-center">
          <Minus className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum detalhe adicional disponível para este log.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Logs mais antigos podem não ter informações detalhadas.
          </p>
        </div>
      )}
    </div>
  )
}

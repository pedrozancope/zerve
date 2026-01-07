import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { FlowStepsLog } from "./FlowStepsLog"
import { ApiRequestResponse } from "./ApiRequestResponse"
import type { ExecutionLog } from "@/types"
import type { ExecutionResult } from "@/lib/flowSteps"
import { cn } from "@/lib/utils"

interface LogCardProps {
  log: ExecutionLog
  defaultExpanded?: boolean
  viewMode?: "flow" | "simple"
  showApiDetails?: boolean
}

// Configuração visual por tipo de execução
const executionTypeConfig = {
  reservation: {
    label: "Reserva",
    dotClass: "bg-blue-500",
  },
  preflight: {
    label: "Pre-flight",
    dotClass: "bg-sky-500",
  },
  test: {
    label: "Teste E2E",
    dotClass: "bg-orange-500",
  },
  test_token: {
    label: "Teste de Token",
    dotClass: "bg-emerald-500",
  },
  auto_cancel: {
    label: "Auto-Cancel",
    dotClass: "bg-purple-500",
  },
}

export function LogCard({
  log,
  defaultExpanded = false,
  viewMode = "flow",
  showApiDetails = true,
}: LogCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const typeConfig = executionTypeConfig[log.executionType]

  // Converter ExecutionLog para ExecutionResult para o FlowStepsLog
  const convertToExecutionResult = (): ExecutionResult => {
    const responsePayload = log.responsePayload as any

    return {
      success: log.status === "success",
      error:
        log.status === "error"
          ? responsePayload?.error || log.message
          : undefined,
      step: log.errorStep,
      duration: log.durationMs,
      data: log.responsePayload,
      details: responsePayload?.details,
      log: log.executionLog,
      responsePayload: log.responsePayload,
    }
  }

  const hasStructuredLog = log.executionLog && log.executionLog.length > 0

  const hasApiCalls =
    showApiDetails &&
    (log.requestPayload || log.responsePayload) &&
    (log.executionType === "reservation" ||
      log.executionType === "test" ||
      log.executionType === "auto_cancel" ||
      log.executionType === "test_token" ||
      log.executionType === "preflight")

  // Nome do card
  const getTitle = () => {
    if (log.schedule?.name) return log.schedule.name
    if (log.executionType === "test")
      return `Teste E2E - ${
        log.testHour || (log.requestPayload as any)?.reservationHour || "?"
      }:00`
    return typeConfig.label
  }

  // Formatar data/hora
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Verificar se é modo teste (dry-run)
  // Usa o campo isTest do log OU detecta pela mensagem como fallback
  const isDryRun =
    log.isTest === true ||
    log.message?.toLowerCase().includes("dry run") ||
    log.message?.includes("[DRY RUN]")

  // Status config
  const getStatusConfig = () => {
    switch (log.status) {
      case "success":
        return {
          label: "Sucesso",
          className:
            "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/50",
        }
      case "error":
        return {
          label: "Erro",
          className:
            "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/50",
        }
      case "pending":
        return {
          label: "Pendente",
          className:
            "text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/50",
        }
    }
  }

  const statusInfo = getStatusConfig()

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header - Clickable */}
      <div
        className="px-6 py-5 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Grid layout para informações */}
        <div className="grid grid-cols-12 gap-4 items-start">
          {/* Coluna 1: Tipo + Nome (span 4) */}
          <div className="col-span-12 sm:col-span-5 lg:col-span-4">
            <div className="flex items-center gap-3">
              {/* Tipo indicator dot */}
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  typeConfig.dotClass
                )}
              />

              <div className="min-w-0">
                {/* Tipo label */}
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {typeConfig.label}
                </p>
                {/* Nome */}
                <h3 className="font-semibold text-sm mt-0.5 truncate">
                  {getTitle()}
                </h3>
              </div>
            </div>
          </div>

          {/* Coluna 2: Executado em (span 2) */}
          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Executado
            </p>
            <p className="text-sm mt-0.5">
              <span className="font-medium">{formatDate(log.executedAt)}</span>
              <span className="text-muted-foreground ml-1">
                {formatTime(log.executedAt)}
              </span>
            </p>
          </div>

          {/* Coluna 3: Data Reserva (span 2) - só para reservas */}
          <div className="col-span-6 sm:col-span-2 lg:col-span-2">
            {log.reservationDate ? (
              <>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Reserva
                </p>
                <p className="text-sm mt-0.5 font-medium">
                  {formatDate(log.reservationDate)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Duração
                </p>
                <p className="text-sm mt-0.5">
                  {log.durationMs ? `${log.durationMs}ms` : "-"}
                </p>
              </>
            )}
          </div>

          {/* Coluna 4: Modo (span 2) */}
          <div className="col-span-6 sm:col-span-2 lg:col-span-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Modo
            </p>
            <p className="text-sm mt-0.5">
              {isDryRun ? (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Simulação
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Produção
                </span>
              )}
            </p>
          </div>

          {/* Coluna 5: Status + Expand (span 2) */}
          <div className="col-span-6 sm:col-span-12 lg:col-span-2 flex items-center justify-between sm:justify-end gap-3">
            {/* Status badge */}
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                statusInfo.className
              )}
            >
              {statusInfo.label}
            </span>

            {/* Expand icon */}
            <ChevronRight
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform flex-shrink-0",
                isExpanded && "rotate-90"
              )}
            />
          </div>
        </div>

        {/* Mensagem - linha separada */}
        {log.message && (
          <div className="mt-3 ml-5 pl-3 border-l-2 border-muted">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {log.message}
            </p>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t bg-muted/30">
          <div className="px-6 py-5 space-y-4">
            {/* Info extra quando expandido */}
            {log.reservationDate && log.durationMs && (
              <div className="flex items-center gap-6 text-sm text-muted-foreground pb-4 border-b">
                <span>
                  <span className="font-medium text-foreground">
                    {log.durationMs}ms
                  </span>{" "}
                  de duração
                </span>
              </div>
            )}

            {/* Modo de visualização de fluxo (se houver log estruturado) */}
            {viewMode === "flow" && hasStructuredLog ? (
              <FlowStepsLog
                result={convertToExecutionResult()}
                isTest={log.isTest}
                executionType={log.executionType}
                title="Etapas da Execução"
                subtitle={
                  log.status === "success"
                    ? "Todas as etapas concluídas com sucesso"
                    : log.status === "error"
                    ? `Falha na execução`
                    : undefined
                }
              />
            ) : (
              /* Modo de visualização simples (payloads brutos) */
              <>
                {log.requestPayload && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                      Request Payload
                    </h4>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                      {JSON.stringify(log.requestPayload, null, 2)}
                    </pre>
                  </div>
                )}
                {log.responsePayload && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          log.status === "success"
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      ></span>
                      Response Payload
                    </h4>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                      {JSON.stringify(log.responsePayload, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}

            {/* Mostrar detalhes de API externa quando não houver log estruturado */}
            {hasApiCalls && !hasStructuredLog && (
              <ApiRequestResponse
                request={log.requestPayload}
                response={log.responsePayload}
                title="Detalhes da API Externa"
              />
            )}

            {/* Mostrar mensagem informativa se não houver log estruturado em modo flow */}
            {viewMode === "flow" && !hasStructuredLog && (
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground text-center">
                  ℹ️ Este log não possui informações de etapas estruturadas.
                  <br />
                  <span className="text-xs">
                    Logs mais antigos podem não ter esse nível de detalhamento.
                  </span>
                </p>

                {!hasApiCalls &&
                  (log.requestPayload || log.responsePayload) && (
                    <div className="mt-4 space-y-3">
                      {log.requestPayload && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver Request Payload
                          </summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(log.requestPayload, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.responsePayload && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver Response Payload
                          </summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(log.responsePayload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FlowStepsLog } from "./FlowStepsLog"
import { ExecutionTypeBadge } from "./ExecutionTypeBadge"
import { ApiRequestResponse } from "./ApiRequestResponse"
import type { ExecutionLog } from "@/types"
import type { ExecutionResult } from "@/lib/flowSteps"

interface LogCardProps {
  log: ExecutionLog
  defaultExpanded?: boolean
  viewMode?: "flow" | "simple"
  showApiDetails?: boolean
}

export function LogCard({
  log,
  defaultExpanded = false,
  viewMode = "flow",
  showApiDetails = true,
}: LogCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const getStatusIcon = (status: ExecutionLog["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-success" />
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />
      case "pending":
        return <Clock className="h-5 w-5 text-warning" />
    }
  }

  const getStatusBadge = (status: ExecutionLog["status"]) => {
    const variants = {
      success: "success" as const,
      error: "destructive" as const,
      pending: "secondary" as const,
    }
    const labels = {
      success: "Sucesso",
      error: "Erro",
      pending: "Pendente",
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

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

  // Verificar se há chamadas de API externas para mostrar request/response
  const hasApiCalls =
    showApiDetails &&
    (log.requestPayload || log.responsePayload) &&
    (log.executionType === "reservation" ||
      log.executionType === "test" ||
      log.executionType === "auto_cancel" ||
      log.executionType === "test_token" ||
      log.executionType === "preflight")

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {getStatusIcon(log.status)}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">
                  {log.schedule?.name ||
                    (log.isTest
                      ? `Teste E2E - ${
                          log.testHour ||
                          (log.requestPayload as any)?.reservationHour ||
                          "?"
                        }:00`
                      : log.executionType === "test_token"
                      ? "Teste de Token"
                      : log.executionType === "auto_cancel"
                      ? "Auto-Cancel"
                      : "Execução Manual")}
                </CardTitle>
                {getStatusBadge(log.status)}
                <ExecutionTypeBadge
                  executionType={log.executionType}
                  isTest={log.isTest}
                />
              </div>
              <CardDescription>{log.message}</CardDescription>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                {log.reservationDate && (
                  <span>
                    📅 Data da reserva:{" "}
                    {new Date(log.reservationDate).toLocaleDateString("pt-BR")}
                  </span>
                )}
                <span>
                  🕐 Executado em:{" "}
                  {new Date(log.executedAt).toLocaleString("pt-BR")}
                </span>
                {log.durationMs && <span>⏱️ Duração: {log.durationMs}ms</span>}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Fechar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Detalhes
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4 border-t pt-4">
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
        </CardContent>
      )}
    </Card>
  )
}

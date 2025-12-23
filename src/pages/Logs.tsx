import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Workflow,
  List,
  Plane,
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLogs } from "@/hooks/useLogs"
import { useSchedules } from "@/hooks/useSchedules"
import { FlowStepsLog } from "@/components/logs"
import type { ExecutionLog } from "@/types"
import type { ExecutionResult } from "@/lib/flowSteps"

export default function Logs() {
  const [searchParams] = useSearchParams()
  const scheduleIdFromUrl = searchParams.get("schedule")

  const { data: schedules } = useSchedules()

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [scheduleFilter, setScheduleFilter] = useState<string>(
    scheduleIdFromUrl || "all"
  )
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"flow" | "simple">("flow")

  // Atualizar filtro quando mudar URL
  useEffect(() => {
    if (scheduleIdFromUrl) {
      setScheduleFilter(scheduleIdFromUrl)
    }
  }, [scheduleIdFromUrl])

  const {
    data: logs,
    isLoading,
    refetch,
    isRefetching,
  } = useLogs({
    ...(statusFilter !== "all" && {
      status: statusFilter as ExecutionLog["status"],
    }),
    ...(scheduleFilter !== "all" && { scheduleId: scheduleFilter }),
  })

  // Auto refresh a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 5000)

    return () => clearInterval(interval)
  }, [refetch])

  const toggleExpanded = (id: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

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
  const convertToExecutionResult = (log: ExecutionLog): ExecutionResult => {
    return {
      success: log.status === "success",
      error: log.status === "error" ? log.message : undefined,
      step: log.errorStep,
      duration: log.durationMs,
      data: log.responsePayload,
      log: log.executionLog,
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">
            Histórico de execuções das reservas
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-muted-foreground">
          Histórico de execuções das reservas
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agendamentos</SelectItem>
              {schedules?.map((schedule) => (
                <SelectItem key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Toggle de visualização */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "flow" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setViewMode("flow")}
            >
              <Workflow className="h-4 w-4" />
              Fluxo
            </Button>
            <Button
              variant={viewMode === "simple" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setViewMode("simple")}
            >
              <List className="h-4 w-4" />
              Simples
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {!logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-1">
                Nenhum log encontrado
              </h3>
              <p className="text-sm">
                Os logs de execução aparecerão aqui quando as reservas forem
                processadas.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {logs.map((log) => {
            const isExpanded = expandedLogs.has(log.id)
            const hasStructuredLog =
              log.executionLog && log.executionLog.length > 0

            return (
              <Card key={log.id}>
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
                                    (log.requestPayload as any)
                                      ?.reservationHour ||
                                    "?"
                                  }:00`
                                : "Execução Manual")}
                          </CardTitle>
                          {getStatusBadge(log.status)}
                          {log.isTest && (
                            <Badge variant="outline" className="gap-1">
                              <FlaskConical className="h-3 w-3" />
                              Teste
                            </Badge>
                          )}
                          {log.executionType === "preflight" && (
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300"
                            >
                              <Plane className="h-3 w-3" />
                              Pre-flight
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{log.message}</CardDescription>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                          {log.reservationDate && (
                            <span>
                              📅 Data da reserva:{" "}
                              {new Date(log.reservationDate).toLocaleDateString(
                                "pt-BR"
                              )}
                            </span>
                          )}
                          <span>
                            🕐 Executado em:{" "}
                            {new Date(log.executedAt).toLocaleString("pt-BR")}
                          </span>
                          {log.durationMs && (
                            <span>⏱️ Duração: {log.durationMs}ms</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(log.id)}
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
                          result={convertToExecutionResult(log)}
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

                      {/* Mostrar mensagem informativa se não houver log estruturado em modo flow */}
                      {viewMode === "flow" && !hasStructuredLog && (
                        <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                          <p className="text-sm text-muted-foreground text-center">
                            ℹ️ Este log não possui informações de etapas
                            estruturadas.
                            <br />
                            <span className="text-xs">
                              Logs mais antigos podem não ter esse nível de
                              detalhamento.
                            </span>
                          </p>

                          {(log.requestPayload || log.responsePayload) && (
                            <div className="mt-4 space-y-3">
                              {log.requestPayload && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Ver Request Payload
                                  </summary>
                                  <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-32">
                                    {JSON.stringify(
                                      log.requestPayload,
                                      null,
                                      2
                                    )}
                                  </pre>
                                </details>
                              )}
                              {log.responsePayload && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Ver Response Payload
                                  </summary>
                                  <pre className="mt-2 bg-muted p-2 rounded overflow-auto max-h-32">
                                    {JSON.stringify(
                                      log.responsePayload,
                                      null,
                                      2
                                    )}
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
          })}
        </div>
      )}
    </div>
  )
}

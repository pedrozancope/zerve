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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import type { ExecutionLog } from "@/types"

export default function Logs() {
  const [searchParams] = useSearchParams()
  const scheduleIdFromUrl = searchParams.get("schedule")

  const { data: schedules } = useSchedules()

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [scheduleFilter, setScheduleFilter] = useState<string>(
    scheduleIdFromUrl || "all"
  )
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

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

      <div className="flex items-center gap-4">
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
        <div className="space-y-4">
          {logs.map((log) => {
            const isExpanded = expandedLogs.has(log.id)
            return (
              <Card key={log.id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(log.status)}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">
                              {log.schedule?.name ||
                                (log.isTest
                                  ? `Teste E2E - ${
                                      log.testHour ||
                                      (log.requestPayload as any)
                                        ?.reservationHour ||
                                      "?"
                                    }:00`
                                  : "Execução Manual")}
                            </h3>
                            {getStatusBadge(log.status)}
                            {log.isTest && (
                              <Badge variant="outline" className="gap-1">
                                <FlaskConical className="h-3 w-3" />
                                Teste
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {log.message}
                          </p>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {log.reservationDate && (
                              <span>
                                Data da reserva:{" "}
                                {new Date(
                                  log.reservationDate
                                ).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            <span>
                              Executado em:{" "}
                              {new Date(log.executedAt).toLocaleString("pt-BR")}
                            </span>
                            {log.durationMs && (
                              <span>Duração: {log.durationMs}ms</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(log.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 pt-3 border-t">
                        {log.requestPayload && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Request Payload
                            </h4>
                            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                              {JSON.stringify(log.requestPayload, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.responsePayload && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Response Payload
                            </h4>
                            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                              {JSON.stringify(log.responsePayload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

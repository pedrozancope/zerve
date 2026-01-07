import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Clock,
  Filter,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { LogCard } from "@/components/logs"
import type { ExecutionLog } from "@/types"

export default function Logs() {
  const [searchParams] = useSearchParams()
  const scheduleIdFromUrl = searchParams.get("schedule")

  const { data: schedules } = useSchedules()

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [scheduleFilter, setScheduleFilter] = useState<string>(
    scheduleIdFromUrl || "all"
  )

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

  // Estatísticas dos logs filtrados
  const stats = useMemo(() => {
    if (!logs)
      return { total: 0, success: 0, error: 0, pending: 0, successRate: 0 }

    const total = logs.length
    const success = logs.filter((l) => l.status === "success").length
    const error = logs.filter((l) => l.status === "error").length
    const pending = logs.filter((l) => l.status === "pending").length
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0

    return { total, success, error, pending, successRate }
  }, [logs])

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
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Logs de Execução</h1>
        <p className="text-muted-foreground">
          Histórico detalhado de todas as execuções com request/response de APIs
        </p>
      </div>

      {/* Stats Cards */}
      {logs && logs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                execuções registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sucesso</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.success}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.successRate}% de taxa de sucesso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Erros</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.error}
              </div>
              <p className="text-xs text-muted-foreground">
                execuções com falha
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
              <p className="text-xs text-muted-foreground">
                aguardando conclusão
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
              <CardDescription>
                Filtre e visualize os logs por status, agendamento e formato
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-2 self-start sm:self-auto"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Status:
              </span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">✅ Sucesso</SelectItem>
                  <SelectItem value="error">❌ Erro</SelectItem>
                  <SelectItem value="pending">⏳ Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Agendamento:
              </span>
              <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {schedules?.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {!logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-semibold mb-2">
                Nenhum log encontrado
              </h3>
              <p className="text-sm max-w-md mx-auto">
                {statusFilter !== "all" || scheduleFilter !== "all"
                  ? "Tente ajustar os filtros para ver mais resultados."
                  : "Os logs de execução aparecerão aqui quando as reservas forem processadas."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo{" "}
              <span className="font-semibold text-foreground">
                {logs.length}
              </span>{" "}
              {logs.length === 1 ? "log" : "logs"}
            </p>
          </div>

          <div className="space-y-4">
            {logs.map((log) => (
              <LogCard key={log.id} log={log} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

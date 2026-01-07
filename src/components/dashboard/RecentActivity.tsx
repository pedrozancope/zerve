import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ExecutionTypeBadge } from "@/components/logs"
import type { ExecutionLog } from "@/types"

interface RecentActivityProps {
  logs: ExecutionLog[]
  isLoading?: boolean
}

export function RecentActivity({ logs, isLoading }: RecentActivityProps) {
  const getStatusIcon = (status: ExecutionLog["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-success" />
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: ExecutionLog["status"]) => {
    switch (status) {
      case "success":
        return <Badge variant="success">Sucesso</Badge>
      case "error":
        return <Badge variant="error">Erro</Badge>
      case "pending":
        return <Badge variant="warning">Pendente</Badge>
      default:
        return <Badge variant="outline">-</Badge>
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma atividade ainda</p>
            <p className="text-sm">As execuções aparecerão aqui</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(log.status)}
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">
                      {log.schedule?.name ||
                        (log.executionType === "test_token"
                          ? "Teste de Token"
                          : log.executionType === "auto_cancel"
                          ? "Auto-Cancel"
                          : "Execução manual")}
                    </p>
                    {log.executionType !== "reservation" &&
                      !log.schedule?.name && (
                        <ExecutionTypeBadge
                          executionType={log.executionType}
                          isTest={log.isTest}
                          className="text-[10px] h-4 px-1.5"
                        />
                      )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(log.executedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(log.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

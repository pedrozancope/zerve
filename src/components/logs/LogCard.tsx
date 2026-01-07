import { useState } from "react"
import { ChevronRight, ChevronDown, Calendar } from "lucide-react"
import { LogDetailsPanel } from "./LogDetailsPanel"
import type { ExecutionLog } from "@/types"
import { cn } from "@/lib/utils"

interface LogCardProps {
  log: ExecutionLog
  defaultExpanded?: boolean
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

export function LogCard({ log, defaultExpanded = false }: LogCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const typeConfig = executionTypeConfig[log.executionType]

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
          dotClass: "bg-green-500",
          textClass: "text-green-700 dark:text-green-400",
        }
      case "error":
        return {
          label: "Erro",
          dotClass: "bg-red-500",
          textClass: "text-red-700 dark:text-red-400",
        }
      case "pending":
        return {
          label: "Pendente",
          dotClass: "bg-yellow-500",
          textClass: "text-yellow-700 dark:text-yellow-400",
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
        {/* Grid layout para informações - Inspirado no Strapi Cloud */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-3 items-start">
          {/* Coluna 1: Status + Nome */}
          <div className="col-span-12 lg:col-span-4">
            <div className="flex items-start gap-3">
              {/* Status dot */}
              <div className="pt-1">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    statusInfo.dotClass
                  )}
                />
              </div>

              <div className="min-w-0 flex-1">
                {/* Tipo label */}
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                  {typeConfig.label}
                </p>
                {/* Nome */}
                <h3 className="font-semibold text-sm truncate">{getTitle()}</h3>
              </div>
            </div>
          </div>

          {/* Coluna 2: Executado em */}
          <div className="col-span-6 sm:col-span-4 lg:col-span-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Executado
            </p>
            <p className="text-sm">
              <span className="font-medium">{formatDate(log.executedAt)}</span>
              <span className="text-muted-foreground ml-1.5">
                {formatTime(log.executedAt)}
              </span>
            </p>
          </div>

          {/* Coluna 3: Duração */}
          <div className="col-span-6 sm:col-span-4 lg:col-span-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Duração
            </p>
            <p className="text-sm">
              {log.durationMs ? (
                <span className="font-medium">{log.durationMs}ms</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </p>
          </div>

          {/* Coluna 4: Modo */}
          <div className="col-span-6 sm:col-span-4 lg:col-span-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Modo
            </p>
            <p className="text-sm">
              {isDryRun ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Simulação
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Produção
                </span>
              )}
            </p>
          </div>

          {/* Coluna 5: Status + Expand */}
          <div className="col-span-6 sm:col-span-12 lg:col-span-2 flex items-center justify-between lg:justify-end gap-3">
            {/* Status text */}
            <span className={cn("text-sm font-medium", statusInfo.textClass)}>
              {statusInfo.label}
            </span>

            {/* Expand icon */}
            <div className="p-1 rounded hover:bg-muted transition-colors">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        {/* Mensagem - linha separada com borda */}
        {log.message && (
          <div className="mt-4 pl-5 ml-0.5 border-l-2 border-muted">
            <p className="text-sm text-muted-foreground">{log.message}</p>
          </div>
        )}

        {/* Data da reserva quando existir */}
        {log.reservationDate && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground pl-6">
            <Calendar className="h-3.5 w-3.5" />
            <span>Reserva para:</span>
            <span className="font-medium text-foreground">
              {formatDate(log.reservationDate)}
            </span>
          </div>
        )}
      </div>

      {/* Expanded content - Panel de detalhes */}
      {isExpanded && <LogDetailsPanel log={log} />}
    </div>
  )
}

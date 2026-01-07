import { Badge } from "@/components/ui/badge"
import {
  FlaskConical,
  Plane,
  Ban,
  Calendar,
  Key,
  type LucideIcon,
} from "lucide-react"
import type { ExecutionLog } from "@/types"

// ============================================
// Configuração de tipos de execução
// ============================================
const operationConfigs: Record<
  ExecutionLog["executionType"],
  {
    label: string
    icon: LucideIcon
    className: string
  }
> = {
  reservation: {
    label: "Reserva",
    icon: Calendar,
    className:
      "gap-1 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  preflight: {
    label: "Pre-flight",
    icon: Plane,
    className:
      "gap-1 bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  },
  auto_cancel: {
    label: "Auto-Cancel",
    icon: Ban,
    className:
      "gap-1 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  },
  test: {
    label: "Teste E2E",
    icon: FlaskConical,
    className:
      "gap-1 bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  },
  test_token: {
    label: "Teste de Token",
    icon: Key,
    className:
      "gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
}

// ============================================
// Badge de Tipo de Operação (simples)
// ============================================
interface OperationTypeBadgeProps {
  executionType: ExecutionLog["executionType"]
  className?: string
}

export function OperationTypeBadge({
  executionType,
  className,
}: OperationTypeBadgeProps) {
  const config = operationConfigs[executionType]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${className || ""}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// ============================================
// Badge de Modo: Teste (Dry Run)
// ============================================
interface ModeBadgeProps {
  isTest?: boolean
  className?: string
}

export function ModeBadge({ isTest, className }: ModeBadgeProps) {
  if (!isTest) return null

  return (
    <Badge
      variant="outline"
      className={`gap-1 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700 ${
        className || ""
      }`}
    >
      <FlaskConical className="h-3 w-3" />
      Teste
    </Badge>
  )
}

// ============================================
// ExecutionTypeBadge (compatibilidade)
// ============================================
interface ExecutionTypeBadgeProps {
  executionType: ExecutionLog["executionType"]
  isTest?: boolean
  className?: string
}

export function ExecutionTypeBadge({
  executionType,
  isTest,
  className,
}: ExecutionTypeBadgeProps) {
  // Se for teste em reserva/preflight, mostra badge de teste
  if (
    isTest &&
    (executionType === "reservation" || executionType === "preflight")
  ) {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700 ${
          className || ""
        }`}
      >
        <FlaskConical className="h-3 w-3" />
        Teste
      </Badge>
    )
  }

  return (
    <OperationTypeBadge executionType={executionType} className={className} />
  )
}

// ============================================
// LogBadgeGroup (mantido para compatibilidade)
// ============================================
interface LogBadgeGroupProps {
  status: ExecutionLog["status"]
  executionType: ExecutionLog["executionType"]
  isTest?: boolean
  className?: string
}

export function LogBadgeGroup({
  executionType,
  isTest,
  className,
}: LogBadgeGroupProps) {
  const isInherentlyTest =
    executionType === "test" ||
    executionType === "test_token" ||
    executionType === "auto_cancel"

  const showModeBadge = !isInherentlyTest && isTest

  return (
    <div
      className={`inline-flex items-center gap-1.5 flex-wrap ${
        className || ""
      }`}
    >
      <OperationTypeBadge executionType={executionType} />
      {showModeBadge && <ModeBadge isTest={isTest} />}
    </div>
  )
}

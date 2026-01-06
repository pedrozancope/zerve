import { Badge } from "@/components/ui/badge"
import {
  FlaskConical,
  Plane,
  XCircle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react"
import type { ExecutionLog } from "@/types"

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
  if (isTest) {
    return (
      <Badge variant="outline" className={`gap-1 ${className || ""}`}>
        <FlaskConical className="h-3 w-3" />
        Teste
      </Badge>
    )
  }

  const configs: Record<
    ExecutionLog["executionType"],
    {
      label: string
      icon: LucideIcon
      className: string
    }
  > = {
    reservation: {
      label: "Reserva",
      icon: CheckCircle2,
      className:
        "gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
    preflight: {
      label: "Pre-flight",
      icon: Plane,
      className:
        "gap-1 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
    },
    auto_cancel: {
      label: "Auto-Cancel",
      icon: XCircle,
      className:
        "gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    },
    test: {
      label: "Teste E2E",
      icon: FlaskConical,
      className:
        "gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    },
    test_token: {
      label: "Teste de Token",
      icon: CheckCircle2,
      className:
        "gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    },
  }

  const config = configs[executionType]
  const Icon = config.icon

  return (
    <Badge
      variant="secondary"
      className={`${config.className} ${className || ""}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

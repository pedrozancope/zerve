import { CheckCircle2 } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"
import { FlowStepsLog } from "./FlowStepsLog"
import { ApiRequestResponse } from "./ApiRequestResponse"
import type { ExecutionResult, ExecutionType } from "@/lib/flowSteps"

interface TestResultDisplayProps {
  result: ExecutionResult | null
  isLoading: boolean
  executionType?: ExecutionType
  title?: string
  subtitle?: string
  showDataSection?: boolean
}

export function TestResultDisplay({
  result,
  isLoading,
  executionType = "test",
  title = "Fluxo de Execução",
  subtitle,
  showDataSection = true,
}: TestResultDisplayProps) {
  const defaultSubtitle = isLoading
    ? "Executando teste..."
    : !result
    ? "Execute o teste para ver o progresso"
    : undefined

  return (
    <div className="space-y-6">
      {/* Fluxo visual das etapas */}
      <FlowStepsLog
        result={result}
        isTest={executionType === "test"}
        isLoading={isLoading}
        executionType={executionType}
        title={title}
        subtitle={subtitle || defaultSubtitle}
      />

      {/* Request/Response da API (se houver) */}
      {result?.responsePayload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes da API</CardTitle>
            <CardDescription>
              Request e response das chamadas à API externa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiRequestResponse
              response={result.responsePayload}
              title="Dados completos da resposta"
            />
          </CardContent>
        </Card>
      )}

      {/* Dados da reserva/resultado (se sucesso e mostrar data) */}
      {showDataSection && result?.success && result?.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Dados do Resultado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Log completo (debug) - apenas se houver log estruturado */}
      {result?.log && result.log.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground mb-2">
            📋 Ver log completo (debug)
          </summary>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log Completo (Debug)</CardTitle>
              <CardDescription>
                Todos os eventos registrados durante a execução
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto max-h-96">
                {JSON.stringify(result.log, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  )
}

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { PlayCircle, Loader2 } from "lucide-react"
import { TestResultDisplay } from "@/components/logs"
import type { ExecutionResult } from "@/lib/flowSteps"

// Horários disponíveis (6h às 21h)
const AVAILABLE_HOURS = Array.from({ length: 16 }, (_, i) => i + 6)

export default function TestReservationE2E() {
  const [hour, setHour] = useState<string>("7")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)

  const handleTest = async () => {
    setLoading(true)
    setResult(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const res = await fetch(
        `${supabaseUrl}/functions/v1/execute-reservation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            test: true,
            hour: parseInt(hour, 10),
          }),
        }
      )

      const data: ExecutionResult = await res.json().catch(() => ({
        success: false,
        error: "Erro ao parsear resposta",
      }))

      setResult(data)

      if (data.success) {
        toast.success("Reserva executada com sucesso!")
      } else {
        toast.error(`Erro: ${data.error || "Falha desconhecida"}`)
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Erro inesperado ao testar reserva"
      setResult({
        success: false,
        error: errorMsg,
        log: [],
      })
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Teste de Reserva E2E
        </h1>
        <p className="text-muted-foreground">
          Execute uma reserva de teste para validar todo o fluxo
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Card de configuração */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Configuração
            </CardTitle>
            <CardDescription>Configure e execute o teste</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Horário da Reserva</label>
              <Select value={hour} onValueChange={setHour} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_HOURS.map((h) => (
                    <SelectItem key={h} value={h.toString()}>
                      {h.toString().padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Reserva para daqui a 10 dias
              </p>
            </div>

            <Separator />

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <strong>⚠️ Atenção:</strong> Este teste executa uma reserva real.
            </div>

            <Button
              onClick={handleTest}
              disabled={loading}
              className="w-full gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Executar Teste
                </>
              )}
            </Button>

            {result && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={result.success ? "success" : "destructive"}>
                    {result.success ? "Sucesso" : "Erro"}
                  </Badge>
                </div>
                {result.duration && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Duração:
                    </span>
                    <span className="text-sm">{result.duration}ms</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fluxo visual das etapas - usando componente reutilizável */}
        <div className="lg:col-span-2">
          <TestResultDisplay
            result={result}
            isLoading={loading}
            executionType="test"
            title="Fluxo de Execução"
            showDataSection={true}
          />
        </div>
      </div>
    </div>
  )
}

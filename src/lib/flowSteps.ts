import {
  FileCheck,
  PlayCircle,
  Key,
  Shield,
  RefreshCw,
  Calendar,
  Database,
  CheckCircle2,
  Search,
  Bell,
  Save,
  Plane,
  type LucideIcon,
} from "lucide-react"

// Definição das etapas do fluxo de execução
export interface FlowStep {
  id: string
  name: string
  icon: LucideIcon
  description: string
}

// Steps completos do fluxo de reserva
export const RESERVATION_FLOW_STEPS: FlowStep[] = [
  {
    id: "parsing_payload",
    name: "Receber Payload",
    icon: FileCheck,
    description: "Processar dados recebidos",
  },
  {
    id: "test_mode",
    name: "Modo de Teste",
    icon: PlayCircle,
    description: "Ativar modo de teste E2E",
  },
  {
    id: "getting_schedule",
    name: "Buscar Agendamento",
    icon: Search,
    description: "Obter detalhes do agendamento",
  },
  {
    id: "getting_refresh_token",
    name: "Buscar Token",
    icon: Key,
    description: "Obter refresh token do banco",
  },
  {
    id: "authenticating_superlogica",
    name: "Autenticar",
    icon: Shield,
    description: "Autenticar na API SuperLogica",
  },
  {
    id: "updating_refresh_token",
    name: "Atualizar Token",
    icon: RefreshCw,
    description: "Salvar novo refresh token",
  },
  {
    id: "making_reservation",
    name: "Fazer Reserva",
    icon: Calendar,
    description: "Chamar API do Speed",
  },
  {
    id: "processing_response",
    name: "Processar Resposta",
    icon: Database,
    description: "Validar resposta da API",
  },
  {
    id: "saving_execution_log",
    name: "Salvar Log",
    icon: Save,
    description: "Registrar execução no banco",
  },
  {
    id: "saving_reservation",
    name: "Salvar Reserva",
    icon: Save,
    description: "Registrar reserva no banco",
  },
  {
    id: "sending_notification",
    name: "Notificação",
    icon: Bell,
    description: "Enviar e-mail de notificação",
  },
  {
    id: "success",
    name: "Sucesso",
    icon: CheckCircle2,
    description: "Reserva concluída!",
  },
]

// Steps simplificados para modo de teste E2E (não inclui getting_schedule)
export const TEST_FLOW_STEPS: FlowStep[] = RESERVATION_FLOW_STEPS.filter(
  (step) =>
    step.id !== "getting_schedule" &&
    step.id !== "saving_execution_log" &&
    step.id !== "saving_reservation"
)

// Steps para Pre-flight (validação de token)
export const PREFLIGHT_FLOW_STEPS: FlowStep[] = [
  {
    id: "initialization",
    name: "Iniciar Pre-flight",
    icon: Plane,
    description: "Inicializar verificação",
  },
  {
    id: "getting_refresh_token",
    name: "Buscar Token",
    icon: Key,
    description: "Obter refresh token do banco",
  },
  {
    id: "authenticating_superlogica",
    name: "Autenticar",
    icon: Shield,
    description: "Autenticar na API SuperLogica",
  },
  {
    id: "updating_refresh_token",
    name: "Atualizar Token",
    icon: RefreshCw,
    description: "Salvar novo refresh token",
  },
  {
    id: "sending_notification",
    name: "Notificação",
    icon: Bell,
    description: "Enviar e-mail de notificação",
  },
  {
    id: "success",
    name: "Sucesso",
    icon: CheckCircle2,
    description: "Token validado com sucesso!",
  },
]

// Mapeia IDs de step para nomes legíveis
export const STEP_NAMES: Record<string, string> = {
  initialization: "Inicialização",
  parsing_payload: "Processamento do Payload",
  test_mode: "Configuração Modo Teste",
  getting_schedule: "Busca do Agendamento",
  getting_refresh_token: "Obtenção do Refresh Token",
  authenticating_superlogica: "Autenticação SuperLógica",
  updating_refresh_token: "Atualização do Refresh Token",
  making_reservation: "Execução da Reserva",
  processing_response: "Processamento da Resposta",
  saving_execution_log: "Salvamento do Log",
  saving_reservation: "Salvamento da Reserva",
  sending_notification: "Envio de Notificação",
  preflight_start: "Início do Pre-flight",
  updating_last_preflight: "Atualização do Status Pre-flight",
  success: "Sucesso",
  error: "Erro",
}

// Função para obter steps relevantes baseado no contexto
export function getRelevantSteps(
  isTest: boolean,
  logEntries?: LogEntry[],
  executionType?: "reservation" | "preflight" | "test"
): FlowStep[] {
  // Se for preflight, usa steps de preflight
  if (executionType === "preflight") {
    return PREFLIGHT_FLOW_STEPS
  }

  // Se for teste, usa steps simplificados
  if (isTest || executionType === "test") {
    return TEST_FLOW_STEPS
  }

  // Para execução normal, retorna todos os steps que aparecem nos logs
  // ou todos se não houver logs
  if (!logEntries || logEntries.length === 0) {
    return RESERVATION_FLOW_STEPS
  }

  // Filtra apenas os steps que aparecem nos logs
  const logStepIds = new Set(logEntries.map((l) => l.step))

  // Sempre inclui os steps básicos
  const basicSteps = [
    "parsing_payload",
    "getting_schedule",
    "getting_refresh_token",
    "authenticating_superlogica",
    "updating_refresh_token",
    "making_reservation",
    "processing_response",
    "success",
  ]

  return RESERVATION_FLOW_STEPS.filter(
    (step) => logStepIds.has(step.id) || basicSteps.includes(step.id)
  )
}

// Interface para entrada de log
export interface LogEntry {
  step: string
  message: string
  details?: Record<string, unknown>
  timestamp: string
}

// Interface para resultado de execução
export interface ExecutionResult {
  success: boolean
  error?: string
  step?: string
  details?: Record<string, unknown>
  duration?: number
  data?: Record<string, unknown>
  log?: LogEntry[]
}

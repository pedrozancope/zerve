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
  Plane,
  type LucideIcon,
} from "lucide-react"

// Tipos de execução suportados
export type ExecutionType = "reservation" | "preflight" | "test"

// Definição das etapas do fluxo de execução
export interface FlowStep {
  id: string
  name: string
  icon: LucideIcon
  description: string
  /** Descrição alternativa para diferentes tipos de execução */
  descriptionByType?: Partial<Record<ExecutionType, string>>
  /** Tipos de execução onde este step se aplica (se não definido, aplica a todos) */
  appliesTo?: ExecutionType[]
}

// =============================================================================
// DEFINIÇÃO UNIFICADA DE STEPS
// =============================================================================
// Todos os steps possíveis, com indicação de onde se aplicam
export const ALL_FLOW_STEPS: FlowStep[] = [
  // Step inicial para preflight
  {
    id: "initialization",
    name: "Iniciar Pre-flight",
    icon: Plane,
    description: "Iniciando Pre-flight",
    appliesTo: ["preflight"],
  },
  // Step inicial para reservation/test
  {
    id: "parsing_payload",
    name: "Receber Payload",
    icon: FileCheck,
    description: "Payload recebido",
    appliesTo: ["reservation", "test"],
  },
  // Step de modo de teste
  {
    id: "test_mode",
    name: "Modo de Teste",
    icon: PlayCircle,
    description: "Ativar modo de teste E2E",
    appliesTo: ["test"],
  },
  // Busca de agendamento (apenas reservation)
  {
    id: "getting_schedule",
    name: "Buscar Agendamento",
    icon: Search,
    description: "Buscando detalhes do agendamento...",
    appliesTo: ["reservation"],
  },
  // Steps comuns a todos os tipos
  {
    id: "getting_refresh_token",
    name: "Buscar Token",
    icon: Key,
    description: "Obtendo refresh token do Supabase...",
  },
  {
    id: "authenticating_superlogica",
    name: "Autenticar",
    icon: Shield,
    description: "Autenticando com a API da SuperLogica...",
  },
  {
    id: "updating_refresh_token",
    name: "Atualizar Token",
    icon: RefreshCw,
    description: "Atualizando refresh token no Supabase...",
  },
  // Steps específicos de reservation/test
  {
    id: "making_reservation",
    name: "Enviar Requisição",
    icon: Calendar,
    description: "Iniciando reserva na API do Speed...",
    descriptionByType: {
      test: "🔍 [DRY RUN] Simulando reserva...",
    },
    appliesTo: ["reservation", "test"],
  },
  {
    id: "processing_response",
    name: "Processar Resposta",
    icon: Database,
    description: "Resposta da reserva recebida",
    appliesTo: ["reservation", "test"],
  },
  // Notificação - comum a todos
  {
    id: "sending_notification",
    name: "Notificação",
    icon: Bell,
    description: "Enviar e-mail de notificação",
  },
  // Sucesso - comum a todos
  {
    id: "success",
    name: "Sucesso",
    icon: CheckCircle2,
    description: "Concluído com sucesso!",
    descriptionByType: {
      preflight: "Pre-flight concluído com sucesso! ✈️",
      reservation: "Reserva concluída!",
      test: "🔍 [DRY RUN] Simulação concluída com sucesso",
    },
  },
]

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Obtém os steps aplicáveis para um tipo de execução
 */
export function getStepsForType(executionType: ExecutionType): FlowStep[] {
  return ALL_FLOW_STEPS.filter((step) => {
    // Se não tem restrição, aplica a todos
    if (!step.appliesTo || step.appliesTo.length === 0) return true
    // Verifica se aplica ao tipo especificado
    return step.appliesTo.includes(executionType)
  })
}

/**
 * Obtém a descrição apropriada para um step baseado no tipo de execução
 */
export function getStepDescription(
  step: FlowStep,
  executionType: ExecutionType
): string {
  return step.descriptionByType?.[executionType] || step.description
}

/**
 * Verifica se um step se aplica a um tipo de execução
 */
export function stepAppliesTo(
  stepId: string,
  executionType: ExecutionType
): boolean {
  const step = ALL_FLOW_STEPS.find((s) => s.id === stepId)
  if (!step) return false
  if (!step.appliesTo || step.appliesTo.length === 0) return true
  return step.appliesTo.includes(executionType)
}

// =============================================================================
// EXPORTS LEGADOS (para compatibilidade)
// =============================================================================

// Steps completos do fluxo de reserva
export const RESERVATION_FLOW_STEPS: FlowStep[] = getStepsForType("reservation")

// Steps simplificados para modo de teste E2E
export const TEST_FLOW_STEPS: FlowStep[] = getStepsForType("test")

// Steps para Pre-flight (validação de token)
export const PREFLIGHT_FLOW_STEPS: FlowStep[] = getStepsForType("preflight")

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
  executionType?: ExecutionType
): FlowStep[] {
  // Determina o tipo de execução
  const type: ExecutionType = executionType || (isTest ? "test" : "reservation")

  // Retorna os steps para o tipo
  return getStepsForType(type)
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

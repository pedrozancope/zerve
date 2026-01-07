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
  XCircle,
  Clock,
  Filter,
  type LucideIcon,
} from "lucide-react"

// Tipos de execução suportados
export type ExecutionType =
  | "reservation"
  | "preflight"
  | "test"
  | "auto_cancel"
  | "test_token"

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
  // Step inicial para auto-cancel
  {
    id: "parsing_request",
    name: "Processar Requisição",
    icon: FileCheck,
    description: "Processando requisição do Auto-Cancel",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "loading_config",
    name: "Carregar Configuração",
    icon: Database,
    description: "Carregando configuração do Auto-Cancel",
    appliesTo: ["auto_cancel"],
  },
  // Steps para test_token - sequência completa
  {
    id: "get_token",
    name: "Buscar Token",
    icon: Key,
    description: "Obtendo refresh token do banco de dados",
    appliesTo: ["test_token"],
  },
  {
    id: "authenticate",
    name: "Autenticar",
    icon: Shield,
    description: "Autenticando com SuperLógica",
    appliesTo: ["test_token"],
  },
  {
    id: "list_reservations",
    name: "Listar Reservas",
    icon: Search,
    description: "Testando API listando reservas",
    appliesTo: ["test_token"],
  },
  {
    id: "update_token",
    name: "Atualizar Token",
    icon: RefreshCw,
    description: "Atualizando refresh token no banco",
    appliesTo: ["test_token"],
  },
  {
    id: "success",
    name: "Sucesso",
    icon: CheckCircle2,
    description: "Teste concluído com sucesso",
    appliesTo: ["test_token"],
  },
  {
    id: "getting_auth_token",
    name: "Obter Token de Auth",
    icon: Key,
    description: "Obtendo token de autenticação",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "authenticating",
    name: "Autenticar",
    icon: Shield,
    description: "Autenticando com a API",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "calculating_date",
    name: "Calcular Data",
    icon: Clock,
    description: "Calculando data de hoje (BRT)",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "listing_reservations",
    name: "Listar Reservas",
    icon: Search,
    description: "Buscando reservas do dia",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "filtering_reservations",
    name: "Filtrar Reservas",
    icon: Filter,
    description: "Filtrando reservas de hoje",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "filtering_today_reservations",
    name: "Confirmar Reservas de Hoje",
    icon: CheckCircle2,
    description: "Confirmando reservas para cancelamento",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "cancelling_reservations",
    name: "Cancelar Reservas",
    icon: XCircle,
    description: "Processando cancelamentos",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "cancellation_summary",
    name: "Resumo do Cancelamento",
    icon: CheckCircle2,
    description: "Resumo dos cancelamentos processados",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "updating_config",
    name: "Atualizar Configuração",
    icon: RefreshCw,
    description: "Atualizando timestamp da última execução",
    appliesTo: ["auto_cancel"],
  },
  {
    id: "saving_execution_log",
    name: "Salvar Log",
    icon: Database,
    description: "Salvando log de execução",
    appliesTo: ["auto_cancel"],
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
  // Geral
  initialization: "Inicialização",
  start: "Início",
  success: "Concluído com Sucesso",
  error: "Erro",

  // Conexão e Config
  connecting_database: "Conectando ao Banco de Dados",
  loading_config: "Carregando Configuração",
  loading_unit_condo_config: "Carregando Configuração de Unidade",
  validating_config: "Validando Configuração",
  getting_api_config: "Carregando Configurações da API",
  updating_config: "Atualizando Configuração",

  // Autenticação
  getting_auth_token: "Buscando Token de Autenticação",
  getting_refresh_token: "Buscando Token de Autenticação",
  get_token: "Buscando Token",
  authenticating: "Autenticando na API",
  authenticate: "Autenticando na API",
  authenticating_superlogica: "Autenticando na SuperLógica",
  updating_token: "Salvando Novo Token",
  updating_refresh_token: "Salvando Novo Token",
  update_token: "Salvando Novo Token",

  // Reservas
  getting_schedule: "Carregando Agendamento",
  making_reservation: "Enviando Reserva para API",
  processing_response: "Processando Resposta da Reserva",
  saving_reservation: "Salvando Reserva no Banco",
  parsing_payload: "Processando Requisição",
  test_mode: "Modo de Teste E2E",

  // Auto-Cancel
  parsing_request: "Processando Requisição",
  calculating_date: "Calculando Data Atual (BRT)",
  listing_reservations: "Buscando Reservas na API",
  list_reservations: "Buscando Reservas na API",
  filtering_reservations: "Filtrando Reservas do Dia",
  filtering_today_reservations: "Identificando Reservas para Cancelar",
  cancelling_reservations: "Processando Cancelamentos",
  cancellation_summary: "Resumo dos Cancelamentos",

  // Pre-flight
  preflight_start: "Início da Validação Pré-voo",
  updating_last_preflight: "Atualizando Status Pré-voo",

  // Logs e Notificações
  saving_execution_log: "Salvando Log de Execução",
  sending_notification: "Enviando Notificação por E-mail",
  getting_notification_email: "Obtendo E-mail de Notificação",
}

// Função para obter steps relevantes baseado no contexto
export function getRelevantSteps(
  isTest: boolean,
  _logEntries?: LogEntry[],
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
  request?: Record<string, unknown> // Request payload para APIs externas
  response?: Record<string, unknown> // Response body de APIs externas
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
  responsePayload?: Record<string, unknown>
}

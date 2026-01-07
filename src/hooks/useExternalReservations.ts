import { useQuery } from "@tanstack/react-query"

// =============================================================================
// Types
// =============================================================================
export interface ExternalReservation {
  id: string
  areaId: string
  areaName: string
  reservationDate: string
  unit: string
  block: string
  condoName: string
  status: "active" | "cancelled"
  queuePosition: number
  email: string
  createdAt: string
}

interface RawReservationItem {
  id_reserva_res: string
  id_area_are: string
  dt_reserva_res: string
  st_nome_are: string
  st_unidade_uni: string
  st_bloco_uni: string
  st_fantasia_cond: string
  fl_status_res: string
  nm_fila_res: string
  st_email_res: string
  dt_reservarealizada_res: string
}

export interface ListReservationsResponse {
  success: boolean
  data?: {
    reservations: ExternalReservation[]
    total: number
  }
  error?: string
  duration?: string
}

// =============================================================================
// Utils
// =============================================================================

/**
 * Parseia data no formato MM/DD/YYYY ou DD/MM/YYYY para Date
 */
export function parseReservationDate(dateStr: string): Date {
  // A API retorna no formato MM/DD/YYYY HH:MM:SS
  const [datePart] = dateStr.split(" ")
  const [month, day, year] = datePart.split("/").map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Formata data de reservação para exibição (DD/MM/YYYY)
 */
export function formatReservationDateDisplay(dateStr: string): string {
  const date = parseReservationDate(dateStr)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Extrai o horário do nome da área (ex: "QUADRA DE TÊNIS - 19 hr às 20 hr")
 */
export function extractTimeFromAreaName(areaName: string): string | null {
  const match = areaName.match(/(\d{1,2})\s*hr?\s*[àa]s?\s*(\d{1,2})\s*hr?/i)
  if (match) {
    return `${match[1]}h - ${match[2]}h`
  }
  return null
}

/**
 * Verifica se a reserva é para hoje
 */
export function isReservationToday(dateStr: string): boolean {
  const reservationDate = parseReservationDate(dateStr)
  const today = new Date()
  return (
    reservationDate.getDate() === today.getDate() &&
    reservationDate.getMonth() === today.getMonth() &&
    reservationDate.getFullYear() === today.getFullYear()
  )
}

/**
 * Retorna o nome do dia da semana
 */
export function getDayOfWeekName(dateStr: string): string {
  const date = parseReservationDate(dateStr)
  const days = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ]
  return days[date.getDay()]
}

/**
 * Mapeia reserva da API para o formato interno
 */
function mapReservationFromAPI(raw: RawReservationItem): ExternalReservation {
  return {
    id: raw.id_reserva_res,
    areaId: raw.id_area_are,
    areaName: raw.st_nome_are,
    reservationDate: raw.dt_reserva_res,
    unit: raw.st_unidade_uni,
    block: raw.st_bloco_uni || "",
    condoName: raw.st_fantasia_cond,
    status: raw.fl_status_res === "1" ? "active" : "cancelled",
    queuePosition: parseInt(raw.nm_fila_res) || 0,
    email: raw.st_email_res,
    createdAt: raw.dt_reservarealizada_res,
  }
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook para buscar reservas externas da API SuperLógica
 * Reutiliza a edge function test-token que já faz autenticação e lista reservas
 */
export function useExternalReservations() {
  return useQuery({
    queryKey: ["external-reservations"],
    queryFn: async (): Promise<ListReservationsResponse> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/test-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao buscar reservas")
      }

      // Extrair reservas da resposta do test-token
      // A estrutura é: data.data.apiResponse.data[0].data[]
      const rawReservations: RawReservationItem[] =
        data.data?.apiResponse?.data?.[0]?.data || []

      // Mostrar todas as reservas (ativas e canceladas)
      const reservations = rawReservations.map(mapReservationFromAPI)

      // Ordenar por data
      reservations.sort((a, b) => {
        const dateA = parseReservationDate(a.reservationDate)
        const dateB = parseReservationDate(b.reservationDate)
        return dateA.getTime() - dateB.getTime()
      })

      return {
        success: true,
        data: {
          reservations,
          total: reservations.length,
        },
        duration: data.duration ? `${data.duration}ms` : undefined,
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutos
    refetchOnWindowFocus: false,
  })
}

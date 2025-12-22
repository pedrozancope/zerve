// Day of week names
export const DAY_NAMES = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const

export const DAY_NAMES_PT = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const

export const DAY_NAMES_PT_SHORT = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const

/**
 * Calcula o dia de disparo (10 dias antes da reserva)
 * @param reservationDayOfWeek - Dia da semana da reserva (0=Dom, 6=Sáb)
 * @returns Dia da semana do disparo (0-6)
 */
export function getTriggerDayOfWeek(reservationDayOfWeek: number): number {
  // 10 dias antes = mesmo dia da semana - 3 dias
  // (10 mod 7 = 3, então voltar 3 dias)
  return (reservationDayOfWeek + 7 - 3) % 7
}

/**
 * Gera a cron expression para EventBridge/pg_cron
 * Por padrão dispara às 00:01 BRT (03:01 UTC) no dia correto
 *
 * @param reservationDayOfWeek - Dia da reserva (0=Dom, 6=Sáb)
 * @param hour - Hora do disparo (BRT), padrão 0
 * @param minute - Minuto do disparo, padrão 1
 * @returns Cron expression para AWS EventBridge
 */
export function generateCronExpression(
  reservationDayOfWeek: number,
  hour: number = 0,
  minute: number = 1
): string {
  const triggerDay = getTriggerDayOfWeek(reservationDayOfWeek)
  const dayName = DAY_NAMES[triggerDay]

  // Converter BRT para UTC (adiciona 3 horas)
  const utcHour = (hour + 3) % 24

  // Formato EventBridge: cron(minutos hora dia-do-mês mês dia-da-semana ano)
  return `cron(${minute} ${utcHour} ? * ${dayName} *)`
}

/**
 * Calcula as próximas N datas de execução
 */
export function getNextExecutionDates(
  reservationDayOfWeek: number,
  count: number = 3
): { triggerDate: Date; reservationDate: Date }[] {
  const results: { triggerDate: Date; reservationDate: Date }[] = []
  const today = new Date()
  const triggerDayOfWeek = getTriggerDayOfWeek(reservationDayOfWeek)

  // Encontra o próximo dia de disparo
  const nextTrigger = new Date(today)
  const currentDay = today.getDay()
  let daysUntilTrigger = (triggerDayOfWeek - currentDay + 7) % 7

  // Se for hoje mas já passou da meia-noite, pega a próxima semana
  if (daysUntilTrigger === 0) {
    const now = new Date()
    if (now.getHours() > 0 || now.getMinutes() > 1) {
      daysUntilTrigger = 7
    }
  }

  nextTrigger.setDate(today.getDate() + daysUntilTrigger)
  nextTrigger.setHours(0, 1, 0, 0)

  for (let i = 0; i < count; i++) {
    const triggerDate = new Date(nextTrigger)
    triggerDate.setDate(triggerDate.getDate() + i * 7)

    const reservationDate = new Date(triggerDate)
    reservationDate.setDate(reservationDate.getDate() + 10)

    results.push({ triggerDate, reservationDate })
  }

  return results
}

/**
 * Formata cron expression para exibição legível
 */
export function formatCronDescription(reservationDayOfWeek: number): string {
  const triggerDay = getTriggerDayOfWeek(reservationDayOfWeek)
  return `Toda ${DAY_NAMES_PT[triggerDay]} às 00:01`
}

/**
 * Calcula a próxima data de execução baseada na cron expression
 * @param cronExpression - Cron expression do EventBridge
 * @param fromDate - Data de referência (default: agora)
 * @returns Próxima data de execução
 */
export function getNextExecutionDate(
  cronExpression: string,
  fromDate: Date = new Date()
): Date {
  // Parse da cron expression do EventBridge
  // Formato: cron(minutos hora dia-do-mês mês dia-da-semana ano)
  const match = cronExpression.match(
    /cron\((\d+)\s+(\d+)\s+\?\s+\*\s+(\w+)\s+\*\)/
  )

  if (!match) {
    throw new Error("Invalid cron expression format")
  }

  const [, minutes, hours, dayName] = match
  const targetDayOfWeek = DAY_NAMES.indexOf(dayName as any)

  if (targetDayOfWeek === -1) {
    throw new Error(`Invalid day name: ${dayName}`)
  }

  const nextDate = new Date(fromDate)
  const currentDayOfWeek = nextDate.getDay()

  // Calcular dias até o próximo dia alvo
  let daysUntilNext = (targetDayOfWeek - currentDayOfWeek + 7) % 7

  // Se for o mesmo dia, verificar se o horário já passou
  if (daysUntilNext === 0) {
    const targetTime = new Date(nextDate)
    targetTime.setHours(parseInt(hours) - 3, parseInt(minutes), 0, 0) // UTC-3 para BRT

    if (nextDate >= targetTime) {
      daysUntilNext = 7 // Próxima semana
    }
  }

  nextDate.setDate(nextDate.getDate() + daysUntilNext)
  nextDate.setHours(parseInt(hours) - 3, parseInt(minutes), 0, 0) // UTC-3 para BRT

  return nextDate
}

/**
 * Calcula a data de reserva baseada na data de trigger (10 dias depois)
 * @param triggerDate - Data do trigger
 * @returns Data da reserva
 */
export function getReservationDateFromTrigger(triggerDate: Date): Date {
  const reservationDate = new Date(triggerDate)
  reservationDate.setDate(reservationDate.getDate() + 10)
  return reservationDate
}

# Supabase Edge Functions - Tennis Scheduler

Edge Functions serverless em Deno para gerenciar reservas automáticas.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL (pg_cron)                      │
│  Job: check-and-execute-schedules (roda a cada minuto)      │
│                           │                                  │
│                           ▼                                  │
│  Função SQL: check_and_execute_schedules()                  │
│  - Verifica se há schedules para executar                   │
│  - Se SIM → Chama Edge Function via pg_net                  │
│  - Se NÃO → Retorna sem fazer nada (custo zero)            │
└─────────────────────┬───────────────────────────────────────┘
                      │ (Apenas quando necessário)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Edge Function: execute-reservation              │
│  - Busca dados do schedule                                  │
│  - Autentica na API Speed                                   │
│  - Cria a reserva                                           │
│  - Registra logs                                            │
└─────────────────────────────────────────────────────────────┘
```

## 💰 Otimização de Custos

A função SQL `check_and_execute_schedules()` roda dentro do PostgreSQL:

- **Custo ZERO** para verificação (não conta como invocação de Edge Function)
- Edge Function só é chamada quando há algo para executar
- ~4-5 invocações por mês em vez de 43.200!

## 📁 Estrutura

```
supabase/functions/
├── execute-reservation/
│   └── index.ts          # Executa reservas (chamada pelo pg_cron)
├── check-scheduled-triggers/
│   └── index.ts          # [DEPRECATED] Substituída por função SQL
└── deno.json             # Configuração Deno
```

## 🚀 Deploy

### 1. Pré-requisitos

```bash
# Instalar Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login
```

### 2. Deploy das Functions

```bash
# Deploy todas
supabase functions deploy

# Ou individual
supabase functions deploy create-schedule
supabase functions deploy execute-reservation
```

### 3. Configurar Secrets

```bash
# URL da API do Speed Tennis
supabase secrets set SPEED_API_URL=https://api.speedtennis.com.br/v1/reservas

# Outros secrets conforme necessário
supabase secrets list
```

## 🔧 Desenvolvimento Local

### Rodar localmente

```bash
# Iniciar Supabase local
supabase start

# Servir functions
supabase functions serve

# Ou função específica
supabase functions serve execute-reservation --env-file .env.local
```

### Testar localmente

```bash
# Criar variáveis locais
echo "SPEED_API_URL=https://api.speedtennis.com.br/v1/reservas" > .env.local

# Invocar function
curl -i --location --request POST 'http://localhost:54321/functions/v1/execute-reservation' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"scheduleId":"uuid-here"}'
```

## 📖 Functions

### `create-schedule`

Cria um job no pg_cron quando um schedule é criado.

**Payload:**

```json
{
  "scheduleId": "uuid",
  "cronExpression": "cron(1 3 ? * THU *)",
  "scheduleName": "Tênis Quinta 18h"
}
```

**Response:**

```json
{
  "success": true,
  "jobId": 123,
  "message": "Cron job created for schedule Tênis Quinta 18h"
}
```

### `execute-reservation`

Executa a reserva no sistema Speed (chamada automaticamente pelo pg_cron).

**Payload:**

```json
{
  "scheduleId": "uuid"
}
```

**Response Success:**

```json
{
  "success": true,
  "message": "Reserva criada com sucesso",
  "reservationId": "12345",
  "executionLogId": "uuid",
  "reservationDate": "2025-01-05",
  "duration": 1234,
  "schedule": {
    "id": "uuid",
    "name": "Tênis Quinta 18h",
    "timeSlot": "18:00"
  }
}
```

**Response Error:**

```json
{
  "success": false,
  "error": "Error message",
  "scheduleId": "uuid",
  "duration": 1234
}
```

## 🔍 Monitoramento

### Ver Logs

```bash
# Logs em tempo real
supabase functions logs execute-reservation --follow

# Últimos logs
supabase functions logs execute-reservation --tail 100
```

### Logs estruturados

A função `execute-reservation` produz logs detalhados:

```
[2025-12-22T12:00:01.234Z] ========================================
[INFO] Starting reservation execution for schedule: uuid
[INFO] Fetching schedule details...
[INFO] Schedule found: Tênis Quinta 18h
[INFO] Time slot: 18:00
[INFO] Calculated reservation date: 2026-01-01
[INFO] Retrieving Speed authentication token...
[INFO] Token retrieved successfully
[INFO] Making reservation request to Speed API...
[INFO] Request completed in 1234ms
[SUCCESS] ✅ Reservation completed successfully!
[SUCCESS] Reservation ID: 12345
[SUCCESS] Date: 2026-01-01
[SUCCESS] Time Slot: 18:00
[INFO] Total execution time: 1234ms
[2025-12-22T12:00:02.468Z] ========================================
```

## ⚙️ Configuração da API Speed

A Edge Function `execute-reservation` espera que a API do Speed:

### Endpoint

```
POST https://api.speedtennis.com.br/v1/reservas
```

### Headers

```
Content-Type: application/json
Authorization: Bearer <token>
```

### Body

```json
{
  "idHorario": "455", // ID do horário (ex: 455 para 18:00)
  "data": "2026-01-01" // Data da reserva (YYYY-MM-DD)
}
```

### Response Success (200)

```json
{
  "success": true,
  "idReserva": "12345",
  "message": "Reserva criada com sucesso"
}
```

### Response Error (4xx/5xx)

```json
{
  "success": false,
  "message": "Erro ao criar reserva",
  "error": "Detalhes do erro"
}
```

## 🐛 Troubleshooting

### Function não executa

1. Verificar secrets:

```bash
supabase secrets list
```

2. Ver logs:

```bash
supabase functions logs execute-reservation --tail 50
```

3. Verificar job do pg_cron:

```sql
SELECT * FROM cron.job WHERE jobname LIKE 'schedule_%';
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Token inválido

```sql
-- Verificar token
SELECT key, is_encrypted, updated_at
FROM app_config
WHERE key = 'speed_auth_token';

-- Atualizar token
SELECT upsert_encrypted_config('speed_auth_token', 'novo-token', true);
```

### Erro de timezone

A função calcula automaticamente o timezone de Brasília (UTC-3). Se houver problemas, verifique:

```typescript
// A função calculateReservationDate() já considera o offset
const brasiliaOffset = -3 * 60 // -3 horas
```

## 📚 Recursos

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy Docs](https://deno.com/deploy/docs)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)

## 🔐 Segurança

- ✅ Tokens criptografados no banco com pgcrypto
- ✅ Service role key apenas nas Edge Functions
- ✅ CORS configurado
- ✅ Logs não expõem dados sensíveis
- ✅ Secrets isolados via Supabase Vault

---

**Desenvolvido com ❤️ usando Supabase + Deno**

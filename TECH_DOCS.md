# 📋 Zerve - Documentação Técnica e de Regras de Negócio

> **⚠️ DOCUMENTO INTERNO — FONTE DE VERDADE DO PROJETO**
>
> Esta documentação é a **single source of truth** do sistema Zerve.  
> Deve ser consultada **SEMPRE** antes de:
>
> - Sugerir novas funcionalidades
> - Refatorar código existente
> - Alterar regras de negócio
> - Modificar estrutura do banco de dados

**Data da última atualização:** 06/01/2026  
**Versão:** 1.0.0

---

## 🎯 Propósito deste Documento

Este documento existe para:

- ✅ Preservar regras de negócio e decisões técnicas já tomadas
- ✅ Evitar sobrescrita acidental de código ou lógica existente
- ✅ Garantir consistência entre novas features e o sistema atual
- ✅ Compensar limitações de memória/contexto de IA
- ✅ Servir como contrato técnico e funcional do projeto

### ⚠️ AVISO CRÍTICO: Estado Real do Banco

**O estado real do sistema NÃO está apenas nas migrations.**

Grande parte da lógica reside em:

- Triggers SQL ativos
- Functions PostgreSQL
- Jobs pg_cron
- RLS (Row Level Security)
- Edge Functions no Supabase

**REGRA ABSOLUTA:**  
→ O estado real no **Supabase em produção** SEMPRE prevalece sobre código local  
→ Migrations são apenas **referência parcial**, não verdade absoluta

---

## 📑 Índice

1. [Visão Geral da Aplicação](#1-visão-geral-da-aplicação)
2. [Regras de Negócio](#2-regras-de-negócio)
3. [Arquitetura Técnica](#3-arquitetura-técnica)
4. [Banco de Dados — Estado Atual](#4-banco-de-dados--estado-atual)
5. [Modelagem de Dados](#5-modelagem-de-dados)
6. [Functions, Services e Use Cases](#6-functions-services-e-use-cases)
7. [Hooks, Middlewares e Interceptadores](#7-hooks-middlewares-e-interceptadores)
8. [Jobs, Cron e Processos Assíncronos](#8-jobs-cron-e-processos-assíncronos)
9. [Integrações Externas](#9-integrações-externas)
10. [Decisões Técnicas Importantes](#10-decisões-técnicas-importantes)
11. [Pontos Sensíveis / Áreas de Alto Risco](#11-pontos-sensíveis--áreas-de-alto-risco)
12. [Checklist para Mudanças Futuras](#12-checklist-para-mudanças-futuras)

---

## 1. Visão Geral da Aplicação

### 1.1 Objetivo do Sistema

**Zerve** é um sistema automatizado de reservas de quadras de tênis que elimina a necessidade de intervenção manual do usuário no momento crítico da abertura de vagas.

### 1.2 Problema que Resolve

O sistema Speed Tennis (condomínio) libera quadras para reserva **10 dias antes** da data desejada, sempre à **00:01** (meia-noite).

**Problema:** As melhores quadras (7h, 8h) esgotam em segundos. Usuários precisariam acordar à meia-noite para conseguir reservar.

**Solução:** Zerve automatiza todo o processo:

- Dispara exatamente às 00:01
- Autentica automaticamente
- Calcula a data correta (sempre 10 dias à frente)
- Faz a reserva antes de qualquer usuário manual
- Notifica sobre sucesso/falha

### 1.3 Público-alvo

- Moradores do condomínio que jogam tênis regularmente
- Pessoas que precisam garantir horários fixos semanalmente
- Usuários que não querem/podem acordar à meia-noite

### 1.4 Fluxos Principais de Negócio (Alto Nível)

**Fluxo 1: Agendamento Recorrente** — Schedule salvo (is_active=true) → Job global roda a cada minuto → Edge Function executa reserva → Log salvo → Notificação enviada

**Fluxo 2: Validação Prévia (Pre-flight)** — Job valida token X horas antes → Notifica se há erro → Usuário corrige antes disparo real

**Fluxo 3: Auto-Cancel** — Job executa em horário configurado → Lista reservas do dia → Cancela via API → Notificação

**Fluxo 4: Teste E2E** — Usuário aciona teste → Faz reserva HOJE (não +10 dias) → Retorna passo-a-passo em tempo real

---

## 2. Regras de Negócio (SEÇÃO MAIS IMPORTANTE)

> **⚠️ Esta seção é CRÍTICA. Mudanças aqui impactam todo o sistema.**

### 2.1 Regra da Janela de 10 Dias

**RN-001: Cálculo de Data de Reserva (Regra de Ouro)**

- ✅ **CONFIRMADO**: Sistema Speed Tennis libera reservas exatamente **10 dias antes** da data desejada
- ✅ O disparo deve ocorrer às **00:01 BRT** (03:01 UTC)
- ✅ Se o usuário quer jogar no **Domingo dia 29**, o sistema deve disparar na **Quinta dia 19** às 00:01
- ✅ Cálculo: `trigger_day_of_week = (reservation_day_of_week - 3) % 7`  
  (Exemplo: Quarta=3 → (3-3)%7 = 0=Segunda → dispara 3 dias antes; 10 dias = 1 semana + 3 dias)

**Onde é aplicada:**

- ✅ **Frontend**: `src/lib/cron.ts` — função `getTriggerDayOfWeek()`
- ✅ **Edge Function**: `supabase/functions/execute-reservation/index.ts` — função `calculateReservationDate()`
- ✅ **Supabase**: Triggers calculam `trigger_day_of_week` automaticamente ao criar schedule

**⚠️ NUNCA altere esta regra sem confirmar mudança na API do Speed Tennis**

---

### 2.2 Modos de Disparo (Trigger Mode)

**RN-002: Dois Modos Independentes de Cálculo**

O sistema suporta dois modos de disparo:

#### Modo A: `reservation_date` (Padrão)

Usuário define o dia desejado (ex: Domingo às 7h) → Sistema calcula automaticamente que disparo ocorre na Quinta às 00:01 → Recorrência: Weekly, Biweekly, Monthly, Once

#### Modo B: `trigger_date` (Data Específica)

Usuário define data/hora exata (ex: 25/12/2025 às 00:01) → Sistema obedece data exata fornecida → Reserva será feita MESMA data do disparo

**Onde é aplicada:**

- ✅ **Frontend**: `src/pages/NewSchedule.tsx` — seletor de modo
- ✅ **Edge Function**: Lógica de cálculo em `execute-reservation/index.ts`
- ✅ **Supabase**: Campo `schedules.trigger_mode` (ENUM)

**⚠️ CRÍTICO:** Ao editar schedule, preservar o modo original. Não converter automaticamente entre modos.

---

### 2.3 Frequências de Recorrência

**RN-003: Tipos de Recorrência Suportados**

⚠️ **AVISO:** `biweekly` e `monthly` são **simulações visuais do frontend** — backend executa `weekly`

| Frequência | Implementação       | Status Real                                             |
| ---------- | ------------------- | ------------------------------------------------------- |
| `once`     | ✅ Completa         | Auto-desativa após execução (confirmado)                |
| `weekly`   | ✅ Completa         | Executa TODA semana, mesmo dia/horário                  |
| `biweekly` | ⚠️ Frontend calcula | **Validação pendente** — frontend +14d, backend weekly  |
| `monthly`  | ⚠️ Frontend calcula | **Validação pendente** — frontend +1mês, backend weekly |

**⚠️ VALIDAÇÃO NECESSÁRIA:**

- `biweekly`: Confirmar se executa a cada 2 semanas ou toda semana
- `monthly`: Confirmar se respeita "mesmo dia do mês" ou toda semana
- **Recomendação:** Adicionar testes E2E para estas frequências antes de usar em produção

**Implementação:**

- Frontend: Seletor em `NewSchedule.tsx`
- Supabase: Campo `schedules.frequency` com constraint CHECK
- pg_cron: Jobs recorrentes usam cron expressions (`0 1 * * THU` para semanal)

**Regra Especial para `once`:**

- Auto-desativa implementado em ambas Edge Functions após execução
- Confirmado em `execute-reservation/index.ts` (linha 1202-1205) e `check-scheduled-triggers/index.ts` (linha 89-95)

---

### 2.4 Pre-flight (Validação Prévia)

**RN-004: Sistema de Validação Antecipada de Token**

**Objetivo:** Evitar falha no horário crítico (00:01) por token expirado

**Como funciona:**

- ✅ Configurável por schedule (cada agendamento decide se quer pre-flight)
- ✅ Executa X horas antes do disparo real (padrão: 4h, customizável)
- ✅ Job global `preflight-check` roda a cada minuto
- ✅ SQL Function verifica: `NOW() >= (trigger_datetime - preflight_hours_before)`
- ✅ Valida: autenticação SuperLógica, token, credenciais
- ✅ **NÃO faz reserva**, apenas testa

**Timeline exemplo:**

```
20:01 → Job preflight-check roda (como a cada minuto)
   ├─ SQL Function detecta: NOW() >= (00:01 - 4h)
   ├─ Chama Edge Function run-preflight
   ├─ Autentica
   ├─ Valida token
   └─ Se erro: NOTIFICA usuário

00:01 → Disparo real (schedule principal)
   └─ Token já foi validado, probabilidade de sucesso alta
```

**Campos envolvidos:**

- `schedules.preflight_enabled` (boolean)
- `schedules.preflight_hours_before` (integer, padrão 4)
- `schedules.preflight_notify_on_success` (boolean, padrão false)
- `schedules.preflight_notify_on_failure` (boolean, padrão true)
- `schedules.last_preflight_at` (timestamp)

**Onde é aplicada:**

- ✅ **Edge Function**: `supabase/functions/run-preflight/index.ts`
- ✅ **pg_cron**: Job global `preflight-check` (jobid: 11, schedule `* * * * *`)
- ✅ **SQL Function**: `call_preflight_edge_function()` verifica schedules elegíveis

---

### 2.5 Auto-Cancel (Cancelamento Automático)

**RN-005: Cancelamento Diário de Reservas Usadas**

**Objetivo:** Liberar quadra após uso, permitindo que outros reservem

**Comportamento:**

- ✅ Job global `auto-cancel-check` roda a cada minuto
- ✅ SQL Function verifica se `trigger_time` = hora atual (com tolerância de 10min)
- ✅ Horário padrão: **22h BRT** (01h UTC do dia seguinte)
- ✅ Cancela APENAS reservas do **dia atual**
- ✅ Lista todas as reservas do usuário
- ✅ Filtra por data = hoje (formato **MM/DD/YYYY** - API SuperLógica)
- ✅ Cancela via API SuperLógica

**Configurações:**

- `auto_cancel_config.is_active` (boolean)
- `auto_cancel_config.trigger_time` (TIME, default '22:00:00')
- `auto_cancel_config.cancellation_reason` (TEXT, enviado à API)
- `auto_cancel_config.notify_on_success_no_reservations` (notifica se 0 reservas)
- `auto_cancel_config.notify_on_success_with_reservations` (notifica se 1+ canceladas)
- `auto_cancel_config.notify_on_failure` (notifica em caso de erro)

**Onde é aplicada:**

- ✅ **Edge Function**: `supabase/functions/run-auto-cancel/index.ts`
- ✅ **Frontend**: `src/pages/AutoCancel.tsx` + `src/hooks/useAutoCancel.ts`
- ✅ **Supabase**: Tabela `auto_cancel_config`
- ✅ **pg_cron**: Job global `auto-cancel-check` (jobid: 15, schedule `* * * * *`)
- ✅ **SQL Function**: `run_auto_cancel_check()` verifica configs ativas

---

### 2.6 Conversão de Timezone (BRT ↔ UTC)

**RN-006: Timezone — Regra de Ouro (⚠️ CRÍTICO)**

- Banco de dados: **SEMPRE UTC**
- Frontend: **SEMPRE BRT**
- Conversão: **BRT = UTC - 3 horas**

Exemplos:

- Usuário configura 00:01 BRT → Banco armazena 03:01 UTC
- Usuário configura 22:00 BRT (auto-cancel) → Banco armazena 01:00 UTC (dia seguinte)

**Implementação:**

- Frontend: `src/pages/NewSchedule.tsx`, `AutoCancel.tsx`, `Dashboard.tsx`
- Edge Functions: Trabalham diretamente em UTC
- pg_cron: Expressions em UTC

⚠️ **NUNCA assuma que horários no banco estão em BRT**

---

### 2.7 Horários Disponíveis (Time Slots)

**RN-007: Mapeamento de Horários para IDs da API**

O sistema Speed Tennis usa IDs específicos para cada horário:

| Horário | ID Externo | Observação                       |
| ------- | ---------- | -------------------------------- |
| 06:00   | 455        | Primeiro horário disponível      |
| 07:00   | 440        | **Horário nobre** (alta demanda) |
| 08:00   | 441        | **Horário nobre** (alta demanda) |
| 09:00   | 442        |                                  |
| 10:00   | 443        |                                  |
| 11:00   | 444        |                                  |
| 12:00   | 445        |                                  |
| 13:00   | 446        |                                  |
| 14:00   | 447        |                                  |
| 15:00   | 448        |                                  |
| 16:00   | 449        |                                  |
| 17:00   | 450        |                                  |
| 18:00   | 451        |                                  |
| 19:00   | 452        |                                  |
| 20:00   | 453        |                                  |
| 21:00   | 454        | Último horário disponível        |

**Onde é aplicada:**

- ✅ **Frontend**: `src/lib/constants.ts` — constante `TIME_SLOTS`
- ✅ **Edge Functions**: Mapeamento hardcoded em `execute-reservation/index.ts` (constante `ID_AREAS`)
- ✅ **Supabase**: Tabela `time_slots` populada via migration inicial

**⚠️ NUNCA altere esses IDs sem confirmar com API Speed Tennis — causará falha nas reservas**

---

### 2.8 Autenticação via Refresh Token

**RN-008: Sistema de Token Persistente**

**Problema:** Access tokens da SuperLógica expiram rapidamente  
**Solução:** Armazenar refresh_token, renovar access_token a cada execução

**Fluxo:**

1. Usuário fornece refresh_token manualmente (obtido externamente)
2. Sistema armazena em `app_config` com chave `auth_token`
3. A cada execução (reservation, preflight, auto-cancel):
   - Autentica com refresh_token
   - Obtém novo access_token
   - Obtém novo refresh_token
   - Atualiza `app_config.auth_token` com novo refresh_token
4. Próxima execução usa o novo refresh_token

**Campos envolvidos:**

- `app_config.key = 'auth_token'`
- `app_config.value` (✅ texto plano - encriptação não implementada)

**Onde é aplicada:**

- ✅ **Frontend**: `src/pages/Settings.tsx` — formulário para inserir token
- ✅ **Edge Functions**: Todas (`execute-reservation`, `run-preflight`, `run-auto-cancel`, `test-token`)
  - Função `authSuperLogica(refreshToken)`
  - Atualização do token em `app_config`

**⚠️ CRÍTICO:** Se refresh_token expirar, TODAS as execuções falham até usuário fornecer novo token

---

### 2.9 Notificações por Email

**RN-009: Sistema de Notificações via Resend**

**Quando notificar:**

| Evento                  | Condição    | Configuração                                             |
| ----------------------- | ----------- | -------------------------------------------------------- |
| Reserva bem-sucedida    | Sempre      | `schedules.notify_on_success`                            |
| Reserva falhou          | Sempre      | `schedules.notify_on_failure`                            |
| Pre-flight OK           | Opcional    | `schedules.preflight_notify_on_success`                  |
| Pre-flight falhou       | Padrão: SIM | `schedules.preflight_notify_on_failure`                  |
| Auto-cancel 0 reservas  | Opcional    | `auto_cancel_config.notify_on_success_no_reservations`   |
| Auto-cancel 1+ reservas | Padrão: SIM | `auto_cancel_config.notify_on_success_with_reservations` |
| Auto-cancel falhou      | Padrão: SIM | `auto_cancel_config.notify_on_failure`                   |

**Email de destino:**

- ✅ **CONFIRMADO**: Obtido de `auth.users.email` (usuário autenticado)
- ⚠️ Pode ser sobrescrito por `app_config.notification_email` se configurado

**Onde é aplicada:**

- ✅ **Edge Functions**: Todas as funções chamam `sendNotificationEmail()`
- ✅ **Integração**: API Resend via `RESEND_API_KEY` (env var no Supabase)

---

### 2.10 Logs Estruturados (Flow Steps)

**RN-010: Sistema de Log Passo-a-Passo**

**Objetivo:** Rastreabilidade completa de cada execução

**Estrutura:**

```typescript
{
  step: string,           // ID do passo (ex: "authenticate")
  message: string,        // Descrição legível
  details?: object,       // Metadados adicionais
  request?: object,       // Request enviado para APIs externas
  response?: object,      // Response recebido
  timestamp: string       // ISO 8601
}
```

**Campo no banco:**

- `execution_logs.flow_steps` (JSONB array)

**Steps definidos:**

- ✅ **Código**: `src/lib/flowSteps.ts` — constante `ALL_FLOW_STEPS`
- ✅ Diferentes steps por tipo de execução (`reservation`, `preflight`, `test`, `auto_cancel`, `test_token`)

**Onde é aplicada:**

- ✅ **Edge Functions**: Todas as funções populam array de steps
- ✅ **Frontend**: `src/components/logs/FlowStepsLog.tsx` — visualização gráfica
- ✅ **Supabase**: Armazenado em `execution_logs.flow_steps`

---

### 2.11 Modo Dry Run (Simulação)

**RN-011: Execução Sem Efeitos Colaterais**

**Objetivo:** Testar fluxo completo SEM fazer reserva/cancelamento real

**Comportamento:**

- ✅ Executa TODO o fluxo normal
- ✅ Autentica, valida, calcula datas
- ✅ **NÃO chama API de reserva/cancelamento**
- ✅ Simula sucesso
- ✅ Salva log marcado como dry run

**Onde é aplicada:**

- ✅ **Edge Functions**:
  - `execute-reservation/index.ts` — parâmetro `dryRun`
  - `run-auto-cancel/index.ts` — parâmetro `dryRun`
- ✅ **Frontend**: Botão "Teste (Dry Run)" em interfaces

---

### 2.12 Row Level Security (RLS)

**RN-012: Isolamento de Dados por Usuário**

**Regra:** Cada usuário vê/manipula APENAS seus próprios dados

**Tabelas com RLS ativo:**

- ✅ `schedules` — usuário vê apenas seus agendamentos
- ✅ `execution_logs` — logs de seus schedules
- ✅ `reservations` — reservas de seus schedules
- ✅ `app_config` — configurações próprias
- ✅ `auto_cancel_config` — configuração própria

**Exceção:**

- ⚠️ Edge Functions usam **service_role_key** — bypass RLS
- ⚠️ pg_cron jobs usam **service_role_key** — bypass RLS

**Onde é aplicada:**

- ✅ **Supabase**: Policies criadas em migrations iniciais
- ✅ **CONFIRMADO:** 5 policies ativas verificadas (4 em auto_cancel_config + 1 em system_config)

---

## 3. Arquitetura Técnica

### 3.1 Stack Tecnológica

#### Frontend

- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.3.0
- **Linguagem**: TypeScript 5.9.3
- **Estilização**: Tailwind CSS 3.4.19
- **Componentes**: shadcn/ui (Radix UI)
- **Roteamento**: React Router DOM 7.11.0
- **State Management**: TanStack Query (React Query) 5.90.12
- **Notificações**: Sonner 2.0.7
- **Data Manipulation**: date-fns 4.1.0
- **Cron Parsing**: Croner 9.1.0

#### Backend / Banco de Dados

- **BaaS**: Supabase
  - PostgreSQL (versão gerenciada)
  - Extensões: `pg_cron`, `pgcrypto`, `pg_net`
- **Autenticação**: Supabase Auth
- **Serverless Functions**: Supabase Edge Functions (Deno runtime)
- **Agendamento**: pg_cron (extensão PostgreSQL)

#### Integrações Externas

- **API de Reservas**: SuperLógica API (`api.superlogica.com` + `speedassessoria.superlogica.net`)
- **Email**: Resend API

#### DevOps / Deploy

- **Hospedagem Frontend**: Vercel
- **Hospedagem Backend**: Supabase Cloud

---

### 3.2 Organização de Pastas (Simplificado)

```
zerve/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── dashboard/           # Componentes do dashboard
│   │   ├── layout/              # AppLayout, Header, Sidebar
│   │   ├── logs/                # FlowStepsLog (visualização)
│   │   ├── ui/                  # shadcn/ui components
│   │   └── ProtectedRoute.tsx   # HOC para rotas autenticadas
│   ├── hooks/
│   │   ├── useAuth.ts           # Autenticação Supabase
│   │   ├── useConfig.ts         # CRUD de app_config
│   │   ├── useSchedules.ts      # CRUD de schedules
│   │   ├── useLogs.ts           # Leitura de execution_logs
│   │   ├── useReservations.ts   # Leitura de reservations
│   │   ├── useAutoCancel.ts     # CRUD de auto_cancel_config
│   │   └── useTestToken.ts      # Teste de token
│   ├── lib/
│   │   ├── constants.ts         # TIME_SLOTS, NAV_ITEMS, enums
│   │   ├── cron.ts              # Cálculo de cron/datas
│   │   ├── flowSteps.ts         # Definição de steps
│   │   └── utils.ts             # Utilitários
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Schedules.tsx
│   │   ├── NewSchedule.tsx
│   │   ├── Logs.tsx
│   │   ├── Settings.tsx
│   │   ├── AutoCancel.tsx
│   │   ├── TestReservationE2E.tsx
│   │   └── Login.tsx
│   ├── services/
│   │   └── supabase.ts          # Cliente Supabase
│   ├── types/
│   │   ├── index.ts             # Tipos principais
│   │   └── supabase.ts          # Tipos do Supabase
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── supabase/
│   ├── functions/               # Edge Functions (Deno)
│   │   ├── _shared/
│   │   │   └── cors.ts
│   │   ├── execute-reservation/
│   │   ├── run-preflight/
│   │   ├── run-auto-cancel/
│   │   └── test-token/
│   └── migrations/              # SQL migrations
│
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── vercel.json
```

---

### 3.3 Padrões Arquiteturais

#### 3.3.1 Frontend

**Padrão de Componentes:**

- Componentes funcionais com hooks
- Separação clara: UI components (`components/ui/`) vs feature components
- Custom hooks para lógica de negócio (`hooks/`)

**Estado e Data Fetching:**

- TanStack Query para cache e sincronização com backend
- Query keys padronizadas (`["schedules"]`, `["execution_logs"]`)
- Invalidação automática após mutations

**Roteamento:**

- React Router DOM v7
- Rota pública: `/login`
- Rotas protegidas: wrapper `<ProtectedRoute>` + `<AppLayout>`

**Formulários:**

- Controlados (useState)
- Validação inline
- Feedback via toast (Sonner)

#### 3.3.2 Backend (Edge Functions)

**Estrutura comum:**

```typescript
1. CORS handling (OPTIONS request)
2. Parse request payload
3. Validate inputs
4. Execute business logic (com flow steps)
5. Save execution_log
6. Send notification (se configurado)
7. Return response
```

**Error Handling:**

- Try/catch em todos os níveis
- Logs estruturados (JSON)
- Erros salvos em `execution_logs` com `status = 'error'`

**Autenticação:**

- Service role key no header (bypass RLS)
- Token do usuário obtido de `app_config`

#### 3.3.3 Banco de Dados

**Triggers:**

- Auto-gerenciamento de pg_cron jobs
- Cálculo automático de campos derivados
- Limpeza em cascata (delete jobs ao deletar schedule)

**Functions SQL:**

- Encapsulamento de lógica complexa
- Reutilização entre triggers e queries
- Security definer para operações privilegiadas

---

### 3.4 Convenções Importantes

#### Nomenclatura

**TypeScript/JavaScript:**

- Componentes: PascalCase (`NewSchedule.tsx`)
- Hooks: camelCase com prefixo `use` (`useSchedules.ts`)
- Funções: camelCase (`getTriggerDayOfWeek()`)
- Constantes: SCREAMING_SNAKE_CASE (`TIME_SLOTS`)
- Tipos: PascalCase (`Schedule`, `ExecutionLog`)

**SQL:**

- Tabelas: snake_case plural (`schedules`, `execution_logs`)
- Colunas: snake_case (`trigger_day_of_week`)
- Functions: snake_case (`create_schedule_cron_job`)
- Constraints: `{table}_{column}_check`

#### Timestamps

- **Sempre** usar `TIMESTAMP WITH TIME ZONE` no SQL
- **Sempre** armazenar em UTC
- Conversão para BRT apenas na apresentação (frontend)

#### IDs

- **Sempre** usar UUID (via `gen_random_uuid()`)
- **Nunca** usar auto-increment integers

#### Booleans

- Prefixos: `is_`, `notify_on_`, `preflight_`, `enabled`
- Default explícito em migrations

---

## 4. Banco de Dados — Estado Real vs Código

> **⚠️ ATENÇÃO:** Esta seção diferencia o que está **confirmado** vs **inferido**

### 4.1 Estado CONFIRMADO no Supabase

**Validado via queries diretas executadas em 06/01/2026:**

#### 4.1.1 Tabelas Públicas (10 total)

- `schedules`
- `execution_logs`
- `reservations`
- `app_config`
- `auto_cancel_config`
- `time_slots`
- `system_config`
- `cleanup_history`

#### 4.1.2 pg_cron Jobs Ativos (4 total)

1. **automatic-cleanup** (jobid: 5)
   - Schedule: `0 3 * * 0` (domingos às 3h AM UTC = meia-noite BRT)
   - Comando: `SELECT run_automatic_cleanup()`
   - Função: Limpeza de dados antigos (logs/schedules/reservations)
2. **check-and-execute-schedules** (jobid: 8)
   - Schedule: `* * * * *` (a cada minuto)
   - Comando: `SELECT check_and_execute_schedules()`
   - Função: Polling global de schedules ativos na janela de execução
3. **preflight-check** (jobid: 11)
   - Schedule: `* * * * *` (a cada minuto)
   - Comando: `SELECT call_preflight_edge_function()`
   - Função: Polling global de schedules needing preflight
4. **auto-cancel-check** (jobid: 15)
   - Schedule: `* * * * *` (a cada minuto)
   - Comando: `SELECT run_auto_cancel_check()`
   - Função: Polling global de auto_cancel_config ativos

**Padrão Comum (jobs 8, 11, 15):**

- Job roda a cada minuto
- Chama SQL Function que verifica tabela
- Function determina se é hora de executar (lógica de janela/horário)
- Se sim, chama Edge Function via pg_net
- Atualiza `last_executed_at` para evitar duplicação

#### 4.1.3 Triggers Ativos — Apenas Utilitários

**Status:** Sistema removeu triggers de gerenciamento de pg_cron em migration 20260106200000.

Triggers remanescentes são apenas utilitários:
- `on_schedule_datetime_change` — reseta preflight ao alterar trigger_datetime
- `on_schedule_preflight_config_change` — reseta preflight ao alterar config
- `update_schedules_updated_at` — padrão para atualizar `updated_at`

---

#### 4.1.4 RLS Policies (5 total)

**schedules** (4 policies):

- SELECT: `auth.uid() = user_id` ✅
- INSERT: sem qual (permite qualquer insert autenticado) ✅
- UPDATE: `auth.uid() = user_id` ✅
- DELETE: `auth.uid() = user_id` ✅

**execution_logs** (1 policy) — ❌ **VIOLAÇÃO DE RN-012**:

- SELECT: `qual = true` (TODOS autenticados veem TODOS os logs — **PROBLEMA CRÍTICO**)
  - **Esperado (RN-012):** Cada usuário vê apenas seus próprios logs
  - **Real:** Qualquer usuário pode ler logs de qualquer outro (privacidade violada)
  - **Ação Necessária:** Alterar para `auth.uid() = user_id` imediatamente

#### 4.1.5 Funções SQL Principais (4 funções confirmadas)

1. **check_and_execute_schedules() → jsonb**
   - Busca schedules ativos na janela de execução (NUNCA antes, até 10min depois)
   - Marca `last_executed_at` ANTES de chamar Edge Function
   - Chama `execute-reservation` via pg_net
   - Limpa schedules 'once' que passaram 15min
2. **run_auto_cancel_check() → jsonb**

   - Busca auto_cancel_config ativos na janela de 10min
   - Marca `last_executed_at` ANTES de chamar Edge Function
   - Chama `run-auto-cancel` via pg_net

3. **call_preflight_edge_function() → jsonb**

   - Lê system_config para obter supabase_url e service_role_key
   - Chama `run-preflight` via pg_net

4. **run_automatic_cleanup() → TABLE**
   - Chama 3 funções de limpeza (logs, schedules, reservations)
   - Insere resultado em `cleanup_history` (funcional desde migration 20260106200000)

**Padrão comum**: Todas as funções lêem de `system_config` para obter credentials antes de chamar Edge Functions.

---

### 4.2 Estrutura de Tabelas (Confirmada)

```sql
id UUID PRIMARY KEY
hour INTEGER UNIQUE CHECK (6-21)
external_id VARCHAR(10) UNIQUE
display_name VARCHAR(20)
created_at TIMESTAMP WITH TIME ZONE
```

- Populada via migration inicial
- **16 registros** (horários 6h-21h)
- Imutável após criação

---

**Tabela: `schedules`**

```sql
id UUID PRIMARY KEY
user_id UUID → auth.users
name VARCHAR(255)
time_slot_id UUID → time_slots

-- Modo reservation_date
reservation_day_of_week INTEGER (0-6)
trigger_day_of_week INTEGER (0-6)

-- Modo trigger_date
trigger_mode VARCHAR CHECK ('reservation_date', 'trigger_date')
trigger_datetime TIMESTAMP WITH TIME ZONE
trigger_time TIME DEFAULT '00:01:00'

-- pg_cron
cron_expression VARCHAR(100)
pg_cron_job_id BIGINT

-- Recorrência
frequency VARCHAR CHECK ('once', 'weekly', 'biweekly', 'monthly')
is_active BOOLEAN DEFAULT true
start_date DATE
end_date DATE

-- Notificações
notify_on_success BOOLEAN DEFAULT true
notify_on_failure BOOLEAN DEFAULT true

-- Pre-flight
preflight_enabled BOOLEAN DEFAULT false
preflight_hours_before INTEGER DEFAULT 4
preflight_notify_on_success BOOLEAN DEFAULT false
preflight_notify_on_failure BOOLEAN DEFAULT true
last_preflight_at TIMESTAMP WITH TIME ZONE

-- Controle
last_executed_at TIMESTAMP WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
```

**RLS:** ativo, políticas por `user_id`

---

**Tabela: `execution_logs`**

```sql
id UUID PRIMARY KEY
schedule_id UUID → schedules (nullable)
user_id UUID → auth.users (nullable)
status VARCHAR CHECK ('success', 'error', 'pending')
message TEXT
request_payload JSONB
response_payload JSONB
reservation_date DATE
executed_at TIMESTAMP WITH TIME ZONE
duration_ms INTEGER

-- Log estruturado
execution_type VARCHAR CHECK ('reservation', 'preflight', 'test', 'auto_cancel', 'test_token')
error_step VARCHAR
flow_steps JSONB  -- Array de FlowStep[]

-- Modo teste
is_test BOOLEAN DEFAULT false
test_hour INTEGER
```

**RLS:** ativo, usuário vê logs de seus schedules

---

**Tabela: `reservations`**

```sql
id UUID PRIMARY KEY
schedule_id UUID → schedules (nullable)
execution_log_id UUID → execution_logs
time_slot_id UUID → time_slots
reservation_date DATE
status VARCHAR CHECK ('confirmed', 'cancelled', 'failed')
external_id VARCHAR(255)  -- ID no sistema Speed
created_at TIMESTAMP WITH TIME ZONE
```

---

**Tabela: `app_config`**

Armazena configurações sensíveis por usuário: refresh tokens, emails customizados.

| Campo   | Tipo         | Descrição                            |
| ------- | ------------ | ------------------------------------ |
| id      | UUID         | Identificador único                  |
| user_id | UUID         | FK → auth.users                      |
| key     | VARCHAR(100) | Chave da config (ex: `auth_token`)   |
| value   | TEXT         | Valor (texto plano, sem encriptação) |

**Keys Ativas:**

- `auth_token` — Refresh token SuperLógica (RN-008)
- `notification_email` — Email customizado (opcional)

**Constraints:** UNIQUE(user_id, key) — 1 valor por chave por usuário

---

**Tabela: `auto_cancel_config`**

Configuração de cancelamento automático por usuário.

| Campo                               | Tipo        | Default           | Descrição                  |
| ----------------------------------- | ----------- | ----------------- | -------------------------- |
| id                                  | UUID        | -                 | Identificador único        |
| user_id                             | UUID        | -                 | FK → auth.users            |
| is_active                           | BOOLEAN     | false             | Se está ativo              |
| trigger_time                        | TIME        | 22:00:00          | Hora de execução (UTC)     |
| cancellation_reason                 | TEXT        | 'Cancelamento...' | Motivo enviado à API       |
| notify_on_success_no_reservations   | BOOLEAN     | false             | Notificar se 0 reservas    |
| notify_on_success_with_reservations | BOOLEAN     | true              | Notificar se 1+ canceladas |
| notify_on_failure                   | BOOLEAN     | true              | Notificar se erro          |
| last_executed_at                    | TIMESTAMPTZ | NULL              | Última execução            |
| created_at                          | TIMESTAMPTZ | NOW()             | Criação                    |
| updated_at                          | TIMESTAMPTZ | NOW()             | Última atualização         |

**Regras:** RN-005 (cancelamento do dia atual), RN-006 (timezone em UTC)

---

---

#### 4.2.3 Índices Confirmados

- `idx_schedules_user_id` ON schedules(user_id)
- `idx_schedules_active` ON schedules(is_active) WHERE is_active = true
- `idx_schedules_pg_cron_job_id` ON schedules(pg_cron_job_id)
- `idx_schedules_preflight_enabled` ON schedules(preflight_enabled) WHERE preflight_enabled = true
- `idx_execution_logs_schedule` ON execution_logs(schedule_id)
- `idx_execution_logs_status` ON execution_logs(status)
- `idx_execution_logs_date` ON execution_logs(executed_at DESC)
- `idx_execution_logs_type` ON execution_logs(execution_type)
- `idx_reservations_schedule` ON reservations(schedule_id)
- `idx_reservations_date` ON reservations(reservation_date)
- `idx_app_config_user` ON app_config(user_id)
- `idx_auto_cancel_config_is_active` ON auto_cancel_config(is_active)
- `idx_auto_cancel_config_user_id` ON auto_cancel_config(user_id)

---

## 5. Modelagem de Dados — Resumido

Todas as entidades usam UUID como PK, TIMESTAMPTZ para timestamps (em UTC), RLS para isolamento de usuário. Veja documentação completa anterior para campos específicos.

---

### 5.6 Entidade: `system_config` ✅ CONFIRMADO

**Responsabilidade:** Armazena configurações de sistema (URLs, credentials)

**Status:** Tabela ativa com 2 registros

**Campos:**
| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|-------------|---------|-----------|
| key | TEXT | ✅ | - | PK, chave única da config |
| value | TEXT | ✅ | - | Valor da configuração |
| created_at | TIMESTAMPTZ | ✅ | NOW() | Criação |
| updated_at | TIMESTAMPTZ | ✅ | NOW() | Última atualização |

**Registros Ativos (Confirmados):**

1. `supabase_url` - URL base do projeto Supabase
2. `service_role_key` - Service Role Key para autenticação server-side

**Onde é Usado:**

- ✅ `check_and_execute_schedules()` - lê antes de chamar Edge Function
- ✅ `run_auto_cancel_check()` - lê antes de chamar Edge Function
- ✅ `call_preflight_edge_function()` - lê antes de chamar Edge Function
- ✅ **TODAS as funções SQL** que chamam Edge Functions via pg_net

**Regras de Negócio:**

- ✅ Credentials centralizadas para chamadas HTTP de dentro do banco
- ✅ Facilita rotação de service_role_key sem alterar código
- ⚠️ **CRÍTICO**: Se registros forem deletados, TODOS os jobs param de funcionar

**Impacto no Sistema:**

- ⚠️ **RISCO ALTO**: Tabela armazena `service_role_key` em texto plano
- ⚠️ Deletar `service_role_key` → paralisa sistema inteiro
- ⚠️ Deletar `supabase_url` → paralisa sistema inteiro

**Segurança:**

- ✅ RLS habilitado
- ✅ Bloqueio total - apenas SECURITY DEFINER functions podem acessar
- ✅ Confirmado via migration 20260106112245

**Constraints:**

- PRIMARY KEY: `key`

---

---

### 5.7 Entidade: `cleanup_history` ✅ FUNCIONAL

**Responsabilidade:** Auditoria de limpezas automáticas

**Status:** Funcional — `run_automatic_cleanup()` insere registros a cada execução

---

## 6. Functions, Services e Use Cases

### 6.1 Lógica de Aplicação (Frontend)

#### 6.1.1 Hooks de Autenticação

**Hook: `useAuth`** (`src/hooks/useAuth.ts`)

**Responsabilidade:** Gerenciar estado de autenticação Supabase

**Funcionalidades:**

- Login com email/password
- Logout
- Obter usuário atual
- Observar mudanças de sessão

**Entradas/Saídas:**

```typescript
// Login
input: { email: string, password: string }
output: Promise<{ user, session } | error>

// Logout
input: void
output: Promise<void>

// Current user
output: User | null
```

**Onde é usado:**

- `src/components/ProtectedRoute.tsx` — proteção de rotas
- `src/pages/Login.tsx` — formulário de login
- Todos os hooks que precisam de user_id

---

#### 6.1.2 Hooks de Schedules

**Hook: `useSchedules`** (`src/hooks/useSchedules.ts`)

**Responsabilidade:** CRUD completo de agendamentos

**Funcionalidades:**

- `useSchedules()` — listar todos os schedules do usuário
- `useSchedule(id)` — buscar 1 schedule por ID
- `useCreateSchedule()` — criar novo schedule
- `useUpdateSchedule()` — atualizar schedule existente
- `useDeleteSchedule()` — deletar schedule

**Regras Críticas:**

- ✅ Converte campos snake_case (DB) ↔ camelCase (TS)
- ✅ Mapeia `time_slot` (join) para objeto `TimeSlot`
- ✅ Conversão UTC ↔ BRT em `trigger_time` e `trigger_datetime`
- ✅ Invalidação de cache após mutations

**⚠️ NÃO ALTERAR sem validar:**

- Mapeamento de campos entre DB e tipos TypeScript
- Conversão de timezone
- Query keys do TanStack Query

**Onde é usado:**

- `src/pages/Schedules.tsx` — listagem
- `src/pages/NewSchedule.tsx` — criar/editar
- `src/pages/Dashboard.tsx` — estatísticas

---

#### 6.1.3 Hooks de Logs

**Hook: `useLogs`** (`src/hooks/useLogs.ts`)

**Funcionalidades:**

- `useLogs(filters)` — listar logs com filtros
- `useLog(id)` — buscar 1 log por ID
- `useLogStats()` — estatísticas (taxa de sucesso, total)
- `useRecentLogs(limit)` — últimos N logs

**Regras Críticas:**

- ✅ Parsing de `flow_steps` (JSONB → array)
- ✅ Filtros por: status, execution_type, date range
- ✅ Join com `schedules` para obter nome

**Onde é usado:**

- `src/pages/Logs.tsx` — visualização completa
- `src/pages/Dashboard.tsx` — atividade recente
- `src/components/logs/FlowStepsLog.tsx` — detalhamento de steps

---

#### 6.1.4 Hooks de Configuração

**Hook: `useConfig`** (`src/hooks/useConfig.ts`)

**Funcionalidades:**

- `useConfig()` — listar todas as configs do usuário
- `useConfigByKey(key)` — buscar config por chave
- `useUpsertConfig()` — criar ou atualizar config
- `useDeleteConfig()` — remover config

**Regras Críticas:**

- ✅ Upsert inteligente: busca existente antes de decidir INSERT vs UPDATE
- ✅ **CONFIRMADO:** Value em texto plano (NÃO encriptado), sem necessidade de `decrypt_value()`

**Onde é usado:**

- `src/pages/Settings.tsx` — gerenciar `auth_token` e `notification_email`
- Edge Functions — leitura de `auth_token` (via service role)

---

#### 6.1.5 Hooks de Auto-Cancel

**Hook: `useAutoCancel`** (`src/hooks/useAutoCancel.ts`)

**Funcionalidades:**

- `useAutoCancelConfig()` — buscar config do usuário
- `useUpsertAutoCancelConfig()` — criar/atualizar config
- `useRunAutoCancel({ dryRun, adHoc })` — executar manualmente

**Regras Críticas:**

- ✅ Conversão BRT ↔ UTC em `trigger_time`
- ✅ Trigger SQL gerencia pg_cron job automaticamente
- ✅ Modo `dryRun` para teste sem cancelamento real

**Onde é usado:**

- `src/pages/AutoCancel.tsx` — interface completa de configuração

---

#### 6.1.6 Hooks de Teste

**Hook: `useTestToken`** (`src/hooks/useTestToken.ts`)

**Funcionalidade:**

- `useTestToken()` — testar autenticação manualmente

**Comportamento:**

- ✅ Chama Edge Function `test-token`
- ✅ Retorna resultado passo-a-passo em tempo real
- ✅ NÃO faz reserva, apenas valida token

**Onde é usado:**

- `src/pages/Settings.tsx` — botão "Testar Token"

---

### 6.2 Lógica no Supabase (Edge Functions)

#### 6.2.1 Edge Function: `execute-reservation` — PRINCIPAL

**Arquivo:** `supabase/functions/execute-reservation/index.ts`

**Responsabilidade:** Executa reserva via API Speed ou modo teste

**Entrada:** `{scheduleId?, test?, hour?, dryRun?}`

**Fluxo:** Parse → Buscar config → Autenticar → Calcular data → Chamar API Speed → Salvar log/reserva → Notificar

**Regras Críticas:**

- RN-001: Cálculo +10 dias
- RN-008: Renovação de token
- RN-010: Popula flow_steps
- RN-011: Modo dryRun (sem efeitos colaterais)

---

#### 6.2.2 Edge Function: `run-preflight`

**Arquivo:** `supabase/functions/run-preflight/index.ts`

**Responsabilidade:** Validação de token antes do disparo real (RN-004)

**Entrada:** `{scheduleId?, ...}` (se vazio, valida TODOS)

**Fluxo:** Buscar schedules → Para cada → Autenticar → Validar resposta → Atualizar `last_preflight_at` → Salvar log → Notificar

**Regras Críticas:**

- RN-004: Executa X horas antes do disparo
- NÃO faz reserva, apenas valida
- Notifica se falha (tempo para corrigir)

---

#### 6.2.3 Edge Function: `run-auto-cancel`

**Arquivo:** `supabase/functions/run-auto-cancel/index.ts`

**Responsabilidade:** Cancelar reservas do dia (RN-005)

**Entrada:** `{userId?, dryRun?, adHoc?}`

**Fluxo:** Buscar config → Autenticar → Listar reservas → Filtrar por HOJE → Cancelar via API → Atualizar status → Salvar log → Notificar

**Regras Críticas:**

- RN-005: APENAS reservas do dia atual
- Formato de data: MM/DD/YYYY (consistente em request e response, confirmado em 06/01/2026)
- Configuração em UTC, comparação em BRT

---

#### 6.2.4 Edge Function: `test-token`

**Arquivo:** `supabase/functions/test-token/index.ts`

**Responsabilidade:** Testar autenticação manualmente

**Fluxo:** Buscar token → Autenticar → Listar reservas (validação) → Salvar log → Retornar resultado

**Regras Críticas:**

- NÃO faz reserva/cancelamento
- Apenas valida credenciais

---

### 6.3 SQL Functions (Polling Global)

**Arquitetura:** 4 jobs globais (rodando `* * * * *`) chamam funções SQL que verificam tabelas

**Funções Principais:**

1. **`check_and_execute_schedules()`** - Polling de schedules na janela de execução
2. **`run_auto_cancel_check()`** - Polling de configs de auto-cancel
3. **`call_preflight_edge_function()`** - Wrapper para disparar pre-flight
4. **`run_automatic_cleanup()`** - Limpeza domingos 3h AM UTC

**Padrão Comum:** Lêm `system_config`, verificam condições (janela de tempo, `last_executed_at`), chamam Edge Functions via pg_net

---

## 7. Jobs, Cron e Processos Assíncronos (Resumido)

**Arquitetura:** 4 jobs globais rodam a cada minuto, cada um chamando uma SQL Function para verificar se há registros elegíveis para execução

**Jobs Ativos:**

| ID  | Nome                        | Propósito                             |
| --- | --------------------------- | ------------------------------------- |
| 5   | automatic-cleanup           | Remove dados antigos (domingos 3h AM) |
| 8   | check-and-execute-schedules | Executa schedules na janela de tempo  |
| 11  | preflight-check             | Valida token antes do disparo         |
| 15  | auto-cancel-check           | Cancela reservas do dia               |

**Padrão:** Cada job roda `* * * * *` (a cada minuto), função SQL verifica condições, chama Edge Function se elegível

**Proteção contra duplicação:** `last_executed_at` atualizado ANTES de chamar Edge Function, não executa se rodou <15min atrás

---

## 8. Integrações Externas

### 8.1 API SuperLógica (Crítica)

**Provedor:** SuperLógica (Gruvi App)  
**Domínios:**

- `https://api.superlogica.com` — Autenticação
- `https://speedassessoria.superlogica.net` — Operações de reserva

**Autenticação:** OAuth 2.0 com refresh_token

---

#### 8.1.1 Endpoint: `/auth/token` (Autenticação)

**URL:** `POST https://api.superlogica.com/spaces/v1/auth/token`

**Headers Obrigatórios:**

```json
{
  "Content-Type": "application/x-www-form-urlencoded",
  "x-app-name": "Gruvi",
  "x-person-id": "{SUPERLOGICA_PERSON_ID}",
  "x-company-id": "23044",
  "x-app-version": "2.15.0",
  "x-app-build": "1272",
  "x-device-type": "mobile",
  "User-Agent": "Gruvi/1272 v2.15.0 (ios; mobile;)"
}
```

**Body (URLEncoded):**

```
grant_type=refresh_token
client_id={SUPERLOGICA_CLIENT_ID}
refresh_token={token}
session_id={SUPERLOGICA_SESSION_ID}
```

**Response (Sucesso):**

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

**Response (Erro):**

- Status: 400/401/403
- Body: texto de erro

**Regras Críticas:**

- ✅ `refresh_token` expira (⚠️ validade desconhecida)
- ✅ Sempre obter NOVO `refresh_token` e salvar (RN-008)
- ⚠️ **NUNCA expor tokens em logs**

**Tratamento de Erros:**

- ❌ Token inválido → salvar log com erro → notificar usuário
- ❌ Rede falha → retry? (⚠️ validar comportamento)

**Environment Variables Necessárias:**

```
SUPERLOGICA_CLIENT_ID
SUPERLOGICA_SESSION_ID
SUPERLOGICA_PERSON_ID
```

⚠️ **VALIDAÇÃO NECESSÁRIA:**

- Confirmar valores corretos dessas env vars no Supabase

---

#### 8.1.2 Criar Reserva: POST `/api/cond/espacos/v1/reservas`

**Request Format:** MM/DD/YYYY (Body: `{id_area_are, dt_reserva_res, id_sacado_sac}`)

**Response Format:** MM/DD/YYYY (confirmado em 06/01/2026)

ID do horário deve ser válido (RN-007), response contém `ID_RESERVA_RES` (essencial para cancelamento).

---

#### 8.1.3 Listar Reservas: POST `/areadocondomino/atual/reservas/obterreservasdaunidade`

**Request Format:** MM/DD/YYYY (Body: `{idUnidades, dtInicio, dtFim, idCondominio, filtrarFila}`)

**Response Format:** MM/DD/YYYY (confirmado em 06/01/2026)

Usado por auto-cancel. Campo `dt_reserva_res` retorna no formato MM/DD/YYYY (exemplo: "01/14/2026 00:00:00").

---

#### 8.1.4 Cancelar Reserva: DELETE `/api/cond/espacos/v1/reservas/{id}`

Exige `id_reserva_res`. Sem ID → impossível cancelar.

---

### 8.2 API Resend (Notificações)

**URL:** `POST https://api.resend.com/emails`

Envia notificações após execuções. `to` obtido de `app_config.notification_email` ou `auth.users.email`. Env var: `RESEND_API_KEY`

**Regras:** Domínio em `from` deve ser verificado no Resend

---

### 8.3 Tratamento de Erros

**Padrão:** Try/catch, erro salvo em `execution_logs`, notificação enviada. Sem retry automático (job roda novamente na próxima janela).

**Melhorias possíveis:** Retry com backoff, circuit breaker, alertas proativos para falhas repetidas

---

## 9. Decisões Técnicas Importantes (Resumido)

> Architectural Decision Records (ADRs) simplificados

### 9.1 ADR-001: pg_cron em vez de AWS EventBridge

**Decisão:** Usar pg_cron — tudo dentro do Supabase, sem custo adicional

**Trade-offs:** Simplicidade vs vendor lock-in, menos robust monitoring que AWS CloudWatch

---

### 9.2 ADR-002: ✅ Jobs Globais de Polling (IMPLEMENTADO CORRETAMENTE)

**Status:** ✅ Implementado e confirmado em 06/01/2026 — Sistema usa polling global, NÃO jobs individuais

**O que é (Implementado):**

- 4 jobs globais rodam `* * * * *` (a cada minuto)
- Cada job chama SQL Function que verifica tabelas
- Function determina se há registros elegíveis
- Se sim, chama Edge Function; se não, retorna (sem fazer nada)
- Campo `last_executed_at` evita duplicação (não roda 2x em menos de 15 min)

**Jobs Ativos:**

| Job                         | ID  | Função SQL                       | Propósito              |
| --------------------------- | --- | -------------------------------- | ---------------------- |
| automatic-cleanup           | 5   | `run_automatic_cleanup()`        | Limpeza domingos 3h AM |
| check-and-execute-schedules | 8   | `check_and_execute_schedules()`  | Polling de schedules   |
| preflight-check             | 11  | `call_preflight_edge_function()` | Polling de pre-flight  |
| auto-cancel-check           | 15  | `run_auto_cancel_check()`        | Polling de auto-cancel |

**NÃO Usar (Dead Code):**

- ❌ `cron.schedule()` / `cron.unschedule()` por schedule
- ❌ Triggers `on_schedule_*` (existem mas nunca criam jobs)
- ❌ Campo `pg_cron_job_id` (sempre NULL)

**Trade-offs:**

- ✅ Simplicidade: 4 jobs permanentes
- ✅ Estabilidade: sem gerenciamento dinâmico
- ⚠️ Job roda mesmo sem registros elegíveis (mitigado por checks)

---

### 9.3 ADR-003: Timezone — UTC no Banco, BRT no Frontend

**Decisão:** Armazenar sempre em UTC, converter na apresentação

**Critical:** Erros causam disparos no horário errado

---

### 9.4 ADR-004: Edge Functions (Deno) para Lógica Complexa

**Decisão:** Lógica de negócio em TypeScript/Deno, SQL apenas para dados e triggers

**Trade-offs:** Type safety vs latência adicional

---

### 9.5 ADR-005: Refresh Token em vez de Credenciais

**Decisão:** Armazenar refresh_token, renovar a cada execução

**Trade-offs:** Melhor segurança vs complexidade

---

### 9.6 ADR-006: Logs Estruturados em JSONB

**Decisão:** Array de FlowSteps em `execution_logs.flow_steps` (RN-010)

**Trade-offs:** Queries poderosas vs campo pode ficar grande

---

### 9.7 ADR-007: Dois Modos de Disparo (Reservation Date vs Trigger Date)

**Decisão:** Suportar ambos — RN-002

**Trade-offs:** Flexibilidade vs complexidade

---

### 9.8 ADR-008: RLS com Service Role Bypass

**Decisão:** RLS em todas as tabelas, Edge Functions usam service_role_key

**Trade-offs:** Segurança vs risco de vazamento de service_role_key

---

## 10. Contradições Resolvidas e Pontos Sensíveis

> ⚠️ **ATENÇÃO MÁXIMA** ao trabalhar nestas áreas

### 10.1 🔴 RESOLVIDO: ADR-002 Estava Desatualizado (Jobs Individuais vs Polling Global)

**O que estava errado:** Seção 10.2 antigos dizia "Decisão: Jobs individuais", mas seção 4.1.2-4.1.3 confirmam polling global

**Correção aplicada:** ADR-002 reescrito para refletir realidade — **4 jobs globais rodam `* * * * *`**

**Confirmação:**

- ✅ 4 jobs globais listados em 4.1.2
- ✅ 6 triggers inoperantes em 4.1.3 (pg_cron_job_id sempre NULL)
- ✅ SQL Functions checam tabelas a cada minuto
- ✅ `last_executed_at` evita duplicação

---

### 10.2 🔴 CRÍTICO: RLS Policy em `execution_logs` Viola RN-012

**Problema:** Policy diz `qual = true` (todos veem todos os logs)

**Impacto:** Qualquer usuário autenticado pode ler logs de outros usuários (violação de privacidade)

**Ação Necessária:** Alterar policy para `auth.uid() = user_id` imediatamente

**Localização:** Seção 4.1.4 — já marcado como violação crítica

---

### 10.3 🔴 CRÍTICO: RLS Policy em `schedules` INSERT Sem Validação

**Problema:** `INSERT: sem qual` permite criar schedules para qualquer user_id

**Impacto:** Usuário A pode criar agendamentos no nome de Usuário B

**Ação Necessária:** Adicionar `WITH CHECK (auth.uid() = user_id)`

---

### 10.4 🟡 MÉDIO: RN-003 Biweekly/Monthly Não Testadas

**Problema:** Documentação diz que biweekly/monthly simulam visualmente, mas backend executa weekly

**Impacto:** Possível que frequências não respeitem "a cada 2 semanas" ou "a cada mês"

**Ação Necessária:** Validar implementação em `check_and_execute_schedules()` + adicionar testes E2E

---

### 10.6 API SuperLógica — Inconsistência de Formato de Data ✅ RESOLVIDO

**Status:** Problema resolvido em 06/01/2026

**O que estava documentado (ERRADO):**
- Request: MM/DD/YYYY
- Response: DD/MM/YYYY (inconsistência da API)

**Realidade confirmada:**
- ✅ Request: MM/DD/YYYY
- ✅ Response: MM/DD/YYYY (mesmo formato)
- ✅ Campo `dt_reserva_res` retorna "01/14/2026 00:00:00" (MM/DD/YYYY)
- ✅ **NÃO há inconsistência** — API é consistente

**Validação:** HAR files da API SuperLógica analisados em 06/01/2026 confirmam formato consistente.

---

### 10.6 system_config com Credenciais

**Risco:** `service_role_key` permite bypass total de RLS

**Proteção:** RLS ativo, policy restritiva (USING false), apenas SECURITY DEFINER functions acessam

**Ação:** ✅ Validado em 06/01/2026 — RLS funcionando corretamente

---

### 10.7 ADR-002: Jobs Globais com Polling (IMPLEMENTADO E CONFIRMADO)

**Contexto:**

- Duas estratégias para agendar execuções:
  A) 1 job global que verifica tabela `schedules` a cada minuto
  B) 1 job pg_cron individual para cada schedule

**Decisão (CONFIRMADA EM 06/01/2026):**

- ✅ **Jobs globais** (estratégia A) — **IMPLEMENTADA**

**Estado Atual (Verificado via Query SQL):**

Exatamente 4 jobs globais ativos:

| jobid | jobname                    | schedule   | command                           |
| ----- | -------------------------- | ---------- | --------------------------------- |
| 5     | automatic-cleanup          | 0 3 \* \* 0 | SELECT run_automatic_cleanup()    |
| 8     | check-and-execute-schedules | \* \* \* \* \* | SELECT check_and_execute_schedules() |
| 11    | preflight-check            | \* \* \* \* \* | SELECT call_preflight_edge_function() |
| 15    | auto-cancel-check          | \* \* \* \* \* | SELECT run_auto_cancel_check()    |

**Como Funciona:**

- ✅ Jobs 8, 11, 15 rodam a cada minuto (`* * * * *`)
- ✅ Cada job chama SQL Function que verifica tabela
- ✅ Function determina se há registros elegíveis para execução
- ✅ Se sim: chama Edge Function via pg_net; se não: retorna sem fazer nada
- ✅ `last_executed_at` evita duplicação (não executa 2x em menos de 15 min)

**Dead Code (Triggers Não Funcione):**

Existem 6 triggers que tentam gerenciar jobs individuais, mas nunca executam porque `pg_cron_job_id` está sempre NULL. Candidatos para remoção em refactoring futuro.

**Alternativa Descartada:**

- ❌ Jobs individuais — tentativa antiga em triggers (inoperante)

**Razões para Polling Global:**

- ✅ Simplicidade: 4 jobs permanentes, sem gerenciamento dinâmico
- ✅ Estabilidade: sem criar/deletar jobs em runtime
- ✅ Escalabilidade: funciona com qualquer número de schedules
- ⚠️ Job roda mesmo sem registros elegíveis (mitigado por checks SQL)

**Consequências:**

- ✅ Sistema estável e previsível
- ✅ Fácil manutenção (sem lógica de criação/deleção)
- ✅ Menos risco de jobs órfãos
- ⚠️ 1 minuto de latência máxima (executa a cada minuto)

---

### 10.8 ADR-003: Timezone — UTC no Banco, BRT no Frontend

**Contexto:**

- Usuários estão no Brasil (BRT = UTC-3)
- Banco de dados pode estar em qualquer timezone
- Cron jobs rodam em UTC

**Decisão:**

- ✅ SEMPRE armazenar em UTC no banco
- ✅ SEMPRE converter para BRT no frontend
- ✅ Conversão explícita em TODOS os pontos

**Alternativas Descartadas:**

- ❌ Armazenar em BRT — inconsistências com cron (roda em UTC)
- ❌ Usar `TIMESTAMP WITHOUT TIME ZONE` — perde informação de timezone
- ❌ Deixar PostgreSQL converter automaticamente — comportamento implícito, propenso a erros

**Consequências:**

- ✅ Consistência garantida
- ✅ Suporte futuro a múltiplos timezones (se necessário)
- ⚠️ Complexidade: conversões em múltiplos lugares
- ⚠️ **CRÍTICO:** Erros de conversão causam disparos no horário errado

**Padrão Implementado:**

```typescript
// Frontend: BRT → UTC ao salvar
const utcHour = (brtHour + 3) % 24

// Frontend: UTC → BRT ao exibir
const brtHour = (utcHour - 3 + 24) % 24
```

---

### 10.9 ADR-004: Uso de Edge Functions (Deno) em vez de Database Functions

**Contexto:**

- Lógica de negócio complexa (autenticação, chamadas HTTP, etc.)
- Duas opções: tudo em PL/pgSQL ou separar em Edge Functions

**Decisão:**

- ✅ Lógica complexa em Edge Functions (Deno/TypeScript)
- ✅ SQL apenas para operações de dados e triggers

**Alternativas Descartadas:**

- ❌ Tudo em PL/pgSQL — linguagem menos expressiva, difícil debug
- ❌ Lógica no frontend — inseguro (tokens expostos)

**Consequências:**

- ✅ TypeScript = type safety, melhor DX
- ✅ Ecosystem Deno = acesso a libs modernas
- ✅ Logs estruturados mais fáceis
- ✅ Testabilidade melhor
- ⚠️ Latência adicional (round trip SQL → HTTP → Edge Function)
- ⚠️ Depende de pg_net para HTTP calls de dentro do SQL

---

### 10.10 ADR-005: Refresh Token em vez de Credenciais (User/Pass)

**Contexto:**

- API SuperLógica exige autenticação
- Duas opções: armazenar user/pass ou refresh_token

**Decisão:**

- ✅ Armazenar APENAS refresh_token
- ✅ Renovar a cada execução

**Alternativas Descartadas:**

- ❌ Armazenar user/password — risco de segurança maior
- ❌ Armazenar access_token — expira rapidamente (1h?)

**Consequências:**

- ✅ Menor risco: refresh_token pode ser revogado sem mudar password
- ✅ Alinhado com OAuth 2.0 best practices
- ⚠️ Usuário precisa obter refresh_token manualmente (via app Gruvi)
- ⚠️ Se refresh_token expirar, TODAS execuções falham

---

### 10.11 ADR-006: Logs Estruturados (Flow Steps) em JSONB

**Contexto:**

- Necessidade de rastreabilidade passo-a-passo
- Debugging de falhas
- Auditoria de API calls

**Decisão:**

- ✅ Usar campo JSONB `flow_steps` em `execution_logs`
- ✅ Array de objetos com estrutura padronizada

**Alternativas Descartadas:**

- ❌ Logs apenas em texto (`message` field) — difícil parsing
- ❌ Tabela separada `log_steps` — queries mais complexas
- ❌ Logs apenas no stdout (Supabase Logs) — não persiste long-term

**Consequências:**

- ✅ Queries poderosas (JSONB operators)
- ✅ Visualização rica no frontend
- ✅ Audit trail completo (request/response bodies)
- ⚠️ Campo pode ficar grande (considera limit?)
- ⚠️ Performance de queries JSONB (índices necessários?)

---

### 10.12 ADR-007: Dois Modos de Disparo (Reservation Date vs Trigger Date)

**Contexto:**

- Maioria dos usuários quer: "toda Domingo às 7h"
- Alguns casos especiais: "dispare em 25/12 às 00:01"

**Decisão:**

- ✅ Suportar AMBOS os modos
- ✅ Campo `trigger_mode` (ENUM)

**Alternativas Descartadas:**

- ❌ Apenas reservation_date — casos especiais impossíveis
- ❌ Apenas trigger_date — UX ruim (usuário precisa calcular dia do disparo)

**Consequências:**

- ✅ Flexibilidade máxima
- ⚠️ Complexidade adicional (dois caminhos de cálculo)
- ⚠️ Frontend precisa mostrar UI diferente por modo

---

### 10.13 ADR-008: RLS (Row Level Security) com Service Role Bypass

**Contexto:**

- Múltiplos usuários no sistema
- Jobs pg_cron rodam como `postgres` (sem user_id)

**Decisão:**

- ✅ RLS ativo em todas as tabelas (segurança)
- ✅ Edge Functions usam `service_role_key` (bypass RLS)

**Alternativas Descartadas:**

- ❌ Sem RLS — dados de usuários visíveis entre si
- ❌ Edge Functions com `anon_key` — não consegue acessar dados de outros usuários

**Consequências:**

- ✅ Segurança: frontend isolado por usuário
- ✅ Flexibilidade: Edge Functions veem tudo
- ⚠️ **CRÍTICO:** `service_role_key` vazada = acesso total ao banco
- ⚠️ Edge Functions devem validar user_id manualmente se chamadas pelo frontend

---

## 11. Pontos Sensíveis / Áreas de Alto Risco

> ⚠️ **ATENÇÃO MÁXIMA** ao trabalhar nestas áreas

### 11.1 🔴 RISCO CRÍTICO: system_config com Credenciais Sensíveis

**Descoberto em:** 06/01/2026 (Validação #7)

**Problema:** Tabela armazena `service_role_key` em texto plano

**Registros Sensíveis:**

- `service_role_key` - permite bypass total de RLS
- `supabase_url` - URL do projeto

**Proteção Atual:**

- ✅ RLS habilitado (confirmado - policy restritiva ativa)
- ✅ Apenas funções `SECURITY DEFINER` podem acessar
- ✅ Policy bloqueia acesso direto de usuários

**Riscos:**

- ❌ Se policy for removida → qualquer usuário pode ler service key
- ❌ Service key permite acesso total ao banco (bypass RLS)
- ❌ Deletar registros → paralisa sistema inteiro

**Ação Necessária:**

**Ação Recomendada:**

1. ✅ **CONFIRMADO**: RLS habilitado com policy restritiva
2. ✅ **CONFIRMADO**: Policy bloqueia acesso direto (USING false)
3. ⚠️ **Melhorias opcionais**:
   - Migrar para Supabase Vault (encriptação nativa)
   - Usar variáveis de ambiente ao invés de banco

---

### 11.3 🔴 RISCO CRÍTICO: Cálculo de Data de Reserva

**Localização:**

- `src/lib/cron.ts` — frontend
- `supabase/functions/execute-reservation/index.ts` — backend

**Por que é Crítico:**

- ❌ Erro aqui = reserva feita no dia errado
- ❌ Dia errado = horário já reservado por outros
- ❌ Impossível corrigir após reserva feita

**Regras que NÃO podem ser quebradas:**

- ✅ Reserva sempre +10 dias do disparo
- ✅ `getTriggerDayOfWeek() = (reservationDay - 3) % 7`
- ✅ Conversão correta BRT ↔ UTC

**Testes Obrigatórios antes de Alterar:**

1. Reserva Domingo → dispara Quinta?
2. Reserva Segunda → dispara Sexta?
3. Horário 00:01 BRT = 03:01 UTC?
4. Modo `trigger_date` respeita data fornecida?

---

### 11.4 🔴 RISCO CRÍTICO: Conversão de Timezone

**Localização:**

- `src/pages/NewSchedule.tsx`
- `src/pages/AutoCancel.tsx`
- `src/pages/Dashboard.tsx`

**Por que é Crítico:**

- ❌ Erro aqui = job dispara na hora errada
- ❌ Ex: usuário configura 00:01, mas dispara 03:01 (ou 21:01 do dia anterior)

**Regras que NÃO podem ser quebradas:**

- ✅ Banco SEMPRE em UTC
- ✅ Frontend SEMPRE em BRT
- ✅ Conversão: BRT = UTC - 3 horas

**Exemplo de Erro Comum:**

```typescript
// ❌ ERRADO
triggerTime = userInput // sem conversão

// ✅ CORRETO
const [brtHour, minute] = userInput.split(":")
const utcHour = (brtHour + 3) % 24
triggerTime = `${utcHour}:${minute}:00`
```

---

### 11.5 🔴 RISCO CRÍTICO: Renovação de Refresh Token

**Localização:**

- Todas as Edge Functions (`authSuperLogica()`)
- Update em `app_config.auth_token`

**Por que é Crítico:**

- ❌ Não renovar = token expira em X dias
- ❌ Token expirado = TODAS execuções falham
- ❌ Falha silenciosa se update falhar

**Regras que NÃO podem ser quebradas:**

- ✅ SEMPRE salvar novo refresh_token após autenticação
- ✅ SEMPRE verificar se update teve sucesso
- ✅ NUNCA ignorar erros de update

**Padrão Correto:**

```typescript
const { access_token, refresh_token } = await authSuperLogica()

// SEMPRE atualizar
const { error } = await supabase
  .from("app_config")
  .update({ value: refresh_token })
  .eq("key", "auth_token")

if (error) throw new Error("Failed to update token")
```

---

### 11.6 🔴 RISCO CRÍTICO: IDs de Horários (time_slots)

**Localização:**

- `src/lib/constants.ts` — constante `TIME_SLOTS`
- Edge Functions — constante `ID_AREAS`

**Por que é Crítico:**

- ❌ ID errado = API rejeita reserva
- ❌ ID não existe = reserva falha
- ❌ Mapping inconsistente frontend/backend = reserva horário errado

**Regras que NÃO podem ser quebradas:**

- ✅ IDs devem corresponder EXATAMENTE à API Speed
- ✅ Frontend e backend devem ter MESMO mapping
- ✅ NUNCA alterar sem confirmar com API Speed

**Mapeamento Atual (RN-007):**

```
6h → 455
7h → 440
8h → 441
...
21h → 454
```

---

### 11.5 🟡 MÉDIO: Gerenciamento de pg_cron Jobs (Resolvido)

**Status:** ✅ Sistema agora usa **polling global** — problema de dead code triggers foi resolvido em migration 20260106200000.

**Arquitetura Atual:**

- ✅ Sistema usa **4 jobs globais** que verificam tabelas a cada minuto
- ✅ Deletar schedule → NÃO precisa deletar job (job é global e permanente)
- ✅ Desativar schedule → Function SQL ignora (WHERE is_active = TRUE)
- ✅ Criar schedule ativo → NÃO cria job (job global já existe)
- ✅ Triggers antigos de gerenciamento foram removidos

---

### 11.6 🟡 MÉDIO: Formato de Data na API SuperLógica

**Localização:**

- Edge Functions (chamadas HTTP)

**Por que é Sensível:**

- ✅ API usa MM/DD/YYYY em queries (confirmado e implementado)
- ✅ API retorna DD/MM/YYYY em responses (confirmado)
- ⚠️ Inconsistência causa erros de parsing se não tratada

**Regras Importantes:**

- ✅ Request: SEMPRE MM/DD/YYYY (formato americano)
- ✅ Response: SEMPRE esperar DD/MM/YYYY (formato brasileiro)
- ✅ Implementado corretamente em todas Edge Functions

---

### 11.7 🟡 MÉDIO: Frequências Recorrentes (Biweekly, Monthly)

**Localização:**

- Cálculo de cron expressions
- Lógica em Edge Functions (⚠️ validar implementação completa)

**Por que é Sensível:**

- ⚠️ Implementação complexa
- ⚠️ Possível gap: migrations mencionam, mas lógica completa? Validar

**⚠️ VALIDAÇÃO NECESSÁRIA:**

- Confirmar se `biweekly` realmente executa a cada 2 semanas
- Confirmar se `monthly` realmente funciona (mesmo dia da semana do mês)

---

### 11.8 🟢 BAIXO: Notificações por Email

**Localização:**

- Edge Functions (`sendNotificationEmail()`)

**Por que é Menos Crítico:**

- ✅ Falha de notificação NÃO afeta reserva
- ✅ Usuário pode verificar logs manualmente

**Mas Importante:**

- ⚠️ Se `RESEND_API_KEY` não configurada → silently fails
- ⚠️ Usuário pode não perceber falhas

---

## 12. Checklist para Mudanças Futuras

### 12.1 Antes de Modificar Regras de Negócio

- [ ] Consultei a seção "Regras de Negócio" deste documento?
- [ ] A mudança afeta cálculo de datas? (RN-001, RN-002)
- [ ] A mudança afeta timezone? (RN-006)
- [ ] A mudança afeta autenticação? (RN-008)
- [ ] Documentei a mudança como novo ADR?
- [ ] Atualizei este documento (TECH_DOCS.md)?

---

### 12.2 Antes de Alterar Banco de Dados

- [ ] Verifiquei o estado REAL do Supabase (não apenas migrations)?
- [ ] A mudança afeta triggers existentes?
- [ ] A mudança afeta functions SQL?
- [ ] A mudança afeta jobs pg_cron?
- [ ] A mudança afeta RLS policies?
- [ ] Criei migration com `DROP IF EXISTS` e `CREATE OR REPLACE` (idempotência)?
- [ ] Testei migration em ambiente de desenvolvimento?

---

### 12.3 Antes de Modificar Edge Functions

- [ ] A mudança afeta renovação de token? (CRÍTICO)
- [ ] A mudança afeta cálculo de data? (CRÍTICO)
- [ ] A mudança afeta estrutura de `flow_steps`?
- [ ] Atualizei `src/lib/flowSteps.ts` se mudei steps?
- [ ] Testei com modo `dryRun` antes de production?
- [ ] Verifiquei se logs estão sendo salvos corretamente?

---

### 12.4 Antes de Modificar Frontend

- [ ] A mudança afeta conversão de timezone? (CRÍTICO)
- [ ] A mudança afeta cache (TanStack Query)?
- [ ] Invalidação de cache está correta após mutations?
- [ ] Tipos TypeScript estão sincronizados com banco?
- [ ] Testei com diferentes estados (loading, error, success)?

---

### 12.5 Antes de Deploy

- [ ] Testei localmente com Supabase local? (ou dev environment)
- [ ] Executei teste E2E manual?
- [ ] Verifiquei logs de execução?
- [ ] Confirmei que jobs pg_cron estão ativos?
- [ ] Validei que notificações estão funcionando?
- [ ] Ambiente variables configuradas? (SUPERLOGICA\_\*, RESEND_API_KEY)

---

**FIM DA DOCUMENTAÇÃO**

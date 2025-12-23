#!/bin/bash

# ============================================
# Testar Pre-flight Edge Function manualmente
# ============================================

# Substitua pela sua service_role_key
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmc2duZ2RwdG16b3Z6dXZ1ZGFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzU4ODI5NCwiZXhwIjoyMDQ5MTY0Mjk0fQ.YOUR_ACTUAL_KEY"

# Teste 1: Verificar se a função responde
echo "=== Teste 1: Chamando run-preflight sem parâmetros ==="
curl -X POST https://ifsgngdptmzovzuvudah.supabase.co/functions/v1/run-preflight \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  --verbose

echo -e "\n\n=== Teste 2: Forçar pre-flight para schedule específico ==="
curl -X POST https://ifsgngdptmzovzuvudah.supabase.co/functions/v1/run-preflight \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId": "025977c6-9e79-44b1-bb7e-a79be64cf94b"}'

echo -e "\n\nDone!"

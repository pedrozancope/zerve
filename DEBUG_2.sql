-- Ver agendamentos com preflight habilitado e seus dados
SELECT 
  id,
  name,
  trigger_datetime,
  preflight_hours_before,
  last_preflight_at,
  NOW() as agora,
  trigger_datetime - (preflight_hours_before || ' hours')::INTERVAL as preflight_deveria_rodar_em
FROM schedules 
WHERE preflight_enabled = true 
  AND is_active = true
ORDER BY created_at DESC
LIMIT 3;

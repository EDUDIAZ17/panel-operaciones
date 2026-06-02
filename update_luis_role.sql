-- update_luis_role.sql
-- Ejecuta este script en el editor SQL de Supabase si deseas volver a aplicar el cambio de rol

UPDATE public.app_users 
SET role = 'admin', name = 'Luis Hernandez (Admin)' 
WHERE email = 'luis.hernandez@alexatransportes.com.mx';

-- Para verificar el cambio, ejecuta:
-- SELECT email, name, role FROM public.app_users WHERE email = 'luis.hernandez@alexatransportes.com.mx';

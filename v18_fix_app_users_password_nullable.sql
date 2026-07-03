-- v18_fix_app_users_password_nullable.sql
-- Run this in the Supabase SQL Editor if you want to clean up the legacy 'password' column 
-- and remove the NOT NULL constraint since we now use 'password_hash'.

-- Make the legacy plaintext password column optional
ALTER TABLE public.app_users ALTER COLUMN password DROP NOT NULL;

-- OR (Optional) Drop the column entirely if you don't need the legacy plaintext passwords anymore:
-- ALTER TABLE public.app_users DROP COLUMN IF EXISTS password;

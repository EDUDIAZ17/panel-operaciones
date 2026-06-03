-- v14_enable_cron_worker.sql
-- Run this script in the Supabase SQL Editor to schedule the geofencing worker every minute 24/7.

-- 1. Enable the pg_net and pg_cron extensions if they are not already active
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Clean up any existing schedule to prevent duplicates
SELECT cron.unschedule('evaluate-gps-alerts-worker');

-- 3. Schedule the edge function to run every minute
-- IMPORTANT: Replace '<project-ref>' with your actual Supabase Project Reference ID
-- and '<service-role-key>' with your Supabase Service Role Key (service_role)
SELECT cron.schedule(
  'evaluate-gps-alerts-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/evaluate-gps-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <service-role-key>'
    ),
    body := '{}'::jsonb
  );
  $$
);

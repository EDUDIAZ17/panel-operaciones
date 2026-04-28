// config.js
// ================================================================
// CONFIGURACIÓN CENTRALIZADA
// ================================================================
// 
// NOTA PARA PRODUCCIÓN:
// Cuando tengas un hosting propio, crea un archivo .env en la raíz
// con las siguientes variables y usa un bundler (Vite, Webpack) 
// para inyectarlas en tiempo de build:
//
//   SUPABASE_URL=https://kcyfqdgcdokodqzcaukf.supabase.co
//   SUPABASE_ANON_KEY=your-anon-key
//   GOOGLE_MAPS_API_KEY=your-maps-key
//
// Por ahora, las variables se definen aquí directamente para 
// que funcione en GitHub Pages (entorno estático sin bundler).
// ================================================================

// Supabase
export const SUPABASE_URL = 'https://kcyfqdgcdokodqzcaukf.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeWZxZGdjZG9rb2RxemNhdWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTAyNjgsImV4cCI6MjA4Njk2NjI2OH0.HG6L_fTsjbAPaAKDlMneUzfkqLP68haJ2MyVA9tspz8';

// Google Maps API Key (must be exposed in frontend for Maps JS SDK)
// IMPORTANT: Restrict this key by HTTP referrer in Google Cloud Console:
//   - https://edudiaz17.github.io/*
//   - http://localhost:*/*
export const GOOGLE_MAPS_API_KEY = 'AIzaSyBiaioYABgNrwIm-j_H1VuPk2SN7CsbbFY';

// Google Gemini API Key - Handled via Supabase Edge Function (gemini-proxy)
// The key is stored as a secret in Supabase, NOT in client code.
export const GOOGLE_API_KEY = '';

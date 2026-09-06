import { createClient } from '@supabase/supabase-js'

const projectUrl = 'https://nqvpxopsiiagemumfbmc.supabase.co'
const publishableKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xdnB4b3BzaWlhZ2VtdW1mYm1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTQwNTcsImV4cCI6MjA5NTI3MDA1N30.VQYWGLALTxD84EksKwwUuVh5zfoAkCgenhMRXm3xdMs'

const url = import.meta.env.VITE_SUPABASE_URL || projectUrl
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || publishableKey

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient(url, key) : null

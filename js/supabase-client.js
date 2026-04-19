// js/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// DOPLŇTE SVOJE ÚDAJE ZO SUPABASE DASHBOARDU
const supabaseUrl = 'https://nfcguaztnjhaachquyzj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mY2d1YXp0bmpoYWFjaHF1eXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDg5NzAsImV4cCI6MjA5MjEyNDk3MH0.4W2x8pC1ak0DZK-kC9AGJIdsxPALi3d04LBk4W0IKls'

export const supabase = createClient(supabaseUrl, supabaseKey)

// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://esxzcafxafhqugjcyzge.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzeHpjYWZ4YWZocXVnamN5emdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0OTQ4MDgsImV4cCI6MjA2NTA3MDgwOH0.G5gTHK_d_HMWAVNuyTltScEzLjUnYsIqKKmAkIjN3Hc";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let supabaseClient = null;

const DEFAULT_SUPABASE_URL = 'https://duiwbdumovrreansqzpm.supabase.co';
const DEFAULT_SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aXdiZHVtb3ZycmVhbnNxenBtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODE5NjUwOCwiZXhwIjoyMTAzNzcyNTA4fQ.oFsFROH5mgLFl0SfHhV8m0a7nVuN_qwHT7HKSfBcWSY';

export function getSupabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_SERVICE_KEY;
  return { url, key };
}

export function initSupabase() {
  const { url, key } = getSupabaseConfig();

  if (!url || !key || url.includes('your-project.supabase.co')) {
    supabaseClient = null;
    return null;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    return supabaseClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
    supabaseClient = null;
    return null;
  }
}

export async function testSupabaseConnection(testUrl, testKey) {
  const url = testUrl || getSupabaseConfig().url;
  const key = testKey || getSupabaseConfig().key;

  if (!url || !key) {
    return {
      connected: false,
      message: 'Supabase URL and API Key are required'
    };
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false }
    });

    // Test query against pipeline_stages or settings
    const { data, error } = await client.from('settings').select('key').limit(1);

    if (error) {
      // If table doesn't exist yet, but authentication worked
      if (error.code === '42P01' || error.message.includes('relation "public.settings" does not exist')) {
        return {
          connected: true,
          tablesInitialized: false,
          message: 'Connected to Supabase! However, the database tables have not been created yet. Please run the supabase_schema.sql script in your Supabase SQL Editor.'
        };
      }

      return {
        connected: false,
        message: error.message || 'Failed to authenticate with Supabase'
      };
    }

    return {
      connected: true,
      tablesInitialized: true,
      message: 'Successfully connected to live Supabase backend!'
    };
  } catch (err) {
    return {
      connected: false,
      message: err.message || 'Could not reach Supabase host. Please check the project URL and internet connectivity.'
    };
  }
}

export function getSupabase() {
  if (!supabaseClient) {
    return initSupabase();
  }
  return supabaseClient;
}

import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://duiwbdumovrreansqzpm.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aXdiZHVtb3ZycmVhbnNxenBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxOTY1MDgsImV4cCI6MjEwMzc3MjUwOH0.XdaWshSFzpyH1j1b701Tr3e9LMcD5F6koro5iIH3jk0';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project.supabase.co')
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to subscribe to realtime messages for a conversation
export function subscribeToConversationMessages(conversationId, onNewMessage) {
  if (!supabase) return null;

  return supabase
    .channel(`conv_channel_${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        if (onNewMessage) onNewMessage(payload.new);
      }
    )
    .subscribe();
}

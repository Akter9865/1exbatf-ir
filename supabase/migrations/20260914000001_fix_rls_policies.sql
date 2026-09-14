-- ==============================================================================
-- FIX ROW LEVEL SECURITY & GRANT FULL PERMISSIONS TO ANON & AUTHENTICATED ROLES
-- ==============================================================================

-- 1. Grant schema usage and permissions to anon, authenticated, and service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 2. Define permissive policies on all CRM tables so anon / client / backend are never blocked
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'users',
    'pipeline_stages',
    'lead_sources',
    'contacts',
    'conversations',
    'messages',
    'message_attachments',
    'tags',
    'contact_tags',
    'notes',
    'quick_replies',
    'automations',
    'settings',
    'visitor_sessions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    
    -- Drop any existing conflicting policies
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'allow_all_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'public_read_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'public_insert_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'public_all_' || tbl, tbl);
    
    -- Create universal permissive policy allowing SELECT, INSERT, UPDATE, DELETE for public/anon/authenticated
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO public USING (true) WITH CHECK (true);', 'allow_all_' || tbl, tbl);
  END LOOP;
END $$;

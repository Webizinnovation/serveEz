import { createClient } from '@supabase/supabase-js';

// Use environment variables
const supabaseUrl = 'https://njkllbogrrqwxxgmsmyr.supabase.co';
// process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2xsYm9ncnJxd3h4Z21zeW15ciIsInJlZ2lvbl91cmwiOiJucmtnbGJvZ3JycXd4eGdrc215cmEiLCJpYXQiOjE3MjIwMjYxNjgsImV4cCI6MjAzNzYwMjE2OH0.00000000000000000000000000000000000000000000000000';
// process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Export typed version (for better type safety)
export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'; 
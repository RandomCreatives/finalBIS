const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

/**
 * Server-side Supabase client.
 *
 * Uses the SERVICE ROLE key, which bypasses Row Level Security. This is
 * correct for a trusted backend: every request is authorised by our own
 * JWT middleware before it reaches the database. The service key must
 * never be exposed to the browser.
 */
const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

module.exports = supabase;

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const sql = `
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'main_teacher', 'assistant_teacher', 'subject_teacher', 'store_manager'));
`;

async function main() {
    // Try to execute via PostgREST
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
        console.error('RPC exec_sql failed:', error);
        // Try alternative
        const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql });
        console.log('execute_sql result:', d2, e2);
    } else {
        console.log('Migration applied:', data);
    }
}

main().catch(console.error);
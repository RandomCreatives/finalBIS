const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');
const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);

(async () => {
    const { error } = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
CHECK (role IN ('admin','main_teacher','assistant_teacher','subject_teacher','store_manager'));`,
    });
    console.log('rpc result:', error ? error.message : 'ok');
})();

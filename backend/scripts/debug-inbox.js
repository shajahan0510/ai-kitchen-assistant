const path = require('path');
const dotenv = require('dotenv');
const envPath = path.resolve(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'PRESENT' : 'MISSING');
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'PRESENT' : 'MISSING');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function debugInbox() {
    console.log('--- STARTING DEBUG ---');
    try {
        const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, role');
        if (pErr) console.error('Profiles Error:', pErr);
        console.log('Profiles Found:', profiles ? profiles.length : 0);

        const { data: convs, error: cErr } = await supabase.from('conversations').select('*');
        if (cErr) console.error('Convs Error:', cErr);
        console.log('Conversations Found:', convs ? convs.length : 0);

        const { data: members, error: mErr } = await supabase
            .from('conversation_members')
            .select('*, user:user_id(username, role)');
        if (mErr) console.error('Members Error:', mErr);
        console.log('Memberships Found:', members ? members.length : 0);
        if (members) {
            members.forEach(m => console.log(`  - Conv ${m.conversation_id}, User ${m.user_id}, Role ${m.user?.role}`));
        }

    } catch (err) {
        console.error('FATAL ERROR:', err);
    }
}

debugInbox().then(() => console.log('--- DEBUG FINISHED ---'));

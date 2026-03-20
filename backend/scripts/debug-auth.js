require('dotenv').config();
const supabase = require('../config/supabase');

async function debugAdmin() {
    console.log('--- Auth System Debug ---');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

    try {
        // 1. Check Auth Users
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            console.error('Error listing users:', listError.message);
        } else {
            console.log(`Found ${users.length} users in Auth.`);
            const adminAuth = users.find(u => u.email === 'admin@kitchen.ai');
            if (adminAuth) {
                console.log('✅ admin@kitchen.ai exists in Auth.');
                console.log('   ID:', adminAuth.id);
                console.log('   Metadata:', adminAuth.user_metadata);
            } else {
                console.log('❌ admin@kitchen.ai NOT found in Auth.');
            }
        }

        // 2. Check Profiles table
        const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'admin@kitchen.ai')
            .single();

        if (profError) {
            console.log('❌ Profile NOT found or error:', profError.message);
        } else {
            console.log('✅ Profile found:');
            console.log('   Username:', profile.username);
            console.log('   Role:', profile.role);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

debugAdmin();

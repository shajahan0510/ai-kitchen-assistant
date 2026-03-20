require('dotenv').config();
const supabase = require('../config/supabase');

async function createAdmin() {
    console.log('🚀 Creating default admin user...');

    // 1. Create the user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'admin@kitchen.ai',
        password: 'admin123',
        email_confirm: true,
        user_metadata: {
            username: 'admin',
            role: 'admin'
        }
    });

    if (error) {
        if (error.message.includes('already registered')) {
            console.log('ℹ️ Admin user already exists in Auth. Updating role...');
            // If user exists, find them and ensure profile is correct
            const { data: users } = await supabase.auth.admin.listUsers();
            const admin = users.users.find(u => u.email === 'admin@kitchen.ai');
            if (admin) {
                await supabase.from('profiles').update({ role: 'admin' }).eq('id', admin.id);
            }
        } else {
            console.error('❌ Error creating admin:', error.message);
            return;
        }
    } else {
        console.log('✅ Admin user created in Auth:', data.user.id);
        // The trigger in schema.sql should handle public.profiles, but we'll double-check
        setTimeout(async () => {
            const { error: profError } = await supabase
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', data.user.id);
            if (profError) console.error('❌ Error updating profile role:', profError.message);
            else console.log('✅ Profile role set to admin.');
        }, 1000);
    }

    console.log('\n--- Admin Details ---');
    console.log('Email: admin@kitchen.ai');
    console.log('Password: admin123');
    console.log('--------------------');
}

createAdmin();

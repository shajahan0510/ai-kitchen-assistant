require('dotenv').config();
const supabase = require('../config/supabase');

async function resetAdmin() {
    console.log('--- Forced Admin Reset ---');

    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const admin = users.find(u => u.email === 'admin@kitchen.ai');
        if (!admin) {
            console.log('❌ admin@kitchen.ai NOT found in Auth. Creating now...');
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: 'admin@kitchen.ai',
                password: 'admin123',
                email_confirm: true,
                user_metadata: { role: 'admin', username: 'admin' }
            });
            if (createError) throw createError;
            console.log('✅ Admin user CREATED. ID:', newUser.user.id);
        } else {
            console.log('✅ admin@kitchen.ai found in Auth. ID:', admin.id);
            console.log('   Confirmed at:', admin.email_confirmed_at);
            console.log('   Last sign in:', admin.last_sign_in_at);

            console.log('   Force resetting password to "admin123"...');
            const { data: updUser, error: updError } = await supabase.auth.admin.updateUserById(
                admin.id,
                { password: 'admin123', email_confirm: true }
            );

            if (updError) throw updError;
            console.log('✅ Password reset successful.');
        }

        // Ensure profile exists and is admin
        const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'admin@kitchen.ai')
            .single();

        if (profError) {
            console.log('❌ Profile missing. Creating profile...');
            const adminId = admin?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === 'admin@kitchen.ai').id;
            const { error: insError } = await supabase.from('profiles').insert({
                id: adminId,
                email: 'admin@kitchen.ai',
                username: 'admin',
                role: 'admin'
            });
            if (insError) throw insError;
            console.log('✅ Profile created with admin role.');
        } else {
            console.log('✅ Profile found. Current role:', profile.role);
            if (profile.role !== 'admin') {
                await supabase.from('profiles').update({ role: 'admin' }).eq('id', profile.id);
                console.log('✅ Role updated to admin.');
            }
        }

    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

resetAdmin();

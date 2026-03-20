const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const logPath = path.join(__dirname, 'auth_test_results.txt');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logPath, msg + '\n');
}

async function runTest() {
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    log('--- Forced Auth Test ---');
    log('Timestamp: ' + new Date().toISOString());
    log('CWD: ' + process.cwd());
    log('SUPABASE_URL: ' + process.env.SUPABASE_URL);
    log('SUPABASE_SERVICE_KEY length: ' + (process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0));

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    try {
        log('\n1. Checking Auth Users...');
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            log('❌ Error listing users: ' + listError.message);
        } else {
            log(`✅ Found ${users.length} users in Auth.`);
            users.forEach(u => log(`   - ${u.email} (${u.id})`));

            const admin = users.find(u => u.email === 'admin@kitchen.ai');
            if (admin) {
                log('✅ admin@kitchen.ai is in Auth table.');
            } else {
                log('❌ admin@kitchen.ai NOT in Auth table.');

                log('\n2. Attempting to CREATE admin user...');
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: 'admin@kitchen.ai',
                    password: 'admin123',
                    email_confirm: true,
                    user_metadata: { role: 'admin', username: 'admin' }
                });

                if (createError) {
                    log('❌ Create Error: ' + createError.message);
                } else {
                    log('✅ Admin user CREATED. ID: ' + newUser.user.id);
                }
            }
        }

        log('\n3. Verifying Profile role...');
        const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'admin@kitchen.ai')
            .single();

        if (profError) {
            log('❌ Profile Error: ' + profError.message);
        } else {
            log('✅ Profile found. Role: ' + profile.role);
            if (profile.role !== 'admin') {
                log('   Updating role to admin...');
                const { error: updError } = await supabase
                    .from('profiles')
                    .update({ role: 'admin' })
                    .eq('id', profile.id);
                if (updError) log('❌ Role update failed: ' + updError.message);
                else log('✅ Role updated successfully.');
            }
        }

    } catch (err) {
        log('❌ UNEXPECTED ERROR: ' + err.stack);
    }

    log('\n--- Test Complete ---');
}

runTest();

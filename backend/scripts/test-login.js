require('dotenv').config();
const supabase = require('../config/supabase');

async function testLogin() {
    console.log('--- Sign In Test ---');
    console.log('Email: admin@kitchen.ai');

    // Test with service role key client (current config)
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@kitchen.ai',
        password: 'admin123'
    });

    if (error) {
        console.error('❌ Login failed with service key client:', error.message);
    } else {
        console.log('✅ Login successful with service key client!');
        console.log('   Access Token starts with:', data.session.access_token.substring(0, 20));
    }
}

testLogin();

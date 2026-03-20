const fetch = require('node-fetch'); // Using whatever is available or global fetch if node 18+
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testConnection() {
    console.log('Testing connection to:', process.env.SUPABASE_URL);
    try {
        const start = Date.now();
        const res = await fetch(process.env.SUPABASE_URL, { method: 'HEAD', timeout: 5000 });
        console.log(`Fetch successful (${Date.now() - start}ms). Status:`, res.status);
    } catch (e) {
        console.error('Fetch failed:', e.message);
        if (e.cause) console.error('Cause:', e.cause.message);
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    try {
        console.log('Testing Supabase client query...');
        const { data, error } = await supabase.from('recipes').select('count', { count: 'exact', head: true });
        if (error) throw error;
        console.log('Query successful! Count:', data);
    } catch (e) {
        console.error('Supabase client failed:', e.message);
    }
}

testConnection();

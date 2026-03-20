const supabase = require('./backend/config/supabase');

async function setupStorage() {
    console.log('--- Supabase Storage Setup ---');

    try {
        // Check if 'avatars' bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) throw listError;

        const avatarBucket = buckets.find(b => b.name === 'avatars');

        if (!avatarBucket) {
            console.log("Bucket 'avatars' not found. Creating it...");
            const { data, error: createError } = await supabase.storage.createBucket('avatars', {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
                fileSizeLimit: 5242880 // 5MB
            });
            if (createError) throw createError;
            console.log("Bucket 'avatars' created successfully! ✅");
        } else {
            console.log("Bucket 'avatars' already exists. ✅");
        }

        console.log('\nVerifying bucket policy...');
        // Note: Logic to check/create policies via JS client is limited. 
        // Usually handled via SQL, but 'public: true' on creation handles basic GET access.

    } catch (err) {
        console.error('Error during storage setup:', err.message);
    }
}

setupStorage();

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function retrieveBenchmark() {
  const profile_id = 'MM-20260522-pmhpe7e8';
  
  console.log(`[Retrieving] Profile: ${profile_id}\n`);
  
  // Retrieve canonical JSON
  const profile_key = `vault:profile:${profile_id}`;
  const canonical_data = await redis.get(profile_key);
  
  if (!canonical_data) {
    console.error(`❌ Profile not found in Vault: ${profile_key}`);
    process.exit(1);
  }
  
  const canonical = JSON.parse(canonical_data);
  console.log(`✅ Retrieved canonical JSON (${canonical_data.length} bytes)`);
  console.log(`   Email: ${canonical.email}`);
  console.log(`   Profile ID: ${canonical.profile_id}`);
  console.log(`   Created: ${canonical.created_at}\n`);
  
  // Retrieve markdown if exists
  const markdown_key = `vault:markdown:${profile_id}`;
  const markdown_data = await redis.get(markdown_key);
  
  if (markdown_data) {
    console.log(`✅ Retrieved markdown (${markdown_data.length} bytes)\n`);
  } else {
    console.log(`⚠️  Markdown export not yet in Vault (will generate from canonical)\n`);
  }
  
  return { canonical, markdown: markdown_data };
}

const result = await retrieveBenchmark();
redis.disconnect();

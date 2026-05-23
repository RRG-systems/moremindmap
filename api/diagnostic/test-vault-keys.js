/**
 * Test what vault keys exist for Pamela
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function testVault() {
  try {
    console.log('[TEST] Checking vault keys for Pamela\n');

    // Known profile ID
    const profile_id = 'MM-20260523-bm6knd3p';
    const email = 'me***@icloud.com'; // from job metadata
    const email_exact = 'pamela@icloud.com'; // guess

    // Test keys
    const keys_to_test = [
      `vault:profile:${profile_id}`,
      `vault:markdown:${profile_id}`,
      `vault:index:date:2026-05-23`,
      `vault:index:email:${email_exact.toLowerCase()}`,
      'vault:metadata:count',
      `vault:profile:*`
    ];

    for (const key of keys_to_test) {
      try {
        if (key.includes('*')) {
          const matches = await redis.keys(key);
          console.log(`\n${key}:`);
          console.log(`  Found ${matches.length} keys`);
          if (matches.length > 0 && matches.length < 20) {
            matches.forEach(k => console.log(`    - ${k}`));
          }
        } else {
          const exists = await redis.exists(key);
          const type = exists ? await redis.type(key) : 'N/A';
          const ttl = exists ? await redis.ttl(key) : 'N/A';
          
          console.log(`\n${key}:`);
          console.log(`  Exists: ${exists === 1 ? 'YES' : 'NO'}`);
          if (exists === 1) {
            console.log(`  Type: ${type}`);
            console.log(`  TTL: ${ttl === -1 ? 'never' : ttl === -2 ? 'expired' : ttl}`);
            
            if (type === 'string') {
              const data = await redis.get(key);
              if (data.length > 500) {
                console.log(
                  `  Value: ${data.substring(0, 200)}... (${data.length} bytes)`
                );
              } else {
                console.log(`  Value: ${data}`);
              }
            } else if (type === 'set') {
              const members = await redis.smembers(key);
              console.log(`  Members (${members.length}): ${members.join(', ')}`);
            }
          }
        }
      } catch (err) {
        console.log(`\n${key}:`);
        console.log(`  Error: ${err.message}`);
      }
    }

    // Try to find recent profiles by date index
    console.log('\n---\n[RECENT PROFILES]');
    const recent_dates = [
      '2026-05-23',
      '2026-05-22',
      '2026-05-21'
    ];

    for (const date of recent_dates) {
      const date_key = `vault:index:date:${date}`;
      const exists = await redis.exists(date_key);
      if (exists === 1) {
        const profiles = await redis.smembers(date_key);
        console.log(`\n${date}: ${profiles.length} profiles`);
        profiles.forEach(p => console.log(`  - ${p}`));
      }
    }

  } catch (error) {
    console.error('[ERROR]', error.message);
  } finally {
    redis.disconnect();
  }
}

testVault();

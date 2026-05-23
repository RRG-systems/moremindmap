/**
 * Check job diagnostics to see what profile_id was actually generated
 */

import https from 'https';

const PRODUCTION_API = 'https://moremindmap.com';
const JOB_ID = 'e40b8bad-2f44-43c3-b01a-76fd4439db11';

function fetchProduction(path) {
  return new Promise((resolve, reject) => {
    const url = `${PRODUCTION_API}${path}`;
    console.log(`[FETCH] ${url}\n`);

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (err) {
            resolve({ status: res.statusCode, data: data });
          }
        });
      })
      .on('error', reject);
  });
}

async function checkDiagnostics() {
  try {
    // Fetch the job data directly from Redis using a diagnostic endpoint
    // Or try to get it from the status endpoint

    const statusResult = await fetchProduction(
      `/api/moremindmap/status?job_id=${JOB_ID}`
    );

    console.log(`Status: ${statusResult.status}\n`);

    // The HTML response might have the job JSON embedded
    // Let's look for job data in the response

    if (typeof statusResult.data === 'string') {
      // It's HTML, extract JSON if present
      const jsonMatch = statusResult.data.match(/window\.__DATA__\s*=\s*({.*?});/s);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          console.log('[JOB DATA FOUND]');
          console.log(JSON.stringify(data, null, 2).substring(0, 2000));
        } catch (err) {
          console.log('[Could not parse embedded JSON]');
        }
      }

      // Also try to find the profile_id in the HTML
      const profileIdMatch = statusResult.data.match(/"profile_id"\s*:\s*"([^"]+)"/);
      if (profileIdMatch) {
        console.log(`\n✓ Found profile_id in HTML: ${profileIdMatch[1]}`);
      }

      // Look for canonical_profile_id
      const canonicalIdMatch = statusResult.data.match(
        /"canonical_profile_id"\s*:\s*"([^"]+)"/
      );
      if (canonicalIdMatch) {
        console.log(`✓ Found canonical_profile_id in HTML: ${canonicalIdMatch[1]}`);
      }

      // Look for diagnostics section
      const diagMatch = statusResult.data.match(
        /"canonical_diagnostics"\s*:\s*({[^}]*})/
      );
      if (diagMatch) {
        try {
          const diag = JSON.parse(diagMatch[1]);
          console.log(`\n[CANONICAL DIAGNOSTICS]`);
          console.log(JSON.stringify(diag, null, 2));
        } catch (err) {
          console.log(`Could not parse diagnostics`);
        }
      }
    }
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

checkDiagnostics();

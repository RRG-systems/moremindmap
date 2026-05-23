/**
 * Test script to trigger profile generation
 * This will create a new assessment job that runs through canonical generation
 * with the latest instrumented code
 */

import https from 'https';

const PRODUCTION_API = 'https://moremindmap.com';

function postToProduction(path, body) {
  return new Promise((resolve, reject) => {
    const url = `${PRODUCTION_API}${path}`;
    console.log(`\n[POST] ${url}`);

    const postData = JSON.stringify(body);

    const options = {
      hostname: 'moremindmap.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
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
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function generateTestProfile() {
  try {
    console.log(
      `[TEST] Generating new profile to test instrumented vault save\n`
    );

    // Create assessment submission
    const testData = {
      email: `test-${Date.now()}@example.com`,
      full_name: 'Test User',
      answers: {
        'q-1': 'Testing profile generation',
        'q-2': 'Answer 2',
        'q-3': 'Answer 3',
        'q-4': 'Answer 4',
        'q-5': 'Answer 5',
        'q-6': 'Answer 6',
        'q-7': 'Answer 7',
        'q-8': 'Answer 8',
        'q-9': 'Answer 9',
        'q-10': 'Answer 10',
        'q-11': 'Answer 11',
        'q-12': 'Answer 12',
        'q-13': 'Answer 13',
        'q-14': 'Answer 14',
        'q-15': 'Answer 15',
        'q-16': 'Answer 16',
        'q-17': 'Answer 17',
        'q-18': 'Answer 18',
        'q-19': 'Answer 19',
        'q-20': 'Answer 20',
        'q-21': 'Answer 21',
        'q-22': 'Answer 22',
        'q-23': 'Answer 23',
        'q-24': 'Answer 24',
        'q-25': 'Answer 25',
        'q-26': 'Answer 26',
        'q-27': 'Answer 27',
        'q-28': 'Answer 28'
      },
      metadata: {
        person_name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        organization: {
          company: 'Test Corp',
          role_title: 'Tester',
          department: 'QA'
        }
      }
    };

    console.log('Submitting assessment...');
    const submitResult = await postToProduction('/api/moremindmap/start', {
      email: testData.email,
      assessment_version: 'mini-v2',
      payload: {
        answers: testData.answers,
        metadata: testData.metadata
      }
    });

    if (submitResult.status !== 200 && submitResult.status !== 201) {
      console.error('Submit failed:', submitResult.status, submitResult.data);
      process.exit(1);
    }

    console.log(`✓ Assessment submitted`);

    const jobId = submitResult.data.job_id;
    console.log(`Job ID: ${jobId}`);

    // Wait for job to complete
    console.log('\nWaiting for job to complete...');
    await new Promise((r) => setTimeout(r, 3000));

    // Check job status
    console.log('Checking job status...');
    const statusResult = await postToProduction('/api/moremindmap/status', {
      job_id: jobId
    });

    if (statusResult.status === 200 && statusResult.data.success) {
      console.log(`✓ Job completed`);
    }

    // Now check the diagnostics
    console.log(
      '\nRetrieving vault save diagnostics from inspect-vault-save endpoint...\n'
    );
    await new Promise((r) => setTimeout(r, 2000));

    const inspectResult = await postToProduction(
      '/api/diagnostic/inspect-vault-save?limit=1',
      {}
    );

    console.log(JSON.stringify(inspectResult.data, null, 2));
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

generateTestProfile();

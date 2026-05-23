/**
 * test-benchmark-render.js
 * 
 * Test runner: Generate full V1 report from benchmark profile MM-20260523-mqlev9c9
 * 
 * Usage: node test-benchmark-render.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import generateProfileReport from './generate-profile-report.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('=== Canonical → PDF V1 Renderer Test ===\n');

  const profileID = 'MM-20260523-mqlev9c9';
  const benchmarkDir = path.join(
    __dirname,
    '..',
    'benchmark_profiles',
    profileID
  );
  const canonicalPath = path.join(benchmarkDir, 'CANONICAL_PROFILE.json');
  const outputDir = path.join(benchmarkDir, 'pdf_v1');

  // Step 1: Verify benchmark profile exists
  console.log(`[1/4] Verifying benchmark profile...`);
  if (!fs.existsSync(canonicalPath)) {
    console.error(`❌ Benchmark profile not found: ${canonicalPath}`);
    process.exit(1);
  }
  console.log(`✓ Found: ${canonicalPath}`);

  // Step 2: Load canonical dossier
  console.log(`\n[2/4] Loading canonical dossier...`);
  const canonicalDossier = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
  console.log(`✓ Loaded: ${canonicalDossier.profile_id}`);
  console.log(`  Person: ${canonicalDossier.person_name}`);
  console.log(`  Company: ${canonicalDossier.company_name}`);

  // Step 3: Generate report
  console.log(`\n[3/4] Generating V1 report...`);
  const result = await generateProfileReport(canonicalDossier, outputDir, {
    generatePDF: true,
  });

  if (!result.success) {
    console.error(`❌ Report generation failed:`);
    result.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`✓ Report generated in ${result.duration_ms}ms`);
  result.steps.forEach((step) => console.log(`  ✓ ${step}`));

  // Step 4: Verify outputs
  console.log(`\n[4/4] Verifying output files...`);

  const files = [
    { name: 'HTML Report', path: result.files.html },
    { name: 'Mapping Report', path: result.files.mappingReport },
    { name: 'Verification Report', path: result.files.verification },
    { name: 'PDF Report', path: result.files.pdf, optional: true },
  ];

  let allValid = true;
  files.forEach(({ name, path: filePath, optional }) => {
    if (filePath && fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      console.log(`✓ ${name}: ${path.basename(filePath)} (${size} bytes)`);
    } else if (optional) {
      console.log(`⚠ ${name}: Skipped (optional dependency unavailable)`);
    } else {
      console.log(`❌ ${name}: NOT FOUND`);
      allValid = false;
    }
  });

  if (!allValid) {
    console.error(`\n❌ Some output files missing`);
    process.exit(1);
  }

  // Step 5: Summary
  console.log(`\n=== Summary ===`);
  console.log(`Profile ID: ${canonicalDossier.profile_id}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log(`Files Generated: ${Object.values(result.files).filter(Boolean).length}`);
  console.log(`Status: ✓ SUCCESS`);

  if (result.warnings.length > 0) {
    console.log(`\nWarnings:`);
    result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }

  console.log(`\nNext Steps:`);
  console.log(`1. Open ${path.basename(result.files.html)} in browser to inspect HTML`);
  if (result.files.pdf) {
    console.log(`2. Open ${path.basename(result.files.pdf)} to verify PDF rendering`);
  }
  console.log(`3. Review ${path.basename(result.files.mappingReport)} for field mappings`);
  console.log(`4. Check ${path.basename(result.files.verification)} for full verification`);

  process.exit(0);
}

// Run test
runTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

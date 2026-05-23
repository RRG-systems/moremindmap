/**
 * generate-report-html.js
 * 
 * Generate HTML report from canonical dossier
 * Used for profile retrieval flow
 * 
 * POST /api/moremindmap/generate-report-html
 * Body: { canonical_dossier: {...} }
 * 
 * Returns: { html: "<!DOCTYPE html>..." }
 */

// We need to import the render functions from the renderer module
// These are normally backend-only, but we can reuse them server-side

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import renderer functions
// Note: These are in the project root, not node_modules
import canonicalToReportMapper from '../../renderer/canonical-to-report-mapper.js';
import renderToHTML from '../../renderer/render-to-html.js';

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { canonical_dossier } = req.body;

  if (!canonical_dossier) {
    return res.status(400).json({ error: 'canonical_dossier required' });
  }

  try {
    // Map canonical dossier to report content
    const reportContent = canonicalToReportMapper(canonical_dossier);

    // Render to HTML
    const html = renderToHTML(reportContent);

    // Return HTML (frontend will display it)
    return res.status(200).json({
      success: true,
      html: html,
      profile_id: canonical_dossier.profile_id,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[GENERATE REPORT HTML] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate report HTML',
      message: error.message,
    });
  }
}

/**
 * render-to-html.js
 * 
 * Builds complete HTML report from reportContent object
 * Uses existing mini-v2 templates
 * 
 * Generic renderer: works with ANY reportContent, not tied to specific profiles
 * Input: reportContent object (from canonical-to-report-mapper)
 * Output: complete HTML document
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const renderToHTML = (reportContent) => {
  // Load template directory
  const templateDir = path.join(
    __dirname,
    '..',
    'templates',
    'mini-v2'
  );

  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  // Load all page templates
  const pages = {
    cover: loadTemplate(templateDir, 'page01-cover.html'),
    operatingSystem: loadTemplate(templateDir, 'page02-operating-system-map.html'),
    executiveSummary: loadTemplate(templateDir, 'page03-executive-summary.html'),
    operatingPattern: loadTemplate(templateDir, 'page04-operating-pattern.html'),
    decisionArchitecture: loadTemplate(templateDir, 'page05-decision-architecture.html'),
    communicationStyle: loadTemplate(templateDir, 'page06-communication-style.html'),
    systemUnderStrain: loadTemplate(templateDir, 'page07-system-under-strain.html'),
    environment: loadTemplate(templateDir, 'page08-operating-environment-fit.html'),
    facilitatorNotes: loadTemplate(templateDir, 'page09-facilitator-notes.html'),
    profileUnlocks: loadTemplate(templateDir, 'page10-full-profile-unlocks-dna.html'),
  };

  // Load CSS (if exists)
  const cssPath = path.join(__dirname, '..', 'styles', 'report.css');
  const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

  // Build HTML structure
  const html = buildHTMLDocument(pages, reportContent, cssContent);

  return html;
};

/**
 * Load and return template file
 */
function loadTemplate(templateDir, filename) {
  const filepath = path.join(templateDir, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`Warning: Template not found: ${filepath}`);
    return '';
  }
  return fs.readFileSync(filepath, 'utf8');
}

/**
 * Build complete HTML document with all pages
 */
function buildHTMLDocument(pages, reportContent, cssContent) {
  const renderedPages = Object.entries(pages).map(([key, template]) => {
    return renderTemplate(template, reportContent);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Behavioral Operating Profile - ${reportContent.person_name || 'Assessment'}</title>
  <style>
    /* Base Styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.6;
    }

    body {
      padding: 0;
      margin: 0;
    }

    /* Page Container */
    .mmm-page {
      page-break-after: always;
      width: 8.5in;
      height: 11in;
      padding: 0.75in;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
      margin: 0 auto;
      border: 1px solid #e0e0e0;
    }

    @page {
      size: letter;
      margin: 0;
      padding: 0;
    }

    @media print {
      .mmm-page {
        page-break-after: always;
        margin: 0;
        border: none;
      }
    }

    /* Page Structure */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #666;
      margin-bottom: 0.5in;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 0.25in;
    }

    .page-main {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.7rem;
      color: #999;
      border-top: 1px solid #e0e0e0;
      padding-top: 0.25in;
      margin-top: 0.5in;
    }

    .footer-right {
      display: flex;
      align-items: center;
      gap: 0.5in;
    }

    .page-number-box {
      background: #1a1a1a;
      color: #fff;
      padding: 0.15in 0.25in;
      border-radius: 3px;
      font-weight: 600;
    }

    /* Cover Page Specific */
    .cover-page {
      background: linear-gradient(135deg, #f8f8f8 0%, #ffffff 100%);
    }

    .cover-title-section {
      text-align: center;
      margin-bottom: 0.5in;
      position: relative;
    }

    .cover-main-title {
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 0.25in;
      color: #1a1a1a;
    }

    .cover-subtitle {
      font-size: 0.95rem;
      color: #666;
      max-width: 90%;
      margin: 0 auto;
      line-height: 1.5;
    }

    .gold-underline {
      width: 80px;
      height: 3px;
      background: #d4af37;
      margin: 0.25in auto 0.5in;
    }

    .gold-underline-small {
      width: 40px;
      height: 2px;
      background: #d4af37;
      margin: 0.1in 0 0.2in;
    }

    /* Profile Signature Box */
    .profile-signature-box {
      background: #f8f8f8;
      border-left: 4px solid #d4af37;
      padding: 0.25in 0.3in;
      margin-bottom: 0.3in;
      border-radius: 3px;
    }

    .signature-heading {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #999;
      margin-bottom: 0.1in;
    }

    .signature-code {
      font-size: 1.3rem;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 0.1in;
      font-family: 'Monaco', 'Courier', monospace;
    }

    .signature-interpretation {
      font-size: 0.85rem;
      color: #555;
      line-height: 1.4;
    }

    /* DNA Decoder Grid */
    .dna-decoder-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.2in;
      margin-top: 0.15in;
    }

    .dna-item {
      background: #f8f8f8;
      padding: 0.15in;
      border-radius: 3px;
      border: 1px solid #e0e0e0;
    }

    .dna-code {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #d4af37;
      font-family: 'Monaco', monospace;
    }

    .dna-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #1a1a1a;
      margin-top: 0.05in;
    }

    .dna-explanation {
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.05in;
      line-height: 1.3;
    }

    /* Core Edge Box */
    .core-edge-box {
      background: #f8f8f8;
      border-left: 4px solid #d4af37;
      padding: 0.25in 0.3in;
      margin-bottom: 0.3in;
      border-radius: 3px;
      display: flex;
      gap: 0.2in;
    }

    .core-edge-heading {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #999;
      margin-bottom: 0.1in;
    }

    .core-edge-text {
      font-size: 0.85rem;
      color: #555;
      line-height: 1.4;
    }

    /* Metadata Row */
    .cover-metadata-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.15in;
      margin-top: 0.25in;
    }

    .metadata-box {
      background: #f8f8f8;
      border-radius: 3px;
      padding: 0.15in;
      display: flex;
      gap: 0.1in;
      border: 1px solid #e0e0e0;
    }

    .metadata-icon {
      font-size: 1.2rem;
    }

    .metadata-content {
      flex: 1;
    }

    .metadata-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #999;
    }

    .metadata-value {
      font-size: 0.85rem;
      font-weight: 600;
      color: #1a1a1a;
      margin-top: 0.05in;
    }

    /* Content Sections */
    h2 {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 0.2in;
      color: #1a1a1a;
      border-bottom: 2px solid #d4af37;
      padding-bottom: 0.1in;
    }

    h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-top: 0.2in;
      margin-bottom: 0.15in;
      color: #1a1a1a;
    }

    p {
      font-size: 0.9rem;
      margin-bottom: 0.15in;
      line-height: 1.5;
      color: #333;
    }

    ul, ol {
      margin-left: 0.25in;
      margin-bottom: 0.15in;
      font-size: 0.9rem;
    }

    li {
      margin-bottom: 0.1in;
      line-height: 1.4;
    }

    /* Narrative Content */
    .narrative-section {
      margin-bottom: 0.2in;
    }

    .narrative-section-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #d4af37;
      margin-bottom: 0.1in;
    }

    .narrative-content {
      font-size: 0.85rem;
      color: #444;
      line-height: 1.5;
      margin-bottom: 0.15in;
    }

    /* Highlight Box */
    .highlight-box {
      background: #f8f8f8;
      border-left: 4px solid #d4af37;
      padding: 0.2in 0.25in;
      margin: 0.15in 0;
      border-radius: 3px;
      font-size: 0.85rem;
      line-height: 1.4;
    }

    /* Dimension Display */
    .dimension-badge {
      display: inline-block;
      background: #d4af37;
      color: #1a1a1a;
      padding: 0.08in 0.15in;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.1in;
      margin-bottom: 0.05in;
    }

    /* Print Styles */
    @media print {
      body {
        background: white;
      }

      .mmm-page {
        margin: 0;
        padding: 0.75in;
        border: none;
        box-shadow: none;
        page-break-after: always;
      }

      .page-break {
        page-break-after: always;
      }
    }

    /* M+ Icon */
    .m-icon {
      font-weight: 700;
      color: #d4af37;
      font-size: 0.9rem;
    }
  </style>
  ${cssContent ? `<style>${cssContent}</style>` : ''}
</head>
<body>
  <div class="report-container">
    ${renderedPages.join('\n')}
  </div>
</body>
</html>`;
}

/**
 * Simple template renderer: replace {{ variable }} with values
 * Handles both {{ variable }} (with spaces) and {{variable}} (no spaces)
 */
function renderTemplate(template, data) {
  if (!template) return '';

  let rendered = template;

  // Replace all {{ variable }} placeholders (with optional spaces)
  rendered = rendered.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = data[key];

    if (value === undefined || value === null) {
      return ''; // Return empty string for undefined/null
    }

    if (Array.isArray(value)) {
      // For arrays, join with line breaks
      return value.map((item) => {
        if (typeof item === 'string') {
          return `<li>${escapeHTML(item)}</li>`;
        } else if (typeof item === 'object' && item.pattern) {
          return `<li><strong>${escapeHTML(item.pattern)}</strong>: ${escapeHTML(item.manifestation || '')}</li>`;
        }
        return '';
      }).join('');
    }

    if (typeof value === 'object') {
      // For objects, try to extract useful properties
      if (value.description) {
        return escapeHTML(value.description);
      }
      return escapeHTML(JSON.stringify(value));
    }

    return escapeHTML(String(value));
  });

  return rendered;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default renderToHTML;

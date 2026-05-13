import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_DIR = path.resolve(__dirname, '../templates/mini-v2');

const PAGE_FILES = [
 'page01-cover.html',
 'page02-operating-system-map.html',
 'page03-executive-summary.html',
 'page04-operating-pattern.html',
 'page05-decision-architecture.html',
 'page06-communication-style.html',
 'page07-system-under-strain.html',
 'page08-operating-environment-fit.html',
 'page09-facilitator-notes.html',
 'page10-full-profile-unlocks-dna.html'
];

function escapeHtml(value = '') {
 return String(value)
 .replaceAll('&', '&amp;')
 .replaceAll('<', '&lt;')
 .replaceAll('>', '&gt;')
 .replaceAll('"', '&quot;')
 .replaceAll("'", '&#039;');
}

function stripTemplateComments(html) {
 return html.replace(/\{#[\s\S]*?#\}/g, '');
}

function replacePlaceholders(template, data) {
 return template.replace(/\{\{([^}]+)\}\}/g, (_, rawKey) => {
 const key = rawKey.trim();
 if (Object.prototype.hasOwnProperty.call(data, key)) {
 return escapeHtml(data[key]);
 }
 return `{{${key}}}`;
 });
}

export async function generateMiniV2HTML(data = {}) {
 const pages = [];

 for (const file of PAGE_FILES) {
 const filePath = path.join(TEMPLATE_DIR, file);
 const template = await fs.readFile(filePath, 'utf8');
 pages.push(stripTemplateComments(replacePlaceholders(template, data)));
 }

 const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>MORE MindMap Mini Profile V2</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
/* Shared CSS System for Mini V2 - Polished for Anchor Pages */

/* Typography */
body {
  font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  line-height: 1.7;
  color: #2c2c2c;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
}

h1, h2, h3 {
  margin-top: 0;
  letter-spacing: -0.03em;
  color: #0b2a4a;
  font-weight: 700;
}

.page-title {
  font-size: 48px;
  font-weight: 800;
  margin-bottom: 16px;
  color: #0b2a4a;
}

.subtitle {
  font-size: 20px;
  font-weight: 400;
  color: #666;
  margin-bottom: 32px;
  line-height: 1.5;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #777;
  margin-bottom: 12px;
}

.card-heading {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 10px;
  color: #222;
}

.card-body {
  font-size: 14px;
  font-weight: 400;
  color: #444;
}

/* Page Shell */
.mmm-page {
  width: 8.5in;
  min-height: 11in;
  margin: 30px auto;
  background-color: #fff;
  padding: 0.85in 0.75in;
  box-shadow: 0 2px 20px rgba(0,0,0,0.12);
  position: relative;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48px;
  padding-bottom: 14px;
  border-bottom: 2px solid #e0e0e0;
}

.header-left, .header-right {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #555;
}

/* Dividers and Accents */
.gold-accent-bar {
  width: 60px;
  height: 5px;
  background-color: #D4AF37;
  margin-top: 8px;
  margin-bottom: 24px;
  border-radius: 2px;
}

.navy-divider {
  height: 2px;
  background-color: #0b2a4a;
  margin: 32px 0;
}

/* Card System Enhancements */
.mmm-card {
  border: 1.5px solid #d0d0d0;
  border-radius: 10px;
  padding: 26px;
  background: #fafafa;
  margin-bottom: 24px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.08);
}

.three-card-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 40px;
}

.development-priority-banner {
  background-color: #f7f7f7;
  padding: 24px 28px;
  border-radius: 10px;
  border-left: 6px solid #D4AF37;
  margin-top: 40px;
}

.development-priority-banner .card-heading {
  color: #0b2a4a;
  font-size: 18px;
}

/* Grid System */
.mmm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

/* Footer */
.page-footer {
  position: absolute;
  left: 0.6in;
  right: 0.6in;
  bottom: 0.35in;
  font-size: 10px;
  color: #777;
  border-top: 1px solid #ddd;
  padding-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.m-icon {
  font-weight: bold;
  color: #D4AF37; /* Gold accent */
  margin-right: 5px;
}

.page-number-box {
  background-color: #eee;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
  color: #333;
}

/* Specific Page Enhancements */

/* Page 1 Cover Enhancements */
.cover-page .page-main {
  position: relative;
}

.cover-title-section {
  position: relative;
  text-align: left;
  margin-bottom: 50px;
  padding-top: 30px;
}

.cover-background-arcs {
  position: absolute;
  top: 0;
  right: -60px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, transparent 30%, rgba(220,220,220,0.15) 35%, transparent 40%, rgba(220,220,220,0.12) 45%, transparent 50%, rgba(220,220,220,0.08) 55%, transparent 60%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.cover-main-title {
  font-size: 72px;
  font-weight: 800;
  line-height: 1.1;
  color: #2c2c2c;
  margin-bottom: 20px;
  letter-spacing: -0.04em;
  position: relative;
  z-index: 1;
}

.gold-underline {
  width: 100px;
  height: 4px;
  background: #D4AF37;
  margin-bottom: 20px;
}

.gold-underline-small {
  width: 60px;
  height: 3px;
  background: #D4AF37;
  margin-bottom: 18px;
}

.cover-subtitle {
  font-size: 16px;
  line-height: 1.6;
  color: #666;
  max-width: 480px;
  margin: 0;
}

.profile-signature-box {
  background: #2c2c2c;
  border-radius: 12px;
  padding: 32px 38px;
  margin-bottom: 32px;
  display: flex;
  gap: 20px;
}

.signature-accent-bar {
  width: 5px;
  background: #D4AF37;
  border-radius: 2px;
  flex-shrink: 0;
}

.signature-content {
  flex: 1;
}

.signature-heading {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #D4AF37;
  margin-bottom: 12px;
}

.signature-code {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 14px;
  letter-spacing: 0.02em;
}

.signature-interpretation {
  font-size: 13px;
  line-height: 1.6;
  color: #ddd;
}

.profile-dna-box {
  background: #fafafa;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 32px 36px;
  margin-bottom: 32px;
}

.dna-heading {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2c2c2c;
  margin-bottom: 8px;
}

.dna-decoder-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 28px;
  margin-top: 20px;
}

.dna-item {
  display: flex;
  flex-direction: column;
}

.dna-code {
  font-size: 13px;
  font-weight: 700;
  color: #0b2a4a;
  margin-bottom: 4px;
}

.dna-label {
  font-size: 12px;
  font-weight: 700;
  color: #555;
  margin-bottom: 6px;
}

.dna-explanation {
  font-size: 11px;
  line-height: 1.5;
  color: #666;
}

.core-edge-box {
  background: #f5f5f5;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 28px 32px;
  margin-bottom: 40px;
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.core-edge-icon-container {
  flex-shrink: 0;
}

.core-edge-icon {
  width: 100px;
  height: 100px;
  border: 2px solid #c0c0c0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #999;
  background: #fff;
}

.core-edge-content {
  flex: 1;
}

.core-edge-heading {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #2c2c2c;
  margin-bottom: 6px;
}

.core-edge-text {
  font-size: 14px;
  line-height: 1.65;
  color: #444;
  margin: 0;
}

.cover-metadata-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 40px;
}

.metadata-box {
  background: #fafafa;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  padding: 18px;
  display: flex;
  gap: 14px;
  align-items: center;
}

.metadata-icon {
  font-size: 32px;
  flex-shrink: 0;
  opacity: 0.7;
}

.metadata-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #777;
  margin-bottom: 4px;
}

.metadata-value {
  font-size: 16px;
  font-weight: 700;
  color: #2c2c2c;
}

/* Page 2: Behavioral Operating System Map */
.bos-map-page .title-divider-container {
  position: relative;
  margin: 24px 0 48px 0;
}

.bos-map-page .navy-divider {
  height: 2px;
  background: #0b2a4a;
  width: 100%;
  margin: 0;
}

.bos-map-page .gold-divider-accent {
  position: absolute;
  left: 0;
  top: -1px;
  width: 80px;
  height: 4px;
  background: #D4AF37;
  border-radius: 2px;
}

.bos-map-container {
  position: relative;
  width: 100%;
  height: 600px;
  margin-bottom: 40px;
}

.bos-tension-warning-box {
  position: absolute;
  top: 10px;
  left: -30px;
  width: 240px;
  padding: 16px;
  background: #fff8f0;
  border: 1.5px solid #ffe0b2;
  border-radius: 8px;
  display: flex;
  gap: 12px;
}

.warning-icon {
  font-size: 24px;
  color: #D4AF37;
  flex-shrink: 0;
}

.warning-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #D4AF37;
  margin-bottom: 6px;
}

.warning-text {
  font-size: 11px;
  line-height: 1.5;
  color: #666;
}

.bos-center-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 500px;
}

.bos-orbit-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 340px;
  height: 340px;
  border: 1px dotted rgba(192, 192, 192, 0.4);
  border-radius: 50%;
}

.bos-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220px;
  height: 220px;
  border: 2px solid #d0d0d0;
  border-radius: 50%;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 24px;
}

.core-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #D4AF37;
  margin-bottom: 10px;
}

.core-heading {
  font-size: 17px;
  font-weight: 700;
  color: #0b2a4a;
  margin-bottom: 10px;
  line-height: 1.3;
}

.core-summary {
  font-size: 10px;
  line-height: 1.5;
  color: #666;
}

.bos-node {
  position: absolute;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 18px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

.bos-node.bos-primary {
  background: #0b2a4a;
  border: 3px solid #D4AF37;
  color: white;
}

.bos-node.bos-secondary {
  background: #2c5aa0;
  border: 2px solid #5580c0;
  color: white;
}

.bos-node.bos-opposing {
  background: #e8e8e8;
  border: 2px solid #b8b8b8;
  color: #555;
}

.bos-top-node { 
  top: 0; 
  left: 50%; 
  transform: translate(-50%, -50%);
}
.bos-right-node { 
  top: 50%; 
  right: 0; 
  transform: translate(50%, -50%);
}
.bos-bottom-node { 
  bottom: 0; 
  left: 50%; 
  transform: translate(-50%, 50%);
}
.bos-left-node { 
  top: 50%; 
  left: 0; 
  transform: translate(-50%, -50%);
}

.node-label, .node-label-small {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 3px;
  opacity: 0.9;
}

.node-name {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
  line-height: 1.2;
}

.node-icon {
  font-size: 18px;
  opacity: 0.85;
  margin-bottom: 5px;
}

.node-descriptor {
  font-size: 7.5px;
  line-height: 1.3;
  margin-top: 4px;
  opacity: 0.9;
}

.node-descriptor-line {
  margin-bottom: 2px;
}

.bos-connector {
  position: absolute;
  background: none;
  border-top: 2px dotted #999;
}

.bos-conn-top { 
  top: 110px; 
  left: 50%; 
  width: 1px; 
  height: 85px; 
  border-left: 1px dotted #aaa; 
  transform: translateX(-50%); 
}
.bos-conn-right { 
  top: 50%; 
  right: 140px; 
  width: 85px; 
  height: 1px; 
  border-top: 1px dotted #aaa; 
  transform: translateY(-50%); 
}
.bos-conn-left { 
  top: 50%; 
  left: 140px; 
  width: 85px; 
  height: 1px; 
  border-top: 1px dotted #aaa; 
  transform: translateY(-50%); 
}
.bos-conn-bottom { 
  bottom: 140px; 
  left: 50%; 
  width: 1px; 
  height: 85px; 
  border-left: 1px dotted #aaa; 
  transform: translateX(-50%); 
}

.bos-tension-label {
  position: absolute;
  font-size: 8px;
  font-weight: 600;
  color: #888;
  text-align: center;
  line-height: 1.2;
}

.bos-tension-top { top: 40px; left: 50%; transform: translateX(-50%); }
.bos-tension-right { top: 50%; right: 30px; transform: translateY(-50%); }
.bos-tension-bottom { bottom: 40px; left: 50%; transform: translateX(-50%); }



.bos-summary-section {
  margin-top: 20px;
}

.bos-summary-card {
  display: flex;
  gap: 20px;
  padding: 20px 24px;
  background: #f9f9f9;
  border: 1.5px solid #e0e0e0;
  border-left: 4px solid #D4AF37;
  border-radius: 8px;
  align-items: flex-start;
}

.summary-icon {
  font-size: 32px;
  color: #0b2a4a;
  flex-shrink: 0;
}

.summary-content {
  flex: 1;
}

.summary-heading {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0b2a4a;
  margin-bottom: 10px;
}

.summary-body {
  font-size: 11.5px;
  line-height: 1.65;
  color: #444;
  max-width: 800px;
}

.bos-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 20px;
  border-left: 1px solid #ddd;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: #555;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dot.legend-primary { background: #0b2a4a; border: 2px solid #D4AF37; }
.legend-dot.legend-secondary { background: #2c5aa0; }
.legend-dot.legend-opposing { background: #c0c0c0; }

.legend-text {
  line-height: 1.3;
}

.bos-footer .footer-accent-line {
  position: absolute;
  top: -8px;
  left: 0;
  width: 60px;
  height: 3px;
  background: #D4AF37;
  border-radius: 2px;
}

.bos-footer .footer-content {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

/* Page 4 Operating Pattern Refinements */
.operating-pattern-page .three-card-row {
  grid-template-columns: repeat(3, 1fr); /* Ensure 3 columns */
  gap: 20px;
}

/* Print Styles - Ensure consistency */
@media print {
  body {
    background: #fff;
  }
  .mmm-page {
    margin: 0;
    box-shadow: none;
    border: none;
    padding: 0.6in;
  }
  .page-footer {
    position: relative;
    bottom: auto;
    left: auto;
    right: auto;
    margin-top: 20px;
  }
  /* Ensure header/footer don't break page flow unexpectedly */
  header, footer {
    position: relative;
  }
}
</style>
</head>
<body>
${pages.join('\n\n')}
</body>
</html>`;

 if (pages.length !== 10) {
 throw new Error(`Mini V2 HTML generation failed: expected 10 page templates, found ${pages.length}`);
 }

 const leftovers = html.match(/\{\{[^}]+\}\}/g) || [];
 if (leftovers.length) {
 throw new Error(`Mini V2 HTML generation failed: ${leftovers.length} placeholders left`);
 }

 console.log("HTML generation completed with explicit pages.length validation.");

 return html;
}

export default generateMiniV2HTML;

export { generateMiniV2HTML as generateHTML };

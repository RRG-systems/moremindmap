/**
 * render-to-pdf.js
 * 
 * Converts HTML report to PDF
 * Uses puppeteer if available, otherwise documents HTML-only fallback
 * 
 * Generic renderer: works with ANY HTML report
 */

import fs from 'fs';
import path from 'path';

/**
 * Attempt to render HTML to PDF using puppeteer
 * Falls back gracefully if puppeteer not available
 */
const renderToPDF = async (htmlContent, outputPath) => {
  try {
    // Try to load puppeteer (optional dependency)
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      console.warn(
        'Puppeteer not available. PDF generation skipped. HTML can be printed to PDF manually.'
      );
      return {
        success: false,
        error: 'PUPPETEER_NOT_AVAILABLE',
        message:
          'Puppeteer not installed. Use: npm install puppeteer (optional). HTML output available for manual PDF export.',
        htmlOnly: true,
      };
    }

    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // Set HTML content
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
      });

      // Generate PDF
      await page.pdf({
        path: outputPath,
        format: 'letter',
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
        printBackground: true,
      });

      const stats = fs.statSync(outputPath);

      return {
        success: true,
        outputPath,
        fileSize: stats.size,
        generated: new Date().toISOString(),
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('PDF generation error:', error.message);
    return {
      success: false,
      error: error.message,
      htmlOnly: true,
      message: 'PDF generation failed. HTML output available. Check error for details.',
    };
  }
};

export default renderToPDF;

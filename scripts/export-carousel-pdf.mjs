import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAROUSEL_URL = 'http://localhost:8080/linkedin_carousel_wm_phase1.html';
const SLIDE_COUNT = 7;
const OUTPUT_DIR = path.join(__dirname, '../docs/carousel');
const OUTPUT_PDF = path.join(OUTPUT_DIR, 'linkedin_carousel_wm_phase1.pdf');

const SLIDE_SIZE = 1080; // square 1080x1080px

(async () => {
  const { PDFDocument, PDFString, PDFName } = await import('pdf-lib');

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Slide container renders at max-width:520px in the HTML.
  // Viewport matches that so there is no upscaling, then DPR:3 gives 1560x1560px
  // screenshots which downsample cleanly into 1080x1080 PDF points → sharp result.
  await page.setViewport({ width: 520, height: 520, deviceScaleFactor: 4 });

  console.log(`Loading ${CAROUSEL_URL}`);
  await page.goto(CAROUSEL_URL, { waitUntil: 'networkidle0', timeout: 15000 });

  await page.waitForFunction(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1500));

  const mergedPdf = await PDFDocument.create();
  const screenshotPaths = [];

  for (let i = 0; i < SLIDE_COUNT; i++) {
    console.log(`Capturing slide ${i + 1}/${SLIDE_COUNT}...`);

    await page.evaluate((index) => window.go(index), i);
    await new Promise(r => setTimeout(r, 400));

    // --- Screenshot (preserves visual quality) ---
    const slideEl = await page.$('#slide-container');
    const imgPath = path.join(OUTPUT_DIR, `slide_${i + 1}.png`);
    await slideEl.screenshot({ path: imgPath });
    screenshotPaths.push(imgPath);

    // --- Collect link positions relative to the slide container ---
    const links = await page.evaluate(() => {
      const container = document.getElementById('slide-container');
      const cr = container.getBoundingClientRect();
      return Array.from(container.querySelectorAll('a[href]')).map(a => {
        const r = a.getBoundingClientRect();
        return {
          href: a.href,
          x: r.left - cr.left,
          y: r.top - cr.top,
          w: r.width,
          h: r.height
        };
      });
    });

    // --- Build PDF page from screenshot ---
    const imgBytes = fs.readFileSync(imgPath);
    const pdfImage = await mergedPdf.embedPng(imgBytes);

    const pdfPage = mergedPdf.addPage([SLIDE_SIZE, SLIDE_SIZE]);
    pdfPage.drawImage(pdfImage, { x: 0, y: 0, width: SLIDE_SIZE, height: SLIDE_SIZE });

    // --- Overlay link annotations (PDF y-axis is bottom-up, HTML is top-down) ---
    if (links.length > 0) {
      const annotRefs = links.map(link => {
        const x1 = link.x;
        const y1 = SLIDE_SIZE - (link.y + link.h); // flip y
        const x2 = link.x + link.w;
        const y2 = SLIDE_SIZE - link.y;

        const annot = mergedPdf.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x1, y1, x2, y2],
          Border: [0, 0, 0], // invisible border
          A: {
            S: 'URI',
            URI: PDFString.of(link.href),
          },
        });
        return mergedPdf.context.register(annot);
      });

      pdfPage.node.set(PDFName.of('Annots'), mergedPdf.context.obj(annotRefs));
      console.log(`  ${links.length} link(s) annotated`);
    }
  }

  const finalBytes = await mergedPdf.save();
  fs.writeFileSync(OUTPUT_PDF, finalBytes);

  console.log(`\nPDF saved: ${OUTPUT_PDF}`);
  console.log(`Slides: ${SLIDE_COUNT} pages — screenshot quality + clickable links`);

  await browser.close();

  // Clean up temp PNGs
  for (const p of screenshotPaths) fs.unlinkSync(p);
  console.log('Done.');
})();

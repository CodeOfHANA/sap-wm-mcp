import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, '../docs/carousel/thumbnail_demo.html');
const OUTPUT_PNG = path.join(__dirname, '../docs/carousel/thumbnail_demo.png');

const WIDTH  = 1280;
const HEIGHT = 720;

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

  const url = `file:///${HTML_FILE.replace(/\\/g, '/')}`;
  console.log(`Loading ${url}`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });

  await page.waitForFunction(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1500));

  const thumb = await page.$('#thumb');
  await thumb.screenshot({ path: OUTPUT_PNG });

  console.log(`\nThumbnail saved: ${OUTPUT_PNG}`);
  await browser.close();
})();

// Accessibility, responsive and interaction audit. Run after "npm run build".
//   node scripts/audit.mjs
// Uses the system Edge or Chrome (set BROWSER_PATH to override). Screenshots go to audit-output/.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import { startServer } from './serve.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'audit-output');
fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });

const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found. Set BROWSER_PATH.');

const PORT = 4420;
const base = `http://localhost:${PORT}`;
const server = await startServer(PORT);
const browser = await chromium.launch({ executablePath });

const sitemap = fs.readFileSync(path.join(root, 'dist/sitemap.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
pages.push('/this-page-does-not-exist/'); // exercises the custom 404

const widths = [360, 768, 1024, 1440];
const results = { overflow: [], console: [], axe: [], interaction: [] };

for (const p of pages) {
  for (const w of widths) {
    const context = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + p, { waitUntil: 'networkidle' });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) results.overflow.push(`${p} at ${w}px overflows by ${overflow}px`);
    // The custom 404 page is served with a real 404 status, which the browser logs. That is expected.
    for (const e of errors) if (!(p.includes('does-not-exist') && /status of 404/.test(e))) results.console.push(`${p} at ${w}px: ${e}`);

    // Axe at the narrowest and widest layouts
    if (w === 360 || w === 1440) {
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of axe.violations) {
        results.axe.push(`${p} at ${w}px: [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length > 1 ? 's' : ''}) e.g. ${v.nodes[0].target.join(' ')}`);
      }
    }
    if (w === 1440 || w === 360) {
      const name = (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '_')) + `-${w}.png`;
      await page.screenshot({ path: path.join(outDir, 'shots', name), fullPage: true });
    }
    await context.close();
  }
}

// Interaction checks
const check = (name, ok, detail = '') => results.interaction.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' (' + detail + ')' : ''}`);
{
  // Desktop dropdown by keyboard
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  check('Skip link is the first tab stop', (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Skip to main content');
  const toggle = page.locator('.sub-toggle').first();
  await toggle.focus();
  await page.keyboard.press('Enter');
  check('Dropdown opens with Enter', (await toggle.getAttribute('aria-expanded')) === 'true' && (await page.locator('.submenu').first().isVisible()));
  await page.keyboard.press('Escape');
  check('Escape closes dropdown and keeps focus on its button', (await toggle.getAttribute('aria-expanded')) === 'false' && (await page.evaluate(() => document.activeElement?.classList.contains('sub-toggle'))));
  const heroImg = page.locator('.hero__media img');
  check('Hero image is eager and high priority', (await heroImg.getAttribute('loading')) === 'eager' && (await heroImg.getAttribute('fetchpriority')) === 'high');
  await context.close();
}
{
  // Mobile menu
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const btn = page.locator('[data-menu-toggle]');
  check('Mobile nav is hidden until opened', !(await page.locator('#site-nav').isVisible()));
  await btn.click();
  check('Mobile menu opens', (await btn.getAttribute('aria-expanded')) === 'true' && (await page.locator('#site-nav').isVisible()));
  const iconsVisible = await page.locator('.menu-toggle__open').isVisible();
  check('Menu button shows only the close icon while open', !iconsVisible);
  await page.keyboard.press('Escape');
  check('Escape closes mobile menu', (await btn.getAttribute('aria-expanded')) === 'false');
  await context.close();
}
{
  // Gallery filters and lightbox
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + '/gallery/', { waitUntil: 'networkidle' });
  const visible = () => page.locator('.gallery__item:not([hidden])').count();
  check('Gallery lists all 36 photos', (await visible()) === 36, `${await visible()} shown`);
  await page.getByRole('button', { name: '2023 Conference' }).click();
  check('Filter "2023 Conference" shows 18', (await visible()) === 18, `${await visible()} shown`);
  await page.getByRole('button', { name: '2022', exact: true }).click();
  check('Filter "2022" shows 18', (await visible()) === 18, `${await visible()} shown`);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const first = page.locator('.gallery__item:not([hidden]) a').first();
  await first.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('dialog[open]');
  check('Lightbox opens with Enter', await dialog.isVisible());
  const cap1 = await page.locator('[data-lb-caption]').textContent();
  await page.keyboard.press('ArrowRight');
  const cap2 = await page.locator('[data-lb-caption]').textContent();
  check('Arrow Right shows the next photo', cap1 !== cap2 && /2 of 36/.test(cap2 ?? ''), cap2?.slice(-24));
  await page.keyboard.press('ArrowLeft');
  check('Arrow Left goes back', /1 of 36/.test((await page.locator('[data-lb-caption]').textContent()) ?? ''));
  await page.keyboard.press('Escape');
  check('Escape closes lightbox', !(await dialog.count()));
  check('Focus returns to the photo that opened it', await first.evaluate((el) => el === document.activeElement));
  await context.close();
}
{
  // Events split by date
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + '/events/', { waitUntil: 'networkidle' });
  const upcoming = await page.locator('#upcoming-title').locator('xpath=ancestor::section').locator('.event-card__title').allTextContents();
  const past = await page.locator('#past-title').locator('xpath=ancestor::section').locator('.event-card__title').allTextContents();
  check('Upcoming section holds the monthly prayer meeting', upcoming.length === 1 && /Monthly/.test(upcoming[0]), upcoming.join(', '));
  check('Past section holds both conferences', past.length === 2, past.join(', '));
  await context.close();
}
{
  // Old WordPress URLs redirect
  const res = await fetch(base + '/event/prayer-conference/', { redirect: 'manual' });
  check('Old /event/prayer-conference/ redirects to the new event page', res.status === 301 && res.headers.get('location') === '/events/prayer-conference-2023/');
  const missing = await fetch(base + '/nope/');
  check('Unknown URL returns 404 status', missing.status === 404);
}

await browser.close();
server.close();

const section = (title, list) => `\n## ${title} (${list.length})\n${list.length ? list.map((l) => '- ' + l).join('\n') : '- none'}`;
const report = `# Audit report\nPages audited: ${pages.length}, widths: ${widths.join(', ')}` + section('Horizontal overflow', results.overflow) + section('Console errors', results.console) + section('Axe (WCAG 2.2 AA) violations', results.axe) + `\n\n## Interaction checks\n${results.interaction.map((l) => '- ' + l).join('\n')}\n`;
fs.writeFileSync(path.join(outDir, 'report.md'), report);
console.log(report);
process.exitCode = results.overflow.length || results.axe.length || results.interaction.some((l) => l.startsWith('FAIL')) ? 1 : 0;

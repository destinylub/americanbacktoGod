// Runs Lighthouse against key pages (mobile and desktop) on the built site.
//   node scripts/lighthouse.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { startServer } from './serve.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'audit-output');
fs.mkdirSync(outDir, { recursive: true });

const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const chromePath = candidates.find((p) => fs.existsSync(p));

const PORT = 4430;
const server = await startServer(PORT);
const pages = ['/', '/about-us/', '/events/', '/events/monthly-prayer-meeting/', '/gallery/', '/contact-us/', '/privacy-policy/'];

const rows = [];
for (const form of ['mobile', 'desktop']) {
  for (const p of pages) {
    const config =
      form === 'desktop'
        ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttlingMethod: 'simulate' } }
        : undefined;
    // A fresh browser per run keeps results independent and avoids dropped connections.
    const chrome = await launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] });
    const run = await lighthouse(`http://localhost:${PORT}${p}`, { port: chrome.port, output: 'json', logLevel: 'error' }, config);
    // On Windows the temp profile can still be locked when Chrome exits. That cleanup failure is harmless.
    try {
      await chrome.kill();
    } catch {}
    const c = run.lhr.categories;
    const audits = run.lhr.audits;
    rows.push({
      form,
      page: p,
      performance: Math.round(c.performance.score * 100),
      accessibility: Math.round(c.accessibility.score * 100),
      bestPractices: Math.round(c['best-practices'].score * 100),
      seo: Math.round(c.seo.score * 100),
      lcp: audits['largest-contentful-paint'].displayValue,
      cls: audits['cumulative-layout-shift'].displayValue,
      tbt: audits['total-blocking-time'].displayValue,
    });
    // Keep the failing audits so they can be fixed
    const failed = Object.values(audits).filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && !['performance'].includes(a.id));
    fs.writeFileSync(path.join(outDir, `lighthouse-${form}-${p.replace(/\W+/g, '_')}.json`), JSON.stringify({ scores: rows.at(-1), failed: failed.map((a) => ({ id: a.id, title: a.title, score: a.score, value: a.displayValue })) }, null, 1));
  }
}
server.close();

const table = ['| Device | Page | Perf | A11y | Best | SEO | LCP | CLS | TBT |', '|---|---|---|---|---|---|---|---|---|', ...rows.map((r) => `| ${r.form} | ${r.page} | ${r.performance} | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`)].join('\n');
fs.writeFileSync(path.join(outDir, 'lighthouse.md'), table + '\n');
console.log(table);

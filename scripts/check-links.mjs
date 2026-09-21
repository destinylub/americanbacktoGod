// Broken link checker for the built site. Run after "npm run build".
//   node scripts/check-links.mjs           checks internal links and assets, plus external links
//   node scripts/check-links.mjs --offline skips external requests
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const offline = process.argv.includes('--offline');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));

const problems = [];
const external = new Map(); // url -> pages that use it
let internalCount = 0;

/** Maps a site path such as /events/ or /images/a.webp to a file inside dist, if one exists. */
function resolveInternal(p) {
  const clean = p.split('#')[0].split('?')[0];
  const candidates = [path.join(dist, clean), path.join(dist, clean, 'index.html')];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const page = '/' + path.relative(dist, file).replace(/\\/g, '/').replace(/index\.html$/, '');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  const refs = [
    ...[...html.matchAll(/\s(?:href|src|poster)="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/\ssrcset="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0])),
    ...[...html.matchAll(/<meta[^>]+content="(https?:\/\/[^"]+\.(?:jpg|png))"/g)].map((m) => m[1]),
  ];

  for (let ref of refs) {
    if (/^(mailto:|tel:|data:|javascript:)/.test(ref)) continue;
    if (/^https?:\/\//.test(ref)) {
      const site = new URL(process.env.SITE_URL || 'https://americabacktogodmission.com');
      const u = new URL(ref);
      if (u.origin === site.origin) ref = u.pathname + u.hash; // own domain: check locally
      else {
        if (!external.has(ref)) external.set(ref, new Set());
        external.get(ref).add(page);
        continue;
      }
    }
    internalCount++;
    if (ref.startsWith('#')) {
      if (ref.length > 1 && !ids.has(ref.slice(1))) problems.push(`${page}: missing anchor ${ref}`);
      continue;
    }
    const target = resolveInternal(ref);
    if (!target) {
      problems.push(`${page}: broken internal link ${ref}`);
      continue;
    }
    const hash = ref.split('#')[1];
    if (hash && target.endsWith('.html')) {
      const targetIds = new Set([...fs.readFileSync(target, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      if (!targetIds.has(hash)) problems.push(`${page}: ${ref} points to a missing anchor #${hash}`);
    }
  }
}

// Redirect destinations in vercel.json must exist
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
for (const r of vercel.redirects ?? []) if (!resolveInternal(r.destination)) problems.push(`vercel.json: redirect ${r.source} points to missing ${r.destination}`);

const warnings = [];
if (!offline) {
  const queue = [...external.keys()];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 link-check' } });
        if (res.status === 405 || res.status === 403) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 link-check' } });
        clearTimeout(timer);
        const where = [...external.get(url)].join(', ');
        // Social networks routinely refuse automated requests, so 4xx from them is a warning, not a failure.
        if (res.status >= 400) {
          const social = /facebook\.com|instagram\.com|youtube\.com/.test(url);
          (social && [400, 403, 429, 999].includes(res.status) ? warnings : problems).push(`${url} returned ${res.status} (used on ${where})`);
        }
      } catch (e) {
        problems.push(`${url} could not be reached: ${e.name === 'AbortError' ? 'timeout' : e.message} (used on ${[...external.get(url)].join(', ')})`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

console.log(`Pages: ${htmlFiles.length}. Internal references checked: ${internalCount}. External links: ${external.size}${offline ? ' (not requested, offline)' : ''}.`);
if (warnings.length) console.log('\nWarnings (sites that block automated requests):\n- ' + warnings.join('\n- '));
if (problems.length) {
  console.log('\nBroken:\n- ' + problems.join('\n- '));
  process.exitCode = 1;
} else console.log('\nNo broken links.');

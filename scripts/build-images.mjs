// Builds responsive AVIF and WebP variants for every image in src/data/images.json.
// Sources live in assets-original/. Output goes to public/images/ and a manifest
// (src/data/images.generated.json) records the real dimensions for width/height attributes.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'src/data/images.json'), 'utf8'));
const outDir = path.join(root, 'public/images');
const DEFAULT_WIDTHS = [360, 540, 800, 1200, 1600];

fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(root, 'src/data/images.generated.json');
// Optional ids on the command line rebuild only those images: node scripts/build-images.mjs logo
const only = process.argv.slice(2);
const manifest = only.length && fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

for (const [id, entry] of Object.entries(registry)) {
  if (only.length && !only.includes(id)) continue;
  const srcPath = path.join(root, 'assets-original', entry.src);
  if (!fs.existsSync(srcPath)) throw new Error(`Missing source for "${id}": ${entry.src}`);

  const meta = await sharp(srcPath).rotate().toBuffer({ resolveWithObject: true });
  const { width: srcW, height: srcH } = meta.info;
  const wanted = entry.widths ?? DEFAULT_WIDTHS;
  // Never upscale: keep widths the source can supply, and always include the largest usable one.
  const widths = [...new Set(wanted.map((w) => Math.min(w, srcW)))].sort((a, b) => a - b);

  for (const w of widths) {
    const h = Math.round((srcH * w) / srcW);
    const pipeline = () => {
      const base = sharp(meta.data).resize({ width: w, withoutEnlargement: true });
      if (entry.mask !== 'circle') return base;
      // Circular alpha mask so a round logo sits cleanly on any background colour.
      const circle = Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${w / 2 - 1}" fill="#fff"/></svg>`);
      return base.ensureAlpha().composite([{ input: circle, blend: 'dest-in' }]);
    };
    await pipeline().avif({ quality: 52, effort: 4 }).toFile(path.join(outDir, `${id}-${w}.avif`));
    await pipeline().webp({ quality: 78 }).toFile(path.join(outDir, `${id}-${w}.webp`));
    if (w === widths.at(-1)) manifest[id] = { width: w, height: h, widths, alt: entry.alt };
  }
  console.log(`${id}: ${widths.join(', ')}`);
}

fs.writeFileSync(path.join(root, 'src/data/images.generated.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`\n${Object.keys(manifest).length} images processed.`);

// Generates the favicon set, web manifest and social preview images into /public.
// The mark is a simplified version of the logo (navy ring, flag disc, star). Replace the
// drawing in flagMark() if a vector version of the official logo is supplied later.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const pub = path.join(root, 'public');
const NAVY = '#3C3B6E';
const NAVY_DEEP = '#26254A';
const RED = '#B22234';
const WHITE = '#FFFFFF';

/** Five-point star polygon points around (cx, cy). */
function star(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/**
 * Round mark on a 64 x 64 grid. `bleed` fills the whole square with navy (for apple-touch and
 * maskable icons) and shrinks the mark to stay inside the safe zone.
 */
function flagMark({ bleed = false, scale = 1 } = {}) {
  const stripe = 48 / 7;
  const stripes = [0, 2, 4, 6].map((i) => `<rect x="8" y="${(8 + i * stripe).toFixed(2)}" width="48" height="${stripe.toFixed(2)}" fill="${RED}"/>`).join('');
  // A 3 x 3 grid of small stars so the canton reads as the American flag, not a single-star flag.
  const cantonStars = [14, 21, 28]
    .flatMap((x) => [15, 22, 29].map((y) => `<polygon points="${star(x, y, 2.7, 1.1)}" fill="${WHITE}"/>`))
    .join('');
  const body = `
    <circle cx="32" cy="32" r="32" fill="${NAVY}"/>
    <g clip-path="url(#disc)">
      <rect x="8" y="8" width="48" height="48" fill="${WHITE}"/>
      ${stripes}
      <rect x="8" y="8" width="26" height="${(stripe * 4).toFixed(2)}" fill="${NAVY_DEEP}"/>
      ${cantonStars}
    </g>
    <circle cx="32" cy="32" r="24" fill="none" stroke="${WHITE}" stroke-width="1.5"/>`;
  const bg = bleed ? `<rect width="64" height="64" fill="${NAVY}"/>` : '';
  const t = bleed ? `translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><clipPath id="disc"><circle cx="32" cy="32" r="24"/></clipPath></defs>
  ${bg}<g transform="${t}">${body}</g>
</svg>
`;
}

const write = (name, data) => fs.writeFileSync(path.join(pub, name), data);
const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();

// SVG favicon
write('favicon.svg', flagMark());

// PNG icons
write('apple-touch-icon.png', await png(flagMark({ bleed: true, scale: 0.86 }), 180));
write('icon-192.png', await png(flagMark(), 192));
write('icon-512.png', await png(flagMark(), 512));
write('icon-maskable-512.png', await png(flagMark({ bleed: true, scale: 0.7 }), 512));

// favicon.ico with PNG-encoded 16, 32 and 48 pixel images
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(flagMark(), s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + sizes.length * 16;
const entries = images.map((img, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i], 0);
  e.writeUInt8(sizes[i], 1);
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(img.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.length;
  return e;
});
write('favicon.ico', Buffer.concat([header, ...entries, ...images]));

// Web manifest
write(
  'site.webmanifest',
  JSON.stringify(
    {
      name: 'America Back to God Mission',
      short_name: 'America Back to God',
      description: 'A prayer and faith-based mission preserving and promoting the spiritual heritage of the United States.',
      start_url: '/',
      display: 'standalone',
      background_color: '#FFF8F0',
      theme_color: '#26254A',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
);

// Social preview images (1200 x 630): navy panel with the logo and mission line, real event photo on the right.
const logo = await sharp(path.join(root, 'public/images/logo-409.webp')).resize(150, 150).png().toBuffer();
async function og(file, photoFile, position, tagline) {
  const W = 1200;
  const H = 630;
  const photoW = 560;
  const photo = await sharp(path.join(root, 'assets-original', photoFile))
    .rotate()
    .resize(photoW, H, { fit: 'cover', position })
    .jpeg({ quality: 88 })
    .toBuffer();
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = tagline.map((t, i) => `<text x="64" y="${400 + i * 48}" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-style="italic" fill="#E6E6F0">${esc(t)}</text>`).join('');
  const panel = `<svg width="${W - photoW}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${NAVY_DEEP}"/>
    <text x="64" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="700" fill="#FFFFFF">America Back</text>
    <text x="64" y="356" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="700" fill="#FFFFFF">to God Mission</text>
    ${lines}
    <rect x="64" y="${H - 60}" width="80" height="5" fill="${RED}"/>
  </svg>`;
  await sharp({ create: { width: W, height: H, channels: 3, background: NAVY_DEEP } })
    .composite([
      { input: Buffer.from(panel), left: 0, top: 0 },
      { input: photo, left: W - photoW, top: 0 },
      { input: logo, left: 64, top: 64 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(pub, file));
}

await og('og-default.jpg', '2024/09/IMG-20240926-WA0011.jpg', 'top', ["Come, let's unite in prayer", 'for America Back to God']);
await og('og-gallery.jpg', '2024/09/IMG-20240926-WA0008.jpg', 'centre', ['Photos from our prayer', 'conferences and gatherings']);

console.log('Favicons, manifest and social images written to /public.');

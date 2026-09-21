// Generates /sitemap.xml from the pages folder plus the event slugs, so new pages appear automatically.
import type { APIRoute } from 'astro';
import { getAllEvents } from '../lib/events';

const pages = import.meta.glob('./**/*.astro');

export const GET: APIRoute = ({ site }) => {
  const base = site!.href.replace(/\/$/, '');
  const paths = Object.keys(pages)
    .filter((file) => !file.includes('404') && !file.includes('['))
    .map((file) =>
      '/' + file.replace('./', '').replace(/index\.astro$/, '').replace(/\.astro$/, '/'),
    );
  for (const event of getAllEvents()) paths.push(`/events/${event.slug}/`);

  const urls = [...new Set(paths)]
    .sort()
    .map((p) => `  <url><loc>${base}${p}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};

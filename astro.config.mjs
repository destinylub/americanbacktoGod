import { defineConfig } from 'astro/config';

// Set SITE_URL in the hosting environment to the final domain. It is used for canonical URLs,
// the sitemap and social preview images.
const site = process.env.SITE_URL || 'https://americabacktogodmission.com';

export default defineConfig({
  site,
  trailingSlash: 'always',
});

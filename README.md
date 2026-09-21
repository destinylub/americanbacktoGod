# America Back to God Mission website

A static website for America Back to God Mission, a prayer and faith-based mission preserving and promoting the spiritual heritage of the United States. Built with Astro and plain CSS. It replaces the previous WordPress and Elementor site and keeps the mission's real content, photographs and brand colors.

> **Legal notice: the Privacy Policy and Terms & Conditions are drafts.**
> They were written for a US-based faith nonprofit and have **not** been reviewed by a lawyer. A qualified attorney must review both pages before launch, especially the sections on donations, refunds, tax-deductibility, children's privacy, governing law (Georgia) and how information collected through Google Forms is handled. The pages are `src/pages/privacy-policy.astro` and `src/pages/terms-and-conditions.astro`. The "last updated" date comes from `legalUpdated` in `src/data/site.json`.

## Contents

- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Editing content](#editing-content)
- [Forms (Google Forms)](#forms-google-forms)
- [Donations](#donations)
- [Design system](#design-system)
- [Deployment on Vercel](#deployment-on-vercel)
- [Testing and audits](#testing-and-audits)
- [Open items](#open-items)

## Quick start

Requires Node 22.12 or newer.

```sh
npm install
npm run dev        # http://localhost:4321
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Preview the built site with Astro |
| `npm run check` | Type-check the project |
| `npm run images` | Regenerate responsive AVIF and WebP images from `assets-original/` |
| `npm run favicons` | Regenerate the favicon set, web manifest and social preview images |
| `npm run serve` | Serve `dist/` locally with the same headers and redirects as Vercel |
| `npm run audit` | Accessibility (axe), responsive overflow and keyboard checks (run after build) |
| `npm run links` | Broken link check on the built site (`-- --offline` skips external links) |
| `npm run lighthouse` | Lighthouse scores for key pages on mobile and desktop |

## Project structure

```
assets-original/        Untouched originals downloaded from the previous site
public/
  images/               Generated AVIF and WebP variants (do not edit by hand)
  fonts/                Self-hosted Fraunces and Source Sans 3 (SIL Open Font License)
  media/                Founder videos
  favicon.*, icon-*.png, site.webmanifest, og-*.jpg
scripts/                Image, favicon, audit, link check and Lighthouse tools
src/
  data/                 Everything a non-developer edits (JSON)
    events.json         Events
    gallery.json        Gallery photos and their groups
    images.json         Image registry: source file and alt text for every photo
    site.json           Contact details, social links, donation link, legal date
    forms.json          Google Form embed links
  components/           Header, Footer, Gallery, EventCard, Picture, Icon and others
  layouts/              BaseLayout (head, skip link, header, footer) and LegalLayout
  lib/                  Date handling and event sorting
  pages/                One file per page, plus the event template and sitemap
  styles/               tokens.css (design tokens), base.css, components.css
vercel.json             Security headers, caching and redirects from the old WordPress URLs
```

## Editing content

### Events

Edit `src/data/events.json`. Each event is one object. The site sorts events into **Upcoming** and **Past** automatically by comparing the event's end time with the build time, so nothing needs to be moved by hand.

```json
{
  "slug": "my-event",
  "title": "Event title",
  "tagline": "One short line",
  "kind": "conference",
  "startDate": "2026-11-13",
  "endDate": "2026-11-15",
  "startTime": "18:00",
  "endTime": "21:00",
  "location": { "address": "1 Main Street", "city": "Atlanta", "region": "GA", "postalCode": "30301" },
  "cost": "Free event",
  "speakers": ["Name one", "Name two"],
  "flyer": "flyer-my-event",
  "description": ["A short paragraph."]
}
```

- Times are 24-hour local times in Eastern Time (`timezone` in `site.json`).
- `flyer` is an id from `src/data/images.json` (see the gallery steps below to add one).
- `speakers` and `cost` are optional.
- The monthly prayer meeting uses `"recurrence": "first-friday"` instead of dates. It always shows the next first Friday and never becomes a past event. To retire it, delete the entry.
- A page for the event is created automatically at `/events/<slug>/`.
- Times use Eastern Time, and dates are compared at build time. The next-meeting date is also corrected in the visitor's browser, so it stays right between deployments.

### Gallery and other photos

1. Copy the original photo into `assets-original/<year>/<month>/`.
2. Add an entry to `src/data/images.json` with a descriptive id, the file path, and alt text that describes what the photo shows:
   ```json
   "conference-prayer-circle": {
     "src": "2026/11/prayer-circle.jpg",
     "alt": "Attendees stand in a circle with hands joined in prayer."
   }
   ```
3. Add the id to `src/data/gallery.json` under `photos`, with a `group` of `conference-2023` or `2022`. To add a new filter, add it to `groups` first.
4. Run `npm run images`. It writes AVIF and WebP files at several sizes into `public/images/`.
5. Commit the new files in `assets-original/`, `public/images/`, and `src/data/`.

Every image needs alt text. Photos keep two crops only (4:3 landscape and 3:4 portrait) so the gallery stays even.

### Contact details, links and legal date

`src/data/site.json` holds the phone number, email, social links, donation link and the "last updated" date of the legal pages. Change a value there and it updates everywhere.

### Founder page

The founder page currently shows the name, title, portrait and two videos. To add a biography, add paragraphs to `src/pages/meet-our-founder.astro` inside the "Founder" section. To add captions to a video, put a `.vtt` file in `public/media/` and set its path in the `videos` list at the top of the same file. Captions are needed for accessibility whenever a video has speech.

## Forms (Google Forms)

The contact, membership and volunteer pages show a Google Form. Until a form link is set, each page shows the phone number and email instead of a form, so nothing looks submittable when it is not.

To connect a form:

1. In Google Forms, create the form and choose **Send**, then the **`<>` embed** tab.
2. Copy the address inside `src="..."`. It looks like `https://docs.google.com/forms/d/e/XXXX/viewform?embedded=true`.
3. Paste it into `src/data/forms.json`, for example:
   ```json
   { "contact": { "embedUrl": "https://docs.google.com/forms/d/e/XXXX/viewform?embedded=true", "title": "Contact form" } }
   ```
4. Commit and deploy.

Only `docs.google.com/forms` addresses are embedded. Validation, required fields and spam limits are configured in Google Forms itself (turn on required questions, response validation, and "Limit to 1 response" or a CAPTCHA question if spam becomes a problem). Responses go to the Google account that owns the form and can be sent to the mission's email from the form's **Responses** tab.

Because Google renders the form, this site cannot add its own honeypot field or client-side validation to it. If the mission later wants a fully custom form, a serverless function on Vercel with a honeypot field is the alternative.

## Donations

No payment link is set yet, and the site does not build a payment form or claim to process payments. The Donate page says online giving is not available and shows the phone number and email.

When the mission has a donation page (for example a hosted payment link), set it in `src/data/site.json`:

```json
"donateUrl": "https://example.com/your-donation-page"
```

The Donate page then shows a "Donate now" button that opens it in a new tab. Update the Privacy Policy and Terms & Conditions to name the payment processor at the same time.

## Design system

- **Colors:** only the mission's two brand colors and shades, tints and neutrals derived from them (`src/styles/tokens.css`). Navy `#3C3B6E` and red `#B22234` come from the previous site's Elementor global colors.
- **Type:** Fraunces (headings) and Source Sans 3 (body), self-hosted with `font-display: swap`. The fluid type scale is `--step--1` to `--step-5`.
- **Layout:** numbered sections (01, 02, 03) joined by a dotted path motif, large photography with consistent crops, rectangular buttons with a 4px radius.
- **Icons:** Lucide line icons, inlined, with one stroke width. The Facebook, Instagram and YouTube marks are drawn in `src/components/Icon.astro`.
- **Motion:** a single gentle rise on the page header and hover states. Everything is disabled under `prefers-reduced-motion`.
- **Accessibility:** skip link, semantic landmarks, keyboard-operable menus and lightbox, visible focus rings, alt text on every image.

## Deployment on Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New Project** and import the repository. The Astro framework preset is detected automatically (build command `npm run build`, output directory `dist`).
3. Add an environment variable `SITE_URL` set to the final address, for example `https://americabacktogodmission.com`. It is used for canonical links, the sitemap and social preview images.
4. Deploy, then add the custom domain under **Settings, Domains**.

`vercel.json` adds security headers (including a Content-Security-Policy that allows Google Forms frames), long caching for images and fonts, and permanent redirects from the old WordPress addresses such as `/event/prayer-conference/`. If a Google Form does not appear after you connect it, check that the Content-Security-Policy `frame-src` still allows `https://docs.google.com`.

After the first deploy, open `/sitemap.xml` and `/robots.txt` and submit the sitemap in Google Search Console.

## Testing and audits

```sh
npm run build
npm run audit         # axe, overflow at 360, 768, 1024 and 1440 px, keyboard flows
npm run links         # broken internal and external links
npm run lighthouse    # mobile and desktop scores
```

Reports are written to `audit-output/`, which is not committed.

## Open items

- **Donation link:** add `donateUrl` when the mission has a donation page.
- **Google Form links:** add the three embed links in `src/data/forms.json`.
- **Founder biography:** to be supplied.
- **Founder video captions:** the two videos have no captions yet.
- **Own photographs:** the stock photographs on the old site were left out. Replace or add photos through the gallery steps above.
- **Logo:** only a raster logo (409 px) exists. The favicon is a simplified drawing of the logo in `scripts/build-favicons.mjs`. Replace it when a vector logo is supplied.
- **Facebook and YouTube links:** they point to the founder's personal profile and channel, as on the previous site.
- **Analytics:** none is installed. The Privacy Policy says so. Update it before adding any.
- **Legal review:** see the notice at the top of this file.

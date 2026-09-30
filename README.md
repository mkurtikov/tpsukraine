# Ukraine TPS Collective

**Local development only.** Do not upload, publish, or deploy this project unless the user explicitly requests it. The previous Sites publication was withdrawn at the user's request on September 30, 2026.

A static Astro site with three routes: `/` (overview), `/background/` (the full briefing), and `/take-action/` (the How can I help? placeholder). A fixed help button on the two reading pages links to the placeholder; the message builder is intentionally deferred.

## Develop

Use Node 22.12+ and npm 9.6.5+.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

## Content

- `src/pages/index.astro` adapts `../docs/Email Body.md` for the homepage. Update its short editorial sections when the email changes.
- `src/content/background.md` contains the complete briefing, with its title and update date presented in the page header.
- Run `npm run sync:content` from this directory after updating `../docs/6. TPS details description.md`. Update the displayed source date in `src/pages/background.astro` and `src/layouts/Layout.astro` when the source date changes.
- `src/styles/global.css` defines the shared visual design and responsive layouts.

The wording reflects the supplied September 29, 2026 materials. This implementation does not perform a new legal review or automatically refresh the source facts.

The site builds to `dist/` and can be served by any static host. No backend, visitor data storage, runtime React, or third-party fonts are required. Links to official sources remain in the briefing.

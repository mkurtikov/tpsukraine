# Ukraine TPS Collective

**Local development only.** Do not upload, publish, or deploy this project unless the user explicitly requests it. The previous Sites publication was withdrawn at the user's request on September 30, 2026.

A static Astro site with three routes: `/` (overview), `/background/` (the full briefing), and `/take-action/` (the letter builder). A fixed help button on the two reading pages links to the builder.

The builder prepares letters for Texas residents to John Cornyn, Ted Cruz, Tammy Duckworth, and their U.S. representative. Its two Markdown templates, `senator.md` and `representative.md`, live in `src/templates/letters/` and are bundled at build time. Senator names and individual introductory wording come from `recipients` in `src/lib/letter-builder.ts`. Everything needed to build the site is inside `website/`; no parent-directory documents are required. The “I am a U.S. citizen” checkbox is selected by default and controls the opening statement; unchecking it uses “I live in…”. Support for an 18-month extension is selected by default; unchecking the box removes that optional paragraph. The preview shows no ready-to-copy status line; copy confirmations and warnings still appear. Senator contact links and postal addresses were checked September 30, 2026.

Choosing “My U.S. Representative” reveals a House.gov finder link and a manual last-name field for the greeting. A local roster in `src/lib/texas-representatives.ts`, checked against House.gov on September 30, 2026, shows “Please double check the name.” for unrecognized nonempty names. It accepts only surnames (including compound surnames), ignoring case, spacing, punctuation, and accents. Full names such as “Chip Roy” trigger the advisory; “Roy” is recognized. This advisory never changes the typed name or blocks copying, and does not determine the user’s district. Update the roster when membership changes; vacant seats are excluded. No lookup API is used. The finder link never includes personal details. Representative instructions explain how to reach the member’s own contact form or mailing address; postal letters do not insert an unknown office address. Switching to a senator hides the representative field and restores that senator’s template and instructions.

Personal information stays in browser memory: no form submission, API, storage, cookies, analytics, or third-party scripts are used. Copying is an explicit clipboard action with a manual-copy fallback. Official contact links do not contain form values. Postal mode adds a return-address field and the office address to the letter. Update `src/lib/letter-builder.ts` when recipient contact details change.

Copy text is enabled whenever the preview contains a letter, including one with placeholders. Nonempty unrecognized representative surnames and incorrectly formatted ZIP codes get an inline advisory and highlighted field. ZIP accepts any input; the advisory checks for five digits or ZIP+4, not postal assignment or district membership. After copying, any missing details or active name/ZIP advisory produces the same red message: “Please double check your data. It may be incomplete or incorrect.” These checks never block copying. Postal mode recommends the online contact form because the inquiry is urgent.

## Develop

Use Node 22.12+ and npm 9.6.5+.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

## Content

- `src/pages/index.astro` contains the homepage's editorial sections. Edit the website copy here.
- `src/content/background.md` contains the complete briefing. Edit it directly; its title and update date are presented in the page header. Update the displayed source date in `src/pages/background.astro` and `src/layouts/Layout.astro` when the source date changes.
- `src/templates/letters/` contains one senator template and one representative template. Edit the shared letter wording here; the builder fills in recipient information, personal details, and optional paragraphs.
- `src/styles/global.css` defines the shared visual design and responsive layouts.

The wording reflects the supplied September 29, 2026 materials. This implementation does not perform a new legal review or automatically refresh the source facts.

The site builds to `dist/` and can be served by any static host. No backend, visitor data storage, runtime React, or third-party fonts are required. Links to official sources remain in the briefing.

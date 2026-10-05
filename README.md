# Ukraine TPS Collective

**Local development only.** Do not upload, publish, or deploy this project unless the user explicitly requests it.

A static Astro site with three routes: `/` (overview), `/background/` (briefing), and `/take-action/` (letter builder). The two reading pages have a sticky top header with a “Take action” button linking to the builder. The button repeats a visible pulse with a slight lift, expanding gold glow, and light sweep; reduced-motion preferences replace the animation with a static highlight. Everything required to build lives inside `website/`.

## Letter builder

The builder supports all 50 states and offers U.S. senators plus a searchable directory of U.S. representatives. It has four steps:

1. Choose a home state and enter ZIP.
2. Enter full name and city, and review the citizenship and extension-support checkboxes.
3. Choose one of the state's two senators, or the full-width “My Representative” card below them.
4. Review the letter and choose online submission or postal mail. Online mode offers copying and an official contact link; postal mode adds a return street address, the selected recipient's office address, and printing.

Both checkboxes start checked. Turning citizenship off uses “I live in…”; turning support off removes the optional extension paragraph. `src/templates/letters/senator.md` and `representative.md` supply the two inquiries. Duckworth's introduction refers to her Ukraine TPS initiative; other senators receive a general oversight request. Both templates use the selected state.

“My Representative” reveals a disclosure linking to the [official House.gov finder](https://www.house.gov/representatives/find-your-representative) and “Search for your representative”. Users first identify their representative and district on House.gov, then type a first or last name and select a matching member of the selected state. Results show full names and districts; searches ignore case and accents and support compound surnames and district numbers. Up to eight results are displayed, with a count and an instruction to narrow larger lists. Arrow keys, Enter, Escape, and pointer selection are supported. Search alone does not determine a district from ZIP.

Selecting a result inserts the correct surname in the greeting, supplies the complete Washington office mailing address for postal letters, and links directly to the member's official website. Instructions explain finding Contact or Email on that website; a homepage is not described as a direct contact form. The same search is available in “Update my details”, and both fields stay synchronized. Editing the query clears the previous selection, website, and address immediately. Unselected or unmatched names leave placeholders; copying is still allowed with the general incomplete-data warning. Vacancies are excluded from search. No automatic ZIP lookup or API is used, and outgoing links contain no personal details.

The older Texas surname and ZIP helpers are no longer used by the wizard.

Required fields block forward navigation: state and a nonempty ZIP on step 1, full name and city on step 2, and a recipient on step 3 (including a selected directory result for a representative). Forward stepper shortcuts check earlier required fields too; backward navigation stays unrestricted. Whitespace-only entries count as empty. Names and cities have no correctness heuristics. Errors appear beside fields with red borders, and an attempted forward action focuses the first missing field. Postal street address is required before printing; apartment/unit is optional. Citizenship and extension support remain optional.

ZIP correctness is advisory and never blocks progress when the field contains text. Warnings appear after leaving the field or attempting to continue, not on each keystroke. ZIP checks cover format, assignment in a bundled USPS snapshot, and a coarse state mismatch advisory. Postal facility state/prefix data cannot establish residence; cross-border ZIPs exist, and ZIP+4 suffixes are checked only for format. The user-selected state always determines the senators. An already-opened, nonempty draft can still be copied if subsequent edits leave required details incomplete.

After copying, the button reads “Copied!”; submission instructions and any validation warning appear separately. There is no redundant “Letter copied.” banner. Missing details or a ZIP advisory produce: “Please double check your data. It may be incomplete or incorrect.” Copying has a manual selection fallback. Postal mode recommends online contact because the inquiry is urgent. Printing uses the complete letter, including the signature, rather than the visible portion of the preview.

The final step has an “Update my details” disclosure alongside the delivery controls. It edits all personal fields, both checkboxes, state, and recipient without leaving the preview, including representative search; their office address is filled automatically from the directory. Changes update the letter and earlier steps immediately and clear stale copy confirmations. “Done updating” checks required fields and focuses any missing value; ZIP advisories do not prevent closing. Changing state clears representative details and replaces the previous recipient with the default for that state’s three recipient options. Copying and sending instructions remain unavailable if no recipient is selected. Copying a nonempty draft is still allowed with the general warning for missing details or ZIP advisories.

On screens at least 1200px wide, only step 4 expands to a two-column layout: delivery choices, the details disclosure, copy/print instructions, official links, status messages, and next-letter navigation are on the left; the letter preview is on the right and stays visible while scrolling. The redundant personal-details summary is hidden on desktop, with all fields available in the disclosure. Narrower screens retain the single-column flow and details summary. The same preview element moves at the breakpoint, preserving form state, focus, and mobile reading order. Printing still uses the separate complete-letter element.

The final step ends with “Back to details” (step 2) and “I want to send another one” (step 3). The latter marks the current recipient “Previously sent”, retains personal details and options, and chooses the next default across both senators and My Representative: automatically select the only remaining unsent option, or select nothing when two or more remain or all three are marked. If both senators are marked and the representative has not been identified yet, My Representative is selected and its search disclosure opens. Representative marks are keyed by the selected member’s stable Bioguide ID and participate in the same default-selection rule. An unknown or newly selected representative is treated as unsent; another member’s mark never carries over. Marks never prevent choosing the same recipient again. Only that button adds a mark; selecting, copying, printing, or opening a contact link does not. These are user-flow markers, not verification of delivery. Reloading clears all entered details, choices, and marks.

There is no visitor API, backend, local/session storage, cookies, analytics, or third-party script. Personal details and “Previously sent” marks remain in page memory. Contact links never include form values. The website does not submit or send letters.

## Develop and verify

Use Node 24 via `.nvmrc` (Astro requires at least Node 22.12).

```sh
nvm use
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Tests exercise required-versus-advisory validation, all 100 senators and 433 serving state representatives, representative search and state filtering, stale selections, optional statements, postal output, incomplete values, and ZIP edge cases using Astro's Vite dependency and Node's test runner. For UI changes, also check navigation, copy, preparing another letter, state changes, reload, and mobile layout in the local preview.

## Directory maintenance

The builder bundles public data locally; visitors make no directory lookup requests. `src/data/senators.json` was retrieved October 4, 2026 from the [official Senate XML directory](https://www.senate.gov/general/contact_information/senators_cfm.xml). It contains names, states, contact links, and Washington office addresses. `contactFor` in `src/lib/letter-builder.ts` holds overrides where a more direct contact form is known. Some directory entries point to an office homepage; the UI explains how to find Contact or Email there.

`src/data/zip-directory.json` was generated from the September 2026 [USPS ZIP Locale Detail](https://postalpro.usps.com/ZIP_Locale_Detail) workbook. To refresh both snapshots, download the current official files, then run:

```sh
python3 scripts/import-directories.py /path/to/senators.xml /path/to/ZIP_Locale_Detail.xlsx YYYY-MM-DD
npm test
npm run build
```

The importer validates the 100-member, two-per-state roster and official HTTPS URLs before writing it. A vacancy or roster change requires reviewing this invariant. Inspect the generated diff and verify changed contact links. The ZIP source URL in the importer also needs updating when importing a newer workbook. No automatic scheduled refresh is configured.

### House directory

`src/data/representatives.json` supplies the letter builder’s representative autocomplete through `src/lib/representatives.ts`. The shared accessible search markup lives in `src/components/RepresentativeSearch.astro`. It was retrieved October 4, 2026 from the [Clerk's MemberData XML](https://clerk.house.gov/xml/lists/MemberData.xml), published October 1, and the [House.gov directory](https://www.house.gov/representatives). It contains 433 serving voting representatives, five delegates, and Puerto Rico's resident commissioner. Florida's 20th and Texas's 23rd districts are recorded separately as vacancies, not selectable former members.

Each serving member has a stable Bioguide ID, official full name, separate surname for salutations, state, district number and display label, role, official website, Washington office mailing address with ZIP+4, and office phone. District `0` means an at-large or nonvoting seat; use `districtLabel` and `role` for display. Addresses include the addressee and are ready for postal letters. These are Washington offices, not a complete list of local district offices. Website links are official homepages, not verified direct contact-form URLs. They were extracted from the official directory; availability of every individual website was not tested.

The importer joins sources by state and district, checks surnames, offices, phones and vacancy status against both, validates all 441 seats and unique member IDs, and records source URLs, hashes, publication date, and retrieval date. Any disagreement stops import before the existing snapshot is overwritten. It normalizes the Clerk's `AQ00` American Samoa seat code to postal state `AS` and uses one explicitly verified HTTPS override for Menefee's homepage.

To refresh, download both public files and run from `website/`:

```sh
curl --fail --location https://clerk.house.gov/xml/lists/MemberData.xml --output /tmp/house-member-data.xml
curl --fail --location https://www.house.gov/representatives --output /tmp/house-directory.html
python3 scripts/import-representatives.py /tmp/house-member-data.xml /tmp/house-directory.html YYYY-MM-DD
```

Replace `YYYY-MM-DD` with the actual download date. Review the generated diff, especially membership changes and vacancies. No API key, account, live visitor lookup, or scheduled refresh is involved. The [Clerk's data guide](https://clerk.house.gov/member_info/MemberData_UserGuide.pdf) describes the fields and public-domain reuse of the data.

## Content

- `src/pages/index.astro`: homepage editorial sections.
- `src/content/background.md`: complete briefing. Its displayed source dates live in `src/pages/background.astro` and `src/layouts/Layout.astro`.
- `src/templates/letters/senator.md` and `representative.md`: the two shared letter templates.
- `src/pages/take-action.astro`, `src/scripts/letter-builder.ts`, and `src/styles/letter-builder.css`: wizard markup, behavior, and styling.
- `src/styles/global.css`: shared design and responsive layouts.

Search indexing is disabled through the shared robots meta tag. Crawlers need access to read `noindex`, so do not combine it with a blanket robots.txt block. This directive is not access control.

The source wording reflects the supplied September 2026 materials. Directory refreshes do not update legal content or its displayed source date. The site builds to `dist/` and can be served by any static host; no runtime React, backend, or third-party fonts are needed.

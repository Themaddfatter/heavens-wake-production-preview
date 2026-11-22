# Development continuity — Heaven's Wake Production (HWP)

_Last reviewed: 2026-11-22. This document is a development handoff, not a live-release certificate._

## Repository and deployment
- Repository: `Themaddfatter/heavens-wake-production-preview`, default branch `main`.
- GitHub `main` revision inspected before documentation: `1760361b0e54c75fcf2dd74b2ad461a51adf6eac` — `Use ApiBiblia for RVR1960 in HWP Bible settings`. Re-read latest commit at the start of every session; the file may have changed after the snapshot.
- Production URL: `https://production.sioncdo.com` (verify current DNS and live release independently).
- Key files: `index.html`, `hwp-style.css`, `hwp-access.css`, `sync-staging/`, `hwp-bibles/`; HWP is a static front end connected to shared Sion services. Shared backend and Ministry Connect reside in `Themaddfatter/sion-schedule-next`.
- Deployment workflow: `.github/workflows/verify-hwp-production.yml`, `main` push with explicit application paths; `docs/**` alone is excluded from that workflow's normal push trigger. Workflow uses the existing self-hosted `hwp-wsl` runner and GitHub Pages.
- Do **not** remove/replace/reset runners, GitHub Pages, domains, credentials, shared data, authorization, or backend integrations as part of unrelated work.

## Non-negotiable requirements
- HWP sign-in uses Ministry Connect accounts; access is restricted to authorized Audio Video, Ministerial, and administrator accounts as configured in the live permission model. Unauthorized users should receive an informative access-denied explanation. Do not weaken access checks just to make login succeed.
- Shared media, service settings, and other durable state should sync automatically after login and across devices. Do not rely on browser-only state for the sole persistent copy.
- Light/dark application theme must not unintentionally alter the background presentation, its banner, font colors, or output headers.
- Preserve editable presentation backgrounds, accurate image/video fitting controls, slide editor and stage-screen editor capabilities, and existing service integrations.
- Honor bilingual presentation/scripture settings and licensed translation provider conditions. Do not expose translation API keys in client code or documentation.

## User-reported work needing verification
Requests below are **not** asserted to be broken in the latest release; compare with live behavior and code before changing.
- Background media editing: reported inability to resize photos, scale/fit videos, and independently edit presentation backgrounds; full fitting controls are requested in slide and stage editors.
- Background presentation preview: text in left pane reportedly not visible and theme-switch appearance needs isolation.
- Sign-in: visual parity with HWS login (logo sizing, fields, icons, password eye); automatic shared-library connection and synchronization after successful sign-in.
- Service workflow: use the term **Services** instead of Playlists; user-configurable service types; preserve the existing service-to-presentation relationships.
- Bible translation settings: the most recent inspected commit routes RVR1960 through ApiBiblia. That is **committed code only**, not confirmation the API request works or the update is live; verify provider permissions, test response, and release result.
- Storage and upload: persistent shared media should work with existing storage/backend setup. Do not substitute a storage provider or discard data without explicit approval.

## How to continue safely in a new chat
1. Read this file, refresh the repository `main` HEAD and latest workflow status, inspect the relevant source and tests; cross-check the Sion backend when integrations are involved.
2. Treat user reports separately from proof: log **COMPLETED / WORKING ON / NOT STARTED / BLOCKED** with concrete changed files and commit SHA.
3. Distinguish **implemented**, **committed**, **deployed**, and **verified on production.sioncdo.com**. When verification is absent, label it unverified.
4. Keep log output minimal but do not skip necessary test, release, security, permissions, or live-site checks. Re-read files before writes to avoid overwriting another session.
5. After material changes, update this handoff's status without removing unresolved issues.
6. Never write credentials, private data, or unpublished licensed Bible text into this handoff.

## Snapshot
- Inspect date: 2026-11-22.
- Baseline `main` SHA: `1760361b0e54c75fcf2dd74b2ad461a51adf6eac`.
- No source files, application settings, storage, runners, or release workflows were changed as part of this documentation task. Live deployment status was **not** independently verified.

## Bible browser and presentation translation — November 22, 2026
- Requested: preserve the full-chapter Bible reader, with a view-language dropdown above Create Presentation (English KJV / Spanish RVR1909), including chapter navigation, verse selection and Bible search in the chosen local text. Create Presentation must open a separate translation chooser and create slides using the selected edition; the browser language and slide translation are independent.
- Implemented in `index.html` on `main` at commit `ce3f8c01d4260ee5df0481abd244480db68c9273`. Reader uses bundled local KJV/RVR1909 assets; licensed translation requests are made only for presentation creation and reuse the existing passage cache. Spanish book-name reference input is supported.
- Four inline scripts passed syntax compilation. GitHub Actions production workflow run `45043719807` for `ce3f8c01` completed successfully (including deploy to GitHub Pages and automated HTTP checks of `https://production.sioncdo.com`); the dynamic Pages deployment run `45043719107` also succeeded. This verifies release and HTTP reachability, not authenticated end-to-end user interaction with the new Bible UI. Confirm public-domain resources and translation API licensing remain intact.

## HWP quick scripture adder — November 22, 2026
- Reported screenshot: entering `hech 2:38` with NLT in the bottom quick scripture adder yielded misleading `No API.Bible id is set for New Living Translation` before any correct scripture request. Root cause: the parser used the untranslated book token `Hech`, which cannot map to API.Bible's canonical book code (`ACT`), although the configured NLT Bible ID was present.
- Code fix `2e3cae3db3f1fe97043fa82775c70c479ee4da98` in HWP `index.html`: shared book resolver recognizes Spanish names/abbreviations by the existing Spanish/KJV book index; quick scripture adder normalizes API lookups through locally bundled KJV book metadata before the licensed provider call; missing-book error distinguished from missing translation ID; live-preview debounce increased from 180ms to 500ms. Translation/API authorization remains unchanged.
- Verified locally in tool context: four inline JavaScript blocks compile; nine English/Spanish reference parser regression cases pass. Production workflow `45044222064` completed successfully for commit `2e3cae3d`, including the existing self-hosted runner, GitHub Pages deployment, and the automated HTTP verification step for `https://production.sioncdo.com`. This is not an authenticated browser interaction test. Cannot verify actual NLT provider authorization without user's credential-bearing session. Do not confuse an upstream translation license failure with the reference parser bug.

## Service presentation numbering — November 22, 2026
- User request: remove the visible numeric prefixes from presentations in the HWP Service pane, while preserving ordering and slide numbering.
- Implemented in `index.html` on `main` at `1ae83478da9c2e7d0b159237b3f0a2638e7f1877`: removed only the service-presentation `service-num` span showing `r+1`; the Background `BG` label and slide thumbnail numbering remain intact.
- Static code assertions verified a unique targeted removal and unchanged background/slide labels. Existing GitHub Actions workflow run `45051549167` completed successfully, including inline JavaScript syntax checks, GitHub Pages deploy from self-hosted `hwp-wsl` runner, and automated HTTP production checks. Authenticated visual UI interaction was not tested.

## HWP light-theme readability pass — November 22, 2026
- Request: audit the light theme so low-contrast text and controls remain readable in all major HWP operator surfaces.
- Committed to `main`: `5a941a0578df887f1ee466a494881a136f0c6ff8` — appended a scoped 55-rule light-mode accessibility pass to `hwp-access.css` without editing HTML, scripts, dark-theme selectors, sign-in appearance, authorization, saved state, or projected media.
- Covered toolbar labels/actions, active service/presentation rows (excluding intentionally dark BG row), panes, search fields and placeholders, settings navigation/help, Bible verse numbering, library folders/preview windows, media cards, stage-editor controls, number-spinner controls, drag/delete icons and error alerts. The presentation-content boundary is unchanged; output artboards/thumbnails are excluded from light-specific recoloring.
- Local static checks: balanced CSS braces; reference light-foreground/background combinations checked at ratios 5.56:1 to 12.96:1 (selection text 8.71:1, verse number 6.71:1); check does **not** replace an authenticated browser visual audit.
- GitHub Pages dynamic deployment run `45052024458` for `5a941a05`: completed successfully. The separate self-hosted HWP verification workflow was not listed for this commit at the time of inspection; direct `https://production.sioncdo.com` HTTP and authenticated visual confirmation were unavailable from current tools. Do not call the custom-domain deployment independently verified without those checks.
- Final follow-up commit `2abfe72ee115a9e49eb0f8af2974974442d9a215` darkened gold text/active accents in background-library headings, chapter numbers, Help, templates, and mobile navigation without changing projected output. GitHub Pages dynamic run `45052169855` succeeded. Self-hosted HWP workflow run `45052170243` completed successfully, including four inline-JS syntax checks, Pages deployment, and automated HTTP verification of `https://production.sioncdo.com` (HWP home, CSS assets and auth module). **Production HTTP deployment verified**; authenticated visual end-to-end testing remains unverified.


## Service header grouping — November 22, 2026
- Requested: permanent **Praise Songs** and **Sermon** headings in HWP's Services pane; names locked, colors adjustable, and positions draggable. Other custom headings also own their linked presentations; Service Start/End are boundaries, not parent headings.
- Implemented in index.html commits 6344c5190894c1523a9cad27b1f70986fbdf5445 and c5ac96e731c0c794674e7564d0ca69954abb9403. Data model stores groupHeaderId on linked presentations, serviceGroupsMigrated on playlists, and permanentHeaderKey on protected headers. Existing services migrate on mount and newly created services seed both headers. Moves carry grouped presentations, dropping inside a header links them, and standalone gaps unlink them. Deleting a custom header detaches its linked children; protected headers reject renaming and deletion.
- hwp-style.css commit 780fc6e2b16203de3b0cfec5411deb5cf2e53f1b: only linked rows are indented; standalone drop zones and previews indicate link/unlink. Styling is confined to operator UI, not projected slides.
- Eight helper assertions passed for migration, mandatory headers, membership, atomic move, relinking/unlinking, boundary moves, and protecting headings. Inline JavaScript syntax checked by GitHub Actions. Final CSS deployment workflow 45053416621 needs success confirmation. Authenticated browser drag/drop visual testing remains unverified.

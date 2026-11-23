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

## Service header movement correction — November 22, 2026
- User clarified that only the boundary headers **Service Start** and **Service End** are fixed. The permanent **Praise Songs** and **Sermon** headings (and custom headings) must be draggable, with linked presentations staying attached.
- Fixed in `index.html` at commit `cfe22fbf215ff4e2436d5cf4593cec4a35aa162e`: header drag targets on Service Start/End now place the header immediately within the service at the correct edge rather than silently using the presentation-only mover. Dragging headers into the visible inter-item gaps also works. The new `hwpServiceMoveHeaderBefore` helper keeps each header and its children in one atomic block, while only independent presentations unlink in a standalone gap. Boundary headers remain non-draggable and permanent names cannot be changed.
- Validation: all four inline JavaScript blocks compiled, and six targeted movement checks passed (first/last internal positions, move to another header's child slot, protect grouped children, drag relative to another header, fixed boundary behavior). Self-hosted HWP workflow `45060531760` and GitHub Pages dynamic workflow `45060531269` both succeeded for that commit, including syntax verification, Pages deployment, and the production HTTP/theme isolation checks. Authenticated browser drag-and-drop was not independently tested.


## Silent service drag previews and indented header drop boxes — November 22, 2026
- Updated `index.html` on main at `e365ab233957e0fecbe94de3b4d0ecba4bb84bd9`: removed visible text labels/overlays from drag positioning. Added `headerDrop(headerId)`, a dedicated text-free insertion target immediately beneath every service header, available while dragging a presentation. Drop there links the presentation to that header using the existing `move-service-item` action. Existing standalone gaps still unlink; moving headers still carries their linked presentations.
- Updated `hwp-style.css` at `b3ffcabd70bcb72332ab2a5c1eaef1e86a76a5bc`: visual empty insertion rectangles, indented for linked presentations and full width for standalone items or moved headers. Removed obsolete floating text-preview styles.
- Verified syntax of all nine `index.html` script tags; verified helper behaviors for attaching presentations, unlinking standalone presentations, and moving headers with children. Static checks confirmed text-free placeholders and indented target CSS.
- CI and production deployment could not be independently confirmed from the available Actions/status or production HTTP tools. Avoid claiming the changes are live until the self-hosted runner and production URL have been verified.

## Bible verse right-click and automatic service header routing — November 22, 2026
- Requirement: right-click an individual verse in the Bible reader to choose a configured translation and send its Scripture presentation to the end of the Sermon header; every new Scripture presentation follows the existing Sermon entries in send order; every song added to a service goes to the end of Praise Songs in send order. Keep independent presentations independent and keep header movement/group controls.
- Implemented in `index.html` on `main` at `a835114ac3d1f7a0a929935c4681d3957abb5554`. Right-click opens the existing HWP context-menu component and offers only translation options authorized by current Bible settings. Selection uses the existing local Bible assets/licensed provider lookups, targets the clicked verse (not any previously selected range), and reports failures visibly by toast. Existing Create Presentation modal still handles selected ranges.
- A shared `hwpServiceAppendPresentation` helper routes category `scripture` to the protected Sermon header, category `song` to Praise Songs, and other categories to standalone insertion. It is used by Scripture imports and the library add action, preserving input order and header positions even if the headers have been moved. New blank presentations also use the shared service-insert path.
- Validation before commit: all four nonempty inline scripts compiled; seven targeted helper assertions covered required headers, song and Scripture insertion order, append after moving a header, noncategorized independence, and context-menu code paths. The tests are static/isolated and do not establish authenticated browser behavior or licensed API availability.
- Deployment: self-hosted HWP production workflow `45082803293` completed successfully for app commit `a835114ac3d1f7a0a929935c4681d3957abb5554`, including inline JS syntax validation, Pages deployment, and automated production HTTP/theme isolation verification. The parallel automatic Pages workflow `45082802796` was cancelled at its deploy step, but the dedicated production workflow succeeded afterward. No workflow was manually dispatched. Authenticated browser interaction and licensed provider authorization have not been independently tested.

## Selected Bible verse range via right-click — November 22, 2026
- User clarification: when multiple verses are selected in the Bible reader, right-click and choose a translation to create a **single** Scripture presentation containing the **entire** selected range in canonical verse order, under the Sermon header.
- Updated `index.html` in commit `50be7ef336bb635af5e3396548529393b99dd5a0`: `hwpBibleRightClickRange` preserves an in-range application selection (including Shift-click) or a native text selection spanning verse rows; clicking outside selection falls back to the single clicked verse. Context-menu title displays full range and the selected translation invokes the existing importer with explicit start/end and configured verses-per-slide. Header insertion remains in the shared `hwpServiceAppendPresentation` flow.
- Validation: four inline JavaScript blocks compiled; six targeted behavior tests passed (UI multi-selection interior/end, outside click, single verse, native drag-selection, and native selection outside click). No API provider keys altered or runner manually dispatched.
- Deployment: self-hosted HWP production workflow `45083576616` completed successfully, including JavaScript syntax, Pages deployment, and automated production HTTP/theme-isolation checks. Authenticated end-to-end Bible interaction remains unverified.


## 2026-11-22 — Shared Firebase cloud media staging (NOT LIVE)
- Target: one independently hosted Firebase Storage library for Ministry Connect, HWS, HWW and HWP; existing Firebase Auth/Firestore stay master for accounts, settings, song/sermon data.
- HWP: synchronize media into each authorized browser's own on-disk OPFS while HWP is open; play local Blob files rather than streaming during services. No owner's PC/Mac, Google Drive desktop app or personal Google credentials required. Firefox/Chrome/Edge use OPFS; desktop clients may later use standard folders.
- Staged GitHub branch: `feature/firebase-shared-media-sync-20261122` in this repo (and the other existing repositories). HWW empty repository received an initial cloud adapter on main.
- Storage rules draft in Ministry Connect: `config/storage-shared-v1.rules.staging` and rollout guide `docs/FIREBASE_SHARED_CLOUD_STORAGE_ROLLOUT.md`. Staged code and HWP OPFS/Firebase adapter exist; browser mock tests for HWP local download, revision checking, failed transfer rollback and Firebase adapter passed. No live bucket or Firebase emulator tests performed.
- **No production deployment or Action/PC runner was started. No existing media files were migrated, overwritten or deleted.**
- Blocking prerequisite: Firebase Console owner must inspect existing bucket/rules, enable Blaze + Cloud Storage if needed, identify actual bucket, approve merged rules and verified origins/CORS. Only then connect front-end adapters, migrate copies of media with identity/integrity checks, run security/real-browser tests, and cut over.

## 2026-11-22 — Labels plus button, scripture panel, center service headers
- Updated `index.html` and `hwp-access.css`: Settings > Labels add action uses a bounded icon-only `+` control with an accessible name; Tags retains its Add text. Reused the existing live Scripture form inside the right Preview pane below a dividing rule; removed its old bottom-center instance. Kept the translation lookup, Send live, and Add to service handlers unchanged. Center service header bands now match the left-pane border, centered text, decorative tildes, and saved background/text colors, extending across the center column.
- Validation before commit: all nonempty inline JavaScript blocks compile, the Scripture component occurs exactly once in Show mode, and changes are scoped to UI presentation. Deployment and authenticated-browser verification pending after commit.


## Multi-translation Bible slide sections and abbreviation tags — 2026-11-22
- User reported the changes from the "Add Bible Translations" conversation were not live. On inspection, `main` had the prior 1–4-translation modal and `MUL` presentation model, but did not include translation section headings, automatic abbreviation tags or Bible settings for them.
- Implementation committed in `index.html`: `d6e586ba4e61df106d3b2d0f7a3192c231a18fc5` (group headings, generated Scripture slide badges and document tags, settings); `6e05b96f10f1ce5bfa0146649023cc16bee559e8` (enforce black-on-white tag chips in slide views).
- Normal Bible Create Presentation supports 1–4 translations, default count set in Settings → Bible; right-click multi-translation chooser shares the same `import-scripture` reducer. Each scripture slide gets an abbreviation-based tag (white background/black lettering) and a projected badge. Section headings in the slide grid appear when the translation changes. Existing Scripture slides are normalized and reflect Bible settings for heading visibility, badge visibility, position and text size. Keep Bible text licensing / access checks unchanged.
- Source verification: all four HTML inline JS blocks compiled successfully using V8 Function parsing. Twelve isolated source-level regressions passed (badge contrast, translation matching, persistence/idempotence, positioning, tags, divider boundaries and settings).
- **Release status:** code committed to `main`; custom-domain deployment and authenticated end-to-end user session **not independently verified** in this tool session. HWP's `.github/workflows/verify-hwp-production.yml` triggers on index.html pushes, uses existing self-hosted `hwp-wsl` runner, and verifies `https://production.sioncdo.com`. Do not claim the feature live until a successful production job and visual test are confirmed. Do not change the runner or hosting architecture to hide a deployment issue.


## 2026-11-22 — Recovery after multi-translation release
- User reported production.sioncdo.com showed the old logo and HWP did not open after the 2026-11-22 Bible translation updates. The production workflow had reported success, but its HTTP/syntax checks did not verify the authenticated browser startup.
- Restored ONLY `index.html` from the last previously verified build, commit `24e7375e7c3402bca729928cb36eb7c703b5a379`, in recovery commit `944351b72acd86d20d6be5d667c9d875f0112373`; did not reset service data, media, shared assets, other repository files, or history.
- Recovery production workflow run `45110950249` succeeded, including deployment and HTTP checks of `https://production.sioncdo.com`; authenticated end-to-end startup and browser-side logo cache remain unverified.
- Do NOT reintroduce the new Bible tag / badge / divider / Settings normalization from `d6e586ba...` and `6e05b96f...` to production without testing startup with older persisted libraries, full Bible and song workflows, and actual logged-in browser usage. Preserve the older working multi-translation selector while reworking the new presentation enhancements separately.


## 2026-11-22 — Safe Bible multi-translation presentation release
- Implemented in PR #2, merged into main at commit 550aa59b17bea44a51ff9df8e40c54604fbff771.
- Normal Bible Create presentation and verse right-click selectors offer one to four translations, in separate slides within one presentation. Settings > Bible controls the default count; verses per slide and MUL naming remain unchanged.
- New Scripture slides receive a persistent matching abbreviation tag (hwp_bible_translation_*) with white background and black text in the tag UI, plus an optional audience badge with white fill and black type. Settings > Bible controls the divider headings, badge visibility, corner and text size.
- The manual Apply translation tags and badges to existing Scripture slides action updates older saved presentations explicitly. Editing the badge settings also refreshes Scripture slides intentionally, rather than at library startup.
- Dividers are editor-only above each translation group; they never project to the audience. The UI follows the existing song language separator pattern.
- Crucial safety constraint: do NOT automatically decorate or normalize all saved Scripture slides in Kt during application startup. The previous release caused a loading regression.
- Added tests/hwp-bible-presentations.test.mjs. PR validation run 45111719853 passed the existing media tests and the Bible regression suite.
- Production workflow run 45111775873 passed syntax checks, Bible tests, GitHub Pages deployment and custom-domain HTTP/content verification at https://production.sioncdo.com.
- Authenticated browser startup, slide projection and real Bible API data paths were not independently tested in this tool session.


## 2026-11-23 — Startup correction and multi-song medley selection
- Fixed startup crash `a.map is not a function` in commit `d02a62f65166db85c31bda7124fe68c086ca785f`: the service-row live-status boolean shadowed the service-row array. Pages and browser-release workflows succeeded. Authenticated startup not independently verified.
- Added "Create medley from selected songs" to the HWP service-pane context menu in `9b3ce853ba7c4e47b6fca152352773eb0228e0f7`. Select songs with Command/Ctrl or Shift, right-click a selection, and the first in service order becomes the medley root. Regression added in `44d87fce538bca2cd4fce6c149806403ef75450b`. Pages deployment for app commit succeeded; authenticated UI verification still needed.
- NOT IMPLEMENTED: published Ministry Connect schedules -> HWP services; HWW assigned list -> HWP service songs/medleys; HWS published sermon Scriptures -> HWP service Scriptures. Existing Ministry Connect `functions/production-center.js` creates `sionProductionDecks`, but standalone HWP uses a separate chunked `hwpSharedWorkspace/current`. Existing HWW song-library bridge updates presentations, not service playlists. Published HWS summary omits translated-copy entries and legacy production deck uses fallback editions, so do not silently label fallback text as the requested translation. Implement idempotent conflict-safe reconciliation, preserve manual content and unpublished state, honor edition permissions, and test real authenticated end-to-end workflows before release.

## 2026-11-23 — HWP Stage Message, Media Manager and slide editor release

- PR #9 was merged into main at `9aaed6b90a6490ebc70c1e43b0ea3c03551d033d`. Follow-up changes corrected outdated regression expectations in `tests/hwp-bible-presentations.test.mjs` at `3b1572f67d3116b5a7e4f9ea2dd7eb1b3be6e79b`.
- Release cache-busting and explicit deployment checks were committed to main at `e5e746694cb7e249e035e0f497f4c8932e0e4b07`. The live page identifier was subsequently bumped to `hwp-stage-media-controls-v2`, and `hwp-access.css` uses the v2 cache key. The v2 release also flips the media submenu at viewport edges and invalidates stale logo URL cache at sign-out.
- Code: Stage Message now persists until an explicit Take off stage action, with stacked Send / Take off icon buttons and hover labels; Clear All preserves the selected background; the stage preview strips audience slide and media backgrounds but retains lyric text. Multi-translation presentation identifiers use selected abbreviations in order, not MUL.
- Media Manager: drag/drop items between folders, create folders, right-click Copy / Paste / Duplicate / Delete and hover Send to folder menu, including photo/video/audio media. Copies preserve the original file source reference and receive distinct media IDs. Audio entries are not added as slides.
- Background slides show Photo Background / Video Background sections and type-driven labels. Background editing uses the standard + Slide creator instead of the old Add image/video and Clear controls. The center presentation title is no longer editable inline; the slide count remains.
- Slide Edit: Shape -> Type, any kind switch clears text/runs/bindings, and Text editing is limited to text-only selections. The fill control says Photo or Video and the upload button is visually prominent. Repeated uploaded logo/media reads share cached resolved URLs.
- Firebase wiring verified in source: Ministry Connect's `sion-schedule-next` Auth/Functions, Firebase Storage bucket `gs://sion-schedule-next.firebasestorage.app`, shared workspace and browser-local OPFS media synchronization. Cloud boot failures now report Sync issue when the browser is online and retry at 15-second intervals. This is **source configuration evidence, not proof of account-specific authenticated sync success or desktop-native local playback**.
- Validation: ten inline script blocks compiled with V8; eight new source-level regression tests passed; five isolated behavioral checks passed (stage message, Clear All, folder move, stage background stripping, cached logo fetches). The PR's existing `Validate HWP Firebase local media synchronization` run `45271203472` failed 2 **outdated source assertions** (MUL wording and prior logo resolver), which were updated in a subsequent main commit. A passing fresh CI run was **not independently observed**. No manual self-hosted runner rerun was initiated.
- **Live verification limitation:** GitHub main now contains the work, and existing GitHub Pages release checks are configured to request `https://production.sioncdo.com` and check the new marker. This tool session could not fetch the custom domain or its GitHub Pages alias (both browser/web requests were blocked), and authenticated end-to-end visual testing was unavailable. **Do not claim the new features are verified live until an actual successful deployment observation and authenticated visual test.**

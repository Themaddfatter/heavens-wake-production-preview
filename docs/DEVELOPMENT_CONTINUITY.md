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

# Heaven's Wake Production — macOS desktop foundation

The native Mac application uses the production HWP website as its single source for the UI, authentication and live service data. The site is loaded in a sandboxed Electron window with no Node integration or privileged renderer bridge. Existing web/phone/tablet releases are unchanged. A new launch loads the current website; an already-open session is not forcibly refreshed. Use View > Reload HWP when safe. Existing website caching and release notifications still apply.

The desktop updater checks at startup and every 30 minutes, downloads a signed native update in the background, and installs it when the app normally quits or when the operator explicitly chooses Install Downloaded Update. No forced restart mid-service. The public repository's GitHub Releases are the native update feed. Do not publish a different product to that feed.

## Run a development preview on a Mac
Install Node.js 24 and run:
```sh
cd desktop/mac
npm install
npm run check
npm start
```
This is not an Apple-approved installer. It uses Electron's default icon until the official HWP icon is supplied as build/icon.icns and configured in the package. Do not distribute development builds.

## Release setup
Register a dedicated self-hosted macOS GitHub Actions runner with the macOS label (Xcode command line tools, Node, GitHub CLI and internet access). Do not run untrusted pull request jobs on this runner. Keep it separate from the existing Windows/web deployment runner. Use a Developer ID Application certificate for the church's Apple team, not an App Store certificate.

Set repository Actions secrets (never commit their values):
- HWP_MAC_CSC_LINK: base64 PKCS#12 certificate export with private key.
- HWP_MAC_CSC_KEY_PASSWORD: certificate export password.
- HWP_MAC_APPLE_ID, HWP_MAC_APPLE_APP_SPECIFIC_PASSWORD, HWP_MAC_APPLE_TEAM_ID: notarization credentials.
- HWP_MAC_UPDATE_SIGN_KEY: persistent Ed25519 update-manifest signing key in electron-builder's supported format. Keep a secure backup; changing it arbitrarily can break updates.

The workflow is designed to run on main when desktop files change or on manual dispatch. It uses one universal app for Apple Silicon and Intel; builds DMG and ZIP, verifies Apple signature/notarization, then publishes the release metadata and artifacts. Version derives from the workflow run number. Never reuse a published version; if a run needs a new version, use a new workflow dispatch. Do not publish until the Mac acceptance checks pass.

## First-release acceptance checklist
- Generate and commit the npm lockfile using a trusted Mac, then change CI to npm ci for reproducible dependency installs.
- Verify the official icon, signing identity and stapled app on clean Intel and Apple Silicon Macs. Check the downloaded DMG opens without a Gatekeeper override.
- Test actual Ministry Connect login and persistent login, camera/mic permission prompts, local network mixer connection, HWP audience/stage output windows, keyboard shortcuts, and livestream.
- Check signed update metadata and upgrade from an installed earlier version; verify download while running and install only on normal quit or explicit restart.
- Test new web deployments on desktop, mobile, and tablet; verify existing web cache/update behavior and avoid forced refresh during service.
- Add a Download for Mac link to the live website once the verified release exists. Native display management, offline media storage and hardware bridge integration need further work and are not claimed by this initial wrapper.

## Build a local test DMG before signing credentials are ready

On the Mac, with Node.js 24 and Xcode command line tools installed:

```sh
cd desktop/mac
npm install --no-audit --no-fund
npm run check
npm run dist:preview
```

The output is in `dist-preview/`. This is a local, ad-hoc-signed preview, not an Apple-notarized distribution. It has its own app ID and disables native automatic updates; website updates still use the production site. Do not publish preview installers to the signed update feed. The Mac release requires the Apple credentials and real-device tests above.

'use strict';
const { build, Platform, Arch } = require('electron-builder');
const path = require('node:path');
const fs = require('node:fs');
const pkg = require('./package.json');
if (process.platform !== 'darwin') {
  console.error('Run the preview build on a Mac. The public release requires a signed macOS build.');
  process.exit(1);
}
// Keep the test app isolated from the eventual signed release and its update feed.
const config = structuredClone(pkg.build);
config.appId = 'com.sioncdo.hwp.preview';
config.productName = 'HWP';
config.directories.output = 'dist-preview';
config.forceCodeSigning = false;
config.mac.identity = '-';
config.mac.artifactName = 'HWP.${ext}';
config.mac.hardenedRuntime = false;
config.mac.notarize = false;
config.mac.target = ['dmg'];
config.dmg.sign = false;
config.publish = null;
config.extraMetadata = { hwpPreview: true };
const arch = process.env.HWP_PREVIEW_UNIVERSAL === '1' ? Arch.universal : (process.arch === 'arm64' ? Arch.arm64 : Arch.x64);
build({projectDir: __dirname, config, targets: Platform.MAC.createTarget(['dmg'], arch), publish: 'never'})
  .then(files => {
    const dmgs = files.filter(file => file.endsWith('.dmg') && fs.statSync(file).size > 0);
    if (!dmgs.length) throw new Error('No preview installer was generated.');
    for (const file of dmgs) console.log('Local preview installer: ' + path.resolve(file));
  }).catch(error => { console.error(error); process.exitCode = 1; });

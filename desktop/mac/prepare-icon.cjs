'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const source = path.resolve(__dirname, '../../hwp-logo.png');
const build = path.join(__dirname, 'build');
const iconset = path.join(build, 'HWP.iconset');
if (process.platform !== 'darwin') throw new Error('macOS is required to prepare the HWP application icon');
if (!fs.existsSync(source)) throw new Error('Official HWP logo missing: ' + source);
fs.mkdirSync(iconset, { recursive: true });
try {
  for (const size of [16,32,128,256,512]) {
    for (const scale of [1,2]) {
      const pixels = size * scale;
      const name = 'icon_' + size + 'x' + size + (scale === 2 ? '@2x' : '') + '.png';
      // Keep the official logo proportions, centered on a transparent square.
      const target = path.join(iconset, name);
      execFileSync('/usr/bin/sips', ['-Z', String(pixels), '-s', 'format', 'png', source, '--out', target]);
      execFileSync('/usr/bin/sips', ['-p', String(pixels), String(pixels), target]);
    }
  }
  execFileSync('/usr/bin/iconutil', ['-c','icns',iconset,'-o',path.join(build,'icon.icns')]);
} finally {
  fs.rmSync(iconset, {recursive:true, force:true});
}

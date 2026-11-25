import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Mixer cursor is set in the native range control and its thumb, not only an external override',()=>{
 const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 assert.doesNotMatch(styles,/\.hwp-mixer-(?:fader|calibrated-input)[^{]*\{[^}]*cursor:ns-resize/);
 assert.match(html,/hwp-access\.css\?v=hwp-fixed-header-v1-fader-cursor-v2/);
 const cursor=html.match(/<style id="hwp-mixer-hand-cursor-v2">([\s\S]*?)<\/style>/)[1];
 assert.match(cursor,/input\.hwp-mixer-calibrated-input\{cursor:grab!important\}/);
 assert.match(cursor,/input\.hwp-mixer-calibrated-input:active\{cursor:grabbing!important\}/);
 for(const pseudo of ['::-webkit-slider-thumb','::-moz-range-thumb']){
  assert.ok(cursor.includes('input.hwp-mixer-calibrated-input'+pseudo+'{cursor:grab!important}'));
  assert.ok(cursor.includes('input.hwp-mixer-calibrated-input:active'+pseudo+'{cursor:grabbing!important}'));
 }
});

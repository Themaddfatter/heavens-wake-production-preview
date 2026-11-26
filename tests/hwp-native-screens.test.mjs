import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('HWP Settings exposes native display roles, identification and hardware topology',()=>{
 for(const marker of ['function HwpNativeScreenSettings()','api.onChanged(update)',"call('identify')","call('assign',chosen.id,event.target.value)",'hwp-screen-map','hwp-screen-config-sidebar',"api.enable('audience',!!e.live.audienceOn)","api.enable('stage',!!e.live.stageOn)",'M.jsx(HwpNativeScreenSettings,{})'])assert.ok(html.includes(marker),marker);
});

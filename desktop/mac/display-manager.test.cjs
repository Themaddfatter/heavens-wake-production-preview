'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/display-manager.cjs','utf8');
test('a disconnected saved display cannot block the next connected projector; display events do not reload operator',()=>{
 let attached=[{id:1,internal:true,size:{width:1440,height:900},bounds:{x:0,y:0,width:1440,height:900}}],opened=[],handlers={},events={},written;
 class Win{constructor(opts){this.opts=opts;opened.push(this)}isDestroyed(){return !!this.dead}destroy(){this.dead=true}setAlwaysOnTop(){}setVisibleOnAllWorkspaces(){}setBounds(){}once(){}on(){}loadURL(url){this.url=url;return Promise.resolve()}}
 const op={isDestroyed:()=>false,getBounds:()=>attached[0].bounds,webContents:{send(){},mainFrame:{url:'https://production.sioncdo.com/'}}};
 const screen={getPrimaryDisplay:()=>attached[0],getDisplayMatching:()=>attached[0],getAllDisplays:()=>attached,on:(k,f)=>events[k]=f};
 const mockFs={readFileSync:()=>JSON.stringify({'99':'audience'}),mkdirSync(){},writeFileSync(_p,v){written=v},renameSync(){}};
 const module={exports:{}},requireMock=n=>n==='electron'?{BrowserWindow:Win,screen,ipcMain:{handle:(k,f)=>handlers[k]=f}}:n==='node:fs'?mockFs:require(n);
 const scheduled=[];vm.runInNewContext(source,{module,require:requireMock,URL,console,setTimeout:fn=>{scheduled.push(fn);return scheduled.length},clearTimeout(){}});
 const manager=module.exports.createDisplayManager({app:{getPath:()=>'/tmp'},home:'https://production.sioncdo.com/',securePrefs:{},getOperator:()=>op});
 const event={sender:op.webContents,senderFrame:op.webContents.mainFrame};
 handlers['hwp:screens:enable'](event,'audience',true);assert.equal(opened.length,0);
 attached.push({id:2,internal:false,size:{width:1920,height:1080},bounds:{x:1440,y:0,width:1920,height:1080}});
 events['display-added']();scheduled.pop()();assert.equal(opened.length,1);assert.match(opened[0].url,/display=audience/);assert.equal(JSON.parse(written)['2'],'audience');
 events['display-metrics-changed']();scheduled.pop()();assert.equal(opened.length,1);assert.equal(manager.status().displays[1].role,'audience');
});
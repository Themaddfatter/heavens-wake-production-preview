'use strict';
const {build,Platform,Arch}=require('electron-builder');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const pkg=require('./package.json');
if(process.platform!=='darwin')throw Error('macOS build host required');
const signed=process.env.HWS_SIGNED==='1';
const dir=path.join(__dirname,'build'), icons=path.join(dir,'HWS.iconset'), source=path.join(dir,'official.png');
fs.mkdirSync(icons,{recursive:true});
execFileSync('/usr/bin/curl',['--fail','--silent','--show-error','--location','--retry','3','https://sermon.sioncdo.com/hws-icon-512-white.png','-o',source]);
for(const size of [16,32,128,256,512])for(const scale of [1,2]){
 const p=String(size*scale);
 execFileSync('/usr/bin/sips',['-z',p,p,'-s','format','png',source,'--out',path.join(icons,'icon_'+size+'x'+size+(scale===2?'@2x':'')+'.png')]);
}
execFileSync('/usr/bin/iconutil',['-c','icns',icons,'-o',path.join(dir,'icon.icns')]);
fs.rmSync(icons,{recursive:true,force:true});
const config=structuredClone(pkg.build);
if(!signed){config.appId='com.sioncdo.hws.preview';config.forceCodeSigning=false;config.mac.identity='-';config.mac.notarize=false;config.mac.hardenedRuntime=false;config.mac.artifactName='HWS.${ext}';config.dmg.sign=false;config.publish=null;config.extraMetadata={hwsPreview:true};}
else{config.forceCodeSigning=true;}
build({projectDir:__dirname,config,targets:Platform.MAC.createTarget(signed?['dmg','zip']:['dmg'],Arch.universal),publish:'never'}).catch(e=>{console.error(e);process.exitCode=1});

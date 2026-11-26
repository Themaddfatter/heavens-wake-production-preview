'use strict';
const HOME='https://sermon.sioncdo.com/';
const ORIGIN=new URL(HOME).origin;
function isHws(url){try{return new URL(url).origin===ORIGIN}catch{return false}}
function external(url){try{return new URL(url).protocol==='https:'}catch{return false}}
function permission(url,p){return isHws(url)&&['fullscreen','clipboard-sanitized-write'].includes(p)}
module.exports={HOME,isHws,external,permission};

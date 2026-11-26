'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {isHws,external,permission}=require('./policy.cjs');
test('only exact HWS origin is trusted',()=>{assert.equal(isHws('https://sermon.sioncdo.com/'),true);for(const url of ['https://sermon.sioncdo.com.evil.example','http://sermon.sioncdo.com','https://production.sioncdo.com','file:///tmp/a','javascript:alert(1)'])assert.equal(isHws(url),false)});
test('external links require https',()=>{assert.equal(external('https://example.com'),true);assert.equal(external('file:///tmp/a'),false)});
test('permissions restricted by origin and purpose',()=>{assert.equal(permission('https://sermon.sioncdo.com','fullscreen'),true);assert.equal(permission('https://example.com','fullscreen'),false);assert.equal(permission('https://sermon.sioncdo.com','media'),false)});

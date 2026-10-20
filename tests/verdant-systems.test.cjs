'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { VerdantSim, sanitize } = require('../client/verdant-sim.js');

function memoryStorage(){const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}

test('the garden press consumes Sunfruit and a keeper rewards the delivery once',()=>{
  const sim=new VerdantSim();assert.deepEqual(sim.state.inventory,{fruit:2,scrap:1,shard:1,nectar:0,cell:0});
  assert.equal(sim.craft('garden').ok,true);assert.equal(sim.state.inventory.fruit,0);assert.equal(sim.state.inventory.nectar,1);
  const first=sim.deliver('garden');assert.equal(first.ok,true);assert.equal(first.reward,35);assert.equal(sim.state.credits,35);
  assert.equal(sim.deliver('garden').ok,false);assert.equal(sim.state.credits,35);
});

test('gathering is stored and duplicate harvests cannot mint extra supplies',()=>{
  const sim=new VerdantSim();assert.equal(sim.collect('s1-scrap-a','scrap').ok,true);assert.equal(sim.state.inventory.scrap,2);
  assert.equal(sim.collect('s1-scrap-a','scrap').ok,false);assert.equal(sim.state.inventory.scrap,2);
  assert.equal(sim.collect('s1-fake','credits').ok,false);
});

test('solar recycling has a different recipe and request rewards are one-time',()=>{
  const sim=new VerdantSim();assert.equal(sim.craft('solar').ok,false);
  sim.collect('salvage-1','scrap');assert.equal(sim.craft('solar').ok,true);assert.equal(sim.state.inventory.scrap,0);assert.equal(sim.state.inventory.shard,0);assert.equal(sim.state.inventory.cell,1);
  const order=sim.deliver('power');assert.equal(order.ok,true);assert.equal(order.reward,45);assert.equal(sim.state.inventory.cell,0);
});

test('three distinct orders culminate in a persistent, world-changing SHIFT and a new island',()=>{
  const sim=new VerdantSim();sim.craft('garden');sim.deliver('garden');
  sim.collect('salvage-1','scrap');sim.craft('solar');sim.deliver('power');
  sim.collect('fruit-1','fruit');sim.collect('fruit-2','fruit');sim.deliver('harvest');
  assert.equal(sim.state.completed.length,3);assert.equal(sim.currentOrder(),null);assert.equal(sim.chooseShift('water').ok,true);assert.equal(sim.state.routeOpen,true);assert.equal(sim.state.shiftChoice,'water');
  const firstIslandOrder=sim.orders()[0].title;assert.equal(sim.nextSector().ok,true);assert.equal(sim.state.sector,2);assert.notEqual(sim.orders()[0].title,firstIslandOrder);
  assert.equal(sim.orders()[0].id,'terrace');assert.equal(sim.state.routeOpen,false);
});

test('upgrades spend glow coins, improve production, and persist through reload',()=>{
  const storage=memoryStorage(),sim=new VerdantSim(storage);sim.state.credits=80;sim.save();
  assert.equal(sim.upgrade('garden').level,1);assert.equal(sim.upgrade('garden').level,2);assert.equal(sim.state.credits,10);
  sim.state.inventory.fruit=2;sim.save();assert.equal(sim.craft('garden').ok,true);assert.equal(sim.state.inventory.nectar,2);
  const restored=new VerdantSim(storage);assert.equal(restored.state.upgrades.garden,2);assert.equal(restored.state.inventory.nectar,2);
});

test('save sanitizing rejects unknown versions, invalid types, and corrupt data',()=>{
  assert.equal(sanitize({version:99,credits:999}).credits,0);
  const s=sanitize({version:1,sector:2,credits:-40,inventory:{fruit:Infinity,cell:'999'},upgrades:{garden:50},completed:['terrace','foreign'],harvested:Array(80).fill('ok')});
  assert.equal(s.credits,0);assert.equal(s.inventory.fruit,0);assert.equal(s.inventory.cell,0);assert.equal(s.upgrades.garden,3);assert.deepEqual(s.completed,['terrace']);assert.equal(s.harvested.length,30);
});

test('browser build is offline and includes responsive touch controls and the free local renderer',()=>{
  const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('client/style.css','utf8');
  assert.match(html,/client\/verdant-sim\.js/);assert.match(html,/client\/verdant-game\.js/);assert.match(html,/id="joystick"/);assert.match(html,/id="interactButton"/);assert.match(html,/SANCTUARY UPGRADES|data-upgrade=/i);
  assert.match(css,/@media\(max-width:520px\)/);assert.match(css,/orientation:landscape/);assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(html,/<script\s+src="https?:/i);assert.doesNotMatch(html,/api[_-]?key|secret[_-]?token/i);
});

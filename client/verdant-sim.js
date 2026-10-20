/* Offline-first VERDANT HAVEN economy. Pure state rules are shared by browser and tests. */
(() => {
  'use strict';
  const SAVE_KEY = 'secret-shift.verdant.v1';
  const ORDERS = [
    [
      { id: 'garden', title: 'Wake the sun garden', person: 'Miri · Garden keeper', needs: { nectar: 1 }, reward: 35, hint: 'Press two Sunfruit into nectar, then bring it to Miri.' },
      { id: 'power', title: 'Light the sky market', person: 'Pip · Courier bot', needs: { cell: 1 }, reward: 45, hint: 'Recycle salvage and a crystal shard into a light cell.' },
      { id: 'harvest', title: 'Seed the little terrace', person: 'Tavi · Island cook', needs: { fruit: 2 }, reward: 55, hint: 'Gather two Sunfruit and deliver them fresh.' }
    ],
    [
      { id: 'terrace', title: 'Stock the lantern bazaar', person: 'Tavi · Island cook', needs: { fruit: 3 }, reward: 65, hint: 'The upper terrace has new Sunfruit.' },
      { id: 'beacon', title: 'Re-tune the cloud beacon', person: 'Pip · Courier bot', needs: { cell: 2 }, reward: 80, hint: 'Two crystal cells will wake the beacon.' },
      { id: 'orchard', title: 'Brew a dawn tonic', person: 'Miri · Garden keeper', needs: { nectar: 2 }, reward: 95, hint: 'The upgraded press turns each pair of fruit into nectar.' }
    ]
  ];
  const fresh = () => ({ version: 1, sector: 1, inventory: { fruit: 2, scrap: 1, shard: 1, nectar: 0, cell: 0 }, credits: 0, upgrades: { garden: 0, solar: 0, habitat: 0 }, market:{shelves:{fruit:0,nectar:0,cell:0},sales:0,missed:0,waiting:0},helper:false, completed: [], harvested: [], shiftChoice: '', routeOpen: false, storyComplete: false });
  const safeInt = n => Number.isFinite(n) ? Math.max(0, Math.min(999, Math.floor(n))) : 0;
  function sanitize(raw) {
    const s = fresh(); if (!raw || raw.version !== 1) return s;
    s.sector = raw.sector === 2 ? 2 : 1;
    for (const k of Object.keys(s.inventory)) s.inventory[k] = safeInt(raw.inventory?.[k]);
    s.credits = safeInt(raw.credits);
    for (const k of Object.keys(s.upgrades)) s.upgrades[k] = Math.min(3, safeInt(raw.upgrades?.[k]));
    for (const k of Object.keys(s.market.shelves)) s.market.shelves[k]=Math.min(8,safeInt(raw.market?.shelves?.[k]));
    for (const k of ['sales','missed','waiting']) s.market[k]=safeInt(raw.market?.[k]);
    s.helper=!!raw.helper;
    s.completed = Array.isArray(raw.completed) ? [...new Set(raw.completed.filter(x => ORDERS[s.sector - 1].some(o => o.id === x)))].slice(0, 3) : [];
    s.harvested = Array.isArray(raw.harvested) ? raw.harvested.filter(x => typeof x === 'string' && x.length < 40).slice(0, 30) : [];
    s.shiftChoice = raw.shiftChoice === 'water' || raw.shiftChoice === 'light' ? raw.shiftChoice : '';
    s.routeOpen = !!raw.routeOpen; s.storyComplete = !!raw.storyComplete; return s;
  }
  class VerdantSim {
    constructor(storage) { this.storage = storage || null; this.state = fresh(); this.load(); }
    load() { try { const text = this.storage?.getItem(SAVE_KEY); if (text) this.state = sanitize(JSON.parse(text)); } catch { this.state = fresh(); } return this.state; }
    save() { try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* Private browsing can disable storage; the run remains playable. */ } return this.state; }
    reset() { this.state = fresh(); return this.save(); }
    orders() { return ORDERS[this.state.sector - 1]; }
    order(id) { return this.orders().find(x => x.id === id); }
    packLimit() { return Math.max(12 + safelyLevel(this.state.upgrades.habitat) * 2, this.packLoad()); }
    packLoad() { return Object.values(this.state.inventory).reduce((sum,n)=>sum+safeInt(n),0); }
    currentOrder() { return this.orders().find(x => !this.state.completed.includes(x.id)) || null; }
    collect(id, type, amount = 1) { if (this.state.harvested.includes(id)) return { ok: false, reason: 'already' }; if (!['fruit','scrap','shard'].includes(type)) return { ok: false, reason: 'unknown' };const count=safeInt(amount);if(this.packLoad()+count>this.packLimit())return{ok:false,reason:'pack full'};this.state.harvested.push(id);this.state.inventory[type] = safeInt(this.state.inventory[type] + count); this.save(); return { ok: true, type, amount:count }; }
    craft(kind) {
      const i = this.state.inventory;
      if (kind === 'garden') { if (i.fruit < 2) return { ok: false, reason: 'need two Sunfruit' }; i.fruit -= 2; i.nectar += 1 + (this.state.upgrades.garden >= 2 ? 1 : 0); }
      else if (kind === 'solar') { if (i.scrap < 2 || i.shard < 1) return { ok: false, reason: 'need two salvage and one shard' }; i.scrap -= 2; i.shard -= 1; i.cell += 1 + (this.state.upgrades.solar >= 2 ? 1 : 0); }
      else return { ok: false, reason: 'unknown station' };
      this.save(); return { ok: true, kind };
    }
    deliver(id) { const order = this.order(id); if (!order || this.state.completed.includes(id)) return { ok: false, reason: 'closed' }; for (const [k,n] of Object.entries(order.needs)) if (this.state.inventory[k] < n) return { ok: false, reason: `need ${n} ${k}` }; for (const [k,n] of Object.entries(order.needs)) this.state.inventory[k] -= n; this.state.completed.push(id); this.state.credits += order.reward + this.state.upgrades.habitat * 5; this.save(); return { ok: true, reward: order.reward + this.state.upgrades.habitat * 5, finished: this.state.completed.length === 3 }; }
    upgrade(kind) { const costs = { garden: [25,45,70], solar: [30,50,75], habitat: [35,55,80] }; const level = this.state.upgrades[kind], cost = costs[kind]?.[level]; if (cost == null) return { ok: false, reason: 'max level' }; if (this.state.credits < cost) return { ok: false, reason: `need ${cost} glow coins` }; this.state.credits -= cost; this.state.upgrades[kind]++; this.save(); return { ok: true, level: this.state.upgrades[kind] }; }
    stock(product, requested=4) { if(!['fruit','nectar','cell'].includes(product))return{ok:false,reason:'unknown product'};const s=this.state.market.shelves,cap=6+safelyLevel(this.state.upgrades.habitat)*2,room=Math.max(0,cap-s[product]);const amount=Math.min(room,safeInt(requested),this.state.inventory[product]);if(!amount)return{ok:false,reason:room?'empty pack':'shelf full'};this.state.inventory[product]-=amount;s[product]+=amount;this.save();return{ok:true,amount,total:s[product]}; }
    customerSale(product) { if(!['fruit','nectar','cell'].includes(product))return{ok:false,reason:'unknown product'};const market=this.state.market;if(market.shelves[product]<1){market.missed=safeInt(market.missed+1);this.save();return{ok:false,reason:'empty shelf'};}market.shelves[product]--;market.sales=safeInt(market.sales+1);const coins={fruit:8,nectar:14,cell:18}[product];this.state.credits=safeInt(this.state.credits+coins);this.save();return{ok:true,coins,product}; }
    hireHelper() { if(this.state.helper)return{ok:false,reason:'already hired'};if(this.state.credits<70)return{ok:false,reason:'need 70 glow coins'};this.state.credits-=70;this.state.helper=true;this.save();return{ok:true}; }
    helperStock(product='fruit') { if(!this.state.helper)return{ok:false,reason:'no helper'};return this.stock(product,1); }
    chooseShift(choice) { if (!['water','light'].includes(choice)) return { ok: false, reason: 'invalid route' }; if (this.state.completed.length < 3) return { ok: false, reason: 'finish requests first' }; this.state.shiftChoice = choice; this.state.routeOpen = true; this.state.storyComplete = true; this.save(); return { ok: true, choice }; }
    nextSector() { if (!this.state.storyComplete || this.state.sector !== 1) return { ok: false, reason: 'finish the first signal' }; this.state.sector = 2; this.state.completed = []; this.state.harvested = [];const cap=this.packLimit();for(const k of ['fruit','scrap','shard'])this.state.inventory[k]=Math.min(cap,this.state.inventory[k]+2); this.state.shiftChoice = ''; this.state.routeOpen = false; this.state.storyComplete = false; this.save(); return { ok: true }; }
    snapshot() { return JSON.parse(JSON.stringify(this.state)); }
  }
  function safelyLevel(value){return Number.isFinite(value)?Math.max(0,Math.min(3,value)):0;}
  const api = { VerdantSim, orders: ORDERS, sanitize, saveKey: SAVE_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.VerdantSim = api;
})();

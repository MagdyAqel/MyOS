import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/battle.js';
const advance=(battle,seconds)=>{for(let i=0;i<seconds*20;i++)battle.update(.05);};
test('construction prerequisites, occupied spaces, economy and training',()=>{
 const b=new Battle();
 assert.equal(b.purchase('tank'),false);assert.equal(b.cash,2400);
 assert.equal(b.purchase('power',130,320),false);assert.equal(b.cash,2400);
 assert.equal(b.purchase('supply',320,150),true);
 assert.equal(b.purchase('power',320,450),true);
 assert.equal(b.purchase('barracks',430,150),true);
 const before=b.cash;advance(b,5.1);assert.equal(b.cash,before+180);
 assert.equal(b.purchase('soldier'),true);
 assert.equal(b.entities.filter(e=>e.type==='soldier'&&e.team==='blue').length,3);
 b.cash=0;assert.equal(b.purchase('soldier'),false);assert.equal(b.cash,0);
});
test('commands move units, combat deals damage, and pause freezes simulation',()=>{
 const b=new Battle();b.selectAll();b.command(500,300);
 const tank=b.entities.find(e=>e.type==='tank');const start=tank.x;advance(b,2);assert.ok(tank.x>start);
 b.paused=true;const time=b.time,position=tank.x;advance(b,20);assert.equal(b.time,time);assert.equal(tank.x,position);
 b.paused=false;
 const enemy=b.add('soldier','red',tank.x+40,tank.y);advance(b,.2);assert.ok(enemy.hp<enemy.maxHp);
});
test('waves spawn and headquarters destruction produces terminal outcomes',()=>{
 const b=new Battle();advance(b,40.1);assert.equal(b.wave,1);
 assert.ok(b.entities.some(e=>e.team==='red'&&e.speed));
 b.entities.find(e=>e.team==='blue'&&e.type==='hq').hp=0;b.update(.05);assert.equal(b.status,'lost');
 const lostTime=b.time;advance(b,10);assert.equal(b.time,lostTime);
 const win=new Battle();win.entities.find(e=>e.team==='red'&&e.type==='hq').hp=0;win.update(.05);assert.equal(win.status,'won');
});

test('air mission deploys aircraft with distinct targeting and playable reinforcements',()=>{
 const b=new Battle(1);assert.ok(b.entities.some(e=>e.domain==='air'));
 assert.equal(b.purchase('fighter'),true);
 const bomber=b.entities.find(e=>e.type==='bomber');
 const airEnemy=b.add('fighter','red',bomber.x+35,bomber.y);
 for(const e of b.entities)if(e.team==='blue'&&e.type==='fighter')e.damage=0;
 advance(b,.2);assert.equal(airEnemy.hp,airEnemy.maxHp);
 const groundEnemy=b.add('soldier','red',bomber.x+30,bomber.y);advance(b,2.2);assert.ok(groundEnemy.hp<groundEnemy.maxHp);
});
test('naval deployment stays on water, and submarines cannot fire at ground headquarters',()=>{
 const b=new Battle(2);const sub=b.entities.find(e=>e.type==='submarine');
 b.selected=new Set([sub.id]);b.command(500,30);advance(b,5);assert.ok(sub.y>=285);
 const hq=b.entities.find(e=>e.type==='hq'&&e.team==='red');b.command(hq.x,hq.y);assert.match(b.message,/لا تستطيع/);
 assert.equal(b.purchase('harbor',400,400),false);assert.equal(b.purchase('power',320,450),false);
 assert.equal(b.purchase('destroyer'),true);const ship=b.entities.at(-1);assert.ok(ship.y>=285);
});
test('underwater mission allows torpedoes to destroy submerged command',()=>{
 const b=new Battle(3);const hq=b.entities.find(e=>e.type==='hq'&&e.team==='red');
 assert.equal(hq.domain,'sub');
 for(const e of b.entities)if(e.team==='red'&&e.type==='turret')e.damage=0;
 const sub=b.entities.find(e=>e.type==='submarine');sub.x=hq.x-100;sub.y=hq.y;
 b.selected=new Set([sub.id]);b.command(hq.x,hq.y);advance(b,.2);assert.ok(hq.hp<hq.maxHp);
});

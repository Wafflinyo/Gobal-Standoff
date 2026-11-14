/* Global Standoff 0.4.37 — unified Logs inventory across lumber, caravans, storage and construction. */
(() => {
'use strict';
const SAVE_KEY='global_standoff_v02_save'; // preserves 0.3.x browser saves
const OLD_SAVE_KEY='global_standoff_v01_save';
// Original silver five-sided coin: the currency is Silver Pents (SP), not SP.
const icoMarkup=name=>'<svg class="gs-glyph" aria-hidden="true" viewBox="0 0 32 32"><use href="#gs-i-'+name+'"></use></svg>';
const silverPentIcon=(size=21)=>`<svg class="gs-silver-pent" width="${size}" height="${size}" viewBox="0 0 40 40" aria-label="Silver Pents" role="img"><path d="M20 2L37 14L30.5 35H9.5L3 14Z" fill="#dbe2e7" stroke="#617889" stroke-width="2.4"/><path d="M20 7L31.5 16L27 30H13L8.5 16Z" fill="#a8b9c4" stroke="#f4f9fa" stroke-width="1.5"/><path d="M20 11L20 29M12 17L28 17M14 26L26 26" stroke="#465d6d" stroke-width="1.5" opacity=".4"/><text x="20" y="25.5" text-anchor="middle" font-size="14" font-weight="900" fill="#203e4e" stroke="#edf2f2" stroke-width=".6" paint-order="stroke">SP</text></svg>`;
const moneyLabel=amount=>`${amount} SP`;

const RADIUS=7, HEX=40, MAX_ROUNDS=24, MAJOR_ACTIONS=3, CREDIT_LIMIT_SP=10; // Maximum debt: −10 SP
const COLORS=['#7ed0b7','#e6af79','#b7a1e9','#f08b87'];
const NPCS=[{name:'Alder Union',capital:'Oakspire',sigil:'A'},{name:'Coral Dominion',capital:'Sunport',sigil:'◆'},{name:'Vesper Republic',capital:'Duskfall',sigil:'V'}];
// Each world selects three distinct AI leaders from six strategic mindsets.
// Stable traits persist in saves; a fresh seed mixes assignments.
const CPU_PERSONALITIES={
 frontier:{name:'The Trailblazer',focus:'Territorial expansion',description:'Seeks fertile frontiers and new settlements.',weights:{expand:1.9,economy:1,food:1.1,industry:.8,military:1,science:.7,trade:.8,civic:1,logistics:1.1},aggression:.55,diplomacy:.34,caution:.58},
 merchant:{name:'The Merchant Prince',focus:'Wealth and trade',description:'Prioritizes markets, incomes and trading partners.',weights:{expand:.75,economy:2,food:.85,industry:1.05,military:.5,science:.9,trade:2,civic:.9,logistics:1},aggression:.18,diplomacy:.92,caution:.85},
 industrial:{name:'The Industrialist',focus:'Mines and manufacturing',description:'Secures deposits, factories and transport networks.',weights:{expand:.95,economy:1.1,food:.8,industry:2,military:.7,science:1.05,trade:.9,civic:.7,logistics:1.8},aggression:.4,diplomacy:.58,caution:.62},
 marshal:{name:'The Iron Marshal',focus:'Military strength',description:'Builds defended borders and maintains trained soldiers.',weights:{expand:1.35,economy:.8,food:.9,industry:1.1,military:2,science:.5,trade:.45,civic:.75,logistics:1.15},aggression:.92,diplomacy:.22,caution:.42},
 scholar:{name:'The Scholar',focus:'Research and development',description:'Builds academies, researches technologies and plans ahead.',weights:{expand:.8,economy:1.05,food:1.1,industry:1,military:.5,science:2.1,trade:1.05,civic:1.35,logistics:.85},aggression:.16,diplomacy:.83,caution:.78},
 steward:{name:'The Caretaker',focus:'Food and citizens',description:'Maintains farms, housing and a stable civilian economy.',weights:{expand:.9,economy:1.25,food:1.85,industry:.7,military:.65,science:.85,trade:.9,civic:1.9,logistics:.85},aggression:.24,diplomacy:.73,caution:.94}
};
function assignCpuPersonalities(world){
 const keys=Object.keys(CPU_PERSONALITIES);
 const rng=mulberry32(hash(world.seed+':cpu-personalities:v1'));
 for(let i=keys.length-1;i>0;i--){const j=randInt(rng,i+1);[keys[i],keys[j]]=[keys[j],keys[i]];}
 const taken=new Set();
 for(const p of world.players.slice(1)){
  if(CPU_PERSONALITIES[p.cpuPersonality]&&!taken.has(p.cpuPersonality)){taken.add(p.cpuPersonality);continue;}
  const choice=keys.find(k=>!taken.has(k));p.cpuPersonality=choice;taken.add(choice);
 }
}
function cpuPersonality(p){return CPU_PERSONALITIES[p?.cpuPersonality]||CPU_PERSONALITIES.frontier;}
function cpuRoll(p,tag,extra=''){return mulberry32(hash((G?.seed||'')+':cpu:'+p.id+':'+tag+':'+(G?.round||1)+':'+(p.actionsUsed||0)+':'+extra))();}
const TERRAIN={
 plains:{name:'Plains',color:'#bbc885',yield:{},slots:8,population:30,desc:'Roomy, fertile land ideal for large settlements.'},
 forest:{name:'Forest',color:'#66a17c',yield:{},slots:6,population:20,desc:'Wooded land. Timber must be worked and shipped to be used.'},
 hills:{name:'Hills',color:'#baa079',yield:{},slots:5,population:16,desc:'Rolling terrain with mineral deposits.'},
 desert:{name:'Desert',color:'#d2b879',yield:{},slots:3,population:10,desc:'Arid land with little space for growing communities.'},
 mountain:{name:'Mountains',color:'#97a0a0',yield:{},slots:2,population:6,desc:'Mountain mineral veins; prospect, mine and trade their output.'},
 water:{name:'Lake',color:'#4d97b7',yield:{},slots:0,population:0,desc:'A freshwater lake. Construction and claiming are unavailable.'}
};
// Mountain mineral veins are fixed at world generation. Diamonds are rare both
// as deposits and as individual mining successes; no generic Ore is produced.
const MINERALS={
 coal:{name:'Coal',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-coal"></use></svg>',weight:26,price:2,chance:1,rate:2,reserve:36},
 iron:{name:'Iron',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg>',weight:20,price:3,chance:.95,rate:2,reserve:30},
 copper:{name:'Copper',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-copper"></use></svg>',weight:9,price:5,chance:.85,rate:2,reserve:18},
 silver:{name:'Silver',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-silver"></use></svg>',weight:5,price:9,chance:.6,rate:1,reserve:12},
 goldOre:{name:'Gold Ore',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-gold-ore"></use></svg>',weight:3,price:16,chance:.35,rate:1,reserve:8},
 diamond:{name:'Diamonds',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-diamond"></use></svg>',weight:1,price:40,chance:.12,rate:1,reserve:4}
};
const MINERAL_KEYS=Object.keys(MINERALS);
const START_MINERALS={coal:2,iron:5,copper:0,silver:0,goldOre:0,diamond:0,steel:0};
// Armor is worn by individual named soldiers; Steel requires smelting Iron + Coal.
const GEAR={
 leather:{name:'Leather Armor',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-leather"></use></svg>',bonus:2,item:'leatherArmor'},
 iron:{name:'Iron Armor',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-shield"></use></svg>',bonus:4,item:'ironArmor'},
 steel:{name:'Steel Armor',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-steel"></use></svg>',bonus:7,item:'steelArmor'},
 gold:{name:'Gold-Reinforced Steel',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-gold-ore"></use></svg>',bonus:10,item:'goldArmor'},
 diamond:{name:'Diamond-Reinforced Steel',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-diamond"></use></svg>',bonus:14,item:'diamondArmor'}
};
const GEAR_ORDER=['leather','iron','steel','gold','diamond'];
const RECIPES={
 steel:{name:'Smelt Steel',input:{iron:2,coal:1},output:'steel'},
 leatherArmor:{name:'Leather Armor',input:{leather:2},output:'leatherArmor'},
 woodShield:{name:'Wooden Shield',input:{wood:2},output:'woodShield'},
 bridgeKit:{name:'Bridge Kit',input:{wood:5},output:'bridgeKit'},
 boat:{name:'Boat',input:{wood:6},output:'boat'},
 stoneAxe:{name:'Stone Axe',input:{stone:2,wood:1},output:'stoneAxe'},
 stonePickaxe:{name:'Stone Pickaxe',input:{stone:2,wood:1},output:'stonePickaxe'},
 stoneSword:{name:'Stone Sword',input:{stone:3,wood:1},output:'stoneSword'},
 stoneClub:{name:'Stone Club',input:{stone:2,wood:1},output:'stoneClub'},
 ironArmor:{name:'Iron Armor',input:{iron:2},output:'ironArmor'},
 steelArmor:{name:'Steel Armor',input:{steel:2},output:'steelArmor'},
 goldArmor:{name:'Gold-Reinforced Steel',input:{steel:2,goldOre:1},output:'goldArmor'},
 diamondArmor:{name:'Diamond-Reinforced Steel',input:{steel:2,diamond:1},output:'diamondArmor'}
};
const FACTORY_RECIPES={foundry:['steel'],leatherFactory:['leatherArmor'],woodworks:['woodShield','bridgeKit','boat'],stoneworks:['stoneAxe','stonePickaxe','stoneSword','stoneClub'],armory:['ironArmor','steelArmor','goldArmor','diamondArmor']};
const OUTPUTS={farm:['food','leather'],lumber:['wood'],mine:['stone',...MINERAL_KEYS],foundry:['steel'],leatherFactory:['leatherArmor'],woodworks:['woodShield','bridgeKit','boat'],stoneworks:['stoneAxe','stonePickaxe','stoneSword','stoneClub'],armory:['ironArmor','steelArmor','goldArmor','diamondArmor']};
const GOOD_NAMES={food:'Food',wood:'Logs',bridgeKit:'Bridge Kit',boat:'Boat',stone:'Stone',leather:'Raw Leather',coal:'Coal',iron:'Iron',copper:'Copper',silver:'Silver',goldOre:'Gold Ore',diamond:'Diamonds',steel:'Steel',woodShield:'Wooden Shield',stoneAxe:'Stone Axe',stonePickaxe:'Stone Pickaxe',stoneSword:'Stone Sword',stoneClub:'Stone Club',leatherArmor:'Leather Armor',ironArmor:'Iron Armor',steelArmor:'Steel Armor',goldArmor:'Gold-Reinforced Steel',diamondArmor:'Diamond-Reinforced Steel'};

// v0.4.30: individually craftable helmets, chest plates, weapons and shields.
// Existing armor bundles remain readable for saved soldiers; the new slots are independent.
const WAR_EQUIPMENT={
 leatherHelmet:['Leather Helmet','leatherFactory',{leather:1},'helmet'],
 leatherChest:['Leather Chest Plate','leatherFactory',{leather:2},'chest'],
 woodSword:['Wooden Sword','woodworks',{wood:2},'weapon'],
 woodBattleAxe:['Wooden Battle Axe','woodworks',{wood:3},'weapon'],
 woodSpear:['Wooden Spear','woodworks',{wood:2},'weapon'],
 stoneHelmet:['Stone Helmet','stoneworks',{stone:2},'helmet'],
 stoneChest:['Stone Chest Plate','stoneworks',{stone:4},'chest'],
 stoneBattleAxe:['Stone Battle Axe','stoneworks',{stone:3,wood:1},'weapon'],
 stoneSpear:['Stone Spear','stoneworks',{stone:2,wood:1},'weapon'],
 stoneSledgehammer:['Stone Sledgehammer','stoneworks',{stone:4,wood:1},'weapon'],
 ironHelmet:['Iron Helmet','armory',{iron:2},'helmet'],
 ironChest:['Iron Chest Plate','armory',{iron:3},'chest'],
 ironChain:['Iron Chain Plate','armory',{iron:2},'chest'],
 ironSword:['Iron Sword','armory',{iron:2,wood:1},'weapon'],
 ironBattleAxe:['Iron Battle Axe','armory',{iron:3,wood:1},'weapon'],
 ironSpear:['Iron Spear','armory',{iron:2,wood:1},'weapon'],
 ironShield:['Iron Shield','armory',{iron:2,wood:1},'shield'],
 steelHelmet:['Steel Helmet','armory',{steel:2},'helmet'],
 steelChest:['Steel Chest Plate','armory',{steel:3},'chest'],
 steelChain:['Steel Chain Plate','armory',{steel:2},'chest'],
 steelSword:['Steel Sword','armory',{steel:2,wood:1},'weapon'],
 steelBattleAxe:['Steel Battle Axe','armory',{steel:3,wood:1},'weapon'],
 steelSpear:['Steel Spear','armory',{steel:2,wood:1},'weapon'],
 steelShield:['Steel Shield','armory',{steel:2,wood:1},'shield']
};
for(const material of ['gold','diamond']){
 const prefix=material==='gold'?'Gold-Reinforced Steel':'Diamond-Reinforced Steel';
 const ingredient=material==='gold'?'goldOre':'diamond';
 for(const [key,label,qty,slot] of [
  ['Helmet','Helmet',2,'helmet'],['Chest','Chest Plate',3,'chest'],
  ['Chain','Chain Plate',2,'chest'],['Sword','Sword',2,'weapon'],
  ['BattleAxe','Battle Axe',3,'weapon'],['Spear','Spear',2,'weapon'],
  ['Shield','Shield',2,'shield']]){
  WAR_EQUIPMENT[material+'Steel'+key]=[prefix+' '+label,'armory',{steel:qty,[ingredient]:1},slot];
 }
}
for(const [key,[label,factory,input]] of Object.entries(WAR_EQUIPMENT)){
 RECIPES[key]={name:label,input,output:key};
 FACTORY_RECIPES[factory].push(key);
 OUTPUTS[factory].push(key);
 GOOD_NAMES[key]=label;
}
const WAR_SLOT_ITEMS={
 helmet:Object.keys(WAR_EQUIPMENT).filter(k=>WAR_EQUIPMENT[k][3]==='helmet'),
 chest:Object.keys(WAR_EQUIPMENT).filter(k=>WAR_EQUIPMENT[k][3]==='chest'),
 weapon:['stoneSword','stoneAxe',...Object.keys(WAR_EQUIPMENT).filter(k=>WAR_EQUIPMENT[k][3]==='weapon')],
 shield:['woodShield',...Object.keys(WAR_EQUIPMENT).filter(k=>WAR_EQUIPMENT[k][3]==='shield')]
};
const WAR_SHIELD_VALUES={wood:0.06,stone:0.09,iron:0.12,steel:0.15,gold:0.17,diamond:0.19};
const WAR_CHEST_VALUES={leather:0.08,stone:0.11,iron:0.16,steel:0.20,gold:0.22,diamond:0.24};
const WAR_HELM_VALUES={leather:0.025,stone:0.035,iron:0.045,steel:0.06,gold:0.07,diamond:0.08};
function warMaterial(item){
 const key=String(item||'').toLowerCase();
 if(key.includes('diamond'))return 'diamond';
 if(key.includes('gold'))return 'gold';
 if(key.includes('steel'))return 'steel';
 if(key.includes('iron'))return 'iron';
 if(key.includes('stone'))return 'stone';
 if(key.includes('leather'))return 'leather';
 if(key.includes('wood'))return 'wood';
 return 'none';
}
function warSkill(c){
 return Math.max(0,Math.min(100,Math.round(Number.isFinite(c.military?.skill)
  ?c.military.skill:16+(c.military?.training||1)*13+(c.military?.experience||0)*3)));
}
function warMoraleSpeed(c){const m=c.morale??50;return m>=70?1.25:m<35?.75:1;}
function warWeaponClass(key){
 key=String(key||'').toLowerCase();
 return key.includes('sledge')||key.includes('club')?'hammer':
 key.includes('battleaxe')||key.includes('axe')?'axe':
 key.includes('spear')?'spear':'sword';
}
function warAttackSpeed(c){
 if(!c.military?.weapon)return .85*warMoraleSpeed(c);
 const type=warWeaponClass(c.military?.weapon);
 return ({sword:1.15,axe:0.82,spear:1.40,hammer:0.58})[type]*warMoraleSpeed(c);
}
function warWeaponDamage(c){
 if(!c.military?.weapon)return .8;
 const mat=warMaterial(c.military?.weapon),kind=warWeaponClass(c.military?.weapon);
 const base=({sword:2.4,axe:3.2,spear:1.9,hammer:4.2})[kind];
 return base+({none:0,wood:0,stone:0.5,iron:1,steel:1.4,gold:1.7,diamond:1.9})[mat];
}
function warDefense(c){
 const m=c.military||{},old=m.gear&&GEAR[m.gear]?m.gear:null;
 const helmet=warMaterial(m.helmet),chest=warMaterial(m.chest)||'none',shield=warMaterial(m.shield);
 return Math.min(0.58,(WAR_HELM_VALUES[helmet]||0)+(WAR_CHEST_VALUES[chest==='none'?old:chest]||0)+(WAR_SHIELD_VALUES[shield]||0));
}
function canEquipWarItem(p,c,key){
 const slot=Object.entries(WAR_SLOT_ITEMS).find(([,items])=>items.includes(key))?.[0];
 if(!slot||!c?.military||c.military.missionId||c.military[slot]===key)return false;
 const stock=postStock(p,c.military.postId);
 return !!stock&&localCount(stock,key)>0;
}
function equipWarItem(citizenId,key,id=0){
 const p=G.players[id],c=p?.citizens.find(x=>String(x.id)===String(citizenId));
 if(!p||!canCountryAct(p,id)||!canEquipWarItem(p,c,key))return false;
 const slot=Object.entries(WAR_SLOT_ITEMS).find(([,items])=>items.includes(key))[0];
 const stock=postStock(p,c.military.postId);
 addLocal(stock,key,-1);
 const prior=c.military[slot];if(prior&&GOOD_NAMES[prior])addLocal(stock,prior,1);
 c.military[slot]=key;
 useAction(p,p.name+' equipped '+c.name+' with '+GOOD_NAMES[key]+'.',{tileId:c.military.postId,kind:'equip'});
 return true;
}

function emptyMinerals(){return {...START_MINERALS,coal:0,iron:0};}
function veinFor(seed,tileId){
 const rng=mulberry32(hash(seed+':mineral-deposit:'+tileId));
 const roll=rng()*100;let remaining=roll,kind=null;
 for(const key of MINERAL_KEYS){remaining-=MINERALS[key].weight;if(remaining<0){kind=key;break;}}
 if(!kind)return null; // Barren mountains have no mineral deposit.
 const cap=MINERALS[kind].reserve+randInt(rng,7);
 return {kind,remaining:cap,capacity:cap};
}
function prepareMineralVeins(tiles,seed,legacy=false){
 for(const t of tiles){
  if(t.terrain!=='mountain'){delete t.vein;continue;}
  if(t.vein===undefined)t.vein=veinFor(seed,t.id);
  // Existing players' mines remain productive after save migration.
  if(!t.vein&&legacy&&(t.buildings||[]).includes('mine')){const cap=26;t.vein={kind:'iron',remaining:cap,capacity:cap};}
  // Coal is the ONLY secondary mineral. A coal-primary mountain cannot have a second vein.
  if(t.coalVein===undefined){
   const rng=mulberry32(hash(seed+':secondary-coal:'+t.id));
   if(t.vein&&t.vein.kind!=='coal'&&rng()<.38){
    const reserve=11+randInt(rng,14);
    t.coalVein={kind:'coal',remaining:reserve,capacity:reserve};
   }else t.coalVein=null;
  }
  if(!t.vein||t.vein.kind==='coal')t.coalVein=null;
 }
}
function mineralCount(p,key){return Math.max(0,Math.floor(p.minerals?.[key]||0));}
function gearReadiness(c){return Math.round(10+2*(c.military?.training||1)+Math.floor((c.military?.experience||0)/3)+(GEAR[c.military?.gear]?.bonus||0)+30*warDefense(c)+warWeaponDamage(c)+warSkill(c)*.10);}

const BUILDINGS={
 farm:{name:'Farm',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>',gold:4,wood:2,iron:0,space:2,rounds:1,upkeep:1,jobs:[2,4,6],production:{},allow:['plains','forest','hills'],text:'Workers produce Food and raw Leather · both must be delivered'},
 lumber:{name:'Lumber Camp',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-forest"></use></svg>',gold:4,wood:1,iron:0,space:2,rounds:2,upkeep:1,jobs:[2,4,6],production:{},allow:['forest'],text:'Workers harvest Logs, which are immediately usable for construction after delivery to storage. Woodworks crafts equipment from Logs.'},
 mine:{name:'Mine',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-mine"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['mountain'],text:'Produces Stone on EVERY mountain plus any mineral veins'},
 homes:{name:'Homes',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-homes"></use></svg>',gold:5,wood:2,iron:0,space:1,rounds:1,upkeep:1,jobs:[0,0,0],production:{},allow:['plains','forest','hills','desert','mountain'],text:'+8 housing spaces · no workers required · occupied family homes earn Silver Pents'},
 market:{name:'Marketplace',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-market"></use></svg>',gold:7,wood:2,iron:1,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{gold:5},allow:['plains','forest','hills','desert','mountain'],text:'Silver Pents income scales with worker staffing and morale'},
 academy:{name:'Academy',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-book"></use></svg>',gold:8,wood:2,iron:2,space:2,rounds:3,upkeep:2,jobs:[2,3,4],production:{knowledge:3},allow:['plains','forest','hills','desert','mountain'],text:'Research output requires staffed teachers'},
 caravanWarehouse:{name:'Caravan Warehouse',icon:'▣',gold:8,wood:5,iron:0,space:2,rounds:2,upkeep:1,jobs:[1,2,3],production:{},allow:['plains','forest','hills','desert'],text:'Houses 1 / 2 / 3 wagons and an equal number of paid driver jobs. A wagon cannot move without an employed citizen driver.'},
 storageWarehouse:{name:'Storage Warehouse',icon:'▤',gold:7,wood:4,iron:0,space:2,rounds:2,upkeep:1,jobs:[0,0,0],production:{},allow:['plains','forest','hills','desert','mountain'],text:'Holds 40 / 80 / 140 goods at levels 1 / 2 / 3. Nearby factories can collect supplies here.'},
 builderBunk:{name:'Builders’ Bunk',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-builder"></use></svg>',gold:8,wood:3,iron:0,space:1,rounds:2,upkeep:1,jobs:[0,0,0],production:{},allow:['plains','forest','hills','desert','mountain'],text:'Houses 1 / 2 / 3 active builders by level. Builders travel before working'},
 post:{name:'Military Post',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-shield"></use></svg>',gold:8,wood:2,iron:2,space:2,rounds:2,upkeep:2,jobs:[1,2,3],production:{},allow:['plains','forest','hills','desert','mountain'],text:'Administrative staff support recruitment and the 12-troop garrison'},
 foundry:{name:'Steelworks Factory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-foundry"></use></svg>',gold:10,wood:3,iron:3,space:2,rounds:3,upkeep:3,jobs:[2,4,6],production:{},allow:['plains','hills'],text:'Receives Iron + Coal shipments and smelts Steel'},
 leatherFactory:{name:'Leather Factory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-thread"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['plains','forest','hills'],text:'Raw Leather → Leather Armor; send gear to a military post'},
 woodworks:{name:'Woodworks Factory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-saw"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['forest','plains','hills'],text:'Craft Wooden Shields, Boats and Bridge Kits from Logs'},
 stoneworks:{name:'Stone Workshop',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-axe"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['plains','hills','mountain'],text:'Stone + Wood → axes, pickaxes, swords or clubs'},
 armory:{name:'Armory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-builder"></use></svg>',gold:10,wood:2,iron:2,space:2,rounds:3,upkeep:3,jobs:[2,4,6],production:{},allow:['plains','hills'],text:'Produces Iron, Steel, SP and Diamond armor from delivered metal'}
};
const TECHS={irrigation:{name:'Irrigation',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-water"></use></svg>',gold:3,knowledge:4,desc:'+1 Food per Farm, every round.'},commerce:{name:'Commerce',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg>',gold:4,knowledge:5,desc:'+1 Silver Pent per Marketplace, every round.'},cartography:{name:'Cartography',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-compass"></use></svg>',gold:4,knowledge:5,desc:'Expansion costs 2 less SP.'}};
const CARDS={grant:{name:'Royal Grant',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-pent"></use></svg>',desc:'Gain 6 SP.'},harvest:{name:'Great Harvest',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>',desc:'Gain 5 Food.'},supplies:{name:'Supply Caravan',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg>',desc:'Gain 3 Logs and 2 Iron.'},insight:{name:'Discovery',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-scroll"></use></svg>',desc:'Gain 3 Knowledge.'},charter:{name:'Frontier Charter',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-map"></use></svg>',desc:'Next expansion costs 3 less SP.'},permit:{name:'Building Permit',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg>',desc:'Next building costs 3 less SP.'}};
const CARD_POOL=['grant','harvest','supplies','grant','insight','charter','permit','supplies','harvest','grant','insight','permit'];
const CAPITAL_SPOTS=[[-5,-1],[5,1],[-1,5],[1,-5]];
const PREFIX=['Silver','Oak','Raven','Stone','High','Dawn','West','Green','Amber','Cinder','Iron','Sun','River','Frost','Moss','Ash','Bright','Elder','Wolf','Pine','Star','Cloud'];
const FIRST_NAMES=['Amelia','Noah','Sofia','Elias','Ava','Liam','Maya','Arlo','Leah','Mateo','Iris','Theo','Freya','Kai','Nora','Ezra','Zara','Finn','Luna','Leo','Mila','Ada','Rowan','Owen','Emery','Jude','Alina','Isaac','Layla','Miles','Hazel','Elian','Eva','Soren','Talia','Nico','Cora','Dara','Hugo','Mira'];
const LAST_NAMES=['Brook','Stone','Vale','Arden','Reed','Ashford','Pike','Rivera','Hart','Bennett','Thorne','Wells','Oakley','Shaw','Moreno','Santos','North','Lark','Dunn','Voss','Mercer','Greene','Frost','Dawson','Gray','Rivers','Hale','Moss','Hill','Quinn'];
const SUFFIX=['watch','brook','vale','stead','ford','crest','haven','mere','fall','ridge','field','reach','spire','moor','wood','grove','port','hold','cross','gate'];
const el=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.floor(n).toLocaleString('en-US');
const key=(q,r)=>q+','+r;
const tileAt=(q,r)=>G?.tiles.find(t=>t.q===q&&t.r===r);
const neighbors=t=>[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].map(([dq,dr])=>tileAt(t.q+dq,t.r+dr)).filter(Boolean);
const distance=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const randInt=(rng,n)=>Math.floor(rng()*n);
let G=null,selectedColor=0,showBuild=false,showResearch=false,cpuBusy=false,toastTimer=0,suppressClick=false,drag=null,rosterTab="citizens";
let view={x:-600,y:-490,w:1200,h:980};
// Desired zoom remains independent of device orientation. Never derive the
// next target zoom from a landscape-expanded viewBox or portrait will jump.
let cameraDesiredWidth=1200,viewportLayoutFrame=0,lastViewportLayoutKey='';
function phoneMapLayout(){
 return window.matchMedia?.('(pointer: coarse)')?.matches&&Math.min(window.innerWidth,window.innerHeight)<650;
}
function phoneLandscapeLayout(){
 return phoneMapLayout()&&window.matchMedia?.('(orientation: landscape)')?.matches;
}
function mobileCameraWidth(phone=420,desktop=540){
 return phoneMapLayout()?phone:window.innerWidth<600?phone:desktop;
}
function fittedCameraWidth(desiredWidth,aspect=mapAspect()){
 // Keeping map width fixed while the phone is horizontal collapses its
 // visible vertical span and makes the board seem massively zoomed in.
 // Expand both axes in landscape, not just the SVG's canvas.
 return phoneLandscapeLayout()?desiredWidth*Math.max(1,aspect*.94):desiredWidth;
}
function reconcileMapViewport(force=false){
 if(!G||!document.body.classList.contains('gs-playing'))return;
 const svg=el('worldMap'),rect=svg.getBoundingClientRect();
 if(rect.width<20||rect.height<20)return;
 const aspect=rect.width/rect.height,orientation=phoneLandscapeLayout()?'phone-landscape':'regular';
 const key=`${orientation}:${Math.round(rect.width/8)}:${Math.round(aspect*10)}`;
 if(!force&&key===lastViewportLayoutKey)return;
 lastViewportLayoutKey=key;
 // MoveCamera recomputes from the live aspect on every animation frame.
 // Do not reset the camera or rebuild hexes halfway through its turn.
 if(cameraMoveFrame)return;
 const cx=view.x+view.w/2,cy=view.y+view.h/2,width=fittedCameraWidth(cameraDesiredWidth,aspect);
 view.w=width;view.h=width/aspect;view.x=cx-width/2;view.y=cy-view.h/2;
 svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
}
function scheduleMapViewportReflow(){
 if(viewportLayoutFrame)cancelAnimationFrame(viewportLayoutFrame);
 viewportLayoutFrame=requestAnimationFrame(()=>{
  viewportLayoutFrame=requestAnimationFrame(()=>{
   viewportLayoutFrame=0;reconcileMapViewport();
  });
 });
}
let cpuLastAction=null; // Exact event emitted by a CPU action. No guesses from tile array order.
let sheetMode=null,previewCardIndex=-1;
let scenePlayback=null,scenePlaybackSerial=0;
let cardEffectBusy=false,cardEffectPromise=Promise.resolve(); // Temporarily conceal completed changes until their on-board animation.
function getCountry(){return G.players[0];}
function getSelected(){return G.tiles.find(t=>t.id===G.selectedId)||null;}
function active(){return G&&!G.finished&&!cpuBusy&&!scenePlayback&&!cardEffectBusy&&G.turnIndex===0;}
function actionsUsed(p){return Number.isInteger(p.actionsUsed)?Math.min(MAJOR_ACTIONS,Math.max(0,p.actionsUsed)):(p.acted?1:0);}
function actionsRemaining(p){return Math.max(0,MAJOR_ACTIONS-actionsUsed(p));}
function canCountryAct(p,id){return !!G&&!G.finished&&G.turnIndex===id&&actionsRemaining(p)>0&&(id!==0||!cpuBusy);}
function canAct(){return active()&&actionsRemaining(getCountry())>0;}
// Credit is available until −10 SP. No discretionary spending at the floor.
function hasMoney(p,n){return Number.isFinite(p.gold)&&p.gold>-CREDIT_LIMIT_SP&&p.gold-Math.max(0,Number(n)||0)>=-CREDIT_LIMIT_SP;}
// Worksite IDs stay stable even when other buildings in the hex are sold.
function ensureBuildingMeta(world){
 world.nextBuildingId=world.nextBuildingId||1;
 for(const t of world.tiles){
  t.buildingMeta??=[];
  for(let i=0;i<(t.buildings||[]).length;i++){
   if(!t.buildingMeta[i]?.id)t.buildingMeta[i]={id:world.nextBuildingId++,level:1,autoHire:true};
   t.buildingMeta[i].level=Math.max(1,Math.min(3,t.buildingMeta[i].level||1));
   t.buildingMeta[i].autoHire??=true;
   t.buildingMeta[i].stock??={};t.buildingMeta[i].routes??={};
   if(OUTPUTS[t.buildings[i]]?.length){
    if(!['full','continuous','once'].includes(t.buildingMeta[i].unloadMode))t.buildingMeta[i].unloadMode='full';
    t.buildingMeta[i].unloadOncePending??={};
    if(t.buildingMeta[i].unloadMode==='once'&&!Object.values(t.buildingMeta[i].unloadOncePending).some(n=>n>0))t.buildingMeta[i].unloadMode='full';
   }
   if(FACTORY_RECIPES[t.buildings[i]]?.length&&!FACTORY_RECIPES[t.buildings[i]].includes(t.buildingMeta[i].recipe))t.buildingMeta[i].recipe=FACTORY_RECIPES[t.buildings[i]][0];
   world.nextBuildingId=Math.max(world.nextBuildingId,t.buildingMeta[i].id+1);
  }
  t.buildingMeta.length=(t.buildings||[]).length;
 }
}

// Builder citizens are not normal employees. A bunk's level governs crew capacity.
function builderCapacity(p,world=G){
 return world.tiles.filter(t=>t.owner===p.id).reduce((total,t)=>total+(t.buildings||[]).reduce((sum,type,i)=>sum+(type==='builderBunk'?(t.buildingMeta?.[i]?.level||1):0),0),0);
}
function syncBuilders(p,world=G){
 if(!p.citizens)return;
 const capital=world.tiles.find(t=>t.owner===p.id&&t.capital);
 if(!capital)return;
 const max=builderCapacity(p,world);
 let builders=p.citizens.filter(c=>!!c.builder);
 // Preserve existing builders on active jobs; only dismiss idle surplus.
 while(builders.length>max){const idle=builders.find(c=>!c.builder.projectId);if(!idle)break;idle.builder=null;builders=p.citizens.filter(c=>!!c.builder);}
 const candidates=p.citizens.filter(c=>c.age>=18&&!c.military&&!c.builder&&c.health>=25&&!isBusyPorter(c,world)&&!isBusyExpedition(c,world)).sort((a,b)=>(!!a.job)-(!!b.job)||b.health-a.health||b.morale-a.morale);
 while(builders.length<max&&candidates.length){const citizen=candidates.shift();citizen.job=null;citizen.builder={locationId:capital.id,projectId:null,travelRemaining:0};builders.push(citizen);}
}
function idleBuilders(p){return p.citizens.filter(c=>c.builder&&!c.builder.projectId);}
function assignedBuilders(p,jobId){return p.citizens.filter(c=>c.builder?.projectId===jobId);}
function buildersSummary(p){const builders=p.citizens.filter(c=>!!c.builder);return {total:builders.length,free:builders.filter(c=>!c.builder.projectId).length,busy:builders.filter(c=>!!c.builder.projectId).length,capacity:builderCapacity(p)};}
function appointBuilder(p,job,tile){
 const builder=idleBuilders(p)[0];if(!builder)return null;
 const origin=G.tiles.find(t=>t.id===builder.builder.locationId)||G.tiles.find(t=>t.owner===p.id&&t.capital);
 builder.builder.projectId=job.id;
 builder.builder.travelRemaining=countryTravelRoute(p.id,origin||tile,tile)?.turns??Math.ceil(distance(origin||tile,tile));
 builder.builder.destinationId=tile.id;
 job.builderIds??=[];job.builderIds.push(builder.id);
 return builder;
}
function sendAdditionalBuilder(t,jobId,id=0){
 const p=G.players[id],job=G.projects.find(j=>j.id===jobId&&j.owner===id&&j.tileId===t.id);
 if(!active()||!job||!idleBuilders(p).length)return false;
 const b=appointBuilder(p,job,t);if(!b)return false;
 addLog(`${b.name} joined construction of ${BUILDINGS[job.type].name} at ${t.name}.`);
 save();render();showToast(`${b.name} dispatched to help build`);return true;
}
function ensureStartingCrews(world){
 for(const p of world.players){
  const capital=world.tiles.find(t=>t.owner===p.id&&t.capital);if(!capital)continue;
  // Capital civic package is part of the nation's original starting infrastructure.
  if(!capital.buildings.includes('homes')){capital.buildings.push('homes');capital.buildingMeta??=[];capital.buildingMeta.push({id:world.nextBuildingId++,level:1,autoHire:false,stock:{},routes:{}});}
  if(!capital.buildings.includes('builderBunk')){capital.buildings.push('builderBunk');capital.buildingMeta??=[];capital.buildingMeta.push({id:world.nextBuildingId++,level:1,autoHire:false,stock:{},routes:{}});}
  p.expeditions??=[{id:`exp-${p.id}-1`,name:'Frontier Expedition',level:1,locationId:capital.id,targetId:null,remaining:0,citizenIds:[],elapsed:0}];
   for(const exp of p.expeditions){
    // Old saved worlds may contain an expedition already halfway to its goal.
    // Let that existing journey finish; every new dispatch needs real citizens.
    if(exp.targetId&&!Array.isArray(exp.citizenIds))exp.legacyInFlight=true;
    if(!Array.isArray(exp.citizenIds))exp.citizenIds=[];
    exp.elapsed??=0;
   }
  for(const c of p.citizens){c.builder??=null;if(c.builder)c.job=null;}
  syncBuilders(p,world);
 }
}
function idleExpedition(p){return (p.expeditions||[]).find(crew=>!crew.targetId);}
function expeditionForTile(tileId){return G.players.flatMap(p=>(p.expeditions||[]).map(crew=>({...crew,owner:p.id}))).find(c=>c.targetId===tileId);}
function pendingClaim(tileId){return G.players.some(p=>(p.expeditions||[]).some(c=>c.targetId===tileId));}
// Expeditions are undertaken by named civilians, never by builders, soldiers,
// hired workers, or citizens simultaneously carrying resources. Age 16+ may
// volunteer even though paid building jobs require adults of age 18+.
function isBusyExpedition(c,world=G){
 return !!world?.players?.some(p=>(p.expeditions||[]).some(crew=>crew.targetId&&(crew.citizenIds||[]).includes(c.id)));
}
function eligibleExpeditionCitizens(p,world=G){
 return (p.citizens||[]).filter(c=>c.age>=16&&!c.job&&!c.builder&&!c.military&&!isBusyPorter(c,world)&&!isBusyExpedition(c,world)&&(c.health??0)>0);
}
function clearExpedition(crew){crew.targetId=null;crew.originId=null;crew.citizenIds=[];crew.remaining=0;crew.travelTotal=0;crew.elapsed=0;crew.legacyInFlight=false;}
function progressExpeditions(){
 for(const p of G.players)for(const crew of p.expeditions||[]){
  if(!crew.targetId||(G.turnClock||0)<=(crew.startedClock??-2)+1)continue;
  // Only pre-update expeditions without assigned names may finish as legacy
  // flights. All newly dispatched expeditions require 1-2 real citizens.
  if(!crew.legacyInFlight){
   crew.citizenIds=(crew.citizenIds||[]).filter(id=>p.citizens.some(c=>c.id===id&&(c.health??0)>0));
   if(!crew.citizenIds.length){
    const destination=G.tiles.find(t=>t.id===crew.targetId);
    addLog(`${p.name}'s expedition to ${destination?.name||'the frontier'} was abandoned: no civilian participants remain.`);
    clearExpedition(crew);continue;
   }
   crew.elapsed=(crew.elapsed||0)+1;
   const target=G.tiles.find(t=>t.id===crew.targetId),harsh=target?.terrain==='desert'||target?.terrain==='mountain';
   for(const citizenId of crew.citizenIds){
    const citizen=p.citizens.find(c=>c.id===citizenId);if(!citizen)continue;
    citizen.morale=Math.max(0,(citizen.morale??50)-(crew.citizenIds.length===1?2:1));
    // Companions share the hardship; difficult terrain, poor morale, and
    // older age make health loss more likely, with deterministic world RNG.
    const odds=(crew.citizenIds.length===1?.35:.20)+(harsh?.20:0)+(citizen.morale<35?.15:0)+(citizen.age>=60?.10:0);
    const rng=mulberry32(hash(G.seed+':expedition-health:'+crew.id+':'+crew.startedClock+':'+crew.elapsed+':'+citizen.id));
    if(rng()<Math.min(.85,odds))citizen.health=Math.max(0,(citizen.health??50)-1);
   }
   // Check again AFTER applying travel fatigue, including on the arrival tick.
   // Zero-health participants cannot establish a claim by themselves.
   crew.citizenIds=crew.citizenIds.filter(id=>p.citizens.some(c=>c.id===id&&(c.health??0)>0));
   if(!crew.citizenIds.length){
    const destination=G.tiles.find(t=>t.id===crew.targetId);
    addLog(`${p.name}'s expedition to ${destination?.name||'the frontier'} was abandoned after its crew became incapacitated.`);
    clearExpedition(crew);continue;
   }
  }
  crew.remaining=Math.max(0,crew.remaining-1);
  if(crew.remaining>0)continue;
  const tile=G.tiles.find(t=>t.id===crew.targetId);
  if(tile&&tile.owner===null&&tile.terrain!=='water'&&neighbors(tile).some(n=>n.owner===p.id)){
   tile.owner=p.id;reallocateHousing(p);discoverContacts();checkWarningViolation(tile,p.id);
   G.completedScenes.push({projectId:`claim-${p.id}-${tile.id}-${G.turnClock}`,owner:p.id,tileId:tile.id,kind:'expand'});
   const names=(crew.citizenIds||[]).map(id=>p.citizens.find(c=>c.id===id)?.name).filter(Boolean);
   addLog(`${p.name}'s expedition established control of ${tile.name}${names.length?' with '+names.join(' and '):''}.`);
  }
  crew.locationId=tile?.owner===p.id?tile.id:crew.locationId;clearExpedition(crew);
 }
}
function advanceWorldTurn(){
 G.turnClock=(G.turnClock||0)+1;
 progressExpeditions();progressProjects();progressDomesticRoads();progressBridgeJobs();progressDiplomaticFalcons();progressWarOrders();progressSiegeMarches();progressTradeOffers();progressTradeRoutes();progressShipments();
 save();
}

function worksite(t,index){return t.buildingMeta?.[index]||null;}
function workCapacity(type,level){const spaces=BUILDINGS[type]?.jobs||[0,0,0];return spaces[Math.max(0,Math.min(2,level-1))]||0;}
function worksiteWorkers(p,site){return site?p.citizens.filter(c=>c.job?.siteId===site.id&&!c.military&&c.age>=18):[];}
function isBusyPorter(c,world=G){return !!world?.shipments?.some(j=>j.kind==='porter'&&j.porterId===c.id);}
function eligibleWorker(c,world=G){return c.age>=18&&!c.military&&!c.builder&&!isBusyExpedition(c,world)&&c.health>=25;}
function assignWorkers(p,world=G){
 if(!world)return;
 const owned=world.tiles.filter(t=>t.owner===p.id);
 const sites=[];
 for(const t of owned)for(let i=0;i<t.buildings.length;i++){
  const meta=worksite(t,i);if(meta)sites.push({tile:t,kind:t.buildings[i],meta,capacity:workCapacity(t.buildings[i],meta.level)});
 }
 const siteById=new Map(sites.map(a=>[a.meta.id,a]));
 const staff=new Map();
 for(const c of p.citizens){
  const site=c.job&&siteById.get(c.job.siteId);
  if(!site||!eligibleWorker(c,world)||(staff.get(site.meta.id)||0)>=site.capacity){c.job=null;continue;}
  staff.set(site.meta.id,(staff.get(site.meta.id)||0)+1);
 }
 const priority={builderBunk:20,storageWarehouse:18,caravanWarehouse:-2,farm:0,lumber:1,mine:2,leatherFactory:3,woodworks:4,stoneworks:5,foundry:6,armory:7,market:8,academy:9,post:10,homes:11};
 sites.sort((a,b)=>(priority[a.kind]??9)-(priority[b.kind]??9));
 const unemployed=p.citizens.filter(c=>eligibleWorker(c,world)&&!c.job&&!isBusyPorter(c,world)).sort((a,b)=>b.morale-a.morale||b.health-a.health||a.id.localeCompare(b.id));
 for(const site of sites){
  if(!site.meta.autoHire)continue;
  let used=staff.get(site.meta.id)||0;
  while(used<site.capacity&&unemployed.length){const c=unemployed.shift();c.job={siteId:site.meta.id,tileId:site.tile.id};used++;}
  staff.set(site.meta.id,used);
 }
}
function workforceSummary(p){
 const employed=p.citizens.filter(c=>!!c.job&&!c.military).length;
 const available=p.citizens.filter(c=>eligibleWorker(c)&&!c.job&&!isBusyPorter(c)).length;
 return {employed,available,wages:employed};
}
function workQuality(p,site,type){
 const busyPorters=new Set((G?.shipments||[]).filter(j=>j.owner===p.id&&j.kind==='porter').map(j=>j.porterId));
 const level=site?.level||1,workers=worksiteWorkers(p,site).filter(c=>!busyPorters.has(c.id)),slots=workCapacity(type,level);
 const morale=workers.length?workers.reduce((sum,c)=>sum+c.morale,0)/workers.length:0;
 const ratio=slots?workers.length/slots:0;
 const efficiency=workers.length?Math.max(.35,Math.min(1.35,.50+morale/110)):0;
 return {count:workers.length,slots,level,morale,ratio,efficiency};
}
function hireAt(t,index,id=0){
 const p=G.players[id],site=worksite(t,index),type=t.buildings[index];
 if(!active()||t.owner!==id||!site)return false;
 const q=workQuality(p,site,type),worker=p.citizens.filter(c=>eligibleWorker(c)&&!c.job&&!isBusyPorter(c)).sort((a,b)=>b.morale-a.morale)[0];
 if(!worker||q.count>=q.slots)return false;
 worker.job={tileId:t.id,siteId:site.id};site.autoHire=false;if(type==='caravanWarehouse')syncCaravans(p);save();render();showToast(`${worker.name} hired at ${BUILDINGS[type].name}`);return true;
}
function releaseAt(t,index,id=0){
 const p=G.players[id],site=worksite(t,index);
 if(!active()||t.owner!==id||!site)return false;
 const workers=worksiteWorkers(p,site);
 if(!workers.length)return false;
 const departing=workers[workers.length-1];if(departing.job?.role==='caravanDriver'){const cart=p.caravans.find(c=>c.id===departing.job.caravanId);if(cart?.shipmentId){showToast('Driver is on an active trip. Reassign them when the wagon returns.');return false;}if(cart)cart.driverId=null;}
 departing.job=null;site.autoHire=false;save();render();showToast('Worker released');return true;
}
function toggleAutoHire(t,index,id=0){
 const p=G.players[id],site=worksite(t,index);
 if(!active()||t.owner!==id||!site)return false;
 site.autoHire=!site.autoHire;
 if(site.autoHire)assignWorkers(p);
 if(t.buildings[index]==='caravanWarehouse')syncCaravans(p);
 save();render();return true;
}
function upgradePrice(t,index){
 const meta=worksite(t,index),b=BUILDINGS[t.buildings[index]];
 return meta&&meta.level<3?{gold:b.gold+3*meta.level,wood:2*meta.level,iron:meta.level}:null;
}
function upgradeBuilding(t,index,id=0){
 const p=G.players[id],meta=worksite(t,index),cost=upgradePrice(t,index);
 if(!canCountryAct(p,id)||!allowed(p,t)||!meta||!cost)return false;
 if(!idleBuilders(p).length||G.projects.some(j=>j.upgradeSiteId===meta.id)||!hasMoney(p,cost.gold)||nationalResourceCount(p,'wood')<cost.wood||nationalResourceCount(p,'iron')<cost.iron)return false;
 p.gold-=cost.gold;spendNationalResource(p,'wood',cost.wood);spendNationalResource(p,'iron',cost.iron);
 const duration=Math.max(2,meta.level*2);
 const job={id:G.nextProjectId++,owner:id,tileId:t.id,type:t.buildings[index],upgradeSiteId:meta.id,remaining:duration,total:duration,startedRound:G.round,builderIds:[]};
 G.projects.push(job);appointBuilder(p,job,t);
 useAction(p,`${p.name} began upgrading ${BUILDINGS[t.buildings[index]].name} to Level ${meta.level+1} at ${t.name}.`,{tileId:t.id,kind:'upgrade'});
 if(id===0)showToast('Upgrade underway');return true;
}
// Goods exist only in a site's bounded inventory, in a physical caravan, or in storage.
// Storage Warehouses have independent inventories; the capital warehouse remains available.
// Gold/Knowledge are accounting values, not cargo.
function siteLookup(owner,siteId){
 if(siteId==='depot')return {tile:G.tiles.find(t=>t.owner===owner&&t.capital),site:null,kind:'depot'};
 for(const t of G.tiles.filter(t=>t.owner===owner))for(let i=0;i<t.buildings.length;i++){
  if(t.buildingMeta?.[i]?.id===Number(siteId))return {tile:t,site:t.buildingMeta[i],kind:t.buildings[i]};
 }
 return null;
}
function localCount(site,item){return Math.max(0,Math.floor(site?.stock?.[item]||0));}
function addLocal(site,item,n){site.stock??={};site.stock[item]=Math.max(0,localCount(site,item)+n);}
function siteStorageCapacity(kind,level=1){
 const lvl=Math.max(1,Math.min(3,level||1));
 if(kind==='storageWarehouse')return [40,80,140][lvl-1];
 if(FACTORY_RECIPES[kind])return [12,24,42][lvl-1];
 if(['farm','lumber','mine'].includes(kind))return [16,32,54][lvl-1];
 if(kind==='post')return [32,56,88][lvl-1];
 return 0; // Bunks, markets, academies, and caravan garages are not goods stores.
}
function stockUsed(site){return Object.values(site?.stock||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0);}
function endpointStorageCapacity(p,endpoint){
 if(endpoint==='depot')return Infinity; // Legacy treasury/warehouse storage remains valid.
 const found=siteLookup(p.id,endpoint);
 return found?siteStorageCapacity(found.kind,found.site?.level):0;
}
function endpointStorageFree(p,endpoint){
 if(endpoint==='depot')return Infinity;
 const found=siteLookup(p.id,endpoint);
 return Math.max(0,endpointStorageCapacity(p,endpoint)-stockUsed(found?.site));
}
// Multi-item cargo is backward compatible with older single-item shipments.
function shipmentLoads(job){return Array.isArray(job?.cargo)?job.cargo:[{item:job?.item,qty:job?.qty||0,to:job?.to}];}
function shipmentTotal(job){return shipmentLoads(job).reduce((n,e)=>n+Math.max(0,e.qty||0),0);}
function shipmentCargoText(job){
 const loads=shipmentLoads(job).filter(e=>e.qty>0);
 return loads.length?loads.map(e=>e.qty+' '+(GOOD_NAMES[e.item]||e.item)).join(' + '):'nothing';
}
function incomingReserved(owner,endpoint){
 return G.shipments.filter(j=>j.owner===owner&&j.stage!=='return').reduce((sum,j)=>sum+
  shipmentLoads(j).filter(e=>String(e.to)===String(endpoint)).reduce((v,e)=>v+Math.max(0,e.qty||0),0),0);
}
function endpointDeliverySpace(p,endpoint){
 return endpoint==='depot'?Infinity:Math.max(0,endpointStorageFree(p,endpoint)-incomingReserved(p.id,endpoint));
}
function putLocalBounded(p,siteId,item,amount){
 const found=siteLookup(p.id,siteId);if(!found)return 0;
 const fit=Math.min(Math.max(0,amount),endpointStorageFree(p,siteId));
 if(fit>0)addLocal(found.site,item,fit);
 return fit;
}
function storedAt(p,item){
 const stores=[{id:'depot',tile:siteLookup(p.id,'depot')?.tile,count:depotCount(p,item)}];
 for(const tile of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<tile.buildings.length;i++){
  if(tile.buildings[i]!=='storageWarehouse')continue;
  stores.push({id:tile.buildingMeta?.[i]?.id,tile,count:localCount(tile.buildingMeta?.[i],item)});
 }
 return stores.filter(o=>o.tile&&o.count>0);
}
// Resources in any owned Storage Warehouse are nationally available after
// physical delivery. Production sites and cargo in transit never count.
// Construction consumes the actual stored goods exactly once.
function nationalResourceCount(p,item){
 const treasury=depotCount(p,item);
 if(!G?.tiles)return treasury;
 return treasury+G.tiles.filter(t=>t.owner===p.id).reduce((sum,t)=>sum+
  t.buildings.reduce((acc,kind,i)=>acc+(kind==='storageWarehouse'?
   localCount(t.buildingMeta?.[i],item):0),0),0);
}
function spendNationalResource(p,item,amount){
 const required=Math.max(0,Math.floor(amount)||0);
 if(nationalResourceCount(p,item)<required)return false;
 let left=required;
 const fromDepot=Math.min(left,depotCount(p,item));
 if(fromDepot){addDepot(p,item,-fromDepot);left-=fromDepot;}
 if(left)for(const t of G.tiles.filter(t=>t.owner===p.id)){
  for(let i=0;i<t.buildings.length;i++){
   if(t.buildings[i]!=='storageWarehouse')continue;
   const site=t.buildingMeta?.[i],qty=Math.min(left,localCount(site,item));
   if(qty){addLocal(site,item,-qty);left-=qty;}
   if(!left)break;
  }
  if(!left)break;
 }
 return left===0;
}
function nationalBalance(p,item,change){
 if(change>=0)addDepot(p,item,change);
 else spendNationalResource(p,item,Math.min(-change,nationalResourceCount(p,item)));
}
function nearbyStorage(p,tile,item){
 const stores=[{id:'depot',tile:siteLookup(p.id,'depot')?.tile},...G.tiles.filter(t=>t.owner===p.id).flatMap(t=>t.buildings.map((kind,i)=>kind==='storageWarehouse'?{id:t.buildingMeta?.[i]?.id,tile:t}:null).filter(Boolean))];
 return stores.map(o=>({...o,path:o.tile&&(ownedPath(p.id,tile,o.tile)||(p.boats?.length?boatTravelRoute(p.id,tile,o.tile)?.path:null))})).filter(o=>o.path&&endpointDeliverySpace(p,o.id)>0)
  .sort((a,b)=>pathCost(p.id,a.path)-pathCost(p.id,b.path))[0]||null;
}

function depotCount(p,item){
 if(item==='food'||item==='wood')return Math.max(0,Math.floor(p[item]||0));
 if(item in MINERALS||item==='steel')return mineralCount(p,item);
 return Math.max(0,Math.floor(p.warehouse?.[item]||0));
}
function addDepot(p,item,n){
 if(item==='food'||item==='wood')p[item]=Math.max(0,(p[item]||0)+n);
 else if(item in MINERALS||item==='steel'){p.minerals??=emptyMinerals();p.minerals[item]=Math.max(0,(p.minerals[item]||0)+n);}
 else{p.warehouse??={};p.warehouse[item]=Math.max(0,(p.warehouse[item]||0)+n);}
}
function endpointCount(p,endpoint,item){
 return endpoint==='depot'?depotCount(p,item):localCount(siteLookup(p.id,endpoint)?.site,item);
}
function endpointAdd(p,endpoint,item,change){
 if(endpoint==='depot'){addDepot(p,item,change);return change;}
 const found=siteLookup(p.id,endpoint);if(!found?.site)return 0;
 if(change<0){const amount=-Math.min(-change,localCount(found.site,item));addLocal(found.site,item,amount);return amount;}
 return putLocalBounded(p,endpoint,item,change);
}
// Domestic roads occupy a shared hex boundary. Only a country's own adjacent
// tiles are eligible; completed paved edges improve all subsequent movement.
const LOCAL_ROAD_SP=3,LOCAL_ROAD_WOOD=1;
const domesticRoadKey=(a,b)=>[a,b].sort().join('|');
function domesticRoadExists(a,b){
 if(!a||!b||a.owner===null||a.owner!==b.owner)return false;
 const k=domesticRoadKey(a.id,b.id);
 return (G.domesticRoads||[]).some(r=>r.key===k&&r.owner===a.owner);
}
function roadJobBetween(a,b){const k=domesticRoadKey(a.id,b.id);return (G.domesticRoadJobs||[]).find(j=>j.key===k);}
const BRIDGE_SP=2;
function riverCrossing(a,b){return !!a&&!!b&&distance(a,b)===1&&(G.rivers||[]).some(r=>(r.banks||[]).some(pair=>pair.includes(a.id)&&pair.includes(b.id)));}
function lakeBridgeSpan(a,b){if(!a||!b||distance(a,b)!==2)return null;const q=(a.q+b.q)/2,r=(a.r+b.r)/2;return Number.isInteger(q)&&Number.isInteger(r)?G.tiles.find(t=>t.q===q&&t.r===r&&t.terrain==='water')||null:null;}
function crossingType(a,b){if(!a||!b||a.terrain==='water'||b.terrain==='water')return null;return riverCrossing(a,b)?'river':lakeBridgeSpan(a,b)?'lake':null;}
function bridgeExistsBetween(a,b){if(!a||!b)return false;return (G.bridges||[]).some(j=>j.key===domesticRoadKey(a.id,b.id)&&j.owner===a.owner&&a.owner===b.owner);}
function bridgeJobBetween(a,b){return (G.bridgeJobs||[]).find(j=>j.key===domesticRoadKey(a.id,b.id));}
function caravanCanTraverse(a,b,owner){
 if(!a||!b||a.owner!==owner||b.owner!==owner||a.terrain==='water'||b.terrain==='water')return false;
 return distance(a,b)===1?!riverCrossing(a,b)||bridgeExistsBetween(a,b):!!lakeBridgeSpan(a,b)&&bridgeExistsBetween(a,b);
}

function boatLanding(tile){
 return !!tile&&tile.terrain!=='water'&&(neighbors(tile).some(n=>n.terrain==='water')||
  (G.rivers||[]).some(r=>(r.banks||[]).some(pair=>pair.includes(tile.id))));
}
function boatTravelRoute(owner,start,end){
 if(!start||!end||(start.terrain!=='water'&&(start.owner!==owner||!boatLanding(start)))||end.owner!==owner||!boatLanding(end))return null;
 if(start.id===end.id)return {path:[start.id],cost:0};
 const dist=new Map([[start.id,0]]),prev=new Map(),pending=new Set([start.id]);
 while(pending.size){
  let best=null,bestCost=Infinity;
  for(const id of pending){const d=dist.get(id);if(d<bestCost){best=id;bestCost=d;}}
  pending.delete(best);if(best===end.id)break;
  const at=G.tiles.find(t=>t.id===best);if(!at)continue;
  for(const next of neighbors(at)){
   if(at.terrain!=='water'&&next.terrain!=='water'&&!riverCrossing(at,next))continue;
   if(next.terrain!=='water'&&next.owner!==owner)continue;
   const cost=bestCost+1;if(cost<(dist.get(next.id)??Infinity)){dist.set(next.id,cost);prev.set(next.id,best);pending.add(next.id);}
  }
 }
 if(!dist.has(end.id))return null;
 const path=[end.id];
 while(path[0]!==start.id){const parent=prev.get(path[0]);if(!parent)return null;path.unshift(parent);}
 return {path,cost:dist.get(end.id)};
}
function idleBoat(owner,source){
 const p=G.players[owner];if(!p||!boatLanding(source))return null;
 return (p.boats||[]).filter(b=>!b.shipmentId).map(boat=>{
  const here=G.tiles.find(t=>t.id===boat.currentTileId),route=boatTravelRoute(owner,here,source);
  return {boat,route,cost:route?.cost??Infinity};
 }).filter(v=>v.route).sort((a,b)=>a.cost-b.cost)[0]||null;
}
function dispatchBoatShipment(owner,from,to,item,qty,auto=false,preferred=null){
 const p=G.players[owner],source=siteLookup(owner,from),dest=siteLookup(owner,to);
 if(!p||!source?.tile||!dest?.tile||String(from)===String(to))return false;
 const voyage=boatTravelRoute(owner,source.tile,dest.tile),available=preferred?
  (!preferred.shipmentId?{boat:preferred,route:boatTravelRoute(owner,G.tiles.find(t=>t.id===preferred.currentTileId),source.tile)}:null):
  idleBoat(owner,source.tile);
 if(!voyage||!available?.route)return false;
 const booked=sourceReserved(p,source.site||{id:from},item);
 const amount=Math.min(10,Math.floor(qty),Math.max(0,endpointCount(p,from,item)-booked),endpointDeliverySpace(p,to));
 if(amount<1)return false;
 const job={id:G.nextShipmentId++,kind:'boat',owner,from,to,item,qty:amount,auto,
  boatId:available.boat.id,stage:'pickup',path:available.route.path,step:0,startedClock:G.turnClock||0,
  fromTileId:source.tile.id,toTileId:dest.tile.id,remaining:Math.ceil((available.route.cost+voyage.cost)/2)+2};
 G.shipments.push(job);available.boat.shipmentId=job.id;
 if(owner===0&&!auto)addLog(`${p.name}'s boat sailed to collect ${amount} ${GOOD_NAMES[item]||item}.`);
 return true;
}
function progressBoatJob(job,p){
 const boat=p.boats?.find(b=>b.id===job.boatId);if(!boat)return;
 const here=G.tiles.find(t=>t.id===boat.currentTileId),goal=G.tiles.find(t=>t.id===(job.stage==='pickup'?job.fromTileId:job.toTileId));
 const route=boatTravelRoute(p.id,here,goal);
 if(!route){job.blockedByWater=true;job.remaining=0;return;}
 job.blockedByWater=false;
 if(route.path.length>1){
  const moves=Math.min(2,route.path.length-1);
  boat.currentTileId=route.path[moves];job.path=route.path;job.step=moves;
  job.remaining=Math.ceil(Math.max(0,route.path.length-moves-1)/2)+1;return;
 }
 job.path=route.path;job.step=0;
 if(job.stage==='pickup'){
  const take=Math.min(job.qty,endpointCount(p,job.from,job.item));
  if(!take){boat.shipmentId=null;G.shipments=G.shipments.filter(j=>j!==job);return;}
  endpointAdd(p,job.from,job.item,-take);
  job.qty=take;job.stage='delivery';job.remaining=Math.ceil((boatTravelRoute(p.id,here,G.tiles.find(t=>t.id===job.toTileId))?.cost||0)/2)+1;return;
 }
 const dest=siteLookup(p.id,job.to);
 if(!dest){
  const depot=siteLookup(p.id,'depot');
  if(depot?.tile&&boatTravelRoute(p.id,here,depot.tile)){job.to='depot';job.toTileId=depot.tile.id;return;}
  job.blockedByWater=true;return;
 }
 const moved=endpointAdd(p,job.to,job.item,job.qty);job.qty-=moved;
 if(job.qty>0){job.stage='unloading';job.remaining=0;return;}
 if(p.id===0&&moved)addLog(`Boat delivered ${moved} ${GOOD_NAMES[job.item]||job.item} to ${dest.tile.name}.`);
 boat.shipmentId=null;G.shipments=G.shipments.filter(j=>j!==job);
}
function launchBoat(tile,source='depot',owner=0){
 const p=G.players[owner],store=siteLookup(owner,source);
 if(!p||!tile||tile.owner!==owner||!boatLanding(tile)||store?.tile?.id!==tile.id||
  endpointCount(p,source,'boat')<1||owner===0&&!active())return false;
 endpointAdd(p,source,'boat',-1);p.boats??=[];
 G.nextBoatId??=1;
 p.boats.push({id:'boat-'+owner+'-'+G.nextBoatId++,currentTileId:tile.id,homeTileId:tile.id,shipmentId:null});
 if(owner===0){addLog(`A boat launched from ${tile.name}.`);autoDispatchBoats();save();render();}
 return true;
}
function autoDispatchBoats(){
 for(const p of G.players)for(const boat of p.boats||[]){
  if(boat.shipmentId)continue;
  const here=G.tiles.find(t=>t.id===boat.currentTileId),choices=[];
  if(!here)continue;
  for(const tile of G.tiles.filter(t=>t.owner===p.id&&boatLanding(t)))
  for(let i=0;i<tile.buildings.length;i++){
   const kind=tile.buildings[i],site=tile.buildingMeta?.[i];if(!site||!OUTPUTS[kind])continue;
   for(const item of OUTPUTS[kind]){
    const ready=unloadAllowance(p,kind,site,item);if(!ready)continue;
    const configured=site.routes?.[item],destinations=configured!=null?
     [{id:configured,tile:siteLookup(p.id,configured)?.tile}]:
     [{id:'depot',tile:siteLookup(p.id,'depot')?.tile},...G.tiles.filter(t=>t.owner===p.id)
      .flatMap(t=>t.buildings.map((k,j)=>k==='storageWarehouse'?{id:t.buildingMeta?.[j]?.id,tile:t}:null).filter(Boolean))];
    for(const dest of destinations){
     if(!dest.tile||dest.tile.id===tile.id||endpointDeliverySpace(p,dest.id)<1)continue;
     const sailing=boatTravelRoute(p.id,tile,dest.tile),approach=boatTravelRoute(p.id,here,tile);
     if(sailing&&approach)choices.push({from:site.id,to:dest.id,item,qty:Math.min(10,ready),cost:sailing.cost+approach.cost});
    }
   }
  }
  choices.sort((a,b)=>a.cost-b.cost);
  for(const task of choices)if(dispatchBoatShipment(p.id,task.from,task.to,task.item,task.qty,true,boat)){
   const site=siteLookup(p.id,task.from)?.site;
   if(site)markUnloadBooked(site,task.item,task.qty);
   break;
  }
 }
}
function caravanNeighbors(t,owner){
 const list=neighbors(t).filter(n=>caravanCanTraverse(t,n,owner));
 for(const bridge of G.bridges||[]){
  if(bridge.type!=='lake'||bridge.owner!==owner||![bridge.aId,bridge.bId].includes(t.id))continue;
  const next=G.tiles.find(v=>v.id===(bridge.aId===t.id?bridge.bId:bridge.aId));
  if(next&&caravanCanTraverse(t,next,owner))list.push(next);
 }
 return list;
}
function canStartBridge(a,b,owner){
 const p=G.players[owner];
 if(!p||!crossingType(a,b)||a.owner!==owner||b.owner!==owner||bridgeExistsBetween(a,b)||bridgeJobBetween(a,b)
  ||!idleBuilders(p).length||!hasMoney(p,BRIDGE_SP)||nationalResourceCount(p,'bridgeKit')<1)return false;
 const worker=idleBuilders(p)[0],origin=G.tiles.find(t=>t.id===worker.builder.locationId)||capitalOf(owner);
 return !!(countryTravelRoute(owner,origin,a)||countryTravelRoute(owner,origin,b));
}
function startBridge(aId,bId,owner=0){
 const a=G.tiles.find(t=>t.id===aId),b=G.tiles.find(t=>t.id===bId),p=G.players[owner];
 if(!p||!canCountryAct(p,owner)||!canStartBridge(a,b,owner))return false;
 const worker=idleBuilders(p)[0],origin=G.tiles.find(t=>t.id===worker.builder.locationId)||capitalOf(owner);
 const bank=[a,b].map(tile=>({tile,route:countryTravelRoute(owner,origin,tile)})).filter(x=>x.route).sort((x,y)=>x.route.cost-y.route.cost)[0];
 if(!bank)return false;
 const job={id:G.nextBridgeId++,key:domesticRoadKey(aId,bId),owner,aId,bId,type:crossingType(a,b),waterTileId:lakeBridgeSpan(a,b)?.id||null,builderId:worker.id,startedClock:G.turnClock||0,remaining:3};
 p.gold-=BRIDGE_SP;spendNationalResource(p,'bridgeKit',1);
 worker.builder.projectId='bridge-'+job.id;worker.builder.destinationId=bank.tile.id;worker.builder.travelRemaining=bank.route.turns;
 G.bridgeJobs.push(job);
 useAction(p,`${p.name} began building a ${job.type} bridge between ${a.name} and ${b.name}.`,{tileId:bank.tile.id,kind:'bridge'});
 if(owner===0)showToast('Bridge underway · 3 construction turns');return true;
}
function progressBridgeJobs(){
 for(const job of [...(G.bridgeJobs||[])]){
  if((G.turnClock||0)<=job.startedClock+1)continue;
  const a=G.tiles.find(t=>t.id===job.aId),b=G.tiles.find(t=>t.id===job.bId),p=G.players[job.owner],worker=p?.citizens.find(c=>c.id===job.builderId);
  if(!a||!b||a.owner!==job.owner||b.owner!==job.owner||!worker?.builder){
   if(worker?.builder){worker.builder.projectId=null;worker.builder.destinationId=null;worker.builder.travelRemaining=0;}
   G.bridgeJobs=G.bridgeJobs.filter(j=>j!==job);continue;
  }
  if(worker.builder.travelRemaining>0){worker.builder.travelRemaining--;if(!worker.builder.travelRemaining)worker.builder.locationId=worker.builder.destinationId;continue;}
  if(--job.remaining>0)continue;
  G.bridges.push({key:job.key,owner:job.owner,aId:job.aId,bId:job.bId,type:job.type,waterTileId:job.waterTileId});
  worker.builder.projectId=null;worker.builder.destinationId=null;worker.builder.travelRemaining=0;
  G.bridgeJobs=G.bridgeJobs.filter(j=>j!==job);
  addLog(`${p.name} completed a bridge between ${a.name} and ${b.name}. Caravans can now cross.`);
 }
}

function domesticMoveCost(a,b){return bridgeExistsBetween(a,b)?2:roadExistsBetween(a,b)?1:2;}
// Dijkstra prefers a fully paved route, even when it is slightly longer in hexes.
function countryTravelRoute(owner,start,end,allowNeutralDestination=false){
 if(!start||!end||start.owner!==owner||end.terrain==='water'||(end.owner!==owner&&!(allowNeutralDestination&&end.owner===null)))return null;
 const lookup=new Map(G.tiles.map(t=>[t.id,t])),dist=new Map([[start.id,0]]),prev=new Map(),pending=new Set([start.id]);
 while(pending.size){let at=null,best=Infinity;for(const id of pending){const d=dist.get(id);if(d<best){best=d;at=id;}}pending.delete(at);
  if(at===end.id)break;
  const tile=lookup.get(at);if(!tile)continue;
  for(const n of caravanNeighbors(tile,owner)){
   if(n.owner!==owner&&!(allowNeutralDestination&&n.id===end.id&&n.owner===null))continue;
   const weight=domesticMoveCost(tile,n),candidate=best+weight;
   if(candidate<(dist.get(n.id)??Infinity)){dist.set(n.id,candidate);prev.set(n.id,at);pending.add(n.id);}
  }
 }
 if(!dist.has(end.id))return null;
 const path=[end.id];while(path[0]!==start.id){const parent=prev.get(path[0]);if(parent==null)return null;path.unshift(parent);}
 return {path,cost:dist.get(end.id),turns:Math.ceil(dist.get(end.id)/2)};
}
function ownedPath(owner,a,b){return countryTravelRoute(owner,a,b)?.path||null;}
function pathCost(owner,path){let cost=0;for(let i=1;i<(path?.length||0);i++){
 const a=G.tiles.find(t=>t.id===path[i-1]),b=G.tiles.find(t=>t.id===path[i]);if(a&&b)cost+=domesticMoveCost(a,b);
 }return cost;
}
function canStartDomesticRoad(a,b,owner){
 const p=G.players[owner];return !!a&&!!b&&a.owner===owner&&b.owner===owner&&a.terrain!=='water'&&b.terrain!=='water'&&distance(a,b)===1&&!domesticRoadExists(a,b)&&!roadJobBetween(a,b)&&idleBuilders(p).length>0&&hasMoney(p,LOCAL_ROAD_SP)&&nationalResourceCount(p,'wood')>=LOCAL_ROAD_WOOD;
}
function startDomesticRoad(aId,bId,owner=0){
 const p=G.players[owner],a=G.tiles.find(t=>t.id===aId),b=G.tiles.find(t=>t.id===bId);
 if(!canCountryAct(p,owner)||!canStartDomesticRoad(a,b,owner))return false;
 const worker=idleBuilders(p)[0],origin=G.tiles.find(t=>t.id===worker.builder.locationId)||capitalOf(owner),roadId=G.nextDomesticRoadId++;
 const route=countryTravelRoute(owner,origin,a);if(!route)return false;
 const job={id:roadId,key:domesticRoadKey(aId,bId),owner,aId,bId,builderId:worker.id,remaining:2,startedClock:G.turnClock||0};
 p.gold-=LOCAL_ROAD_SP;spendNationalResource(p,'wood',LOCAL_ROAD_WOOD);
 worker.builder.projectId='domestic-'+roadId;worker.builder.travelRemaining=route.turns;
 worker.builder.destinationId=a.id;G.domesticRoadJobs.push(job);
 useAction(p,`${p.name} began paving the border between ${a.name} and ${b.name}.`,{tileId:a.id,kind:'road'});
 if(owner===0)showToast(`Road crew dispatched · ${route.turns}T travel + 2T construction`);
 return true;
}
function progressDomesticRoads(){
 for(const j of [...G.domesticRoadJobs]){
  if((G.turnClock||0)<=j.startedClock+1)continue;
  const a=G.tiles.find(t=>t.id===j.aId),b=G.tiles.find(t=>t.id===j.bId),p=G.players[j.owner],worker=p?.citizens.find(c=>c.id===j.builderId);
  if(!a||!b||a.owner!==j.owner||b.owner!==j.owner||!worker?.builder){
   if(worker?.builder){worker.builder.projectId=null;worker.builder.destinationId=null;worker.builder.travelRemaining=0;}
   G.domesticRoadJobs.splice(G.domesticRoadJobs.indexOf(j),1);continue;
  }
  if(worker.builder.travelRemaining>0){worker.builder.travelRemaining--;if(worker.builder.travelRemaining===0)worker.builder.locationId=a.id;continue;}
  j.remaining--;if(j.remaining>0)continue;
  G.domesticRoads.push({id:j.id,key:j.key,owner:j.owner,aId:j.aId,bId:j.bId});
  worker.builder.projectId=null;worker.builder.destinationId=null;worker.builder.travelRemaining=0;worker.builder.locationId=a.id;
  G.domesticRoadJobs.splice(G.domesticRoadJobs.indexOf(j),1);
  G.completedScenes.push({projectId:'domestic-road-'+j.id,owner:j.owner,tileId:a.id,kind:'road'});
  addLog(`${p.name} opened the paved road between ${a.name} and ${b.name}. Movement is now faster there.`);
 }
}
// Compute SVG endpoints for the actual common border (not the hex centers).
function domesticRoadEdge(a,b){
 const corners=t=>Array.from({length:6},(_,i)=>{const xy=coords(t),rad=i*Math.PI/3+Math.PI/6;return {x:xy.x+HEX*Math.cos(rad),y:xy.y+HEX*Math.sin(rad)};});
 const ac=corners(a),bc=corners(b);return ac.filter(v=>bc.some(w=>Math.hypot(v.x-w.x,v.y-w.y)<.1)).slice(0,2);
}
function bridgeMapVisuals(){
 return [...(G.bridges||[]),...(G.bridgeJobs||[])].map(j=>{
  const a=G.tiles.find(t=>t.id===j.aId),b=G.tiles.find(t=>t.id===j.bId);
  if(!a||!b)return '';
  const left=sceneCoords(a),right=sceneCoords(b);
  const p=project(left.x*.75+right.x*.25,left.y*.75+right.y*.25);
  const q=project(left.x*.25+right.x*.75,left.y*.25+right.y*.75);
  const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const d=`M${p.x.toFixed(1)},${p.y.toFixed(1)}L${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  const slats=Array.from({length:8},(_,i)=>{
   const x=p.x+dx*(i+.5)/8,y=p.y+dy*(i+.5)/8;
   return `<path d="M${(x-nx*6).toFixed(1)},${(y-ny*6).toFixed(1)}L${(x+nx*6).toFixed(1)},${(y+ny*6).toFixed(1)}" stroke="#664534" stroke-width="1.3"/>`;
  }).join('');
  const opacity=(G.bridgeJobs||[]).includes(j)?'.45':'1';
  return `<g class="gs-bridge" opacity="${opacity}" pointer-events="none"><path d="${d}" stroke="#57402b" stroke-width="20" stroke-linecap="round"/><path d="${d}" stroke="#c49a66" stroke-width="15"/><path d="${d}" stroke="#e2bb7b" stroke-width="12"/>${slats}</g>`;
 }).join('');
}
function domesticRoadVisuals(){
 const visuals=[];
 for(const road of [...(G.domesticRoads||[]),...(G.domesticRoadJobs||[])]){
  const a=G.tiles.find(t=>t.id===road.aId),b=G.tiles.find(t=>t.id===road.bId);if(!a||!b)continue;
  const points=domesticRoadEdge(a,b);if(points.length!==2)continue;
  visuals.push(edgedRoadSegment(project(points[0].x,points[0].y),project(points[1].x,points[1].y),[a.id,b.id],road.remaining==null));
 }
 return `<g class="gs-domestic-road" pointer-events="none">${visuals.join('')}</g>`;
}
// Manual hand transport: 2 resource units; each hex needs 8 world ticks unpaved or
// 6 with roads, roughly 2 rounds for one hex on an unpaved route, each way.
const PORTER_CAPACITY=2,PORTER_UNPAVED_TICKS=8,PORTER_PAVED_TICKS=6;
function porterTicks(a,b){return domesticMoveCost(a,b)===1?PORTER_PAVED_TICKS:PORTER_UNPAVED_TICKS;}
function handHaulingAllowed(p){
 // No wagons means hand-delivery is compulsory. Otherwise respect the
 // elected policy (including while all wagons are dispatched).
 return !(p.caravans||[]).length||p.handHaulingPolicy==='allow';
}
function availablePorter(owner,source){
 const p=G.players[owner];if(!p)return null;
 const occupied=new Set(G.shipments.filter(j=>j.kind==='porter'&&j.owner===owner).map(j=>j.porterId));
 const workforce=p.citizens.filter(c=>eligibleWorker(c)&&!occupied.has(c.id)&&c.job?.role!=='caravanDriver');
 // Prefer the source's employee, or someone not currently employed.
 return workforce.find(c=>c.job?.siteId===source.site?.id)||workforce.find(c=>!c.job)||null;
}
function porterRemaining(job){
 let ticks=0;
 for(let i=job.step;i<(job.path?.length||0)-1;i++){
  const a=G.tiles.find(t=>t.id===job.path[i]),b=G.tiles.find(t=>t.id===job.path[i+1]);
  if(a&&b)ticks+=porterTicks(a,b);
 }
 return Math.max(0,ticks-(job.stepSpent||0));
}
// Caravans are physical, limited units housed in Caravan Warehouses, not invisible timers.
function caravanWarehouses(p){
 const sites=[];
 for(const tile of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<tile.buildings.length;i++)if(tile.buildings[i]==='caravanWarehouse')
  sites.push({tile,site:tile.buildingMeta[i],capacity:Math.max(1,Math.min(3,tile.buildingMeta[i].level||1))});
 return sites;
}
function caravanDriver(p,cart){
 const citizen=p?.citizens?.find(c=>c.id===cart?.driverId);
 if(!citizen||citizen.job?.role!=='caravanDriver'||citizen.job?.caravanId!==cart.id
   ||String(citizen.job.siteId)!==String(cart.homeSiteId))return null;
 return citizen;
}
function caravanHasDriver(p,cart){
 const driver=caravanDriver(p,cart);
 return !!driver&&eligibleWorker(driver)&&!isBusyPorter(driver);
}
function syncCaravans(p){
 p.caravans??=[];p.handHaulingPolicy??='wait';
 const warehouses=caravanWarehouses(p),bySite=new Map(warehouses.map(w=>[String(w.site.id),w]));
 const valid=new Set(warehouses.map(w=>String(w.site.id)));
 // Retain active shipments if a warehouse is demolished; they can finish
 // carrying their cargo, then the removed site's wagons are retired.
 for(const cart of [...p.caravans])if(!valid.has(String(cart.homeSiteId))&&!cart.shipmentId){
  const worker=p.citizens.find(c=>c.id===cart.driverId);
  if(worker?.job?.caravanId===cart.id)worker.job=null;
  p.caravans.splice(p.caravans.indexOf(cart),1);
 }
 for(const base of warehouses){
  const home=p.caravans.filter(c=>String(c.homeSiteId)===String(base.site.id));
  while(home.length<base.capacity){
   let index=home.length;
   while(p.caravans.some(c=>c.id===p.id+'-cart-'+base.site.id+'-'+index))index++;
   const cart={id:p.id+'-cart-'+base.site.id+'-'+index,owner:p.id,homeSiteId:base.site.id,
    currentTileId:base.tile.id,shipmentId:null,driverId:null};
   p.caravans.push(cart);home.push(cart);
  }
  while(home.length>base.capacity){
   const cart=home.find(c=>!c.shipmentId);if(!cart)break;
   const worker=p.citizens.find(c=>c.id===cart.driverId);
   if(worker?.job?.caravanId===cart.id)worker.job=null;
   p.caravans.splice(p.caravans.indexOf(cart),1);home.splice(home.indexOf(cart),1);
  }
 }
 const seen=new Set();
 // Validate saved driver identities and job eligibility. Drivers are never
 // passengers, porters, builders or soldiers at the same time.
 for(const cart of p.caravans){
  const worker=p.citizens.find(c=>c.id===cart.driverId);
  const match=worker?.job&&String(worker.job.siteId)===String(cart.homeSiteId)
   &&(!worker.job.caravanId||worker.job.caravanId===cart.id)
   &&eligibleWorker(worker)&&!isBusyPorter(worker)&&!seen.has(worker.id);
  if(match){
   worker.job.role='caravanDriver';worker.job.caravanId=cart.id;seen.add(worker.id);
  }else{
   if(worker?.job?.caravanId===cart.id)worker.job=null;
   cart.driverId=null;
  }
 }
 // Assign existing employees of a caravan warehouse to its wagons. If
 // automatic hiring is ON, fill vacancies only from eligible unemployed adults.
 for(const cart of p.caravans){
  if(cart.driverId||!valid.has(String(cart.homeSiteId)))continue;
  const base=bySite.get(String(cart.homeSiteId));
  let driver=p.citizens.find(c=>!seen.has(c.id)&&eligibleWorker(c)&&!isBusyPorter(c)
   &&String(c.job?.siteId)===String(cart.homeSiteId)&&!c.job?.caravanId);
  if(!driver&&base.site.autoHire){
   driver=p.citizens.filter(c=>eligibleWorker(c)&&!isBusyPorter(c)&&!c.job)
    .sort((a,b)=>b.morale-a.morale||b.health-a.health||a.id.localeCompare(b.id))[0];
  }
  if(driver){
   driver.job={siteId:base.site.id,tileId:base.tile.id,role:'caravanDriver',caravanId:cart.id};
   cart.driverId=driver.id;seen.add(driver.id);
  }
 }
 // Do not leave orphaned driver jobs locking citizens away from other work.
 const ids=new Set(p.caravans.map(c=>c.id));
 for(const worker of p.citizens)if(worker.job?.role==='caravanDriver'&&!ids.has(worker.job.caravanId))worker.job=null;
}
function setCaravanDriver(cartId,citizenId){
 if(!active())return false;
 const p=getCountry(),cart=p.caravans.find(c=>c.id===cartId);
 if(!cart||cart.shipmentId)return false; // Do not strand cargo in transit.
 const base=caravanWarehouses(p).find(w=>String(w.site.id)===String(cart.homeSiteId));
 if(!base)return false;
 const next=citizenId?p.citizens.find(c=>c.id===citizenId):null;
 if(citizenId&&(!next||!eligibleWorker(next)||isBusyPorter(next)
   ||(next.job&&next.job.caravanId!==cart.id)))return false;
 const prior=caravanDriver(p,cart);
 if(prior&&prior!==next)prior.job=null;
 cart.driverId=next?.id||null;
 if(next)next.job={siteId:base.site.id,tileId:base.tile.id,role:'caravanDriver',caravanId:cart.id};
 save();render();return true;
}
function availableCaravan(owner,pickup){
 const p=G.players[owner];syncCaravans(p);
 return p.caravans.filter(c=>!c.shipmentId&&caravanHasDriver(p,c)).map(c=>{
  const from=G.tiles.find(t=>t.id===c.currentTileId),path=ownedPath(owner,from,pickup);
  return {cart:c,path,cost:path?pathCost(owner,path):Infinity};
 }).filter(c=>c.path).sort((a,b)=>a.cost-b.cost)[0]||null;
}
function dispatchShipment(owner,from,to,item,qty,auto=false,preferredCart=null){
 const p=G.players[owner],src=siteLookup(owner,from),dst=siteLookup(owner,to),amount=Math.floor(qty);
 // A siege blockade can physically prevent new deliveries into the surrounded
 // tile. Already loaded wagons wait with their cargo until the blockade lifts.
 if(dst?.tile&&siegeBlocksDelivery({owner,toTileId:dst.tile.id,stage:'delivery'}))return false;
 if(!p||!src?.tile||!dst?.tile||String(from)===String(to)||amount<1)return false;
 const reservedFrom=G.shipments.filter(j=>j.owner===owner&&String(j.from)===String(from)&&j.stage==='pickup')
  .reduce((sum,j)=>sum+shipmentLoads(j).filter(entry=>entry.item===item).reduce((n,entry)=>n+Math.max(0,entry.qty||0),0),0);
 const freeSource=Math.max(0,endpointCount(p,from,item)-reservedFrom);
 const qtyFit=Math.min(10,amount,freeSource,endpointDeliverySpace(p,to));
 if(qtyFit<1)return false;
 // Goods move within a shared hex without a caravan, driving job or porter.
 if(src.tile.id===dst.tile.id){
  const transferred=endpointAdd(p,to,item,qtyFit);
  if(transferred>0)endpointAdd(p,from,item,-transferred);
  if(transferred>0&&!auto)addLog(`${transferred} ${GOOD_NAMES[item]||item} moved locally within ${src.tile.name}.`);
  return transferred>0;
 }
 const delivery=ownedPath(owner,src.tile,dst.tile);
 if(!delivery)return preferredCart?false:dispatchBoatShipment(owner,from,to,item,qty,auto);
 const available=preferredCart
  ?(!preferredCart.shipmentId&&caravanHasDriver(p,preferredCart)?{cart:preferredCart,path:ownedPath(owner,G.tiles.find(t=>t.id===preferredCart.currentTileId),src.tile)}:null)
  :availableCaravan(owner,src.tile);
 if(preferredCart&&!available?.path)return false;
 const porter=!available&&!preferredCart&&handHaulingAllowed(p)?availablePorter(owner,src):null;
 if(!available&&!porter)return false;
 const id=G.nextShipmentId++;
 if(porter){
  const carrying=Math.min(PORTER_CAPACITY,qtyFit);
  const job={id,kind:'porter',owner,from,to,item,qty:carrying,auto,stage:'pickup',
   porterId:porter.id,caravanId:null,path:[src.tile.id],step:0,stepSpent:0,
   fromTileId:src.tile.id,toTileId:dst.tile.id,startedClock:G.turnClock||0,remaining:1};
  G.shipments.push(job);
  if(!auto)addLog(`${porter.name} started carrying ${carrying} ${GOOD_NAMES[item]||item} from ${src.tile.name} to ${dst.tile.name} by hand.`);
  return true;
 }
 const job={id,owner,from,to,item,qty:qtyFit,auto,stage:'pickup',path:available.path,step:0,
  fromTileId:src.tile.id,toTileId:dst.tile.id,homeSiteId:available.cart.homeSiteId,caravanId:available.cart.id,
  startedClock:G.turnClock||0,remaining:Math.ceil((pathCost(owner,available.path)+pathCost(owner,delivery))/2)+2};
 G.shipments.push(job);available.cart.shipmentId=id;
 if(!auto)addLog(`${p.name}'s wagon left its depot for ${src.tile.name}; it will pick up ${job.qty} ${GOOD_NAMES[item]||item} before delivery.`);
 return true;
}
function finishCaravanJob(job,cart,p){
 cart.shipmentId=null;
 if(job.stage==='return'){cart.currentTileId=job.path[job.path.length-1]||cart.currentTileId;}
 G.shipments.splice(G.shipments.indexOf(job),1);
}
// Upgrade a saved automatic pickup created before mixed cargo existed.
 // Wagons already travelling to a farm can fill spare capacity on arrival.
function upgradeQueuedMixedPickup(job,p){
 if(!job.auto||job.kind==='porter'||Array.isArray(job.cargo)||job.qty>=10)return;
 const origin=siteLookup(p.id,job.from);
 if(!origin?.site||!OUTPUTS[origin.kind])return;
 const candidates=outputPickupTasks(p).filter(t=>String(t.from)===String(job.from));
 const cargo=[{item:job.item,qty:job.qty,to:job.to}];
 let remaining=10-job.qty;
 const perDest=new Map();
 for(const task of candidates)for(const entry of task.cargo){
  if(remaining<=0)break;
  const key=String(entry.to),free=perDest.has(key)?perDest.get(key):endpointDeliverySpace(p,entry.to);
  const qty=Math.min(remaining,entry.qty,free);
  if(qty<1)continue;
  cargo.push({item:entry.item,qty,to:entry.to});
  perDest.set(key,free-qty);remaining-=qty;
 }
 if(cargo.length<2)return;
 const tour=optimalCargoDelivery(p.id,origin.tile,cargo);
 if(!tour)return;
 job.cargo=cargo;job.deliveryStops=tour.stops;
 job.to=tour.stops[0];job.toTileId=siteLookup(p.id,job.to)?.tile?.id;
 job.qty=shipmentTotal(job);
 for(const entry of cargo.slice(1))markUnloadBooked(origin.site,entry.item,entry.qty);
}
function moveCaravanToStage(job,cart,p){
 // Deliveries take at least one later player turn per hex. There is no teleportation.
 const stage=job.stage,path=job.path||[];
 if(job.step<path.length-1){
  // A wagon has two movement points per turn: paved borders cost 1, unpaved cost 2.
  const previousStep=job.step;
  let budget=2;
  while(job.step<path.length-1){
   const a=G.tiles.find(t=>t.id===path[job.step]),b=G.tiles.find(t=>t.id===path[job.step+1]);
   if(!a||!b||!caravanCanTraverse(a,b,job.owner)){
    const here=G.tiles.find(t=>t.id===cart.currentTileId);
    const target=G.tiles.find(t=>t.id===(stage==='pickup'?job.fromTileId:stage==='return'?siteLookup(job.owner,job.returnSiteId||job.homeSiteId)?.tile?.id:job.toTileId));
    const route=countryTravelRoute(job.owner,here,target);
    if(route){job.path=route.path;job.step=0;job.blockedByWater=false;job.remaining=Math.ceil(route.cost/2)+1;}
    else{job.blockedByWater=true;job.remaining=0;}
    return;
   }
   job.blockedByWater=false;
   const need=domesticMoveCost(a,b);if(need>budget)break;
   budget-=need;job.step++;cart.currentTileId=path[job.step];
  }
  job.remaining=Math.ceil(pathCost(job.owner,path.slice(job.step))/2);
  if(job.step>previousStep)job.visualMove={clock:G.turnClock||0,path:[...path],fromStep:previousStep,toStep:job.step};
  return;
 }
 if(stage==='pickup'){
  if(job.auto&&!Array.isArray(job.cargo))upgradeQueuedMixedPickup(job,p);
  if(Array.isArray(job.cargo)){
   for(const entry of job.cargo){
    const available=Math.min(entry.qty,endpointCount(p,job.from,entry.item));
    if(available>0)endpointAdd(p,job.from,entry.item,-available);
    entry.qty=available;
   }
   job.qty=shipmentTotal(job);
   const next=(job.deliveryStops||[]).find(to=>job.cargo.some(e=>e.qty>0&&String(e.to)===String(to)));
   job.to=next||job.to;
   job.toTileId=siteLookup(job.owner,job.to)?.tile?.id||job.toTileId;
   job.stage=job.qty>0?'delivery':'return';
  }else{
   const available=Math.min(job.qty,endpointCount(p,job.from,job.item));
   if(available<=0){job.qty=0;job.stage='return';}
   else {job.qty=available;endpointAdd(p,job.from,job.item,-available);job.stage='delivery';}
  }
  if(job.auto&&job.stage==='delivery'&&job.qty>0){
   cart.collectionVisited??=[];
   if(!cart.collectionVisited.some(id=>String(id)===String(job.from)))cart.collectionVisited.push(job.from);
  }
  const source=G.tiles.find(t=>t.id===job.fromTileId),dest=G.tiles.find(t=>t.id===job.toTileId);
  job.path=(job.stage==='delivery'?ownedPath(job.owner,source,dest):
   ownedPath(job.owner,source,siteLookup(job.owner,job.homeSiteId)?.tile||source))||[source?.id].filter(Boolean);
  job.step=0;job.remaining=Math.max(1,Math.ceil(pathCost(job.owner,job.path)/2));return;
 }
 if(stage==='delivery'||stage==='unloading'){
  const validDestination=siteLookup(job.owner,job.to);
  if(!validDestination){
   // Preserve loaded mixed goods when a delivery building is demolished.
   const capital=siteLookup(job.owner,'depot'),old=job.to;
   if(Array.isArray(job.cargo)){
    for(const entry of job.cargo)if(String(entry.to)===String(old))entry.to='depot';
    job.deliveryStops=(job.deliveryStops||[]).map(id=>String(id)===String(old)?'depot':id);
   }
   job.to='depot';job.toTileId=capital?.tile?.id;
   const from=G.tiles.find(t=>t.id===cart.currentTileId);
   job.path=ownedPath(job.owner,from,capital?.tile)||[from?.id].filter(Boolean);
   job.step=0;job.stage='delivery';return;
  }
  let deliveredText='',unloaded=0;
  if(Array.isArray(job.cargo)){
   const dropped=[];
   for(const entry of job.cargo.filter(e=>e.qty>0&&String(e.to)===String(job.to))){
    const moved=endpointAdd(p,job.to,entry.item,entry.qty);
    entry.qty-=moved;unloaded+=moved;
    if(moved)dropped.push(moved+' '+(GOOD_NAMES[entry.item]||entry.item));
   }
   deliveredText=dropped.join(' + ');job.qty=shipmentTotal(job);
   if(job.cargo.some(e=>e.qty>0&&String(e.to)===String(job.to))){
    job.stage='unloading';job.remaining=0;return;
   }
   if(job.owner===0&&unloaded)addLog(`${deliveredText} arrived at ${validDestination.tile.name}.`);
   const next=(job.deliveryStops||[]).find(to=>job.cargo.some(e=>e.qty>0&&String(e.to)===String(to)));
   if(next){
    const nextSite=siteLookup(job.owner,next);
    if(!nextSite?.tile){
     job.to=next;job.stage='delivery';job.path=[cart.currentTileId];job.step=0;return;
    }
    job.to=next;job.toTileId=nextSite.tile.id;job.stage='delivery';
    const here=G.tiles.find(t=>t.id===cart.currentTileId);
    job.path=ownedPath(job.owner,here,nextSite.tile)||[here?.id].filter(Boolean);
    job.step=0;job.remaining=Math.max(1,Math.ceil(pathCost(job.owner,job.path)/2));return;
   }
  }else{
   unloaded=endpointAdd(p,job.to,job.item,job.qty);
   job.qty-=unloaded;
   if(job.qty>0){job.stage='unloading';job.remaining=0;return;}
   deliveredText=unloaded+' '+(GOOD_NAMES[job.item]||job.item);
   if(job.owner===0&&unloaded)addLog(`${deliveredText} arrived at ${validDestination.tile.name}.`);
  }
  // Automatic shipments chain into the next ready pickup instead of
  // returning empty to a caravan warehouse between deliveries.
  if(job.auto){
   // Old saved shipments may already be en route with cargo. Count the
   // completed pickup even when it happened before this route upgrade.
   cart.collectionVisited??=[];
   if(job.from!=null&&!cart.collectionVisited.some(id=>String(id)===String(job.from)))cart.collectionVisited.push(job.from);
   cart.currentTileId=job.toTileId||cart.currentTileId;
   cart.collectionActiveSource=null;
   finishCaravanJob(job,cart,p);
   scheduleAutoCaravan(p,cart);
   return;
  }
  const dest=G.tiles.find(t=>t.id===job.toTileId),bases=caravanWarehouses(p);
  const destinationBase=bases.find(w=>w.tile.id===dest?.id);
  const canStay=destinationBase&&(p.caravanPolicy==='stay')&&p.caravans.filter(c=>c.id!==cart.id&&!c.shipmentId&&c.currentTileId===dest.id).length<destinationBase.capacity;
  if(canStay){cart.currentTileId=dest.id;finishCaravanJob(job,cart,p);return;}
  let alternatives=bases.map(w=>({...w,path:ownedPath(p.id,dest,w.tile)})).filter(w=>w.path&&p.caravans.filter(c=>c.id!==cart.id&&!c.shipmentId&&c.currentTileId===w.tile.id).length<w.capacity);
  if(p.caravanPolicy==='home'){alternatives.sort((a,b)=>Number(b.site.id===job.homeSiteId)-Number(a.site.id===job.homeSiteId)||a.path.length-b.path.length);}
  else alternatives.sort((a,b)=>pathCost(p.id,a.path)-pathCost(p.id,b.path));
  const base=alternatives[0];
  if(!base){finishCaravanJob(job,cart,p);return;}
  job.returnSiteId=base.site.id;job.stage='return';job.path=base.path;job.step=0;job.remaining=Math.max(1,Math.ceil(pathCost(p.id,base.path)/2));
  return;
 }
 finishCaravanJob(job,cart,p);
}
function progressPorterJob(job,p){
 const worker=p.citizens.find(c=>c.id===job.porterId);
 if(!worker){
  if(job.qty>0&&['delivery','unloading'].includes(job.stage)){
   const site=siteLookup(p.id,job.from);
   if(site?.site)addLocal(site.site,job.item,job.qty);else addDepot(p,job.item,job.qty);
  }
  G.shipments=G.shipments.filter(j=>j!==job);return;
 }
 const path=job.path||[];
 if(job.step<path.length-1){
  const a=G.tiles.find(t=>t.id===path[job.step]),b=G.tiles.find(t=>t.id===path[job.step+1]);
  if(!a||!b||!caravanCanTraverse(a,b,p.id)){
   const goal=G.tiles.find(t=>t.id===path[path.length-1]),route=countryTravelRoute(p.id,a,goal);
   if(!route){job.blockedByWater=true;job.remaining=0;return;}
   job.path=route.path;job.step=0;job.stepSpent=0;job.blockedByWater=false;return;
  }
  job.blockedByWater=false;
  job.stepSpent=(job.stepSpent||0)+1;
  if(job.stepSpent>=porterTicks(a,b)){
   // Hauling is tiring in both directions, worse on unpaved roads.
   worker.morale=Math.max(0,worker.morale-(domesticMoveCost(a,b)===1?1:2));
   job.step++;job.stepSpent=0;
  }
  job.remaining=porterRemaining(job);return;
 }
 if(job.stage==='pickup'){
  const amount=Math.min(PORTER_CAPACITY,job.qty,endpointCount(p,job.from,job.item));
  const from=siteLookup(p.id,job.from),to=siteLookup(p.id,job.to);
  const route=from?.tile&&to?.tile&&ownedPath(p.id,from.tile,to.tile);
  if(!amount||!route){G.shipments=G.shipments.filter(j=>j!==job);return;}
  endpointAdd(p,job.from,job.item,-amount);
  job.qty=amount;job.stage='delivery';job.path=route;job.step=0;job.stepSpent=0;job.remaining=porterRemaining(job)+1;
  return;
 }
 if(['delivery','unloading'].includes(job.stage)){
  let target=siteLookup(p.id,job.to);
  if(!target){
   const here=G.tiles.find(t=>t.id===path[path.length-1]),capital=siteLookup(p.id,'depot');
   const fallback=here&&capital?.tile&&ownedPath(p.id,here,capital.tile);
   if(!fallback){addDepot(p,job.item,job.qty);G.shipments=G.shipments.filter(j=>j!==job);return;}
   job.to='depot';job.toTileId=capital.tile.id;job.path=fallback;job.step=0;job.stepSpent=0;job.stage='delivery';
   job.remaining=porterRemaining(job)+1;return;
  }
  const unloaded=endpointAdd(p,job.to,job.item,job.qty);
  job.qty-=unloaded;
  if(job.qty>0){job.stage='unloading';job.remaining=0;return;}
  if(p.id===0&&unloaded)addLog(`${worker.name} hand-delivered ${unloaded} ${GOOD_NAMES[job.item]||job.item} to ${target.tile.name}.`);
  const from=siteLookup(p.id,job.from),returnRoute=from?.tile&&ownedPath(p.id,target.tile,from.tile);
  if(!returnRoute){G.shipments=G.shipments.filter(j=>j!==job);return;}
  job.stage='return';job.path=returnRoute;job.step=0;job.stepSpent=0;job.remaining=porterRemaining(job);return;
 }
 if(job.stage==='return')G.shipments=G.shipments.filter(j=>j!==job);
}
function progressShipments(){
 for(const job of [...G.shipments]){
  const p=G.players[job.owner];
  if(siegeBlocksDelivery(job)&&['delivery','unloading'].includes(job.stage)){
   job.blockedBySiege=true;continue;
  }
  job.blockedBySiege=false;
  if((G.turnClock||0)<=(job.startedClock??-2)+1)continue;
  if(job.kind==='porter'){
   if(!p){G.shipments=G.shipments.filter(j=>j!==job);continue;}
   progressPorterJob(job,p);continue;
  }
  if(job.kind==='boat'){if(p)progressBoatJob(job,p);continue;}
  const cart=p?.caravans?.find(c=>c.id===job.caravanId);
  if(p&&cart){syncCaravans(p);if(!caravanHasDriver(p,cart)){job.waitingForDriver=true;continue;}job.waitingForDriver=false;}
  if(!p||!cart){
    if(p&&['delivery','unloading'].includes(job.stage)){
     for(const entry of shipmentLoads(job))if(entry.qty>0)addDepot(p,entry.item,entry.qty);
    }
    G.shipments.splice(G.shipments.indexOf(job),1);continue;
   }
  moveCaravanToStage(job,cart,p);
 }
}
function caravanCollectionRouteText(p,cart,job){
 const labels=[];
 if(job?.auto&&job.from!=null)labels.push(job.from);
 for(const id of cart.collectionQueue||[])if(!labels.some(existing=>String(existing)===String(id)))labels.push(id);
 if(!labels.length)return 'No scheduled collection stops';
 return labels.map(id=>{
  const site=siteLookup(p.id,id);
  return esc(site?.tile?.name||'Unavailable hex')+' · '+esc(BUILDINGS[site?.kind]?.name||'Producer');
 }).join(' → ');
}
function caravanWarehouseStatus(p,siteId){
 const carts=(p.caravans||[]).filter(c=>String(c.homeSiteId)===String(siteId));
 const names=id=>esc(G.tiles.find(t=>t.id===id)?.name||'Unknown hex');
 const policy=`<label class="gs-routing-label">Worker transport policy (all warehouses)
  <select data-hand-haul-policy>
   <option value="wait" ${p.handHaulingPolicy!=='allow'?'selected':''}>Wait for a caravan when all wagons are busy</option>
   <option value="allow" ${p.handHaulingPolicy==='allow'?'selected':''}>Allow workers to carry 2 units if wagons are busy</option>
  </select></label><small class="gs-routing-help">If your nation has no caravans, hand deliveries are allowed automatically. Every walking trip decreases morale.</small>`;
 const rows=carts.map((cart,i)=>{
  const job=G.shipments.find(j=>j.id===cart.shipmentId);
  const where=names(cart.currentTileId);
  const driver=caravanDriver(p,cart),driverLabel=driver?esc(driver.name):'NO DRIVER — wagon idle';
   const choices=p.citizens.filter(c=>eligibleWorker(c)&&!isBusyPorter(c)&&(!c.job||c.id===cart.driverId));
   const control=`<label class="gs-routing-label">Driver for wagon ${i+1}
    <select data-caravan-driver="${esc(cart.id)}" ${cart.shipmentId?'disabled':''}>
     <option value="" ${driver?'':'selected'}>Unassigned</option>
     ${choices.map(c=>`<option value="${esc(c.id)}" ${c.id===cart.driverId?'selected':''}>${esc(c.name)} · ${c.id===cart.driverId?'On duty':'Unemployed'}</option>`).join('')}
    </select></label>`;
   if(!job)return `<div class="gs-caravan-status"><strong>Wagon ${i+1} · ${caravanHasDriver(p,cart)?'Available':'Awaiting driver'}</strong><small>Driver: ${driverLabel}</small><small>Located at ${where} · Holding: nothing · Next destination: awaiting assignment</small><small>Collection circuit: ${caravanCollectionRouteText(p,cart,null)}</small>${control}</div>`;
  const from=names(job.fromTileId),to=names(job.toTileId);
  const back=siteLookup(p.id,job.returnSiteId||job.homeSiteId)?.tile?.name||'caravan warehouse';
  const heading=job.stage==='pickup'?from:job.stage==='return'?esc(back):to;
  const cargo=job.stage==='delivery'||job.stage==='unloading'?
   (job.qty>0?esc(shipmentCargoText(job)):'Empty — unloading'):
   (job.stage==='pickup'?`Empty (will collect ${esc(shipmentCargoText(job))})`:'Empty — returning');
  const stage={pickup:'Traveling to pickup',delivery:'Delivering',unloading:'Waiting for unloading space',return:'Returning to warehouse'}[job.stage]||job.stage;
  return `<div class="gs-caravan-status"><strong>Wagon ${i+1} · ${job.waitingForDriver?'PAUSED · no driver':stage}</strong><small>Driver: ${driverLabel}</small><small>Current hex: ${where}</small><small>Heading to: ${heading}</small><small>Holding: ${cargo}</small><small>Route: ${from} → ${to} · ${Math.max(0,job.remaining||0)}T left in current leg</small><small>Collection circuit: ${caravanCollectionRouteText(p,cart,job)}</small>${control}</div>`;
 }).join('');
 return `<div class="gs-caravan-tracker"><strong>Wagons based at this warehouse · ${carts.filter(c=>!c.shipmentId&&caravanHasDriver(p,c)).length}/${carts.length} staffed & available</strong>
  ${rows||'<small>No wagons assigned here yet. New ones appear when construction completes.</small>'}
  ${policy}</div>`;
}
function shippingDashboard(){
 const p=getCountry(),jobs=G.shipments.filter(j=>j.owner===0),carts=p.caravans||[],boats=p.boats||[];
 return `<div class="gs-shipping-summary"><b>Logistics · ${carts.filter(c=>!c.shipmentId&&caravanHasDriver(p,c)).length}/${carts.length} wagons · ${boats.filter(b=>!b.shipmentId).length}/${boats.length} boats available</b>
  <small>Wagons carry 10 units each and require one employed adult citizen driver per wagon. Drivers are full-time workers and cannot hold another job or join expeditions. A hand porter carries 2 units when permitted. A hand trip takes 8 world turns per unpaved hex (6 on paved borders), each way; longer trips reduce worker morale and can affect health.</small>
  <label class="gs-routing-label">Workers when all wagons are busy <select data-hand-haul-policy><option value="wait" ${p.handHaulingPolicy!=='allow'?'selected':''}>Wait for a caravan</option><option value="allow" ${p.handHaulingPolicy==='allow'?'selected':''}>Allow 2-unit worker deliveries</option></select></label>
  ${!(p.caravans||[]).length?'<small>No wagons owned: eligible workers transport resources by hand automatically.</small>':!(p.caravans||[]).some(c=>caravanHasDriver(p,c))?'<small>No employed caravan drivers: hire eligible adults at a Caravan Warehouse to activate wagons.</small>':''}
  <label class="gs-routing-label">After delivery <select data-caravan-policy><option value="nearest" ${p.caravanPolicy==='nearest'?'selected':''}>Closest warehouse</option><option value="home" ${p.caravanPolicy==='home'?'selected':''}>Original warehouse</option><option value="stay" ${p.caravanPolicy==='stay'?'selected':''}>Stay if destination has space</option></select></label>
  ${jobs.slice(0,12).map(j=>`<div class="gs-shipment-row">${j.kind==='porter'?'Worker':j.kind==='boat'?'Boat':'Wagon'} · ${j.stage==='return'?'Returning empty':j.stage==='pickup'?('Going to collect '+shipmentCargoText(j)):shipmentCargoText(j)} · ${esc(G.tiles.find(t=>t.id===j.fromTileId)?.name||'Depot')} → ${esc(G.tiles.find(t=>t.id===j.toTileId)?.name||'Depot')} <strong>${esc(j.stage)} · ${j.remaining}T</strong></div>`).join('')}</div>`;
}
function runAgricultureAndForestry(){
 for(const p of G.players)for(const t of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<t.buildings.length;i++){
  const kind=t.buildings[i];if(!['farm','lumber'].includes(kind))continue;
  const site=worksite(t,i),q=workQuality(p,site,kind);if(!q.count)continue;
  const factor=q.ratio*q.efficiency*(1+(q.level-1)*.45);
  if(kind==='farm'){
   const food=Math.max(1,Math.round((4+(t.river?1:0)+(p.tech.includes('irrigation')?1:0))*factor));
   const leather=Math.max(1,Math.round(1.5*factor));
   const free=endpointStorageFree(p,site.id);
   if(free>=1){addLocal(site,'food',Math.min(food,free));addLocal(site,'leather',Math.min(leather,free-Math.min(food,free)));}
  }else{const free=endpointStorageFree(p,site.id);if(free>=1)addLocal(site,'wood',Math.min(free,Math.max(1,Math.round(3*factor))));}
 }
}
function processFactories(){
 for(const p of G.players)for(const t of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<t.buildings.length;i++){
  const kind=t.buildings[i],recipes=FACTORY_RECIPES[kind];if(!recipes)continue;
  const site=worksite(t,i),q=workQuality(p,site,kind),chosen=RECIPES[site?.recipe];
  if(!chosen||!q.count)continue;
  const attempts=Math.min(q.level,Math.max(1,Math.ceil(q.count/2)));
  for(let n=0;n<attempts;n++){
   if(!Object.entries(chosen.input).every(([item,amount])=>localCount(site,item)>=amount))break;
   // Output must have actual storage room. A full factory stops until a wagon unloads it.
   if(endpointStorageFree(p,site.id)<(chosen.amount||1))break;
   const successChance=Math.min(.98,.55+.32*q.efficiency+.08*(q.level-1));
   const rng=mulberry32(hash(G.seed+':factory:'+site.id+':'+G.round+':'+n));
   if(rng()>successChance)continue;
   for(const [item,amount] of Object.entries(chosen.input))addLocal(site,item,-amount);
   addLocal(site,chosen.output,chosen.amount||1);
  }
 }
}
// Each producer decides when to unload its goods, independently of caravan
// availability. Legacy sites default to waiting until full.
function sourceUnloadMode(site){return ['full','continuous','once'].includes(site?.unloadMode)?site.unloadMode:'full';}
function sourceReserved(p,site,item){
 return G.shipments.filter(j=>j.owner===p.id&&String(j.from)===String(site.id)&&j.stage==='pickup')
  .reduce((sum,j)=>sum+shipmentLoads(j).filter(e=>e.item===item).reduce((v,e)=>v+Math.max(0,e.qty||0),0),0);
}
function outputAvailable(p,site,item){return Math.max(0,localCount(site,item)-sourceReserved(p,site,item));}
function unloadAllowance(p,kind,site,item){
 const available=outputAvailable(p,site,item),mode=sourceUnloadMode(site);
 if(mode==='once')return Math.min(available,Math.max(0,site.unloadOncePending?.[item]||0));
 if(mode==='full'){
  // Remember that the full threshold was reached. Multiple output types
  // belong to one unload batch: removing Food must not strand Leather.
  if(stockUsed(site)>=siteStorageCapacity(kind,site.level))site.unloadFullPending=true;
  if(!site.unloadFullPending)return 0;
 }
 return available;
}
function clearFullUnloadBatch(p,kind,site){
 if(sourceUnloadMode(site)!=='full'){site.unloadFullPending=false;return;}
 // The batch is complete when all its output was transferred or booked.
 // Goods reserved for in-flight pickup must not get dispatched twice.
 if(site.unloadFullPending&&(OUTPUTS[kind]||[]).every(item=>outputAvailable(p,site,item)===0))site.unloadFullPending=false;
}
function markUnloadBooked(site,item,quantity){
 if(sourceUnloadMode(site)!=='once'||quantity<=0)return;
 site.unloadOncePending??={};
 site.unloadOncePending[item]=Math.max(0,(site.unloadOncePending[item]||0)-quantity);
 if(!Object.values(site.unloadOncePending).some(n=>n>0)){
  site.unloadMode='full';site.unloadOncePending={};
 }
}
function localStorageEndpoints(p,tile,sourceId){
 const local=tile.buildings.flatMap((kind,i)=>kind==='storageWarehouse'
  &&String(tile.buildingMeta?.[i]?.id)!==String(sourceId)?[tile.buildingMeta[i].id]:[]);
 if(tile.capital)local.push('depot');
 return local.filter(id=>endpointDeliverySpace(p,id)>0);
}
function unloadWithinHex(p,tile,kind,site){
 for(const item of OUTPUTS[kind]||[]){
  let remaining=unloadAllowance(p,kind,site,item);
  if(remaining<1)continue;
  for(const target of localStorageEndpoints(p,tile,site.id)){
   const fit=Math.min(remaining,endpointDeliverySpace(p,target));
   if(fit<1)continue;
   const moved=endpointAdd(p,target,item,fit);
   if(!moved)continue;
   addLocal(site,item,-moved);markUnloadBooked(site,item,moved);
   remaining-=moved;if(remaining<=0)break;
  }
 }
 clearFullUnloadBatch(p,kind,site);
}
function outgoingDestination(p,tile,site,item){
 const configured=site.routes?.[item];
 let destination=configured;
 if(destination==null&&p.id!==0&&(
  ['woodShield','leatherArmor','ironArmor','steelArmor','goldArmor','diamondArmor'].includes(item)
  ||WAR_EQUIPMENT[item]||item.startsWith('stone'))){
  const post=getMilitaryPosts(p.id)[0];
  if(post)destination=postStock(p,post.id)?.id||'depot';
 }
 if(destination==null)destination=nearbyStorage(p,tile,item)?.id??'depot';
 const dest=siteLookup(p.id,destination);
 if(!dest?.tile||String(destination)===String(site.id)||endpointDeliverySpace(p,destination)<1)return null;
 if(siegeBlocksDelivery({owner:p.id,toTileId:dest.tile.id,stage:'delivery'}))return null;
 const route=countryTravelRoute(p.id,tile,dest.tile);
 return route?{id:destination,tile:dest.tile,route}:null;
}
// Find the cheapest order of delivery destinations for a mixed load.
function optimalCargoDelivery(owner,origin,entries){
 const ids=[...new Set(entries.map(e=>String(e.to)))];
 const sites=ids.map(id=>siteLookup(owner,id));
 if(!sites.length||sites.some(s=>!s?.tile)||sites.length>10)return null;
 const n=ids.length,limit=1<<n,dp=Array.from({length:limit},()=>Array(n).fill(Infinity));
 const prev=Array.from({length:limit},()=>Array(n).fill(-1));
 const cost=(a,b)=>countryTravelRoute(owner,a,b)?.cost??Infinity;
 for(let i=0;i<n;i++)dp[1<<i][i]=cost(origin,sites[i].tile);
 for(let mask=1;mask<limit;mask++)for(let i=0;i<n;i++){
  if(!(mask&(1<<i))||!Number.isFinite(dp[mask][i]))continue;
  for(let j=0;j<n;j++){if(mask&(1<<j))continue;
   const next=mask|1<<j,trial=dp[mask][i]+cost(sites[i].tile,sites[j].tile);
   if(trial<dp[next][j]){dp[next][j]=trial;prev[next][j]=i;}
  }
 }
 let last=-1,best=Infinity;
 for(let i=0;i<n;i++)if(dp[limit-1][i]<best){last=i;best=dp[limit-1][i];}
 if(last<0||!Number.isFinite(best))return null;
 let mask=limit-1;const stops=[];
 while(last>=0){stops.unshift(ids[last]);const old=last;last=prev[mask][old];mask^=1<<old;}
 return {stops,cost:best,lastTile:siteLookup(owner,stops[stops.length-1]).tile};
}
function outputPickupTasks(p){
 const tasks=[];
 for(const tile of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<tile.buildings.length;i++){
  const kind=tile.buildings[i],site=tile.buildingMeta?.[i];if(!site||!OUTPUTS[kind])continue;
  const candidates=[];
  for(const item of OUTPUTS[kind]){
   const ready=unloadAllowance(p,kind,site,item);if(ready<1)continue;
   const target=outgoingDestination(p,tile,site,item);
   if(target&&target.tile.id!==tile.id)candidates.push({item,to:target.id,ready});
  }
  if(!candidates.length)continue;
  // Pack scarcer outputs first: 4 leather + 12 food => 4 leather + 6 food.
  candidates.sort((a,b)=>a.ready-b.ready||a.item.localeCompare(b.item));
  const remainingByDest=new Map(),cargo=[];let space=10;
  for(const entry of candidates){
   if(!space)break;
   const key=String(entry.to),free=remainingByDest.has(key)?
    remainingByDest.get(key):endpointDeliverySpace(p,entry.to);
   const qty=Math.min(space,entry.ready,free);
   if(qty<1)continue;
   cargo.push({item:entry.item,qty,to:entry.to});
   remainingByDest.set(key,free-qty);space-=qty;
  }
  if(!cargo.length)continue;
  const tour=optimalCargoDelivery(p.id,tile,cargo);if(!tour)continue;
  tasks.push({from:site.id,to:tour.stops[0],item:cargo[0].item,qty:cargo[0].qty,
   cargo,stops:tour.stops,source:tile,dest:tour.lastTile,leg:tour.cost});
 }
 return tasks;
}
// Automatic wagons travel a persistent circuit of producer buildings.
// Other wagons' in-progress pickups count as already covered, and a site
// visited this circuit cannot be revisited until other ready sites are served.
function otherCaravanPickupClaims(p,cart){
 const claimed=new Set();
 for(const other of p.caravans||[]){
  if(other.id===cart.id||!other.shipmentId)continue;
  const job=G.shipments.find(j=>j.id===other.shipmentId);
  if(job?.stage==='pickup'&&job.from!=null)claimed.add(String(job.from));
 }
 return claimed;
}
function optimizedUnloadTask(p,cart){
 const start=G.tiles.find(t=>t.id===cart.currentTileId);if(!start)return null;
 const claims=otherCaravanPickupClaims(p,cart);
 const cache=new Map(),travel=(a,b)=>{
  if(!a||!b)return Infinity;
  if(a.id===b.id)return 0;
  const key=a.id+'>'+b.id;
  if(!cache.has(key))cache.set(key,countryTravelRoute(p.id,a,b)?.cost??Infinity);
  return cache.get(key);
 };
 let tasks=outputPickupTasks(p).filter(t=>!claims.has(String(t.from))
  &&Number.isFinite(travel(start,t.source)));
 if(!tasks.length){cart.collectionQueue=[];return null;}
 // The visited list survives deliveries, rounds and browser save/reload.
 cart.collectionVisited??=[];
 const visited=new Set(cart.collectionVisited.map(String));
 let unvisited=tasks.filter(t=>!visited.has(String(t.from)));
 if(!unvisited.length){
  cart.collectionVisited=[];
  unvisited=tasks; // Completed a circuit: begin the next.
 }
 tasks=unvisited;
 if(tasks.length>10)tasks=tasks.sort((a,b)=>{
  const sa=siteLookup(p.id,a.from)?.site,sb=siteLookup(p.id,b.from)?.site;
  return (sa?.lastUnloadClock||0)-(sb?.lastUnloadClock||0)
   ||travel(start,a.source)+a.leg-travel(start,b.source)-b.leg;
 }).slice(0,10);
 const n=tasks.length,limit=1<<n;
 const dp=Array.from({length:limit},()=>Array(n).fill(Infinity));
 const prev=Array.from({length:limit},()=>Array(n).fill(-1));
 for(let i=0;i<n;i++)dp[1<<i][i]=travel(start,tasks[i].source)+tasks[i].leg;
 for(let mask=1;mask<limit;mask++)for(let i=0;i<n;i++){
  if(!(mask&(1<<i))||!Number.isFinite(dp[mask][i]))continue;
  for(let j=0;j<n;j++){
   if(mask&(1<<j))continue;
   const next=mask|(1<<j),cost=dp[mask][i]+travel(tasks[i].dest,tasks[j].source)+tasks[j].leg;
   if(cost<dp[next][j]){dp[next][j]=cost;prev[next][j]=i;}
  }
 }
 let last=-1,best=Infinity;
 for(let i=0;i<n;i++)if(dp[limit-1][i]<best){best=dp[limit-1][i];last=i;}
 let order=[];
 if(last>=0&&Number.isFinite(best)){
  let mask=limit-1;
  while(last>=0){order.unshift(tasks[last]);const old=last;last=prev[mask][old];mask^=1<<old;}
 }else{
  // A changed border may make some stops unreachable. Service reachable
  // producers now, and re-plan the rest after delivery.
  order=tasks.sort((a,b)=>travel(start,a.source)+a.leg-travel(start,b.source)-b.leg).slice(0,1);
 }
 cart.collectionQueue=order.map(t=>t.from);
 return order[0]||null;
}
function scheduleAutoCaravan(p,cart){
 if(!p||!cart||cart.shipmentId||!caravanHasDriver(p,cart))return false;
 const task=optimizedUnloadTask(p,cart);if(!task)return false;
 const first=task.cargo[0];
 if(!dispatchShipment(p.id,task.from,first.to,first.item,first.qty,true,cart))return false;
 const job=G.shipments.find(j=>j.id===cart.shipmentId);
 if(!job||job.kind==='porter')return false;
 cart.collectionActiveSource=task.from;
 cart.collectionQueue=(cart.collectionQueue||[]).filter(id=>String(id)!==String(task.from));
 // One ten-unit capacity shared across every type of cargo.
 job.cargo=task.cargo.map(entry=>({...entry}));
 job.deliveryStops=[...task.stops];job.to=task.stops[0];
 job.toTileId=siteLookup(p.id,job.to)?.tile?.id;
 job.item=first.item;job.qty=shipmentTotal(job);
 job.remaining=Math.ceil((pathCost(p.id,job.path)+task.leg)/2)+2;
 const site=siteLookup(p.id,task.from)?.site;
 if(site){
  for(const entry of job.cargo)markUnloadBooked(site,entry.item,entry.qty);
  site.lastUnloadClock=G.turnClock||0;
 }
 return true;
}
function autoDispatchOutputs(){
 // Same-hex unloading requires no caravan, porter or road movement.
 for(const p of G.players)for(const tile of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<tile.buildings.length;i++){
  const kind=tile.buildings[i],site=tile.buildingMeta?.[i];
  if(site&&OUTPUTS[kind])unloadWithinHex(p,tile,kind,site);
 }
 for(const p of G.players){
  syncCaravans(p);
  for(const cart of p.caravans.filter(c=>!c.shipmentId))scheduleAutoCaravan(p,cart);
  // Preserve hand delivery for nations without wagons or those that explicitly
  // allow porters when all staffed wagons are occupied.
  if(handHaulingAllowed(p))for(const task of outputPickupTasks(p)){
   if(availableCaravan(p.id,task.source))continue;
   const first=task.cargo[0],before=G.shipments.length;
   if(dispatchShipment(p.id,task.from,first.to,first.item,first.qty,true)&&G.shipments.length>before){
    const job=G.shipments[G.shipments.length-1],site=siteLookup(p.id,task.from)?.site;
    if(job.kind==='porter'&&site){markUnloadBooked(site,task.item,job.qty);site.lastUnloadClock=G.turnClock||0;}
   }
  }
  for(const tile of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<tile.buildings.length;i++){
   const kind=tile.buildings[i],site=tile.buildingMeta?.[i];
   if(site&&OUTPUTS[kind])clearFullUnloadBatch(p,kind,site);
  }
 }
}
function autoRequestFactoryInputs(){
 for(const p of G.players)for(const tile of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<tile.buildings.length;i++){
  const kind=tile.buildings[i],site=worksite(tile,i),recipe=RECIPES[site?.recipe];
  if(!FACTORY_RECIPES[kind]||!recipe)continue;
  for(const [item,amount] of Object.entries(recipe.input)){
   const queued=G.shipments.filter(j=>j.owner===p.id)
    .reduce((sum,j)=>sum+shipmentLoads(j).filter(e=>e.item===item&&String(e.to)===String(site.id))
     .reduce((subtotal,e)=>subtotal+Math.max(0,e.qty||0),0),0);
   let needed=Math.max(0,amount*(site.level||1)*2-localCount(site,item)-queued);
   let free=endpointDeliverySpace(p,site.id);
   if(needed<=0||free<=0)continue;
   const sources=storedAt(p,item).map(entry=>({...entry,route:countryTravelRoute(p.id,entry.tile,tile)||(p.boats?.length?boatTravelRoute(p.id,entry.tile,tile):null)}))
    .filter(entry=>entry.route&&String(entry.id)!==String(site.id))
    .sort((a,b)=>a.route.cost-b.route.cost);
   // Shared-hex stores can feed their neighboring factory immediately.
   for(const source of sources.filter(entry=>entry.tile.id===tile.id)){
    const qty=Math.min(needed,free,endpointCount(p,source.id,item));
    if(qty<1)continue;
    const moved=endpointAdd(p,site.id,item,qty);
    if(moved){endpointAdd(p,source.id,item,-moved);needed-=moved;free-=moved;}
    if(needed<=0||free<=0)break;
   }
   if(needed<=0||free<=0)continue;
   for(const source of sources.filter(entry=>entry.tile.id!==tile.id)){
    if(dispatchShipment(p.id,source.id,site.id,item,Math.min(10,needed,free,source.count),true))break;
   }
  }
 }
}
function postStock(p,postId){
 const t=G.tiles.find(t=>t.id===postId&&t.owner===p.id);if(!t)return null;
 const i=t.buildings.indexOf('post');return i<0?null:worksite(t,i);
}
function routingTargets(p,siteId){
 return [{id:'depot',name:'Capital warehouse'},...G.tiles.filter(t=>t.owner===p.id).flatMap(t=>t.buildings.flatMap((type,i)=>t.buildingMeta?.[i]?.id===siteId||!['storageWarehouse','post',...Object.keys(FACTORY_RECIPES)].includes(type)?[]:[{id:t.buildingMeta[i].id,name:`${t.name} · ${BUILDINGS[type].name}`}]))];
}
function setDeliveryRoute(tile,index,item,destination){
 const p=getCountry(),site=worksite(tile,index),automatic=destination==='auto';
 const target=automatic?null:siteLookup(0,destination);
 if(!active()||!site||tile.owner!==0||!(OUTPUTS[tile.buildings[index]]||[]).includes(item)||(!automatic&&!target)||destination===String(site.id))return false;
 if(target&&!ownedPath(0,tile,target.tile)&&!boatTravelRoute(0,tile,target.tile))return false;
 site.routes??={};
 if(automatic)delete site.routes[item];
 else site.routes[item]=destination==='depot'?'depot':Number(destination);
 save();render();return true;
}
function setUnloadMode(tile,index,mode){
 if(!active()||tile?.owner!==0||!['full','continuous','once'].includes(mode))return false;
 const site=worksite(tile,index),kind=tile.buildings[index];
 if(!site||!OUTPUTS[kind])return false;
 site.unloadMode=mode;site.unloadOncePending={};site.unloadFullPending=false;
 if(mode==='once'){
  for(const item of OUTPUTS[kind]){
   const available=outputAvailable(getCountry(),site,item);
   if(available>0)site.unloadOncePending[item]=available;
  }
  if(!Object.keys(site.unloadOncePending).length)site.unloadMode='full';
 }
 if(mode==='once'||mode==='continuous')autoDispatchOutputs();
 save();render();return true;
}
function setFactoryRecipe(tile,index,name){
 const site=worksite(tile,index),type=tile.buildings[index];
 if(!active()||tile.owner!==0||!site||!FACTORY_RECIPES[type]?.includes(name))return false;
 site.recipe=name;save();render();return true;
}
// Factories no longer access the national treasury as a teleporting input bin.
// Every ingredient must physically arrive at the plant via a recorded shipment.
function processSteelworks(){processFactories();}

function makeCitizen(p,rng,starting=false){
 const n=p.nextCitizenId++;
 return {id:`${p.id}-${n}`,name:FIRST_NAMES[randInt(rng,FIRST_NAMES.length)]+' '+LAST_NAMES[randInt(rng,LAST_NAMES.length)],
 age:starting?18+randInt(rng,48):(rng()<.67?18+randInt(rng,38):randInt(rng,17)),health:45+randInt(rng,56),morale:40+randInt(rng,61),skinTone:randInt(rng,5),homeId:null,military:null,job:null};
}
function buildUsed(t){return (t.capital?2:0)+(t.buildings||[]).reduce((sum,type)=>sum+(BUILDINGS[type]?.space||0),0)+(G?.projects||[]).filter(j=>j.tileId===t.id&&!j.upgradeSiteId).reduce((sum,j)=>sum+(BUILDINGS[j.type]?.space||0),0);}
function buildFree(t){return Math.max(0,TERRAIN[t.terrain].slots-buildUsed(t));}
function buildingCount(t,type){return (t.buildings||[]).filter(b=>b===type).length;}
const HOUSEHOLD_SIZE=4; // one occupied house per four housed citizens (including children).
const HOUSEHOLD_RENT=2; // Silver Pents per occupied household, not per citizen.
function tileHousing(t){return (t.capital?12:0)+(t.buildings||[]).reduce((beds,kind,i)=>beds+(kind==='homes'?8+4*((t.buildingMeta?.[i]?.level||1)-1):0),0);}
function tileResidentCap(t){return Math.min(TERRAIN[t.terrain].population,tileHousing(t));}
function reallocateHousing(p){
 const territories=G.tiles.filter(t=>t.owner===p.id).sort((a,b)=>Number(b.capital)-Number(a.capital));
 const remaining=Object.fromEntries(territories.map(t=>[t.id,tileResidentCap(t)]));
 // Keep existing homes stable whenever possible; move the unplaced citizens to vacancies.
 for(const c of p.citizens){if(c.homeId&&remaining[c.homeId]>0)remaining[c.homeId]--;else c.homeId=null;}
 for(const c of p.citizens){if(c.homeId)continue;const t=territories.find(t=>remaining[t.id]>0);if(t){c.homeId=t.id;remaining[t.id]--;}}
}
function occupiedHouseholds(p){
 // A housing unit holds four residents. Count only occupied units, never each resident individually.
 const residents=new Map();
 for(const c of p.citizens||[])if(c.homeId)residents.set(c.homeId,(residents.get(c.homeId)||0)+1);
 return G.tiles.filter(t=>t.owner===p.id).reduce((total,t)=>total+Math.ceil(Math.min(tileResidentCap(t),residents.get(t.id)||0)/HOUSEHOLD_SIZE),0);
}
function peopleSummary(p){const people=p.citizens||[];const housed=people.filter(c=>!!c.homeId).length;
 return {count:people.length,housed,homeless:people.length-housed,housing:G.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+tileResidentCap(t),0),soldiers:people.filter(c=>!!c.military).length,households:occupiedHouseholds(p)};}
function getMilitaryPosts(id){return G.tiles.filter(t=>t.owner===id&&buildingCount(t,'post')>0);}
function postGarrison(p,postId){return p.citizens.filter(c=>c.military?.postId===postId);}
// Citizens age each fourth round; sustained low morale harms health, and
// mortality gradually increases with age, poor health and psychological stress.
function citizenDeathProbability(c){
 const age=Math.max(0,Number(c.age)||0),health=Math.max(0,Math.min(100,c.health??70));
 const morale=Math.max(0,Math.min(100,c.morale??60));
 return Math.min(.35,.00015+Math.pow(Math.max(0,age-52),2)*.000012+
  Math.pow(Math.max(0,60-health),2)*.000009+Math.pow(Math.max(0,45-morale),2)*.000006);
}
function advanceCitizenHealthAndMortality(p){
 let losses=0;
 for(const citizen of [...p.citizens]){
  const hauling=isBusyPorter(citizen)||isBusyExpedition(citizen)||!!citizen.military?.missionId?.startsWith('siege-');
  const morale=Math.max(0,Math.min(100,Number(citizen.morale??60)));
  let health=Math.max(0,Math.min(100,Number(citizen.health??70)));
  if(morale<15)health-=2;
  else if(morale<35)health-=1;
  else if(morale<45&&G.round%2===0)health-=1;
  else if(!hauling&&morale>=65&&nationalResourceCount(p,'food')>0&&p.gold>=0)health++;
  if(citizen.age>=70&&G.round%4===0)health--;
  citizen.health=Math.max(0,Math.min(100,health));
  if(!hauling&&nationalResourceCount(p,'food')>0&&p.gold>=0&&citizen.morale<95){
   citizen.morale=Math.min(100,citizen.morale+1);
  }
  const chance=citizenDeathProbability(citizen);
  const rng=mulberry32(hash(G.seed+':citizen-mortality:'+G.round+':'+p.id+':'+citizen.id));
  if(citizen.health>0&&rng()>=chance)continue;
  p.citizens=p.citizens.filter(c=>c!==citizen);
  p.deathCount=(p.deathCount||0)+1;
  p.recentDeaths??=[];
  p.recentDeaths.unshift({name:citizen.name,age:citizen.age,round:G.round});
  p.recentDeaths.length=Math.min(8,p.recentDeaths.length);
  if(citizen.builder?.projectId){
   const project=G.projects.find(j=>j.id===citizen.builder.projectId);
   if(project)project.builderIds=(project.builderIds||[]).filter(id=>id!==citizen.id);
  }
  addLog(`${citizen.name} of ${p.name} passed away at age ${citizen.age}.`);
  losses++;
 }
 if(losses)reallocateHousing(p);
 return losses;
}
function newCitizensForRound(p){
 const summary=peopleSummary(p);if(nationalResourceCount(p,'food')<=0||summary.homeless>=7||summary.count>=150)return;
 const rng=mulberry32(hash(G.seed+':'+G.round+':'+p.id+':'+p.nextCitizenId));
 p.citizens.push(makeCitizen(p,rng));reallocateHousing(p);
}
// Water is a world-generation result, not a player-adjustable lobby setting.
// Lakes occupy connected *whole hexes*. Rivers trace shared SIDES of adjacent
// land hexes and never travel through the middle of a land tile.
function waterNeighbors(t,byId){return [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]
 .map(([q,r])=>byId.get(key(t.q+q,t.r+r))).filter(Boolean);}
function generateLakes(tiles,rng){
 const byId=new Map(tiles.map(t=>[t.id,t]));
 const valid=t=>t&&!t.capital&&t.owner===null&&
  Math.min(...CAPITAL_SPOTS.map(([q,r])=>distance(t,{q,r})))>1;
 const lakeCount=1+randInt(rng,2);
 for(let n=0;n<lakeCount;n++){
  const available=tiles.filter(t=>valid(t)&&t.terrain!=='water');
  if(!available.length)break;
  const origin=available[randInt(rng,available.length)];
  origin.terrain='water';
  const lake=[origin],size=4+randInt(rng,6);
  while(lake.length<size){
   const choices=new Map();
   for(const tile of lake)for(const neighbor of waterNeighbors(tile,byId))
    if(valid(neighbor)&&neighbor.terrain!=='water')choices.set(neighbor.id,neighbor);
   if(!choices.size)break;
   // Grow around the existing water cluster rather than drawing a thin snake.
   const weighted=[...choices.values()].map(t=>({t,weight:
    waterNeighbors(t,byId).filter(n=>n.terrain==='water').length*2+rng()*2}));
   weighted.sort((a,b)=>b.weight-a.weight);
   const chosen=weighted[Math.min(randInt(rng,Math.min(3,weighted.length)),weighted.length-1)].t;
   chosen.terrain='water';lake.push(chosen);
  }
 }
}
const riverCornerKey=p=>`${Math.round(p.x*1000)},${Math.round(p.y*1000)}`;
function borderRiverGraph(tiles,rng){
 const byId=new Map(tiles.map(t=>[t.id,t]));
 const corners=new Map(tiles.map(t=>[t.id,Array.from({length:6},(_,i)=>{
  const c=coords(t),angle=i*Math.PI/3+Math.PI/6;
  return {x:c.x+HEX*Math.cos(angle),y:c.y+HEX*Math.sin(angle)};
 })]));
 const positions=new Map(),neighbors=new Map(),edges=[];
 function addVertex(p){const k=riverCornerKey(p);positions.set(k,p);if(!neighbors.has(k))neighbors.set(k,[]);return k;}
 for(const t of tiles){
  if(t.terrain==='water')continue;
  for(const other of waterNeighbors(t,byId)){
   if(other.terrain==='water'||t.id>=other.id)continue;
   const otherKeys=new Set(corners.get(other.id).map(riverCornerKey));
   const shared=corners.get(t.id).filter(c=>otherKeys.has(riverCornerKey(c)));
   if(shared.length!==2)continue;
   const a=addVertex(shared[0]),b=addVertex(shared[1]);
   const index=edges.length;
   edges.push({a,b,land:[t.id,other.id],weight:1+rng()*.7});
   neighbors.get(a).push({next:b,index});neighbors.get(b).push({next:a,index});
  }
 }
 return {positions,neighbors,edges};
}
function riverPath(graph,start,goal){
 const {neighbors,edges,positions}=graph;
 const dist=new Map([[start,0]]),parents=new Map(),pending=new Set([start]);
 while(pending.size){
  let node=null,best=Infinity;
  for(const k of pending){const d=dist.get(k);if(d<best){best=d;node=k;}}
  pending.delete(node);if(node===goal)break;
  for(const link of neighbors.get(node)||[]){
   const candidate=best+edges[link.index].weight;
   if(candidate<(dist.get(link.next)??Infinity)){
    dist.set(link.next,candidate);parents.set(link.next,{prev:node,edge:link.index});pending.add(link.next);
   }
  }
 }
 if(!parents.has(goal))return null;
 const route=[goal],banks=[];
 let cursor=goal;
 while(cursor!==start){
  const prior=parents.get(cursor);if(!prior)return null;
  banks.unshift(edges[prior.edge].land);route.unshift(prior.prev);cursor=prior.prev;
 }
 return {points:route.map(k=>positions.get(k)),banks};
}
function generateBorderRivers(tiles,rng,count){
 const graph=borderRiverGraph(tiles,rng),nodes=[...graph.positions.keys()];
 if(!nodes.length)return [];
 const rivers=[];
 for(let i=0;i<count;i++){
  const heading=rng()*Math.PI*2,dx=Math.cos(heading),dy=Math.sin(heading);
  const positions=nodes.map(k=>({k,pos:graph.positions.get(k),degree:graph.neighbors.get(k).length}))
   .map(n=>({...n,progress:n.pos.x*dx+n.pos.y*dy}));
  const minimum=Math.min(...positions.map(n=>n.progress));
  const maximum=Math.max(...positions.map(n=>n.progress));
  const low=minimum+(maximum-minimum)*.17;
  const high=maximum-(maximum-minimum)*.17;
  let starts=positions.filter(n=>n.progress<=low&&n.degree<=2);
  let ends=positions.filter(n=>n.progress>=high&&n.degree<=2);
  if(!starts.length)starts=positions.filter(n=>n.progress<=low);
  if(!ends.length)ends=positions.filter(n=>n.progress>=high);
  if(!starts.length||!ends.length)continue;
  let chosen=null;
  for(let attempt=0;attempt<30;attempt++){
   const start=starts[randInt(rng,starts.length)].k;
   const end=ends[randInt(rng,ends.length)].k;
   const path=riverPath(graph,start,end);
   if(path&&(!chosen||path.banks.length>chosen.banks.length))chosen=path;
   // Aim for a long, genuinely connected river spanning the landscape.
   if(path&&path.banks.length>=16&&path.banks.length<=55){chosen=path;break;}
  }
  if(chosen&&chosen.banks.length>=8){
   rivers.push(chosen);
   const byId=new Map(tiles.map(t=>[t.id,t]));
   for(const [a,b] of chosen.banks){byId.get(a).river=true;byId.get(b).river=true;}
  }
 }
 return rivers;
}
function generateWaterways(tiles,rng,options){
 if(options.lakes)generateLakes(tiles,rng);
 for(const t of tiles)t.river=false;
 return options.rivers?generateBorderRivers(tiles,rng,1+Number(rng()<.22)):[];
}
function createWorld(seed,name,capital,color){
 const rng=mulberry32(hash(seed));
 const colors=[COLORS[color],...COLORS.filter((_,i)=>i!==color)];
 const players=[{name,capital,sigil:'GS'},...NPCS].map((p,i)=>({id:i,name:p.name,capital:p.capital,sigil:p.sigil,color:colors[i],gold:34,food:14,wood:16,minerals:{...START_MINERALS},knowledge:0,marketingUntil:0,warehouse:{},tech:[],hand:[],discountExpand:0,discountBuild:0,acted:false,actionsUsed:0,expansionsThisTurn:0,levyUsed:false,cardPlayed:false,logisticsUsed:false,citizens:[],nextCitizenId:0,caravans:[],boats:[],caravanPolicy:'nearest'}));
 const usedNames=new Set(),tiles=[];
 for(let q=-RADIUS;q<=RADIUS;q++)for(let r=-RADIUS;r<=RADIUS;r++){
  if(Math.abs(q+r)>RADIUS)continue;
  const roll=rng(),terrain=roll<.34?'plains':roll<.60?'forest':roll<.80?'hills':roll<.91?'desert':'mountain';
  const n=PREFIX[randInt(rng,PREFIX.length)]+SUFFIX[randInt(rng,SUFFIX.length)];
  let unique=n,ctr=2;while(usedNames.has(unique))unique=n+' '+ctr++;usedNames.add(unique);
  tiles.push({id:key(q,r),q,r,terrain,name:unique,owner:null,buildings:[],capital:false,river:false});
 }
 CAPITAL_SPOTS.forEach(([q,r],i)=>{let t=tiles.find(t=>t.q===q&&t.r===r);t.terrain='plains';t.owner=i;t.capital=true;t.name=players[i].capital;});
 // A random map can contain either feature, both, or occasionally neither.
 const options={rivers:rng()<.84,lakes:rng()<.84};
 const rivers=generateWaterways(tiles,rng,options);
 prepareMineralVeins(tiles,seed);
 const deck=Array.from({length:6},()=>CARD_POOL).flat().sort(()=>rng()-.5);
 const worldName=['The Wild Marches','The Broken Coast','The Emerald Frontier','The Hinterlands','The New Continent'][randInt(rng,5)];
 G={version:2,waterwayVersion:2,seed,worldName,worldOptions:options,rivers,players,tiles,projects:[],completedScenes:[],shipments:[],nextShipmentId:1,logisticsVersion:1,contacts:[],tradeOffers:[],tradeRoutes:[],domesticRoads:[],domesticRoadJobs:[],nextDomesticRoadId:1,bridges:[],bridgeJobs:[],nextBridgeId:1,nextBoatId:1,diplomaticFalcons:[],warnings:[],wars:[],treaties:[],militaryOrders:[],sieges:[],nextSiegeId:1,nextDiplomacyId:1,nextOrderId:1,nextProjectId:1,nextTradeId:1,nextBuildingId:1,turnClock:0,crewVersion:1,round:1,turnIndex:0,maxRounds:MAX_ROUNDS,selectedId:key(...CAPITAL_SPOTS[0]),deck,drawIndex:0,log:[],finished:false,continued:false};
 for(const p of players){const citizenRng=mulberry32(hash(seed+'-people-'+p.id));for(let k=0;k<10;k++)p.citizens.push(makeCitizen(p,citizenRng,true));reallocateHousing(p);drawCard(p);drawCard(p);}
 assignCpuPersonalities(G); ensureBuildingMeta(G);ensureStartingCrews(G);for(const p of G.players){reallocateHousing(p);assignWorkers(p);syncCaravans(p);}
 beginTurn(0);
 addLog(`${name} established its capital at ${capital}. Four nations have entered a ${tiles.length}-hex world.`);
 save();
}
function drawCard(p){if(p.hand.length>=4)return; if(G.drawIndex>=G.deck.length){const rng=mulberry32(hash(G.seed+'-'+G.round+'-'+G.drawIndex));G.deck=Array.from({length:6},()=>CARD_POOL).flat().sort(()=>rng()-.5);G.drawIndex=0;}
 p.hand.push(G.deck[G.drawIndex++]);}
function beginTurn(id){G.turnIndex=id;const p=G.players[id];p.acted=false;p.actionsUsed=0;p.expansionsThisTurn=0;p.levyUsed=false;p.cardPlayed=false;p.logisticsUsed=false;drawCard(p);discoverContacts();save();}
function addLog(text){G.log.unshift({round:G.round,text});G.log=G.log.slice(0,28);}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(G));}catch(e){/* local storage may be disabled */}}
function upgradeSavedWaterways(s){
 // Preserve all owned territory, citizens and lake hexes in an existing save.
 // Older saves used river paths through tile centers; replace only that geometry.
 if(s.waterwayVersion===2)return s;
 const oldRivers=Array.isArray(s.rivers)?s.rivers:[];
 const shouldHaveRiver=oldRivers.length>0;
 s.rivers=[];
 for(const t of s.tiles)t.river=false;
 if(shouldHaveRiver)s.rivers=generateBorderRivers(s.tiles,mulberry32(hash(s.seed+':river-migration')),1);
 s.waterwayVersion=2;
 try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch(e){}
 return s;
}
function migrateGameplay(s){
 s.projects=s.projects||[];s.completedScenes=s.completedScenes||[];s.contacts=s.contacts||[];
 s.shipments??=[];s.nextShipmentId??=1; s.diplomaticFalcons??=[];s.warnings??=[];s.wars??=[];s.treaties??=[];s.militaryOrders??=[];s.sieges??=[];s.nextSiegeId??=1;s.nextDiplomacyId??=1;s.nextOrderId??=1;
 s.logisticsRouteVersion??=0;
 s.tradeOffers=s.tradeOffers||[];s.tradeRoutes=s.tradeRoutes||[];s.domesticRoads??=[];s.domesticRoadJobs??=[];s.nextDomesticRoadId??=1;s.bridges??=[];s.bridgeJobs??=[];s.nextBridgeId??=1;s.nextBoatId??=1;
 s.nextProjectId=s.nextProjectId||1;s.nextTradeId=s.nextTradeId||1;
 s.nextBuildingId=s.nextBuildingId||1;
 prepareMineralVeins(s.tiles,s.seed,false);
 ensureBuildingMeta(s);
 assignCpuPersonalities(s);
 // Older saves split harvested 'logs' from Construction Wood. They are
 // identical Logs now. Merge inventories and cargo once without losing items.
 if(s.logsUnifiedVersion!==1){
  for(const tile of s.tiles)for(const site of tile.buildingMeta||[]){
   if(!site)continue;
   if(site.stock?.logs!=null){
    site.stock.wood=(site.stock.wood||0)+Math.max(0,site.stock.logs||0);delete site.stock.logs;
   }
   if(site.routes?.logs!=null){site.routes.wood??=site.routes.logs;delete site.routes.logs;}
   if(site.unloadOncePending?.logs!=null){
    site.unloadOncePending.wood=(site.unloadOncePending.wood||0)+site.unloadOncePending.logs;
    delete site.unloadOncePending.logs;
   }
   if(site.recipe==='woodPlanks')site.recipe='woodShield';
  }
  for(const p of s.players){
   if(p.warehouse?.logs){p.wood=(p.wood||0)+p.warehouse.logs;delete p.warehouse.logs;}
  }
  for(const job of s.shipments){
   if(job.item==='logs')job.item='wood';
   for(const load of job.cargo||[])if(load.item==='logs')load.item='wood';
  }
  s.logsUnifiedVersion=1;
 }
 // Barren legacy mines keep extracting Stone; never manufacture Iron veins merely to preserve an old mine.
 for(const p of s.players){
  if(p.materials!==undefined){const old=Math.max(0,p.materials);p.wood=(p.wood||0)+Math.ceil(old*.6);p.ore=(p.ore||0)+Math.floor(old*.4);delete p.materials;}
  p.wood??=10;p.marketingUntil??=0;p.warehouse??={};p.caravans??=[];p.boats??=[];p.caravanPolicy??='nearest';p.handHaulingPolicy??='wait';
  if(!Number.isFinite(p.gold))p.gold=0;
  p.gold=Math.max(-CREDIT_LIMIT_SP,p.gold);
  p.minerals??=emptyMinerals();
  for(const key of [...MINERAL_KEYS,'steel'])p.minerals[key]=Math.max(0,Math.floor(p.minerals[key]||0));
  if(p.ore!==undefined){p.minerals.iron+=Math.max(0,Math.floor(p.ore));delete p.ore;}
  for(const c of p.citizens||[]){if(c.health==null||c.morale==null){const rng=mulberry32(hash(s.seed+':traits:'+c.id));c.health=45+randInt(rng,56);c.morale=40+randInt(rng,61);}if(c.military){if(s.logisticsVersion!==1&&(!c.military.gear||['basic','leather'].includes(c.military.gear)))c.military.gear=null; c.military.helmet??=null;c.military.chest??=null;c.military.skill??=warSkill(c);c.military.shield??=null;c.military.weapon??=null;}c.skinTone??=hash(s.seed+':skin:'+c.id)%5;c.job??=null;}
 }
 if(!s.crewVersion){
  s.turnClock??=0;
  for(const job of s.projects){job.remaining=Math.max(1,(job.remaining||1)*2);job.total=Math.max(job.remaining,(job.total||1)*2);job.builderIds??=[];}
  s.crewVersion=1;
 }
 ensureStartingCrews(s);
 for(const p of s.players)assignWorkers(p,s);
 // Migrate unfinished old worksites onto the initial builder where possible.
 const old=G;G=s;
 for(const p of s.players)for(const job of s.projects.filter(j=>j.owner===p.id&&!j.builderIds?.length)){
  const tile=s.tiles.find(t=>t.id===job.tileId);if(tile)appointBuilder(p,job,tile);
 }
 G=old;
 // Earlier trade proposals and road jobs had no messenger, endpoints or builder assignments.
 // Preserve already completed roads and avoid charging for an unplayable old work order.
 for(const oldOffer of s.tradeOffers){if(!oldOffer.fromTileId&&oldOffer.status==='pending')oldOffer.status='rejected';}
 for(const oldRoad of s.tradeRoutes){if(oldRoad.status==='construction'&&!Number.isInteger(oldRoad.aDone))oldRoad.status='active';}
 const previous=G;G=s;for(const p of s.players)syncCaravans(p);G=previous;
 s.logisticsRouteVersion=2;s.logisticsVersion=1;return s;
}
function loadSaved(){
 try{
  const s=JSON.parse(localStorage.getItem(SAVE_KEY));
  if(s&&s.version===2&&Array.isArray(s.players)&&s.players.length===4&&Array.isArray(s.tiles))return migrateGameplay(upgradeSavedWaterways(s));
  const previous=JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
  if(previous&&previous.version===1&&previous.players?.length===4&&previous.tiles?.length){
   // Preserve old matches; a newly generated match is required for the bigger world.
   previous.version=2;previous.rivers=[];previous.worldOptions={rivers:false,lakes:false};
   for(const t of previous.tiles){t.buildings=t.building?[t.building]:[];delete t.building;t.river=false;}
   for(const p of previous.players){p.citizens=[];p.nextCitizenId=0;p.logisticsUsed=false;const rng=mulberry32(hash(previous.seed+'-people-'+p.id));for(let k=0;k<10;k++)p.citizens.push(makeCitizen(p,rng,true));}
   const old=G;G=previous;for(const p of previous.players)reallocateHousing(p);G=old;
   localStorage.setItem(SAVE_KEY,JSON.stringify(previous));return migrateGameplay(upgradeSavedWaterways(previous));
  }
 }catch(e){console.warn('Save could not be restored',e);}return null;
}
// Contact, consent and payment are required for international routes.
const contactKey=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');
function hasContact(a,b){return (G.contacts||[]).includes(contactKey(a,b));}
function discoverContacts(){
 if(!G)return;
 for(let a=0;a<G.players.length;a++)for(let b=a+1;b<G.players.length;b++){
  const ownedA=G.tiles.filter(t=>t.owner===a),ownedB=G.tiles.filter(t=>t.owner===b);
  if(ownedA.some(x=>ownedB.some(y=>distance(x,y)<=2))&&!hasContact(a,b)){
   G.contacts.push(contactKey(a,b));addLog(`First contact! ${G.players[a].name} and ${G.players[b].name} established diplomatic relations.`);
  }
 }
}
// A warning doesn't start a battle. A delivered war declaration starts a war PHASE.
// Its troop deployments are secret to the opposing country until real reconnaissance exists.
const warPair=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');
const TREATY_TYPES={
 treaty:{label:'Non-Aggression Treaty',duration:8,description:'Both nations agree not to declare war for eight rounds. The pact expires naturally or can be terminated by Falcon.'},
 alliance:{label:'Defensive Alliance',duration:null,description:'Both nations promise mutual defense. If either nation is attacked, the ally joins the war phase against the aggressor. Lasts until dissolved.'}
};
function activeTreaty(a,b){
 const pair=warPair(a,b);
 return (G.treaties||[]).find(t=>t.key===pair&&t.status==='active');
}
function treatyLabel(type){return TREATY_TYPES[type]?.label||'Diplomatic Agreement';}
function canProposeTreaty(a,b,type){
 if(!TREATY_TYPES[type]||a===b||!G.players[a]||!G.players[b]||currentWar(a,b))return false;
 const present=activeTreaty(a,b);
 if(present&&(present.type==='alliance'||present.type===type))return false;
 // A proposed alliance may upgrade an existing non-aggression pact.
 return !(G.diplomaticFalcons||[]).some(f=>['treaty','alliance'].includes(f.kind)
  &&warPair(f.from,f.to)===warPair(a,b)&&['flying','awaiting-reply'].includes(f.status));
}
function expireTreaties(){
 for(const t of G.treaties||[]){
  if(t.status==='active'&&Number.isFinite(t.expiresRound)&&G.round>=t.expiresRound){
   t.status='expired';t.endedClock=G.turnClock||0;
   addLog(`${treatyLabel(t.type)} between ${G.players[t.a].name} and ${G.players[t.b].name} expired.`);
  }
 }
}
function resolveTreatyOffer(note,accepted){
 if(!note||!['treaty','alliance'].includes(note.kind)||note.status!=='awaiting-reply')return false;
 if(accepted&&!canActivateTreaty(note)){
  if(note.to===0)showToast('Agreement cannot be signed during war or after a conflicting treaty.');
  return false;
 }
 note.status=accepted?'accepted':'rejected';
 const proposer=G.players[note.from],recipient=G.players[note.to];
 if(accepted){
  const prior=activeTreaty(note.from,note.to);
  if(prior){prior.status='upgraded';prior.endedClock=G.turnClock||0;}
  const type=note.kind;
  G.treaties.push({id:note.id,key:warPair(note.from,note.to),a:note.from,b:note.to,type,status:'active',
   startedRound:G.round,startedClock:G.turnClock||0,expiresRound:type==='treaty'?G.round+TREATY_TYPES.treaty.duration:null});
  // A signed pact supersedes outstanding border threats between the parties.
  for(const w of G.warnings||[])if(warPair(w.from,w.to)===warPair(note.from,note.to)
    &&['active','escalated'].includes(w.status)){w.status='rescinded';w.rescindedClock=G.turnClock||0;}
  addLog(`${proposer.name} and ${recipient.name} signed a ${treatyLabel(type)} by Falcon.`);
 }else addLog(`${recipient.name} declined the ${treatyLabel(note.kind)} proposal from ${proposer.name}.`);
 return true;
}
function canActivateTreaty(note){
 if(currentWar(note.from,note.to))return false;
 const previous=activeTreaty(note.from,note.to);
 return !previous||(previous.type==='treaty'&&note.kind==='alliance');
}
function respondTreatyOffer(id,accepted){
 const note=G.diplomaticFalcons.find(f=>f.id===id&&f.to===0&&['treaty','alliance'].includes(f.kind)&&f.status==='awaiting-reply');
 if(!note||!active())return false;
 if(!resolveTreatyOffer(note,accepted))return false;
 note.inboxRead=true;note.readRound=G.round;save();render();return true;
}
function currentWar(a,b){return (G.wars||[]).find(w=>w.key===warPair(a,b)&&w.status==='war');}
function opponentsAtWar(id){return (G.wars||[]).filter(w=>w.status==='war'&&(w.a===id||w.b===id)).map(w=>w.a===id?w.b:w.a);}
function startWar(a,b,cause='A war declaration arrived by messenger falcon',callDefenders=true){
 if(a===b||currentWar(a,b))return false;
 if(activeTreaty(a,b)){
  addLog(`War between ${G.players[a].name} and ${G.players[b].name} was prevented by their active ${treatyLabel(activeTreaty(a,b).type)}.`);
  return false;
 }
 const entry={key:warPair(a,b),a,b,status:'war',startedClock:G.turnClock||0,cause};
 G.wars.push(entry);for(const warning of G.warnings||[])if(warning.status==='active'&&warPair(warning.from,warning.to)===entry.key)warning.status='escalated';
 for(const id of [a,b])for(const c of G.players[id].citizens){if(!c.military)c.morale=Math.max(0,(c.morale??50)-4);}
 addLog(`${G.players[a].name} and ${G.players[b].name} entered the WAR PHASE. Troops may patrol, guard borders and flank. No battle begins automatically.`);
 if(callDefenders){
  for(const t of G.treaties||[]){
   if(t.status!=='active'||t.type!=='alliance'||![t.a,t.b].includes(b))continue;
   const ally=t.a===b?t.b:t.a;
   if(ally===a||currentWar(a,ally))continue;
   if(activeTreaty(a,ally)){
    addLog(`${G.players[ally].name} stayed neutral: its separate peace agreement with ${G.players[a].name} prevents intervention.`);
    continue;
   }
   startWar(a,ally,`Defensive alliance with ${G.players[b].name} was invoked`,false);
  }
 }
 return true;
}
function endWar(a,b){
 const w=currentWar(a,b);if(!w)return false;w.status='peace';w.endedClock=G.turnClock||0;
 for(const siege of G.sieges||[])if(['marching','active','breached','aftermath','counterattack'].includes(siege.status)
  &&warPair(siege.attacker,siege.defender)===warPair(a,b))finishSiege(siege,'ceasefire');
 addLog(`${G.players[a].name} and ${G.players[b].name} signed a ceasefire.`);
 return true;
}
function diplomaticMessageText(note){
 const from=G.players[note.from],t=G.tiles.find(t=>t.id===note.tileId);
 if(note.kind==='warning')return `If you expand into ${t?.name||'the warned territory'}, ${from.name} will declare war.`;
 if(note.kind==='retract')return `${from.name} has withdrawn their territorial warning over ${t?.name||'the disputed territory'}. The red border is no longer threatened.`;
 if(note.kind==='war')return `${from.name} declares war. A war phase now begins; battles are not automatic.`;
 if(note.kind==='treaty'||note.kind==='alliance')return `${from.name} proposes a ${treatyLabel(note.kind)}. ${TREATY_TYPES[note.kind].description}`;
 if(note.kind==='dissolve')return `${from.name} has formally ended the ${treatyLabel(note.agreementType)} between your nations.`;
 return `${from.name} proposes a ceasefire.`;
}
function visibleTerritorialWarnings(tileId=null){
 if(!G)return [];
 return (G.warnings||[]).filter(w=>w.to===0&&['active','escalated'].includes(w.status)
  &&(tileId===null||w.tileId===tileId)&&G.tiles.some(t=>t.id===w.tileId&&t.owner===null&&t.terrain!=='water'));
}
function threatenedHexBorders(){
 const seen=new Set();
 return visibleTerritorialWarnings().map(w=>{
  if(seen.has(w.tileId))return '';seen.add(w.tileId);
  const tile=G.tiles.find(t=>t.id===w.tileId),outline=pts(hexPoints(tile,HEX-.7));
  return `<g class="gs-threatened-hex" data-threatened-hex="${esc(tile.id)}" pointer-events="none">
    <polygon class="gs-threat-border-halo" points="${outline}" fill="none"/>
    <polygon class="gs-threat-border-core" points="${outline}" fill="none"/>
    <polygon class="gs-threat-border-pulse" points="${outline}" fill="none"/>
   </g>`;
 }).join('');
}
function sendDiplomaticFalcon(to,kind,tileId=null,id=0,automatic=false,warningId=null,treatyId=null){
 const from=G.players[id],other=G.players[to];if(!from||!other||id===to||!['warning','war','peace','retract','treaty','alliance','dissolve'].includes(kind))return false;
 if(!automatic&&!canCountryAct(from,id))return false;
 if(kind==='warning'&&(!tileId||!G.tiles.some(t=>t.id===tileId&&t.terrain!=='water'&&t.owner===null)))return false;
 if(kind==='warning'&&((G.warnings||[]).some(w=>w.from===id&&w.to===to&&w.tileId===tileId&&['active','escalated'].includes(w.status))
   ||(G.diplomaticFalcons||[]).some(f=>f.from===id&&f.to===to&&f.tileId===tileId&&f.kind==='warning'&&f.status==='flying')))return false;
 const withdrawn=kind==='retract'?(G.warnings||[]).find(w=>w.id===warningId&&w.from===id&&w.to===to&&['active','escalated'].includes(w.status)&&G.tiles.some(t=>t.id===w.tileId&&t.owner===null)):null;
 if(kind==='retract'&&(!withdrawn||G.diplomaticFalcons.some(f=>f.kind==='retract'&&f.warningId===warningId&&f.status==='flying')))return false;
 if(kind==='retract')tileId=withdrawn.tileId;
 const dissolving=kind==='dissolve'?(G.treaties||[]).find(t=>t.id===treatyId&&t.key===warPair(id,to)&&t.status==='active'):null;
 if(kind==='dissolve'&&(!dissolving||G.diplomaticFalcons.some(f=>f.kind==='dissolve'&&f.treatyId===treatyId&&f.status==='flying')))return false;
 if(['treaty','alliance'].includes(kind)&&!canProposeTreaty(id,to,kind))return false;
 if(['warning','war'].includes(kind)&&activeTreaty(id,to))return false;
 if(kind==='war'&&currentWar(id,to))return false;
 if(kind==='peace'&&!currentWar(id,to))return false;
 if(!automatic&&!hasMoney(from,1))return false;
 if(!automatic)from.gold-=1;
 const dist=distance(capitalOf(id),capitalOf(to)),trip=Math.max(1,Math.ceil(dist/5));
 const note={id:G.nextDiplomacyId++,kind,from:id,to,tileId,warningId:withdrawn?.id??null,treatyId:dissolving?.id??null,
  agreementType:dissolving?.type??null,createdClock:G.turnClock||0,travelTotal:trip,remaining:trip,status:'flying',automatic};
 G.diplomaticFalcons.push(note);
 if(!automatic)useAction(from,`${from.name} launched a messenger falcon to ${other.capital} carrying a ${kind==='war'?'declaration of war':kind==='peace'?'ceasefire proposal':kind==='retract'?'withdrawal of a territorial warning':kind==='dissolve'?'formal termination of a treaty':TREATY_TYPES[kind]?`${treatyLabel(kind)} proposal`:'territorial warning'}.`);
 else addLog(`${from.name} dispatched a falcon after a territorial warning was violated.`);
 if(id===0)showToast(`Falcon dispatched to ${other.capital}`);
 return true;
}
function checkWarningViolation(tile,newOwner){
 // Claiming a threatened hex settles all warnings, not just the one
 // addressed to the claiming nation. Preserve the war consequence.
 for(const w of G.warnings.filter(x=>x.tileId===tile.id&&['active','escalated'].includes(x.status))){
  const violation=w.to===newOwner;
  const triggerWar=violation&&w.status==='active'&&!currentWar(w.from,newOwner)
   &&!G.diplomaticFalcons.some(f=>f.kind==='war'&&f.from===w.from&&f.to===newOwner&&f.status==='flying');
  w.status=violation?'violated':'resolved';w.resolvedClock=G.turnClock||0;
  if(triggerWar)sendDiplomaticFalcon(newOwner,'war',tile.id,w.from,true);
 }
}
function progressDiplomaticFalcons(){
 for(const note of G.diplomaticFalcons.filter(x=>x.status==='flying')){
  if((G.turnClock||0)<=note.createdClock+1)continue; // A 1T order never completes on the sender's own turn.
  note.remaining=Math.max(0,note.remaining-1);if(note.remaining)continue;
  note.status='arrived';note.deliveredClock=G.turnClock||0;const recipient=G.players[note.to];
  const relation=warPair(note.from,note.to);if(!G.contacts.includes(relation))G.contacts.push(relation);
  if(note.kind==='warning'){
   const land=G.tiles.find(t=>t.id===note.tileId),stillNeutral=land?.owner===null;
   G.warnings.push({id:note.id,from:note.from,to:note.to,tileId:note.tileId,
    status:stillNeutral?'active':'resolved',deliveredClock:G.turnClock});
   if(stillNeutral)addLog(`Messenger falcon delivered a warning to ${recipient.capital}: ${diplomaticMessageText(note)}`);
   else addLog(`Territorial warning over ${land?.name||'disputed land'} arrived after the hex was already claimed and is no longer active.`);
  }else if(note.kind==='retract'){
   const warning=G.warnings.find(w=>w.id===note.warningId&&w.from===note.from&&w.to===note.to);
   if(warning&&['active','escalated'].includes(warning.status)){
    warning.status='rescinded';warning.rescindedClock=G.turnClock||0;
    addLog(`${G.players[note.from].name} rescinded the territorial warning over ${G.tiles.find(t=>t.id===warning.tileId)?.name||'the disputed territory'}.`);
   }
  }else if(note.kind==='dissolve'){
   const agreement=(G.treaties||[]).find(t=>t.id===note.treatyId&&t.key===warPair(note.from,note.to));
   if(agreement&&agreement.status==='active'){
    agreement.status='terminated';agreement.endedClock=G.turnClock||0;
    addLog(`${G.players[note.from].name} ended the ${treatyLabel(agreement.type)} with ${recipient.name} by Falcon.`);
   }
  }else if(note.kind==='treaty'||note.kind==='alliance'){
   if(note.to===0){
    note.status='awaiting-reply';
    addLog(`${G.players[note.from].name} proposed a ${treatyLabel(note.kind)}. Review your Falcon inbox.`);
   }else{
    const compatible=canActivateTreaty(note),rng=mulberry32(hash(G.seed+':treaty-decision:'+note.id));
    const willing=compatible&&rng()>(note.kind==='alliance'?.36:.17);
    resolveTreatyOffer(note,willing);
   }
  }else if(note.kind==='war'){startWar(note.from,note.to,`War declaration delivered to ${recipient.capital}`);}
  else if(note.kind==='peace'){
   if(note.to===0){note.status='awaiting-reply';addLog(`${G.players[note.from].name} requested a ceasefire. Review World Affairs.`);}
   else {const r=mulberry32(hash(G.seed+':ceasefire:'+note.id)); if(r()>.28)endWar(note.from,note.to);else addLog(`${recipient.name} refused the ceasefire proposal.`);}
  }
 }
}
function acceptCeasefire(falconId,accept){const n=G.diplomaticFalcons.find(x=>x.id===falconId&&x.to===0&&x.kind==='peace'&&x.status==='awaiting-reply');if(!n||!active())return false;n.status=accept?'accepted':'rejected';if(accept)endWar(n.from,n.to);else addLog(`${G.players[0].name} rejected a ceasefire.`);save();render();return true;}
function roadExistsBetween(a,b){return domesticRoadExists(a,b)||(G.tradeRoutes||[]).some(r=>r.status==='active'&&r.banks?.some(pair=>pair.includes(a.id)&&pair.includes(b.id)));}
// Flanks may cross neutral unowned land even when no road exists; unbuilt trails take longer.
// Enemy-controlled hexes are not passable without a future battle/infiltration mechanic.
function militaryTravelPath(owner,from,to){
 if(!from||!to||from.terrain==='water'||to.terrain==='water')return null;
 const cost=new Map([[from.id,0]]),prev=new Map(),pending=new Set([from.id]);
 while(pending.size){let best=null,d=Infinity;for(const id of pending){const c=cost.get(id);if(c<d){best=id;d=c;}}pending.delete(best);if(best===to.id)break;
  const t=G.tiles.find(t=>t.id===best);for(const next of neighbors(t)){
   if(next.terrain==='water'||(next.owner!==null&&next.owner!==owner))continue;
   const travel=roadExistsBetween(t,next)?1:(next.owner===owner?2:3)+(next.terrain==='mountain'?1:0);
   const cand=d+travel;if(cand<(cost.get(next.id)??Infinity)){cost.set(next.id,cand);prev.set(next.id,best);pending.add(next.id);}
  }
 }
 if(!cost.has(to.id))return null;
 const path=[to.id];while(path[0]!==from.id){const p=prev.get(path[0]);if(!p)return null;path.unshift(p);}
 return {path,points:cost.get(to.id)};
}
function orderMilitary(to,enemy,postId,qty,kind='patrol',id=0,transport='foot'){
 const p=G.players[id],post=G.tiles.find(t=>t.id===postId),target=G.tiles.find(t=>t.id===to);
 if(!p||!target||!post||!currentWar(id,enemy)||p.logisticsUsed||G.turnIndex!==id)return false;
 if(id===0&&!active())return false;
 if(post.owner!==id||!buildingCount(post,'post')||target.terrain==='water')return false;
 if(kind==='patrol'&&(target.owner!==id||!neighbors(target).some(n=>n.owner===null||n.owner===enemy)))return false;
 if(kind==='flank'&&(target.owner!==null||!G.tiles.some(t=>t.owner===enemy&&distance(t,target)<=3)))return false;
 const soldiers=postGarrison(p,postId).filter(c=>!c.military.missionId).slice(0,Number(qty));
 if(!soldiers.length||soldiers.length!==Number(qty)||soldiers.length>12)return false;
 const route=militaryTravelPath(id,post,target);if(!route)return false;
 const cartChoice=transport==='caravan'?warCartAtPost(id,post,soldiers.length):null;
 if(transport==='caravan'&&!cartChoice)return false;
 const mission={id:G.nextOrderId++,owner:id,enemy,originPostId:post.id,targetTileId:target.id,kind,troopIds:soldiers.map(c=>c.id),path:route.path,index:0,stepSpent:0,totalPoints:route.points,startedClock:G.turnClock||0,status:'traveling'};
 if(cartChoice){const ride=warSeatTroops(id,post,soldiers.length,'patrol-'+mission.id,route.path);if(!ride)return false;Object.assign(mission,ride,{transport:'caravan',totalTravel:Math.ceil((route.points+cartChoice.cost)/4)});}
 G.militaryOrders.push(mission);for(const c of soldiers)c.military.missionId=mission.id;
 p.logisticsUsed=true;addLog(`${p.name} issued confidential military orders during the war phase.`);
 if(id===0){showToast(`Dispatched ${soldiers.length} troops; off-road travel is slower.`);save();render();}
 return true;
}
function recallMilitary(id,owner=0){const m=G.militaryOrders.find(x=>x.id===id&&x.owner===owner&&x.status!=='returned');if(!m||owner===0&&!active())return false;
 const p=G.players[owner],origin=G.tiles.find(t=>t.id===m.originPostId),here=G.tiles.find(t=>t.id===m.path[m.index]);if(!origin||!here)return false;
 const route=militaryTravelPath(owner,here,origin);if(!route)return false;
 m.path=route.path;m.index=0;m.stepSpent=0;m.totalPoints=route.points;m.targetTileId=origin.id;m.kind='return';m.status='returning';m.startedClock=G.turnClock||0;
 addLog(`${p.name} recalled a patrol.`);save();render();return true;
}
function progressWarOrders(){
 for(const m of G.militaryOrders.filter(m=>['traveling','returning'].includes(m.status))){
  if((G.turnClock||0)<=m.startedClock+1)continue;
  if(m.index>=m.path.length-1){m.status=m.kind==='return'?'returned':'patrolling';continue;}
  if(m.transport==='caravan'&&!warDriverReady(m.owner,m))continue;
  const t=G.tiles.find(t=>t.id===m.path[m.index]),next=G.tiles.find(t=>t.id===m.path[m.index+1]);if(!t||!next)continue;
  const need=roadExistsBetween(t,next)?1:(next.owner===m.owner?2:3)+(next.terrain==='mountain'?1:0);
  if(m.transport==='caravan'){
    let budget=4;
    while(budget>0&&m.index<m.path.length-1){
     const from=G.tiles.find(t=>t.id===m.path[m.index]),toward=G.tiles.find(t=>t.id===m.path[m.index+1]);
     if(!from||!toward)break;
     const step=roadExistsBetween(from,toward)?1:(toward.owner===m.owner?2:3)+(toward.terrain==='mountain'?1:0);
     if(step>budget)break;budget-=step;m.index++;
    }
   }else{m.stepSpent++;if(m.stepSpent>=need){m.index++;m.stepSpent=0;}}
   if(m.cartId){const cart=G.players[m.owner]?.caravans.find(c=>c.id===m.cartId);if(cart)cart.currentTileId=m.path[m.index];}
  if(m.index>=m.path.length-1){m.status=m.kind==='return'?'returned':'patrolling';
   if(m.cartId){warReleaseTransport(G.players[m.owner]?.caravans.find(c=>c.id===m.cartId));m.cartId=null;m.transport='foot';}
    if(m.status==='returned'){const p=G.players[m.owner];for(const c of p.citizens)if(c.military?.missionId===m.id)c.military.missionId=null;}
   else if(m.owner===0)addLog(`Your ${m.kind==='flank'?'flanking party':'border patrol'} reached its assigned position.`);
  }
 }
}

// ═══════════════════════════════════════════════════════════════════════
// SIEGE CAMPAIGNS · one exchange per world round, never a live-timer battle.
// Each participant is a real citizen with military equipment, health, morale
// and experience. Orders are persistent/hidden until both turns resolve.
// ═══════════════════════════════════════════════════════════════════════
const SIEGE_ATTACK_ORDERS={
 blockade:'Maintain blockade',assault:'Assault defenses',disrupt:'Sabotage supplies',
 prepare:'Prepare equipment',withdraw:'Withdraw safely'
};
const SIEGE_DEFEND_ORDERS={
 hold:'Hold the walls',fortify:'Strengthen defenses',resupply:'Break the blockade and resupply',
 rally:'Rally the garrison',counterattack:'Launch a counterattack',surrender:'Offer surrender'
};
function activeSiege(tileId){return (G.sieges||[]).find(s=>s.targetTileId===tileId&&['marching','active'].includes(s.status));}
function siegeBlocksDelivery(job){
 if(!G||!job?.toTileId||!['delivery','unloading'].includes(job.stage))return false;
 const siege=activeSiege(job.toTileId);
 return !!siege&&siege.status==='active'&&siege.defender===job.owner
  &&['blockade','disrupt'].includes(siegeOrderFor(siege,'attacker'));
}
function siegeTeam(s,side){
 const id=side==='attacker'?s.attacker:s.defender,p=G.players[id];
 const ids=side==='attacker'?s.attackerIds:s.defenderIds;
 return (ids||[]).map(cid=>p.citizens.find(c=>c.id===cid)).filter(c=>c?.military&&(c.health??0)>0);
}
function siegeStagingRoute(owner,post,target){
 const friendly=neighbors(target).filter(t=>t.owner===owner&&t.terrain!=='water');
 return friendly.map(t=>({tile:t,route:militaryTravelPath(owner,post,t)}))
  .filter(e=>e.route).sort((a,b)=>a.route.points-b.route.points)[0]||null;
}

function warCartAtPost(owner,post,qty){
 if(!post||qty>6)return null;
 const p=G.players[owner];if(!p)return null;
 syncCaravans(p);
 return (p.caravans||[]).filter(c=>!c.shipmentId&&caravanHasDriver(p,c)).map(cart=>{
  const here=G.tiles.find(t=>t.id===cart.currentTileId);
  const path=here?ownedPath(owner,here,post):null;
  return {cart,path,cost:path?pathCost(owner,path):Infinity};
 }).filter(v=>v.path).sort((a,b)=>a.cost-b.cost)[0]||null;
}
function warSeatTroops(owner,post,qty,mission,path){
 const ready=warCartAtPost(owner,post,qty);if(!ready)return null;
 const cart=ready.cart;
 cart.shipmentId='troops:'+mission;cart.troopMissionId=mission;
 return {cartId:cart.id,ridePath:[...ready.path,...(path||[]).slice(1)],rideCost:ready.cost};
}
function warDriverReady(owner,job){
 if(!job?.cartId)return true;
 const p=G.players[owner];if(!p)return false;
 syncCaravans(p);
 const cart=p.caravans.find(c=>c.id===job.cartId);
 return !!cart&&caravanHasDriver(p,cart);
}
function warMoveRidingCart(owner,job){
 if(!job?.cartId||!job.ridePath?.length)return;
 const cart=G.players[owner]?.caravans.find(c=>c.id===job.cartId);
 if(!cart)return;
 syncCaravans(G.players[owner]);if(!caravanHasDriver(G.players[owner],cart))return;
 const total=Math.max(1,job.totalTravel||1),remaining=Math.max(0,job.marchRemaining??job.remaining??0);
 const index=Math.min(job.ridePath.length-1,Math.max(0,Math.floor((1-remaining/total)*(job.ridePath.length-1))));
 cart.currentTileId=job.ridePath[index];
 if(!remaining)warReleaseTransport(cart);
}
function canStartSiege(tileId,postId,owner){
 const p=G.players[owner],target=G.tiles.find(t=>t.id===tileId),
  post=G.tiles.find(t=>t.id===postId);
 if(!p||!target||!post||target.owner===null||target.owner===owner
  ||target.terrain==='water'||target.capital||!currentWar(owner,target.owner)||p.logisticsUsed)return false;
 if(post.owner!==owner||!buildingCount(post,'post')||!!activeSiege(tileId))return false;
 if((G.sieges||[]).some(s=>s.attacker===owner&&['marching','active'].includes(s.status)))return false;
 return !!siegeStagingRoute(owner,post,target);
}
function startSiege(tileId,postId,qty,owner=0,transport='foot'){
 const p=G.players[owner],target=G.tiles.find(t=>t.id===tileId);
 if(!G||!p||G.turnIndex!==owner||G.finished||owner===0&&!active()||!canStartSiege(tileId,postId,owner))return false;
 const men=postGarrison(p,postId).filter(c=>!c.military.missionId&&c.health>0).slice(0,Number(qty));
 if(!Number.isInteger(Number(qty))||qty<1||qty>12||men.length!==Number(qty))return false;
 const staging=siegeStagingRoute(owner,G.tiles.find(t=>t.id===postId),target);
 if(!staging)return false;
 const cartChoice=transport==='caravan'?warCartAtPost(owner,G.tiles.find(t=>t.id===postId),men.length):null;
 if(transport==='caravan'&&!cartChoice)return false;
 const march=Math.max(1,Math.ceil((staging.route.points+(cartChoice?.cost||0))/(cartChoice?4:2)));
 const siege={id:G.nextSiegeId++,targetTileId:target.id,stagingTileId:staging.tile.id,originPostId:postId,
  attacker:owner,defender:target.owner,attackerIds:men.map(c=>c.id),defenderIds:[],
  status:'marching',marchRemaining:march,createdClock:G.turnClock||0,startedRound:G.round,
  roundNumber:0,supply:0,fort:0,morale:0,destruction:0,preparation:0,history:[],reinforcements:[],
  attackerStanding:'blockade',defenderStanding:'hold',attackerOrder:null,defenderOrder:null};
 if(cartChoice){const ride=warSeatTroops(owner,G.tiles.find(t=>t.id===postId),men.length,'siege-'+siege.id,staging.route.path);if(!ride)return false;Object.assign(siege,ride,{totalTravel:march,transport:'caravan'});}
 G.sieges.push(siege);
 for(const c of men)c.military.missionId='siege-a-'+siege.id;
 p.logisticsUsed=true;
 addLog(`${p.name} mobilized ${men.length} soldiers toward ${target.name}. Their siege begins after ${march} travel ticks.`);
 if(owner===0){showToast(`Siege expedition marching to ${target.name}`);save();render();}
 return true;
}
function canReinforceSiege(s,postId,owner){
 if(!s||s.status!=='active'||![s.attacker,s.defender].includes(owner)||G.players[owner]?.logisticsUsed)return false;
 const post=G.tiles.find(t=>t.id===postId),target=G.tiles.find(t=>t.id===s.targetTileId);
 if(!post||post.owner!==owner||!buildingCount(post,'post')||!target)return false;
 const side=owner===s.attacker?'attacker':'defender';
 const current=siegeTeam(s,side).length+(s.reinforcements||[]).filter(r=>r.side===side).reduce((n,r)=>n+r.ids.length,0);
 if(current>=12||!postGarrison(G.players[owner],postId).some(c=>c.health>0&&!c.military?.missionId))return false;
 const dest=side==='attacker'?G.tiles.find(t=>t.id===s.stagingTileId):target;
 return !!dest&&dest.owner===owner&&!!militaryTravelPath(owner,post,dest);
}
function reinforceSiege(id,postId,qty,owner=0,transport='foot'){
 const s=(G.sieges||[]).find(s=>s.id===Number(id)),p=G.players[owner];
 if(!G||!s||!p||G.turnIndex!==owner||G.finished||owner===0&&!active()||!canReinforceSiege(s,postId,owner))return false;
 const side=owner===s.attacker?'attacker':'defender',destination=G.tiles.find(t=>t.id===(side==='attacker'?s.stagingTileId:s.targetTileId));
 const post=G.tiles.find(t=>t.id===postId),route=militaryTravelPath(owner,post,destination);
 const capacity=12-siegeTeam(s,side).length-(s.reinforcements||[]).filter(r=>r.side===side).reduce((n,r)=>n+r.ids.length,0);
 const available=postGarrison(p,postId).filter(c=>c.health>0&&!c.military.missionId);
 const number=Number(qty);
 if(!Number.isInteger(number)||number<1||number>capacity||number>available.length||!route)return false;
 const cartChoice=transport==='caravan'?warCartAtPost(owner,post,number):null;
 if(transport==='caravan'&&!cartChoice)return false;
 const troops=available.slice(0,number),travel=Math.max(1,Math.ceil((route.points+(cartChoice?.cost||0))/(cartChoice?4:2)));
 s.reinforcements??=[];
 const reinforcement={owner,side,postId,ids:troops.map(c=>c.id),remaining:travel,createdClock:G.turnClock||0};
 if(cartChoice){const ride=warSeatTroops(owner,post,number,'reinforcement-'+s.id+'-'+G.turnClock,route.path);if(!ride)return false;Object.assign(reinforcement,ride,{totalTravel:travel,transport:'caravan'});}
 s.reinforcements.push(reinforcement);
 for(const c of troops)c.military.missionId='siege-r-'+s.id;
 p.logisticsUsed=true;
 addLog(`${p.name} sent ${number} reinforcement${number===1?'':'s'} toward the siege of ${G.tiles.find(t=>t.id===s.targetTileId)?.name||destination.name}. Travel: ${travel} world ticks.`);
 if(owner===0){save();render();showToast(`${number} reinforcements dispatched`);}
 return true;
}
function progressSiegeReinforcements(){
 for(const s of G.sieges||[]){
  if(!['active','breached','aftermath','counterattack'].includes(s.status))continue;
  s.reinforcements??=[];
  for(const job of [...s.reinforcements]){
   if((G.turnClock||0)<=job.createdClock+1)continue;
   const p=G.players[job.owner];
   const target=G.tiles.find(t=>t.id===(job.side==='attacker'?s.stagingTileId:s.targetTileId));
   const late=job.side==='defender'&&['breached','aftermath','counterattack'].includes(s.status);
   if(!p||!target||(!late&&target.owner!==job.owner)){
    for(const c of p?.citizens||[])if(job.ids.includes(c.id)&&c.military?.missionId==='siege-r-'+s.id)c.military.missionId=null;
    warReleaseTransport(p?.caravans?.find(c=>c.id===job.cartId));
    s.reinforcements=s.reinforcements.filter(r=>r!==job);continue;
   }
   if(job.transport==='caravan'&&!warDriverReady(job.owner,job))continue;
   job.remaining=Math.max(0,job.remaining-1);warMoveRidingCart(job.owner,job);
   if(job.remaining>0)continue;
   if(late){
    s.lateDefenderIds??=[];s.lateDefenderPostId=job.postId;
    for(const cid of job.ids){
     const c=p.citizens.find(c=>c.id===cid&&c.health>0&&c.military?.missionId==='siege-r-'+s.id);
     if(c){s.lateDefenderIds.push(cid);c.military.missionId='siege-d-'+s.id;}
    }
    s.lateDefenderIds=[...new Set(s.lateDefenderIds)];s.endedRead=false;
    s.reinforcements=s.reinforcements.filter(r=>r!==job);
    addLog(p.name+' arrived after '+target.name+' was destroyed. Choose guard, counterattack or retreat.');
    continue;
   }
   const roster=job.side==='attacker'?s.attackerIds:s.defenderIds;
   let arrived=0;
   for(const cid of job.ids){
    const soldier=p.citizens.find(c=>c.id===cid&&c.health>0&&c.military?.missionId==='siege-r-'+s.id);
    if(!soldier)continue;
    if(siegeTeam(s,job.side).length>=12){soldier.military.missionId=null;continue;}
    roster.push(cid);soldier.military.missionId='siege-'+(job.side==='attacker'?'a-':'d-')+s.id;arrived++;
   }
   s.reinforcements=s.reinforcements.filter(r=>r!==job);
   if(arrived)addLog(arrived+' '+p.name+' reinforcement(s) arrived at '+target.name+'.');
  }
 }
}
function establishSiege(s){
 const target=G.tiles.find(t=>t.id===s.targetTileId),defender=G.players[s.defender];
 if(!target||target.owner!==s.defender||!currentWar(s.attacker,s.defender)){finishSiege(s,'cancelled');return;}
 // Defenders must actually be stationed in or next to this territory.
 const sites=getMilitaryPosts(s.defender).filter(t=>t.id===target.id||distance(t,target)===1);
 const chosen=sites.flatMap(t=>postGarrison(defender,t.id))
  .filter(c=>c.health>0&&!c.military.missionId).sort((a,b)=>gearReadiness(b)-gearReadiness(a)).slice(0,12);
 s.defenderIds=chosen.map(c=>c.id);
 for(const c of chosen)c.military.missionId='siege-d-'+s.id;
 const stores=(target.buildings||[]).reduce((n,kind,i)=>n+(target.buildingMeta?.[i]?.stock?.food||0),0);
 s.status='active';s.activeRound=G.round;s.supply=Math.min(100,40+Math.min(30,stores)+chosen.length*2);
 s.destruction??=0;s.fort=Math.min(100,28+(buildingCount(target,'post')?22:0)+(target.terrain==='mountain'?14:target.terrain==='hills'?8:target.terrain==='forest'?5:0));
 s.morale=Math.round(chosen.length?chosen.reduce((v,c)=>v+(c.morale||40),0)/chosen.length:55);
 addLog(`${G.players[s.attacker].name} surrounded ${target.name}. A siege is underway: ${chosen.length} defenders, ${s.fort} fortification, ${s.supply} supply.`);
}
function progressSiegeMarches(){
 for(const s of G.sieges||[]){
  if(s.status!=='marching'||(G.turnClock||0)<=s.createdClock+1)continue;
  if(!currentWar(s.attacker,s.defender)||G.tiles.find(t=>t.id===s.targetTileId)?.owner!==s.defender
   ||(!s.stagingNeutral&&G.tiles.find(t=>t.id===s.stagingTileId)?.owner!==s.attacker)||!siegeTeam(s,'attacker').length){
   finishSiege(s,'cancelled');continue;
  }
  if(s.transport==='caravan'&&!warDriverReady(s.attacker,s))continue;
   s.marchRemaining=Math.max(0,s.marchRemaining-1);warMoveRidingCart(s.attacker,s);
  if(!s.marchRemaining)establishSiege(s);
 }
 progressSiegeReinforcements();
}
function setSiegeOrder(siegeId,kind,owner=0){
 const s=(G.sieges||[]).find(x=>x.id===Number(siegeId)&&x.status==='active');
 if(!s||!G||G.turnIndex!==owner||G.finished||owner===0&&!active())return false;
 const side=s.attacker===owner?'attacker':s.defender===owner?'defender':null;
 const allowed=side==='attacker'?SIEGE_ATTACK_ORDERS:side==='defender'?SIEGE_DEFEND_ORDERS:null;
 if(!allowed||!allowed[kind])return false;
 s[side+'Standing']=kind;s[side+'Order']={kind,round:G.round};
 if(owner===0){save();render();showToast(`Siege order ready: ${allowed[kind]}`);}
 return true;
}
function siegeOrderFor(s,side){
 const saved=s[side+'Order'];
 return saved?.round===G.round?saved.kind:s[side+'Standing']||(side==='attacker'?'blockade':'hold');
}
function siegeStrength(s,side){
 return siegeTeam(s,side).reduce((sum,c)=>
  sum+gearReadiness(c)*Math.max(.2,(c.health??50)/100)*(.5+.5*(c.morale??50)/100),0);
}
function applySiegeInjuries(s,side,amount,roundSeed){
 const team=siegeTeam(s,side);if(!team.length)return {wounded:0,dead:0};
 const p=G.players[side==='attacker'?s.attacker:s.defender],rng=mulberry32(hash(G.seed+':siege-wounds:'+s.id+':'+G.round+':'+roundSeed+':'+side));
 const strikes=Math.min(team.length,Math.max(0,Math.round(amount)));
 let wounded=0,dead=0;
 for(let j=0;j<strikes;j++){
  const available=team.filter(c=>p.citizens.includes(c)&&c.health>0);if(!available.length)break;
  const citizen=available[Math.floor(rng()*available.length)];
  const protect=Math.min(12,(GEAR[citizen.military.gear]?.bonus||0)*.55+(citizen.military.shield==='woodShield'?2:0));
  const damage=Math.max(3,Math.round(9+rng()*13-protect));
  citizen.health=Math.max(0,citizen.health-damage);citizen.morale=Math.max(0,(citizen.morale||50)-Math.ceil(damage/3));
  if(!citizen.health){
   p.citizens.splice(p.citizens.indexOf(citizen),1);dead++;
   p.deathCount=(p.deathCount||0)+1;p.recentDeaths??=[];
   p.recentDeaths.unshift({name:citizen.name,age:citizen.age,round:G.round,cause:'battle',tileId:s.targetTileId});
   p.recentDeaths.length=Math.min(8,p.recentDeaths.length);
   reallocateHousing(p);
   addLog(`${citizen.name} of ${p.name} was killed in the fighting at ${G.tiles.find(t=>t.id===s.targetTileId)?.name||'the frontier'}.`);
  }else{citizen.military.experience=(citizen.military.experience||0)+1;wounded++;}
 }
 return {wounded,dead};
}
function finishSiege(s,status){
 if(!['marching','active','breached','aftermath','counterattack'].includes(s.status))return;
 s.status=status;s.endedRound=G.round;s.attackerOrder=null;s.defenderOrder=null;
 for(const j of s.reinforcements||[])warReleaseTransport(G.players[j.owner]?.caravans?.find(c=>c.id===j.cartId));
 warReleaseTransport(G.players[s.attacker]?.caravans?.find(c=>c.id===s.cartId));
 s.reinforcements=[];
 for(const id of [s.attacker,s.defender]){
  for(const c of G.players[id]?.citizens||[])if(c.military&&['siege-a-'+s.id,'siege-d-'+s.id,'siege-r-'+s.id].includes(c.military.missionId))
   c.military.missionId=null;
 }
 const target=G.tiles.find(t=>t.id===s.targetTileId);
 addLog(`Siege of ${target?.name||'the disputed territory'} ended: ${status==='captured'?'the attackers captured the territory':status==='withdrawn'?'the attacking army withdrew':status==='repelled'?'the defenders repelled the attackers':status==='ceasefire'?'a negotiated ceasefire': 'campaign cancelled'}.`);
}
function captureSiegeTerritory(s){
 const t=G.tiles.find(t=>t.id===s.targetTileId);if(!t||t.owner!==s.defender||t.capital)return false;
 const losing=G.players[s.defender],winning=G.players[s.attacker];
 // Surviving enemy soldiers retreat to a different friendly post, or leave
 // military service if their last post was lost; never attach them to an
 // enemy-controlled garrison. Preserves citizen identity and age.
 const safePost=getMilitaryPosts(s.defender).find(post=>post.id!==t.id);
 for(const c of losing.citizens)if(c.military?.postId===t.id){
  if(safePost)c.military.postId=safePost.id;else c.military=null;
 }
 t.owner=s.attacker;
 // Stop unfinished construction or deliveries belonging to the old owner
 // rather than allowing an enemy to finish/build in newly captured territory.
 for(const job of (G.projects||[]).filter(j=>j.tileId===t.id)){
  job.remaining=0;
  for(const id of job.builderIds||[]){const c=losing.citizens.find(c=>c.id===id);if(c?.builder)c.builder.projectId=null;}
 }
 G.projects=(G.projects||[]).filter(j=>j.tileId!==t.id);
 for(const mission of G.militaryOrders||[])if(mission.owner===s.defender&&mission.originPostId===t.id){
  mission.status='returned';for(const c of losing.citizens)if(c.military?.missionId===mission.id)c.military.missionId=null;
 }
 finishSiege(s,'captured');
 reallocateHousing(losing);reallocateHousing(winning);assignWorkers(losing);assignWorkers(winning);
 discoverContacts();checkWarningViolation(t,s.attacker);
 (G.completedScenes??=[]).push({projectId:`siege-${s.id}-${G.turnClock}`,owner:s.attacker,tileId:t.id,kind:'expand'});
 return true;
}

function warRemoveFallen(c,owner,s){
 if(c.health>0)return false;
 const p=G.players[owner],i=p.citizens.indexOf(c);
 if(i<0)return false;
 p.citizens.splice(i,1);
 p.deathCount=(p.deathCount||0)+1;p.recentDeaths??=[];
 p.recentDeaths.unshift({name:c.name,age:c.age,round:G.round,cause:'battle',tileId:s.targetTileId});
 p.recentDeaths.length=Math.min(8,p.recentDeaths.length);
 reallocateHousing(p);
 addLog(c.name+' of '+p.name+' was killed in the siege of '+(G.tiles.find(t=>t.id===s.targetTileId)?.name||'the frontier')+'.');
 return true;
}
// One fixed, virtual combat window per WORLD ROUND. No wall-clock timers
// affect outcomes: asynchronous players always get the same result on return.
function warFightWindow(s,leftIds,rightIds,leftOwner,rightOwner,seed,leftIntensity=1,rightIntensity=1){
 const rng=mulberry32(hash(G.seed+':bean-combat:'+s.id+':'+G.round+':'+seed));
 const rollSide=(sourceIds,targetIds,sourceOwner,targetOwner,intensity)=>{
  let strikes=0,hits=0,damage=0,losses=0;
  const source=G.players[sourceOwner],target=G.players[targetOwner];
  const attack=sourceIds.map(id=>source.citizens.find(c=>c.id===id)).filter(c=>c?.military&&c.health>0);
  for(const unit of attack){
   const attempts=Math.floor(warAttackSpeed(unit)*Math.max(0,intensity)*1.3+
    rng()); // 0-2 attacks for normal fighters; morale changes frequency.
   for(let k=0;k<attempts;k++){
    const targets=targetIds.map(id=>target.citizens.find(c=>c.id===id)).filter(c=>c?.military&&c.health>0);
    if(!targets.length)break;
    const enemy=targets[Math.floor(rng()*targets.length)];
    strikes++;
    const accuracy=Math.min(0.94,Math.max(0.18,0.26+warSkill(unit)*0.0067));
    if(rng()>accuracy)continue;
    hits++;
    const terrainReduction=s.targetTileId&&G.tiles.find(t=>t.id===s.targetTileId)?.terrain==='mountain'&&targetOwner===s.defender?.90:1;
    const raw=warWeaponDamage(unit)*terrainReduction*(0.85+rng()*.3);
    const taken=Math.max(1,Math.round(raw*(1-warDefense(enemy))));
    enemy.health=Math.max(0,enemy.health-taken);
    enemy.morale=Math.max(0,(enemy.morale??50)-Math.max(1,Math.round(taken/4)));
    unit.military.experience=(unit.military.experience||0)+1;
    // Skill improves with participation, never increases damage directly.
    if(unit.military.skill!=null&&rng()<.11)unit.military.skill=Math.min(100,unit.military.skill+1);
    damage+=taken;
    if(warRemoveFallen(enemy,targetOwner,s))losses++;
   }
  }
  return {strikes,hits,damage,losses};
 };
 // Both sides take their attacks based on the strength present at round start.
 // Interleave sides per round with seed-determined initiative to reduce first-turn bias.
 const first=rng()<.5?0:1;
 const out=[null,null];
 for(const side of [first,1-first]){
  out[side]=side===0
   ?rollSide(leftIds,rightIds,leftOwner,rightOwner,leftIntensity)
   :rollSide(rightIds,leftIds,rightOwner,leftOwner,rightIntensity);
 }
 return {attacker:out[0],defender:out[1]};
}
function warDestructionHit(s,attackerHits,attackingCount,defendingCount,aOrder,dOrder){
 if(aOrder!=='assault')return 0;
 const rng=mulberry32(hash(G.seed+':siege-structures:'+s.id+':'+G.round));
 const crew=Math.max(1,attackingCount);
 const defenseless=defendingCount===0?1.4:1;
 const shelter=Math.min(.45,(s.fort||0)/225);
 const prep=s.preparation||0;
 const base=(crew*.85+attackerHits*.6+prep*1.5)*defenseless*(.85+rng()*.3);
 return Math.max(1,Math.min(18,Math.round(base*(1-shelter)*(dOrder==='hold'?.86:1))));
}
function warReleaseTransport(cart){
 if(!cart)return;
 if(typeof cart.shipmentId==='string'&&cart.shipmentId.startsWith('troops:'))cart.shipmentId=null;
 cart.troopMissionId=null;
}
function warReturnTroops(ids,owner,fromId,destinationId,label){
 const p=G.players[owner],from=G.tiles.find(t=>t.id===fromId),dest=G.tiles.find(t=>t.id===destinationId);
 const roster=ids.map(id=>p.citizens.find(c=>c.id===id)).filter(c=>c?.military&&c.health>0);
 if(!roster.length)return;
 const route=from&&dest?militaryTravelPath(owner,from,dest):null;
 if(!route){for(const c of roster)c.military.missionId=null;return;}
 const id=G.nextOrderId++;
 const mission={id,owner,enemy:null,originPostId:destinationId,targetTileId:destinationId,
  kind:'return',troopIds:roster.map(c=>c.id),path:route.path,index:0,stepSpent:0,
  totalPoints:route.points,startedClock:G.turnClock||0,status:'returning'};
 G.militaryOrders.push(mission);
 for(const c of roster)c.military.missionId=id;
 addLog(p.name+' ordered '+roster.length+' soldier(s) to '+label+'.');
}
function warDestroyTerritory(s){
 const tile=G.tiles.find(t=>t.id===s.targetTileId);
 if(!tile||tile.owner!==s.defender||tile.capital)return false;
 const former=G.players[s.defender],lastBuilding=tile.buildings.length;
 // Full destruction removes both ownership and functional structures.
 tile.owner=null;tile.buildings=[];tile.buildingMeta=[];
 for(const project of (G.projects||[]).filter(p=>p.tileId===tile.id)){
  for(const id of project.builderIds||[]){const c=former.citizens.find(c=>c.id===id);if(c?.builder)c.builder.projectId=null;}
 }
 G.projects=(G.projects||[]).filter(p=>p.tileId!==tile.id);
 for(const job of [...(G.shipments||[])])if(job.fromTileId===tile.id||job.toTileId===tile.id){
  const owner=G.players[job.owner],cart=owner?.caravans.find(c=>c.id===job.caravanId);
  if(cart){cart.shipmentId=null;cart.currentTileId=job.path?.[job.step]||cart.currentTileId;}
  if(job.kind==='porter'){const c=owner?.citizens.find(c=>c.id===job.porterId);if(c)c.morale=Math.max(0,(c.morale??50)-2);}
  G.shipments.splice(G.shipments.indexOf(job),1);
 }
 for(const c of former.citizens)if(c.military?.postId===tile.id){
  const fallback=getMilitaryPosts(s.defender).find(t=>t.id!==tile.id);
  if(fallback)c.military.postId=fallback.id;else c.military.postId=null;
 }
 reallocateHousing(former);assignWorkers(former);
 s.destruction=100;s.status='breached';s.destroyedRound=G.round;
 s.attackerChoice=null;s.defenderChoice=null;s.endedRead=false;
 s.lateDefenderIds=[...new Set(s.defenderIds.filter(id=>former.citizens.some(c=>c.id===id&&c.health>0)))];
 (G.completedScenes??=[]).push({projectId:'ruins-'+s.id+'-'+G.turnClock,owner:s.attacker,tileId:tile.id,kind:'siege'});
 addLog(tile.name+' is 100% destroyed. Its '+lastBuilding+' structures are gone and the territory is UNCLAIMED. Both armies must choose their next move.');
 return true;
}
function warChooseAfternath(s,kind,targetId,owner=0){
 if(!s||!['breached','aftermath'].includes(s.status)||!G||G.turnIndex!==owner||G.finished||(owner===0&&!active()))return false;
 const tile=G.tiles.find(t=>t.id===s.targetTileId),p=G.players[owner];
 if(!tile||!p)return false;
 if(owner===s.attacker&&!s.attackerChoice){
  if(kind==='claim'){
   if(tile.owner!==null)return false;
   tile.owner=owner;s.attackerChoice='claim';s.status='aftermath';
   reallocateHousing(p);discoverContacts();checkWarningViolation(tile,owner);
   for(const c of siegeTeam(s,'attacker'))c.military.missionId=null;
   addLog(p.name+' claimed the destroyed territory of '+tile.name+'. Rebuilding is required.');
  }else if(kind==='retreat'){
   s.attackerChoice='retreat';s.status='aftermath';
   warReturnTroops(s.attackerIds,owner,s.stagingTileId,s.originPostId,'retreat to their original military post');
  }else if(kind==='push'){
   const next=G.tiles.find(t=>t.id===targetId);
   if(!next||next.capital||next.terrain==='water'||next.owner!==s.defender||!neighbors(tile).some(n=>n.id===next.id)||!currentWar(owner,next.owner))return false;
   const troops=siegeTeam(s,'attacker');
   if(!troops.length)return false;
   const fresh={id:G.nextSiegeId++,targetTileId:next.id,stagingTileId:tile.id,stagingNeutral:true,
    originPostId:s.originPostId,attacker:owner,defender:next.owner,
    attackerIds:troops.map(c=>c.id),defenderIds:[],status:'marching',
    marchRemaining:1,createdClock:G.turnClock||0,startedRound:G.round,
    roundNumber:0,supply:0,fort:0,morale:0,destruction:0,preparation:0,
    history:[],reinforcements:[],attackerStanding:'assault',defenderStanding:'hold',
    attackerOrder:null,defenderOrder:null};
   G.sieges.push(fresh);
   for(const c of troops)c.military.missionId='siege-a-'+fresh.id;
   s.attackerChoice='push';s.status='aftermath';
   addLog(p.name+' advanced from the ruins of '+tile.name+' toward '+next.name+' without claiming the ruined land.');
  }else return false;
 }else if(owner===s.defender&&s.lateDefenderIds?.length){
  const troops=s.lateDefenderIds.map(id=>p.citizens.find(c=>c.id===id)).filter(c=>c?.military&&c.health>0);
  if(!troops.length){s.lateDefenderIds=[];return false;}
  const border=G.tiles.filter(t=>t.owner===owner&&t.terrain!=='water').sort((a,b)=>distance(a,tile)-distance(b,tile)||a.id.localeCompare(b.id))[0];
  if(kind==='guard'){
   if(!border)return false;
   // Border stand-ground orders go to the closest friendly edge before remaining on patrol.
   const origin=G.tiles.find(t=>t.id===troops[0].military.postId)||border;
   const route=militaryTravelPath(owner,tile,border)||{path:[border.id],points:1};
   const id=G.nextOrderId++;
   G.militaryOrders.push({id,owner,enemy:s.attacker,originPostId:origin.id,
    targetTileId:border.id,kind:'patrol',troopIds:troops.map(c=>c.id),path:route.path,
    index:0,stepSpent:0,totalPoints:route.points,startedClock:G.turnClock||0,status:'traveling'});
   for(const c of troops)c.military.missionId=id;
   addLog(p.name+' deployed late reinforcements to guard the border at '+border.name+'.');
  }else if(kind==='retreat'){
   const post=getMilitaryPosts(owner).find(t=>t.id===s.lateDefenderPostId)||getMilitaryPosts(owner)[0];
   warReturnTroops(troops.map(c=>c.id),owner,tile.id,post?.id,'retreat after the territory was lost');
  }else if(kind==='attack'){
   if(!border)return false;
   // Reinforcements mount a counterattack; occupation is contested for multiple world rounds.
   s.counterattackIds=troops.map(c=>c.id);s.counterRound=0;s.status='counterattack';s.defenderChoice='attack';
   addLog(p.name+' launched a counterattack to reclaim '+tile.name+'.');
   for(const c of troops)c.military.missionId='siege-d-'+s.id;
  }else return false;
  if(kind!=='attack'){s.lateDefenderIds=[];s.defenderChoice=kind;}
 }else return false;
 s.endedRead=false;
 save();render();if(owner===0)showToast('Post-battle order recorded');
 return true;
}
function warFinalizeAftermath(s){
 if(s.status!=='aftermath'||!s.attackerChoice||s.lateDefenderIds?.length||s.reinforcements?.length)return;
 s.status=s.attackerChoice==='claim'?'claimed':s.attackerChoice==='push'?'advanced':'withdrawn';
 s.endedRound=G.round;s.endedRead=false;
 for(const c of siegeTeam(s,'attacker'))if(c.military.missionId==='siege-a-'+s.id)c.military.missionId=null;
}
function resolveSieges(){
 for(const s of G.sieges||[]){
  if(s.status==='aftermath'){warFinalizeAftermath(s);continue;}
  if(s.status==='counterattack'){
   if(s.counterRound===G.round)continue;
   s.counterRound=G.round;
   const combat=warFightWindow(s,s.attackerChoice==='claim'?s.attackerIds:[],s.counterattackIds,s.attacker,s.defender,'reclaim',0.9,1);
   const ra=s.attackerChoice==='claim'?siegeTeam(s,'attacker'):[],rd=s.counterattackIds.map(id=>G.players[s.defender].citizens.find(c=>c.id===id)).filter(c=>c?.military&&c.health>0);
   const tile=G.tiles.find(t=>t.id===s.targetTileId);
   if(!rd.length){s.status='aftermath';s.lateDefenderIds=[];s.defenderChoice='failed';}
   else if(!ra.length||s.counterRoundCount>=3){
    s.counterRoundCount=(s.counterRoundCount||0)+1;
    if(!ra.length){tile.owner=s.defender;reallocateHousing(G.players[s.defender]);}
    s.status='aftermath';s.lateDefenderIds=[];s.defenderChoice=!ra.length?'reclaimed':'repelled';
    if(!ra.length)s.attackerChoice='retreat';
    for(const c of rd)c.military.missionId=null;
   }else s.counterRoundCount=(s.counterRoundCount||0)+1;
   addLog('Counterattack at '+tile.name+': '+combat.attacker.hits+' attacker hits, '+combat.defender.hits+' defender hits.');
   continue;
  }
  if(s.status!=='active'||s.activeRound>=G.round)continue;
  const target=G.tiles.find(t=>t.id===s.targetTileId);
  if(!target||target.owner!==s.defender||!currentWar(s.attacker,s.defender)||
   (!s.stagingNeutral&&G.tiles.find(t=>t.id===s.stagingTileId)?.owner!==s.attacker)){
   finishSiege(s,'cancelled');continue;
  }
  s.roundNumber++;s.destruction??=0;
  const aOrder=siegeOrderFor(s,'attacker'),dOrder=siegeOrderFor(s,'defender');
  const fresh=siegeTeam(s,'attacker'),guards=siegeTeam(s,'defender');
  if(!fresh.length||aOrder==='withdraw'){finishSiege(s,fresh.length?'withdrawn':'repelled');continue;}
  const attacker=G.players[s.attacker],defender=G.players[s.defender];
  const ration=Math.max(1,Math.ceil(fresh.length/6));
  const fed=attacker.food>=ration;
  if(fed)attacker.food-=ration;
  else for(const c of fresh)c.morale=Math.max(0,(c.morale??50)-4);
  const supplyBefore=s.supply;
  const drain=aOrder==='blockade'?7:aOrder==='disrupt'?10:3;
  s.supply=Math.max(0,s.supply-drain);
  if(aOrder==='prepare'&&nationalResourceCount(attacker,'wood')>=1){spendNationalResource(attacker,'wood',1);s.preparation=Math.min(3,(s.preparation||0)+1);}
  if(dOrder==='fortify'&&nationalResourceCount(defender,'wood')>=2){spendNationalResource(defender,'wood',2);s.fort=Math.min(100,s.fort+5);s.destruction=Math.max(0,s.destruction-2);}
  if(dOrder==='resupply'&&defender.food>=3&&neighbors(target).some(t=>t.owner===s.defender)){
   defender.food-=3;s.supply=Math.min(100,s.supply+15);
  }
  if(dOrder==='rally')for(const c of guards)c.morale=Math.min(100,(c.morale??50)+5);
  const leftIntensity=(aOrder==='assault'?1:aOrder==='disrupt'?.40:aOrder==='blockade'?.25:.12)*(fed?1:.65);
  const rightIntensity=dOrder==='counterattack'?1.1:dOrder==='hold'?.60:dOrder==='fortify'?.25:.4;
  const clash=warFightWindow(s,s.attackerIds,s.defenderIds,s.attacker,s.defender,'siege',leftIntensity,rightIntensity);
  const before=s.destruction;
  const structural=warDestructionHit(s,clash.attacker.hits,fresh.length,siegeTeam(s,'defender').length,aOrder,dOrder);
  s.destruction=Math.min(100,s.destruction+structural);
  if(aOrder==='assault')s.preparation=0;
  if(s.supply<=20)for(const c of siegeTeam(s,'defender'))c.morale=Math.max(0,(c.morale??50)-(s.supply===0?4:2));
  const casualties=clash.attacker.losses+clash.defender.losses;
  s.lastCombatRound=G.round;s.lastCombatHits={attacker:clash.attacker.hits,defender:clash.defender.hits};
  const summary='Round '+s.roundNumber+': '+SIEGE_ATTACK_ORDERS[aOrder]+' vs '+SIEGE_DEFEND_ORDERS[dOrder]+
   ' · destruction '+before+'→'+s.destruction+'/100 · hits '+clash.attacker.hits+' / '+clash.defender.hits+
   ' · casualties '+casualties+' · supplies '+supplyBefore+'→'+s.supply+'.';
  s.history.unshift({round:G.round,attacker:aOrder,defender:dOrder,supply:s.supply,fort:s.fort,
   destruction:s.destruction,morale:s.morale,summary});
  s.history=s.history.slice(0,15);
  addLog('Siege of '+target.name+': '+summary);
  if(s.destruction===100){warDestroyTerritory(s);continue;}
  if(!siegeTeam(s,'attacker').length){finishSiege(s,'repelled');continue;}
  // Even when all defenders are defeated, destruction must reach 100% to take land.
 }
}

// v0.4.30 bean artwork. This SVG is the actual runtime drawing, not preview art.
// Material trim and weapon silhouette come exclusively from the soldier's loadout.
const BEAN_SKINS=['#f2c9a6','#dca781','#bd805b','#8c5941','#593a2c'];
function beanSkin(c){
 if(c?.skinTone!=null)return BEAN_SKINS[Math.abs(Number(c.skinTone)||0)%BEAN_SKINS.length];
 return BEAN_SKINS[hash('skin:'+String(c?.id||'0'))%BEAN_SKINS.length];
}
function beanMood(c){
 const m=c?.morale??50;
 return m>=70?'M-3 -14Q0 -9 3 -14':m<35?'M-3 -11Q0 -16 3 -11':'M-3 -13H3';
}
function beanLod(){return view.w>=680?0:view.w>=330?1:2;}
function beanPaint(material){
 const metal={leather:['#986b46','#d6a679'],stone:['#949b9b','#cbd0ce'],
 iron:['#879aa7','#d1dce0'],steel:['#b6c7d5','#f0fbff'],
 gold:['#c4d0d8','#e9bc52'],diamond:['#c3d0dd','#60ddeb'],
 wood:['#ae8356','#e9c28c'],none:['#84969c','#b3c5c4']};
 return metal[material]||metal.none;
}
function beanHelmet(c,lod){
 const m=c.military||{},item=m.helmet||null;
 if(!item)return '';
 const [base,trim]=beanPaint(warMaterial(item));
 let html='<path d="M-9-28Q-9-42 0-42Q9-42 9-28L8-26Q0-29-8-26Z" fill="'+base+'" stroke="#2a3b47" stroke-width="1.5"/>';
 if(lod>=1)html+='<path d="M-8-28Q0-32 8-28M0-40V-30" fill="none" stroke="'+trim+'" stroke-width="1.4"/>';
 if(lod>=2&&['gold','diamond'].includes(warMaterial(item)))html+='<path d="M0-36l2 3-2 3-2-3Z" fill="'+trim+'"/>';
 return html;
}
function beanChest(c,lod){
 const m=c.military||{},item=m.chest||((m.gear&&GEAR[m.gear])?m.gear:null);
 if(!item)return '';
 const mat=warMaterial(item),[base,trim]=beanPaint(mat);
 const chain=/chain/i.test(item);
 let html='<path d="M-10-21Q0-24 10-21L11-8Q0 2-11-8Z" fill="'+base+'" stroke="#293a45" stroke-width="1.3"/>';
 if(lod>=1){
  if(chain&&lod>=2)for(let y=-19;y<-5;y+=4)for(let x=-8;x<8;x+=5)
   html+='<path d="M'+x+' '+y+'q2 3 4 0" stroke="'+trim+'" stroke-width=".8" fill="none"/>';
  else html+='<path d="M0-21V-2M-8-16L8-16" fill="none" stroke="'+trim+'" stroke-width="1.2"/>';
 }
 if(lod>=2&&['gold','diamond'].includes(mat))html+='<path d="M0-16l2 2-2 3-2-3Z" fill="'+trim+'"/>';
 return html;
}
function beanWeapon(c,lod){
 const key=c.military?.weapon;if(!key)return '';
 const kind=warWeaponClass(key),mat=warMaterial(key),[base,trim]=beanPaint(mat);
 const blade=mat==='wood'?'#ad7746':base;
 let shape='';
 if(kind==='sword')shape='<path d="M-2 3L-3-15L0-22L3-15L2 3Z" fill="'+blade+'" stroke="#33404a" stroke-width="1.1"/>'+
  '<path d="M-6 4H6" stroke="'+trim+'" stroke-width="2.4"/><path d="M0 4V11" stroke="#775038" stroke-width="2.6"/>';
 else if(kind==='spear')shape='<path d="M0 11V-14" stroke="#805938" stroke-width="2.5"/>'+
  '<path d="M-4-13L0-23L4-13L0-9Z" fill="'+blade+'" stroke="#384751" stroke-width="1"/>';
 else if(kind==='axe')shape='<path d="M0 10V-16" stroke="#86593d" stroke-width="2.8"/>'+
  '<path d="M0-17L8-22L11-19L10-8L3-5L0-8Z" fill="'+blade+'" stroke="#3a454a" stroke-width="1.2"/>';
 else shape='<path d="M0 11V-17" stroke="#86593d" stroke-width="2.8"/>'+
  '<rect x="-8" y="-22" width="16" height="8" rx="1.5" fill="'+blade+'" stroke="#3a454a" stroke-width="1.2"/>';
 if(lod>=2&&mat!=='wood')shape+='<path d="M0-17V-8" stroke="'+trim+'" stroke-width=".9"/>';
 return '<g transform="translate(16 -9)"><g class="gs-bean-weapon">'+shape+'</g></g>';
}
function beanShield(c,lod){
 const key=c.military?.shield;if(!key)return '';
 const mat=warMaterial(key),[base,trim]=beanPaint(mat);
 let shield='<path d="M0-11L9-8L8 5L0 12L-8 5L-9-8Z" fill="'+base+'" stroke="#243a45" stroke-width="1.7"/>';
 if(lod>=1)shield+='<path d="M0-7L5-5L4 3L0 7L-4 3L-5-5Z" fill="'+(mat==='wood'?'#997047':'#8ba9b9')+'" stroke="'+trim+'" stroke-width="1.3"/>';
 if(lod>=2)shield+='<circle r="2.3" fill="'+trim+'" stroke="#50616a" stroke-width=".7"/>';
 return '<g transform="translate(-17 -7)"><g class="gs-bean-shield">'+shield+'</g></g>';
}
function beanPerson(c,owner,kind='soldier',lod=beanLod()){
 const col=owner?.color||'#7ed0b7',skin=beanSkin(c);
 const body='<path d="M0-23C-10-23-13-13-13-6Q-14 9 0 10Q14 9 13-6C13-16 10-23 0-23Z" fill="'+col+'" stroke="#29383f" stroke-width="1.8"/>'+
  (lod>=1?'<path d="M-7-15Q-11-7-7 2" fill="none" stroke="#ffffff" opacity=".38" stroke-width="2"/>':'');
 let head='<circle cx="0" cy="-28" r="10" fill="'+skin+'" stroke="#27333c" stroke-width="1.8"/>';
 if(lod>=1)head+='<ellipse cx="-4" cy="-31" rx="2.4" ry="1.2" fill="#fff3d4" opacity=".45"/>'+
  '<ellipse cx="-3" cy="-28" rx="1" ry="1.6" fill="#24333b"/><ellipse cx="3" cy="-28" rx="1" ry="1.6" fill="#24333b"/>'+
  '<path d="'+beanMood(c)+'" fill="none" stroke="#5d3d36" stroke-width="1.1" stroke-linecap="round"/>';
 return '<g class="gs-bean-unit '+(kind==='soldier'?'gs-bean-soldier gs-weapon-'+warWeaponClass(c.military?.weapon):'gs-bean-civilian')+'" style="--gs-hop-duration:'+(kind==='soldier'?(0.50/warMoraleSpeed(c)).toFixed(2):'.40')+'s;--gs-attack-duration:'+(kind==='soldier'?(0.92/warMoraleSpeed(c)).toFixed(2):'.85')+'s">'+
  '<ellipse cx="0" cy="12" rx="13" ry="3" fill="#15252b" opacity=".24"/>'+
  '<g class="gs-bean-hopper">'+body+(kind==='soldier'?beanChest(c,lod):'')+
  head+(kind==='soldier'?beanHelmet(c,lod)+beanShield(c,lod)+beanWeapon(c,lod):'')+'</g></g>';
}
function siegeMapVisuals(){
 return (G.sieges||[]).filter(s=>['marching','active','breached','aftermath','counterattack'].includes(s.status)&&(s.attacker===0||s.defender===0)).map(s=>{
  const target=G.tiles.find(t=>t.id===s.targetTileId);if(!target)return '';
  const stage=s.status==='marching'?G.tiles.find(t=>t.id===s.stagingTileId)||target:target;
  const center=sceneCoords(stage),lod=beanLod(),attacker=G.players[s.attacker],defender=G.players[s.defender];
  const left=siegeTeam(s,'attacker').slice(0,3),right=siegeTeam(s,'defender').slice(0,3);
  let figures='';
  const scale=lod===0?.45:lod===1?.58:.71;
  const leftStart=-Math.max(0,left.length-1)*11-13;
  for(let i=0;i<left.length;i++)figures+='<g transform="translate('+(center.x+leftStart+i*11).toFixed(1)+' '+(center.y+9).toFixed(1)+') scale('+scale+')">'+beanPerson(left[i],attacker,'soldier',lod)+'</g>';
  for(let i=0;i<right.length;i++)figures+='<g transform="translate('+(center.x+19+i*11).toFixed(1)+' '+(center.y+9).toFixed(1)+') scale('+scale+')">'+beanPerson(right[i],defender,'soldier',lod)+'</g>';
  const status=s.status==='active'?'SIEGE '+s.roundNumber+' · '+(s.destruction||0)+'%':s.status==='marching'?'MARCHING '+s.marchRemaining+'T':s.status==='counterattack'?'RECLAIMING':'DESTROYED 100%';
  const ring=['breached','aftermath','counterattack'].includes(s.status)?
   '<polygon class="gs-ruined-hex" points="'+pts(hexPoints(target,HEX-1))+'" fill="#43271c" fill-opacity=".30" stroke="#fcad75" stroke-width="5" stroke-dasharray="7 4"/>':
   s.status==='active'?'<polygon class="gs-siege-border" points="'+pts(hexPoints(target,HEX-1))+'" fill="none" stroke="#ffab72" stroke-width="4" stroke-dasharray="10 6"/>':'';
  const label='<g transform="translate('+center.x.toFixed(1)+' '+(center.y-38).toFixed(1)+')"><rect x="-45" y="-14" rx="5" width="90" height="18" fill="#223645" fill-opacity=".95" stroke="#f2c47d" stroke-width="1.5"/><text text-anchor="middle" y="-2" fill="#fff0cb" font-size="8.5" font-weight="bold">'+status+'</text></g>';
  const fighting=s.lastCombatRound>=G.round-1;
  return ring+billboardSvg(center.x,center.y,'<g class="gs-bean-army '+(fighting?'gs-bean-fight':'')+'">'+figures+label+'</g>',true);
 }).join('');
}
function visibleWarOrderMarkers(){
 if(!G||cpuBusy||G.turnIndex!==0)return '';
 return G.militaryOrders.filter(m=>m.owner===0&&m.status!=='returned').map(m=>{
  const t=G.tiles.find(t=>t.id===m.path[m.index]);if(!t)return '';
  const c=sceneCoords(t),foe=capitalOf(m.enemy);const n=m.troopIds.length;
  const target=foe?sceneCoords(foe):{x:c.x,y:c.y-30},degrees=Math.atan2(target.y-c.y,target.x-c.x)*180/Math.PI+90;
  return `<g class="gs-war-marker" pointer-events="none" transform="translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})"><path d="M0 -22L14 -15L11 0Q0 12 -11 0L-14 -15Z" fill="#1b3542" stroke="#f7df9f" stroke-width="2"/><path d="M0 -17V3M-7 -9H7" stroke="#f7df9f" stroke-width="2"/><path d="M0 -37L6 -25L0 -29L-6 -25Z" fill="#f6a77b" stroke="#122e3d" stroke-width="1.5" transform="rotate(${degrees.toFixed(1)})"/><text y="-25" text-anchor="middle">${n}</text></g>`;
 }).join('');
}
function siegeReinforcementHtml(s){
 const player=G.players[0];
 const pending=(s.reinforcements||[]).filter(r=>r.owner===0);
 const posts=getMilitaryPosts(0).filter(t=>canReinforceSiege(s,t.id,0));
 let html=pending.map(r=>`<small class="gs-siege-pending">${r.ids.length} reinforcement${r.ids.length===1?'':'s'} coming from ${esc(G.tiles.find(t=>t.id===r.postId)?.name||'the garrison')} · ${r.remaining} travel ticks</small>`).join('');
 if(!posts.length)return html;
 html+=`<div class="gs-siege-reinforce" data-siege-reinforcement-id="${s.id}">
  <strong>Send reinforcements</strong><small>Dispatch additional real soldiers. They march to the siege over world ticks; at most 12 soldiers per army. Only one military dispatch per turn.</small>
  <label class="gs-war-field">Military Post<select data-siege-reinforce-post>${posts.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${postGarrison(player,t.id).filter(c=>c.health>0&&!c.military.missionId).length} ready</option>`).join('')}</select></label>
  <label class="gs-war-field">Soldiers<select data-siege-reinforce-qty>${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label>
  <label class="gs-war-field">Transport<select data-siege-reinforce-transport><option value="foot">On foot</option><option value="caravan">Caravan (up to 6 soldiers)</option></select></label>
  <button data-siege-reinforce="${s.id}" ${!active()||player.logisticsUsed?'disabled':''}>Send reinforcement party</button>
 </div>`;
 return html;
}

function warAftermathPanelHtml(){
 if(!G)return '';
 let html='';
 for(const siege of G.sieges||[]){
  if(![siege.attacker,siege.defender].includes(0)||!['breached','aftermath','counterattack'].includes(siege.status))continue;
  const t=G.tiles.find(t=>t.id===siege.targetTileId);
  html+='<section class="gs-siege-section gs-aftermath"><div class="gs-siege-heading"><strong>DESTROYED HEX · '+esc(t?.name||'frontier')+'</strong>'+
   '<small>100% destruction: the hex became unclaimed. Eliminating soldiers alone never captures it.</small></div>';
  if(siege.status==='counterattack')html+='<p>Late reinforcements are counterattacking through the ruins. Their battle resolves over subsequent normal rounds.</p>';
  if(siege.attacker===0){
   if(!siege.attackerChoice){
    const next=neighbors(t).filter(n=>n.owner===siege.defender&&!n.capital&&n.terrain!=='water');
    html+='<p><strong>Your next move:</strong> claim the ruins, push into an adjacent enemy hex, or retreat your surviving army.</p>'+
     '<div class="gs-war-actions"><button data-after-siege="'+siege.id+'" data-choice="claim">Stop & Claim Ruins</button>'+
     '<button data-after-siege="'+siege.id+'" data-choice="retreat">Retreat to Post</button></div>';
    if(next.length)html+='<label class="gs-war-field">Next enemy hex<select data-next-hex="'+siege.id+'">'+
     next.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join('')+'</select></label>'+
     '<button data-after-siege="'+siege.id+'" data-choice="push">Push Into Next Hex</button>';
   }else html+='<p>Your army chose '+esc(siege.attackerChoice)+'.'+(siege.reinforcements?.length?' Incoming defenders are still traveling.':'')+'</p>';
  }
  if(siege.defender===0){
   const late=(siege.lateDefenderIds||[]).filter(id=>G.players[0].citizens.some(c=>c.id===id&&c.health>0));
   if(late.length&&siege.status!=='counterattack'){
    html+='<p><strong>'+late.length+' defenders reached the ruined territory.</strong> Guard the nearby border, counterattack to reclaim it, or retreat.</p>'+
     '<div class="gs-war-actions"><button data-after-siege="'+siege.id+'" data-choice="guard">Guard Nearest Border</button>'+
     '<button data-after-siege="'+siege.id+'" data-choice="attack">Counterattack & Reclaim</button>'+
     '<button data-after-siege="'+siege.id+'" data-choice="retreat">Retreat to Post</button></div>';
   }else if(siege.reinforcements?.length)html+='<p>Reinforcements remain en route. Choose their orders on arrival.</p>';
  }
  html+='</section>';
 }
 return html;
}
function siegeWarPanelHtml(){
 const me=G.players[0],wars=opponentsAtWar(0),posts=getMilitaryPosts(0);
 let html='<section class="gs-siege-section"><div class="gs-siege-heading"><strong>Multi-round Siege Campaigns</strong><small>Choose orders during your normal turn. Both sides resolve after the round, and saved standing orders remain in effect when you are away.</small></div>';
 for(const siege of G.sieges||[]){
  if(![siege.attacker,siege.defender].includes(0)||!['marching','active'].includes(siege.status))continue;
  const target=G.tiles.find(t=>t.id===siege.targetTileId),side=siege.attacker===0?'attacker':'defender';
  const available=side==='attacker'?SIEGE_ATTACK_ORDERS:SIEGE_DEFEND_ORDERS,order=siegeOrderFor(siege,side),sent=siege[side+'Order']?.round===G.round;
  const ours=siegeTeam(siege,side).length,theirs=siegeTeam(siege,side==='attacker'?'defender':'attacker').length;
  html+=`<div class="gs-siege-card"><div class="gs-siege-card-head"><strong>${esc(target?.name||'Unknown frontier')}</strong><span>${side==='attacker'?'ATTACKING':'DEFENDING'}</span></div>
   <small>${esc(G.players[siege.attacker].name)} versus ${esc(G.players[siege.defender].name)} · ${siege.status==='marching'?siege.marchRemaining+' travel ticks to arrival': 'Siege round '+(siege.roundNumber+1)+' · '+ours+' of your troops, '+theirs+' opposing'}</small>`;
  if(siege.status==='active'){
   html+=`<div class="gs-siege-meters">${[['Destruction',siege.destruction||0],['Fortifications',siege.fort],['Supplies',siege.supply],['Defender Morale',siege.morale]].map(([label,value])=>`<div><span>${label}</span><b>${value}/100</b><i style="--siege-fill:${value}%"></i></div>`).join('')}</div>
    <label class="gs-war-field">Your standing order<select data-siege-order="${siege.id}">${Object.entries(available).map(([k,label])=>`<option value="${k}" ${order===k?'selected':''}>${esc(label)}</option>`).join('')}</select></label>
    <button data-siege-submit="${siege.id}" ${!active()?'disabled':''}>${sent?'Update saved order':'Submit military order'}</button>
    <small class="gs-siege-order-note">${sent?'Order saved for this round.':'Your standing order applies automatically if no order is submitted.'} Enemy orders stay hidden until resolution.</small>`;
  }
  if(siege.status==='active')html+=siegeReinforcementHtml(siege);
  if(siege.history?.length)html+=`<details class="gs-siege-history"><summary>Previous exchanges (${siege.history.length})</summary>${siege.history.slice(0,4).map(h=>`<p>${esc(h.summary)}</p>`).join('')}</details>`;
  html+='</div>';
 }
 if(wars.length){
  const routes=[];
  if(!me.logisticsUsed)for(const post of posts){
   const available=postGarrison(me,post.id).filter(c=>c.health>0&&!c.military.missionId).length;
   if(!available)continue;
   for(const target of G.tiles){
    if(wars.includes(target.owner)&&!target.capital&&neighbors(target).some(n=>n.owner===0)&&canStartSiege(target.id,post.id,0))routes.push({post,target,available});
   }
  }
  if(routes.length){
   html+=`<div class="gs-siege-launch"><strong>Lay siege to enemy territory</strong>
    <small>Soldiers march to friendly land next to a hostile non-capital hex. After arrival both countries can issue orders before the first round resolves.</small>
    <label class="gs-war-field">Attack route<select id="siegeCampaign">${routes.slice(0,36).map(r=>`<option value="${esc(r.post.id+'|'+r.target.id)}">${esc(r.post.name)} → ${esc(r.target.name)} (${r.available} ready)</option>`).join('')}</select></label>
    <label class="gs-war-field">Soldiers<select id="siegeQuantity">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i===1?'selected':''}>${i+1}</option>`).join('')}</select></label>
    <label class="gs-war-field">Travel<select id="siegeTransport"><option value="foot">March on foot</option><option value="caravan">Ride caravan (up to 6)</option></select></label>
    <button data-start-siege="1" ${!active()||me.logisticsUsed?'disabled':''}>Send soldiers to siege</button></div>`;
  }else html+='<small class="gs-siege-tip">Siege dispatches require an available military garrison and a friendly hex touching a hostile non-capital territory. One military dispatch per turn.</small>';
 }
 const recent=(G.sieges||[]).filter(x=>[x.attacker,x.defender].includes(0)&&!['marching','active'].includes(x.status)).slice(-3).reverse();
 if(recent.length)html+=`<details class="gs-siege-history"><summary>Finished sieges</summary>${recent.map(x=>`<p>${esc(G.tiles.find(t=>t.id===x.targetTileId)?.name||'Unknown')}: ${esc(x.status)} after ${x.roundNumber} exchanges</p>`).join('')}</details>`;
 return html+'</section>';
}

function renderWarPanel(){
 const panel=el('warBody');if(!panel||!G)return;const me=G.players[0],wars=opponentsAtWar(0),incoming=G.diplomaticFalcons.filter(n=>n.to===0&&n.status==='awaiting-reply');
  let html=`<p class="gs-war-intro">Messenger Falcons carry territorial warnings, war declarations, ceasefires, <b>Non-Aggression Treaties</b> and <b>Defensive Alliances</b>. Proposals require approval; alliances answer future attacks, not wars already underway.</p>`;
 if(wars.length)html+=`<div class="gs-war-alert"><strong>WAR PHASE ACTIVE</strong><span>${wars.map(id=>esc(G.players[id].name)).join(' · ')} · Civilians lose 2 morale per round</span></div>`;
  for(const f of incoming){
   const agreement=['treaty','alliance'].includes(f.kind);
   html+=`<div class="gs-war-order"><b>${esc(G.players[f.from].name)} proposes ${agreement?esc(treatyLabel(f.kind)):'a ceasefire'}</b>
    <small>${agreement?esc(TREATY_TYPES[f.kind].description):'End the current war phase.'}</small>
    <div class="gs-war-actions">
     <button ${agreement?'data-treaty-answer':'data-peace-answer'}="${f.id}" data-accept="yes" ${agreement&&!canActivateTreaty(f)?'disabled':''}>Accept</button>
     <button ${agreement?'data-treaty-answer':'data-peace-answer'}="${f.id}" data-accept="no">Decline</button>
    </div></div>`;
  }
 const owned=G.tiles.filter(t=>t.owner===0),warnable=G.tiles.filter(t=>t.owner===null&&t.terrain!=='water');
 const flights=G.diplomaticFalcons.filter(f=>(f.from===0||f.to===0)&&['flying','awaiting-reply'].includes(f.status));
 if(flights.length)html+=`<div class="gs-war-order"><strong>Messenger Falcons</strong>${flights.map(f=>`<div class="gs-war-unit"><b>${esc(G.players[f.from].name)} → ${esc(G.players[f.to].capital)}</b><small>${esc(f.kind.toUpperCase())} · ${f.status==='flying'?`${f.remaining}T until delivery`:'Awaiting your response'}${f.tileId?` · ${esc(G.tiles.find(t=>t.id===f.tileId)?.name||'')}`:''}</small></div>`).join('')}</div>`;
 for(const other of G.players.filter(p=>p.id!==0)){
  const atWar=!!currentWar(0,other.id),capital=capitalOf(other.id),warnings=visibleTerritorialWarnings().filter(w=>w.from===other.id);
  const issued=G.warnings.filter(w=>w.from===0&&w.to===other.id&&['active','escalated'].includes(w.status)&&G.tiles.some(t=>t.id===w.tileId&&t.owner===null));
   const pact=activeTreaty(0,other.id);
   const awaitingPact=G.diplomaticFalcons.some(f=>['treaty','alliance'].includes(f.kind)&&warPair(f.from,f.to)===warPair(0,other.id)&&['flying','awaiting-reply'].includes(f.status));
   html+=`<div class="gs-war-order"><strong>${esc(other.name)} ${atWar?'<span class="gs-war-state">AT WAR</span>':pact?'<span class="gs-treaty-state">'+esc(treatyLabel(pact.type)).toUpperCase()+'</span>':'<span class="gs-war-peace">PEACE</span>'}</strong><small>Falcon destination: ${esc(capital?.name||other.capital)}. Courier cost: 1 SP. ${awaitingPact?'Agreement awaiting a response.':''}</small>`;
   if(pact){
    const expires=pact.type==='treaty'?` · ${Math.max(0,pact.expiresRound-G.round)} rounds left`:' · until dissolved';
    const dissolving=G.diplomaticFalcons.some(f=>f.kind==='dissolve'&&f.treatyId===pact.id&&f.status==='flying');
    html+=`<div class="gs-treaty-current"><strong>${esc(treatyLabel(pact.type))}</strong><small>${esc(TREATY_TYPES[pact.type].description)}${expires}${dissolving?' · Termination Falcon on its way':''}</small>
      <button data-end-agreement="${pact.id}" data-end-partner="${other.id}" ${!canAct()||!hasMoney(me,1)||dissolving?'disabled':''}>End agreement by Falcon · 1 SP</button></div>`;
   }
  for(const w of warnings){const t=G.tiles.find(x=>x.id===w.tileId);html+=`<p class="gs-warning-text">WARNING RECEIVED: The border of ${esc(t?.name||'the disputed territory')} glows red until the land is claimed or the warning is rescinded.</p>`;}
  for(const w of issued){
   const t=G.tiles.find(x=>x.id===w.tileId),pending=G.diplomaticFalcons.some(f=>f.kind==='retract'&&f.warningId===w.id&&f.status==='flying');
   html+=`<div class="gs-warning-issued"><small>Your threat over ${esc(t?.name||'the disputed territory')} is active.${pending?' Withdrawal falcon on the way.':''}</small>
    <button data-rescind-warning="${w.id}" ${!canAct()||!hasMoney(me,1)||pending?'disabled':''}>Rescind warning by Falcon · 1 SP</button></div>`;
  }
   if(!atWar){
    html+=`<div class="gs-treaty-actions"><small>Send a diplomatic proposal by Falcon (1 SP and one major action). Non-aggression prevents declarations of war for 8 rounds. A defensive alliance also joins the war phase if an ally is attacked.</small>
      <button data-send-treaty="${other.id}" ${!canAct()||!hasMoney(me,1)||!canProposeTreaty(0,other.id,'treaty')?'disabled':''}>Propose Non-Aggression Treaty</button>
      <button data-send-alliance="${other.id}" ${!canAct()||!hasMoney(me,1)||!canProposeTreaty(0,other.id,'alliance')?'disabled':''}>Propose Defensive Alliance</button></div>`;
   html+=`<label class="gs-war-field">Disputed territory<select data-warning-land="${other.id}">${warnable.slice().sort((a,b)=>Math.min(...owned.map(o=>distance(a,o)))-Math.min(...owned.map(o=>distance(b,o)))).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><div class="gs-war-actions"><button data-send-warning="${other.id}" ${!canAct()?'disabled':''}>Send Warning</button><button data-send-war="${other.id}" ${!canAct()?'disabled':''}>Declare War by Falcon</button></div>`;
  }else html+=`<div class="gs-war-actions"><button data-send-peace="${other.id}" ${!canAct()?'disabled':''}>Send Ceasefire Proposal</button></div>`;
  html+='</div>';
 }
 html+=warAftermathPanelHtml()+siegeWarPanelHtml();
 const posts=getMilitaryPosts(0);
 if(wars.length&&posts.length){
  const borderOptions=G.tiles.filter(t=>t.owner===0&&neighbors(t).some(n=>n.owner===null||wars.includes(n.owner)));
  const flankOptions=G.tiles.filter(t=>t.owner===null&&t.terrain!=='water'&&wars.some(w=>G.tiles.some(e=>e.owner===w&&distance(t,e)<=3))).slice(0,45);
  html+=`<div class="gs-war-order"><strong>Confidential Troop Orders</strong><small>One military logistics order per turn. Patrol owned frontier hexes or flank through neutral land. Roads shorten travel. Enemies cannot view the positions.</small><label class="gs-war-field">Enemy<select id="warEnemy">${wars.map(id=>`<option value="${id}">${esc(G.players[id].name)}</option>`).join('')}</select></label><label class="gs-war-field">Military Post<select id="warPost">${posts.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} (${postGarrison(me,t.id).filter(c=>!c.military.missionId).length} ready)</option>`).join('')}</select></label><label class="gs-war-field">Order<select id="warKind"><option value="patrol">Border patrol</option><option value="flank">Flanking through neutral land</option></select></label><label class="gs-war-field">Destination<select id="warDestination">${borderOptions.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><label class="gs-war-field">Soldiers<select id="warQuantity">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i===1?'selected':''}>${i+1}</option>`).join('')}</select></label><label class="gs-war-field">Transport<select id="warTransport"><option value="foot">March on foot</option><option value="caravan">Caravan (max 6 soldiers)</option></select></label><button data-order-war="1" ${!active()||me.logisticsUsed?'disabled':''}>Dispatch Troops</button><div class="gs-war-hidden" data-patrol-options="${esc(JSON.stringify(borderOptions.map(t=>[t.id,t.name])))}" data-flank-options="${esc(JSON.stringify(flankOptions.map(t=>[t.id,t.name])))}"></div></div>`;
 }
 const own=G.militaryOrders.filter(m=>m.owner===0&&m.status!=='returned');
 if(own.length)html+=`<div class="gs-war-order"><strong>Your Military Orders</strong>${own.map(m=>{const tile=G.tiles.find(t=>t.id===m.path[m.index]),target=G.tiles.find(t=>t.id===m.targetTileId);return `<div class="gs-war-unit"><b>${m.troopIds.length} troops · ${m.kind.toUpperCase()}</b><small>${esc(tile?.name||'Traveling')} → ${esc(target?.name||'Unknown')} · ${m.status}</small><button data-recall-war="${m.id}" ${!active()?'disabled':''}>Recall</button></div>`;}).join('')}</div>`;
 const received=(G.diplomaticFalcons||[]).filter(m=>m.to===0&&['arrived','awaiting-reply','accepted','rejected'].includes(m.status)).slice(-14).reverse();
 if(received.length)html+='<div class="gs-war-order"><strong>Received Falcon Messages</strong>'+received.map(m=>'<div class="gs-war-unit"><b>'+esc(G.players[m.from]?.name||'Unknown')+' · '+esc(m.kind.toUpperCase())+(m.inboxRead?'':' · UNREAD')+'</b><small>'+esc(diplomaticMessageText(m))+'</small></div>').join('')+'</div>';
 panel.innerHTML=html;
}

const tradePlanCache=new Map();
const ROUTE_SHARE_OPTIONS=[10,20,25,30,40,50,60,70,75,80,90];
const capitalOf=id=>G.tiles.find(t=>t.owner===id&&t.capital);
function routeEndpoint(id,tileId){return G.tiles.find(t=>t.id===tileId&&t.owner===id)||capitalOf(id);}
function tradePlan(a,b,fromId=null,toId=null){
 const from=routeEndpoint(a,fromId),to=routeEndpoint(b,toId);
 if(!from||!to||from.id===to.id)return null;
 const k=G.seed+':route:'+a+':'+b+':'+from.id+':'+to.id;
 if(tradePlanCache.has(k))return tradePlanCache.get(k);
 // Rivers and roads use exactly the shared edges of adjacent land hexes.
 // Third-party territory cannot be crossed without its permission; neutral land can.
 const rng=mulberry32(hash(k)),graph=borderRiverGraph(G.tiles,rng);
 const allowedEdge=e=>e.land.every(id=>{const owner=G.tiles.find(t=>t.id===id)?.owner;return owner===null||owner===a||owner===b;});
 graph.neighbors=new Map([...graph.neighbors].map(([node,links])=>[node,links.filter(l=>allowedEdge(graph.edges[l.index]))]));
 const starts=[...new Set(graph.edges.filter(e=>e.land.includes(from.id)&&allowedEdge(e)).flatMap(e=>[e.a,e.b]))];
 const ends=new Set(graph.edges.filter(e=>e.land.includes(to.id)&&allowedEdge(e)).flatMap(e=>[e.a,e.b]));
 const queue=[...starts],parents=new Map(starts.map(v=>[v,null]));let reached=null;
 for(let i=0;i<queue.length;i++){
  const node=queue[i];if(ends.has(node)&&parents.get(node)!==null){reached=node;break;}
  for(const link of graph.neighbors.get(node)||[]){
   if(parents.has(link.next))continue;
   parents.set(link.next,{prior:node,edge:link.index});queue.push(link.next);
  }
 }
 if(!reached)return null;
 const points=[],banks=[];let cur=reached;
 while(cur!==null){points.unshift(graph.positions.get(cur));const step=parents.get(cur);if(!step)break;banks.unshift(graph.edges[step.edge].land);cur=step.prior;}
 const best={points,banks};
 const segmentCosts=best.banks.map(pair=>pair.some(id=>G.tiles.find(t=>t.id===id)?.terrain==='mountain')?2:1);
 const totalGold=segmentCosts.reduce((sum,c)=>sum+c,0);
 const result={points:best.points,banks:best.banks,segmentCosts,length:segmentCosts.length,totalGold,fromTileId:from.id,toTileId:to.id};
 tradePlanCache.set(k,result);return result;
}
function routeCostSplit(plan,percent){
 if(!plan||plan.length<2)return null;
 let best=null;
 const goal=plan.totalGold*percent/100;
 for(let segments=1;segments<plan.length;segments++){
  const a=plan.segmentCosts.slice(0,segments).reduce((s,n)=>s+n,0);
  if(!best||Math.abs(a-goal)<best.delta)best={aSegments:segments,bSegments:plan.length-segments,costA:a,costB:plan.totalGold-a,delta:Math.abs(a-goal)};
 }
 return best;
}
function alreadyLinked(a,b,fromTileId=null,toTileId=null){
 const same=o=>contactKey(o.a??o.from,o.b??o.to)===contactKey(a,b)&&
  (fromTileId===null||(o.fromTileId===fromTileId&&o.toTileId===toTileId)||(o.fromTileId===toTileId&&o.toTileId===fromTileId));
 return G.tradeRoutes.some(same)||G.tradeOffers.some(o=>!['rejected','expired','countered'].includes(o.status)&&same(o));
}
function proposeTradeRoute(to,share,id=0,fromTileId=null,toTileId=null){
 const p=G.players[id],target=G.players[to];if(!target||id===to||!canCountryAct(p,id))return false;
 const from=routeEndpoint(id,fromTileId),dest=routeEndpoint(to,toTileId);
 if(!from||!dest||alreadyLinked(id,to,from.id,dest.id))return false;
 const plan=tradePlan(id,to,from.id,dest.id),percent=Number(share);
 if(!ROUTE_SHARE_OPTIONS.includes(percent)||!plan)return false;
 const split=routeCostSplit(plan,percent);if(!split||!hasMoney(p,split.costA))return false;
 const trip=Math.max(1,Math.ceil(distance(capitalOf(id),capitalOf(to))/4));
 G.tradeOffers.push({id:G.nextTradeId++,from:id,to,share:percent,costA:split.costA,costB:split.costB,fromTileId:from.id,toTileId:dest.id,
  plan,split,status:'falcon',createdClock:G.turnClock||0,travelTotal:trip,travelRemaining:trip});
 useAction(p,`${p.name} sent a messenger falcon to ${target.capital}, proposing a border road from ${from.name} to ${dest.name} (${split.costA}/${split.costB} SP).`);
 if(id===0)showToast('Messenger falcon dispatched · awaiting delivery');return true;
}
// A counteroffer reverses the negotiation direction. The respondent can
// revise the cost split and endpoints, then send a physical falcon back.
// The 1-SP courier reply is a diplomatic response, not a major action.
function counterTradeOffer(offerId,share,responder=0,ownTileId=null,otherTileId=null){
 const original=G.tradeOffers.find(o=>o.id===offerId&&o.to===responder&&o.status==='pending');
 const p=G.players[responder];if(!original||!p||(responder===0&&!active())||!hasMoney(p,1))return false;
 const percent=Number(share);
 if(!ROUTE_SHARE_OPTIONS.includes(percent)||(original.revision||0)>=3)return false;
 const from=routeEndpoint(responder,ownTileId??original.toTileId);
 const to=routeEndpoint(original.from,otherTileId??original.fromTileId);
 if(!from||!to||(ownTileId!=null&&from.id!==ownTileId)||(otherTileId!=null&&to.id!==otherTileId))return false;
 const duplicate=G.tradeOffers.some(o=>o!==original&&contactKey(o.from,o.to)===contactKey(responder,original.from)
  &&!['rejected','expired','countered'].includes(o.status)
  &&((o.fromTileId===from.id&&o.toTileId===to.id)||(o.fromTileId===to.id&&o.toTileId===from.id)));
 if(duplicate||G.tradeRoutes.some(r=>contactKey(r.a,r.b)===contactKey(responder,original.from)
  &&((r.fromTileId===from.id&&r.toTileId===to.id)||(r.fromTileId===to.id&&r.toTileId===from.id))))return false;
 const plan=tradePlan(responder,original.from,from.id,to.id),split=routeCostSplit(plan,percent);
 if(!plan||!split)return false;
 const trip=Math.max(1,Math.ceil(distance(capitalOf(responder),capitalOf(original.from))/4));
 const id=G.nextTradeId++;
 const counter={id,from:responder,to:original.from,share:percent,costA:split.costA,costB:split.costB,
  fromTileId:from.id,toTileId:to.id,plan,split,status:'falcon',
  createdClock:G.turnClock||0,travelTotal:trip,travelRemaining:trip,
  revision:(original.revision||0)+1,counterToId:original.id,negotiationId:original.negotiationId??original.id};
 p.gold-=1;original.status='countered';original.counterId=id;original.inboxRead=true;
 G.tradeOffers.push(counter);
 addLog(`${p.name} sent a road counteroffer by falcon to ${G.players[original.from].capital}: ${from.name}–${to.name}, ${split.costA}/${split.costB} SP.`);
 if(responder===0){save();render();showToast('Counteroffer sent by falcon · 1 SP');}
 return true;
}
function reserveRoadBuilder(p,route,side,endpoint){
 const citizen=idleBuilders(p)[0];if(!citizen)return null;
 const origin=G.tiles.find(t=>t.id===citizen.builder.locationId)||capitalOf(p.id);
 citizen.builder.projectId='road-'+route.id+'-'+side;
 citizen.builder.destinationId=endpoint.id;
 citizen.builder.travelRemaining=countryTravelRoute(p.id,origin||endpoint,endpoint)?.turns??Math.ceil(distance(origin||endpoint,endpoint));
 route[side+'BuilderId']=citizen.id;
 return citizen;
}
function releaseRoadBuilder(route,side){
 const citizen=G.players[route[side==='a'?'a':'b']].citizens.find(c=>c.id===route[side+'BuilderId']);
 if(!citizen?.builder)return;
 citizen.builder.projectId=null;citizen.builder.destinationId=null;citizen.builder.travelRemaining=0;
 const pathIndex=side==='a'?Math.max(0,route.aDone-1):Math.min(route.length-1,route.length-route.bDone);
 const bank=route.banks[pathIndex]||[];
 const tile=G.tiles.find(t=>t.id===bank.find(id=>G.tiles.find(v=>v.id===id)?.owner===(side==='a'?route.a:route.b)))||routeEndpoint(side==='a'?route.a:route.b,side==='a'?route.fromTileId:route.toTileId);
 if(tile)citizen.builder.locationId=tile.id;
}
function decideTradeOffer(offer,accepted){
 if(!offer||offer.status!=='pending')return false;
 const a=G.players[offer.from],b=G.players[offer.to];
 if(!accepted){offer.status='rejected';addLog(`${b.name} declined the road proposal from ${a.name}.`);return true;}
 if(!hasMoney(a,offer.costA)||!hasMoney(b,offer.costB)||!idleBuilders(a).length||!idleBuilders(b).length){
  if(offer.to===0)showToast('Both countries need available SP and one idle builder to accept.');return false;
 }
 const route={id:offer.id,a:a.id,b:b.id,fromTileId:offer.fromTileId,toTileId:offer.toTileId,
  points:offer.plan.points,banks:offer.plan.banks,length:offer.plan.length,split:offer.split,
  aDone:0,bDone:0,startedClock:G.turnClock||0,status:'construction',rounds:0,remaining:0,
  costA:offer.costA,costB:offer.costB};
 if(!reserveRoadBuilder(a,route,'a',routeEndpoint(a.id,route.fromTileId)))return false;
 if(!reserveRoadBuilder(b,route,'b',routeEndpoint(b.id,route.toTileId))){releaseRoadBuilder(route,'a');return false;}
 a.gold-=offer.costA;b.gold-=offer.costB;offer.status='accepted';G.tradeRoutes.push(route);
 const first=G.tiles.find(t=>t.id===route.fromTileId),last=G.tiles.find(t=>t.id===route.toTileId);
 addLog(`${a.name} and ${b.name} approved ${first.name}–${last.name}. Each builder will construct their assigned ${route.split.aSegments}/${route.split.bSegments} road segments.`);
 return true;
}
function progressTradeOffers(){
 for(const offer of G.tradeOffers.filter(o=>o.status==='falcon')){
  // No countdown on the sender's own turn. First tick happens after the next nation finishes.
  if((G.turnClock||0)<=offer.createdClock+1)continue;
  offer.travelRemaining=Math.max(0,offer.travelRemaining-1);
  if(offer.travelRemaining>0)continue;
  offer.status='pending';offer.deliveredClock=G.turnClock||0;
  const link=contactKey(offer.from,offer.to);if(!G.contacts.includes(link))G.contacts.push(link);
  addLog(`${G.players[offer.from].name}'s falcon reached ${G.players[offer.to].capital} with a road proposal.`);
  if(offer.to!==0){
   const partner=G.players[offer.to];
   const canPay=hasMoney(partner,offer.costB)&&hasMoney(G.players[offer.from],offer.costA);
   const labor=idleBuilders(partner).length&&idleBuilders(G.players[offer.from]).length;
   const rng=mulberry32(hash(G.seed+':road-decision:'+offer.id));
   // CPUs can negotiate their contribution instead of always accepting or
   // rejecting. Limit revisions to avoid endless messenger exchanges.
   const wantsCounter=offer.costB>offer.costA&&offer.costB>2&&(offer.revision||0)<2;
   if(wantsCounter&&hasMoney(partner,1)&&counterTradeOffer(offer.id,40,partner.id,offer.toTileId,offer.fromTileId))continue;
   if(canPay&&labor&&rng()>(offer.share<30?.35:.16))decideTradeOffer(offer,true);
   else decideTradeOffer(offer,false);
  }
 }
}
function progressTradeRoutes(){
 for(const route of G.tradeRoutes.filter(r=>r.status==='construction')){
  if((G.turnClock||0)<=route.startedClock+1)continue;
  for(const side of ['a','b']){
   const p=G.players[route[side]],worker=p.citizens.find(c=>c.id===route[side+'BuilderId']);
   if(!worker?.builder){route.status='paused';addLog(`Road ${route.id} paused: missing ${p.name} builder.`);continue;}
   if(worker.builder.travelRemaining>0){worker.builder.travelRemaining--;if(worker.builder.travelRemaining===0)worker.builder.locationId=(side==='a'?route.fromTileId:route.toTileId);continue;}
   const completed=side==='a'?route.aDone:route.bDone,assigned=route.split[side==='a'?'aSegments':'bSegments'];
   if(completed>=assigned)continue;
   const edgeIndex=side==='a'?completed:route.length-1-completed;
   const shared=route.banks?.[edgeIndex]||[];
   // No nation may build along unclaimed or foreign-owned borders, even with an accepted deal.
   if(!shared.some(id=>G.tiles.find(t=>t.id===id)?.owner===p.id)){route[side+'WaitingForLand']=true;continue;}
   route[side+'WaitingForLand']=false;
   route[side+'Done']++;
   if(route[side+'Done']===assigned)releaseRoadBuilder(route,side);
  }
  if(route.aDone===route.split.aSegments&&route.bDone===route.split.bSegments){
   route.status='active';route.completedClock=G.turnClock;
   addLog(`The shared road between ${G.tiles.find(t=>t.id===route.fromTileId)?.name} and ${G.tiles.find(t=>t.id===route.toTileId)?.name} is open.`);
  }
 }
}
function respondTradeOffer(id,yes){
 const offer=G.tradeOffers.find(o=>o.id===id&&o.to===0&&o.status==='pending');
 if(!offer||!active())return false;
 const success=decideTradeOffer(offer,yes);
 if(success){save();render();}return success;
}
function refreshCounterEstimate(offerId){
 const panel=el('tradeBody'),offer=G.tradeOffers.find(o=>o.id===offerId&&o.to===0);
 if(!offer||!panel)return;
 const own=panel.querySelector(`[data-counter-from="${offerId}"]`)?.value;
 const foreign=panel.querySelector(`[data-counter-to="${offerId}"]`)?.value;
 const share=Number(panel.querySelector(`[data-counter-share="${offerId}"]`)?.value||40);
 const plan=tradePlan(0,offer.from,own,foreign),split=routeCostSplit(plan,share);
 const label=panel.querySelector(`[data-counter-estimate="${offerId}"]`);
 if(label)label.textContent=plan&&split?`Counteroffer: you pay ${split.costA} SP and build ${split.aSegments} segments; they pay ${split.costB} SP and build ${split.bSegments}. Return falcon: 1 SP now.`:'No permitted border route connects the endpoints.';
 const send=panel.querySelector(`[data-trade-counter="${offerId}"]`);
 if(send)send.disabled=!active()||!plan||!split||!hasMoney(getCountry(),1)||(offer.revision||0)>=3;
}
function renderTradePanel(){
 const node=el('tradeBody');if(!node||!G)return;
 const mine=G.tiles.filter(t=>t.owner===0),allOffers=G.tradeOffers.filter(o=>o.from===0||o.to===0),roads=G.tradeRoutes.filter(r=>r.a===0||r.b===0);
 let html='<p class="gs-trade-caption">Choose named territories. Falcons can propose a route across unknown land, but builders may ONLY construct border segments adjoining their own controlled hexes. Unclaimed segments wait until territory is secured. Each side completes its paid share.</p>';
 for(const partner of G.players.filter(p=>p.id!==0)){
  const theirs=G.tiles.filter(t=>t.owner===partner.id);
  const defaultA=mine[0],defaultB=theirs[0];
  if(!defaultA||!defaultB)continue;
  html+=`<div class="gs-trade-row"><strong>${esc(partner.name)}</strong>
   <div class="gs-trade-controls gs-road-form"><label>From your land<select data-road-from="${partner.id}">${mine.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
   <label>To their land<select data-road-to="${partner.id}">${theirs.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
   <label>Our cost share<select data-trade-share="${partner.id}">${ROUTE_SHARE_OPTIONS.map(v=>`<option value="${v}" ${v===50?'selected':''}>${v}% / ${100-v}%</option>`).join('')}</select></label>
   <button class="small-outline" data-trade-propose="${partner.id}" ${!canAct()?'disabled':''}>Send messenger falcon</button></div>
   <small data-road-estimate="${partner.id}">Choose endpoints to view the exact road cost.</small></div>`;
 }
 for(const o of allOffers){const other=G.players[o.from===0?o.to:o.from];
  const start=G.tiles.find(t=>t.id===o.fromTileId),end=G.tiles.find(t=>t.id===o.toTileId);
  const incoming=o.status==='pending'&&o.to===0;
  const ownTiles=G.tiles.filter(t=>t.owner===0),theirTiles=G.tiles.filter(t=>t.owner===o.from);
  const ourOldShare=100-o.share;
  const defaultShare=ROUTE_SHARE_OPTIONS.filter(v=>v<ourOldShare).slice(-1)[0]??ROUTE_SHARE_OPTIONS[0];
  const fields=incoming&&(o.revision||0)<3?`<div class="gs-trade-counter"><strong>Negotiate · Send a Falcon back</strong>
   <label>Your route endpoint<select data-counter-from="${o.id}">${ownTiles.map(t=>`<option value="${esc(t.id)}" ${t.id===o.toTileId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
   <label>Their route endpoint<select data-counter-to="${o.id}">${theirTiles.map(t=>`<option value="${esc(t.id)}" ${t.id===o.fromTileId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
   <label>Your proposed cost share<select data-counter-share="${o.id}">${ROUTE_SHARE_OPTIONS.map(v=>`<option value="${v}" ${v===defaultShare?'selected':''}>${v}% you / ${100-v}% them</option>`).join('')}</select></label>
   <small data-counter-estimate="${o.id}">Calculating revised road route…</small>
   <button class="small-outline" data-trade-counter="${o.id}" ${!active()||!hasMoney(getCountry(),1)?'disabled':''}>Send counteroffer by Falcon · 1 SP</button>
   </div>`:'';
  html+=`<div class="gs-trade-row"><strong>${o.revision?'Counteroffer':'Messenger'} · ${esc(other.name)}</strong>
   <small>${esc(start?.name||'Capital')} → ${esc(end?.name||'Capital')} · ${o.status==='falcon'?o.travelRemaining+'T in flight':o.status.toUpperCase()} · ${o.costA}/${o.costB} SP${o.revision?' · revision '+o.revision:''}</small>
   ${incoming?`<div class="gs-trade-controls"><button class="primary" data-trade-answer="${o.id}" data-accept="yes">Accept & assign builder</button><button class="small-outline" data-trade-answer="${o.id}" data-accept="no">Decline</button></div>`:''}${fields}</div>`;
 }
 for(const r of roads){
  const start=G.tiles.find(t=>t.id===r.fromTileId),end=G.tiles.find(t=>t.id===r.toTileId);
  const progress=r.status==='active'?r.length:(r.aDone||0)+(r.bDone||0);const waiting=r.aWaitingForLand||r.bWaitingForLand;
  html+=`<div class="gs-trade-row"><strong>Border Road · ${esc(start?.name||G.players[r.a].name)} ↔ ${esc(end?.name||G.players[r.b].name)}</strong><small>${r.status==='active'?'OPEN · +2 SP/round to each':(waiting?'WAITING FOR OWNED BORDER · ':'BUILDING · ')+progress+'/'+r.length+' edges complete'} · ${r.costA??0}/${r.costB??0} SP paid by each nation</small></div>`;
 }
 node.innerHTML=html;
 for(const partner of G.players.filter(p=>p.id!==0))refreshRouteEstimate(partner.id);
 for(const pending of allOffers.filter(o=>o.status==='pending'&&o.to===0))refreshCounterEstimate(pending.id);
}
function refreshRouteEstimate(partnerId){
 const panel=el('tradeBody'),a=panel?.querySelector(`[data-road-from="${partnerId}"]`)?.value,b=panel?.querySelector(`[data-road-to="${partnerId}"]`)?.value;
 const share=Number(panel?.querySelector(`[data-trade-share="${partnerId}"]`)?.value||50);
 const label=panel?.querySelector(`[data-road-estimate="${partnerId}"]`);if(!label)return;
 const plan=tradePlan(0,partnerId,a,b),split=routeCostSplit(plan,share);
 label.textContent=plan&&split?`${plan.length} shared hex edges · you pay ${split.costA} SP and build ${split.aSegments} edges; ${G.players[partnerId].name} pays ${split.costB} SP and builds ${split.bSegments}.`:'No valid neutral-land border route found.';
}
function showToast(s){const t=el('toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2650);}

function unreadFalconDispatches(){
 if(!G)return [];
 const diplomatic=(G.diplomaticFalcons||[]).filter(f=>f.to===0&&!f.inboxRead&&['arrived','awaiting-reply'].includes(f.status)).map(f=>({type:'diplomatic',item:f,clock:f.deliveredClock??f.createdClock??0}));
 const routes=(G.tradeOffers||[]).filter(o=>o.to===0&&!o.inboxRead&&o.status==='pending').map(o=>({type:'route',item:o,clock:o.deliveredClock??o.createdClock??0}));
 return [...diplomatic,...routes].sort((a,b)=>a.clock-b.clock||a.item.id-b.item.id);
}
// Return-to-turn notifications are saved with each siege, not tied to
// being online for the enemy action. These appear BEFORE other Falcon inbox
// items, especially when the player must choose a defensive order.
function pendingSiegeNotice(){
 return (G.sieges||[]).find(s=>{
  if(![s.attacker,s.defender].includes(0)||s.status==='marching')return false;
  if(s.status==='active')return (s.reportedRounds??-1)<s.roundNumber;
  return !s.endedRead;
 });
}
function presentSiegeInbox(){
 if(!G||!active()||sheetMode||!el('modalLayer').classList.contains('hidden'))return false;
 const s=pendingSiegeNotice();if(!s)return false;
 const territory=G.tiles.find(t=>t.id===s.targetTileId);
 const defend=s.defender===0,over=s.status!=='active';
 const heading=over?(s.status==='breached'?'HEX DESTROYED — ORDERS REQUIRED':s.status==='aftermath'?'AFTERMATH: DECISIONS PENDING':s.status==='counterattack'?'COUNTERATTACK UNDERWAY':s.status==='claimed'?'RUINS CLAIMED':s.status==='repelled'?'SIEGE REPELLED':'SIEGE ENDED')
  :defend?'YOUR TERRITORY IS UNDER SIEGE':'SIEGE CAMPAIGN REPORT';
 const last=s.history?.[0]?.summary||'The encirclement has begun. Submit your military order during your turn.';
 const details=over?(['breached','aftermath','counterattack'].includes(s.status)?'The hex is destroyed to 100% and unclaimed unless an army claims it. Choose your next order in World Affairs; late defenders also have choices.':`Campaign outcome: ${s.status}. ${s.roundNumber} exchange${s.roundNumber===1?'':'s'} resolved.`)
  :`Round ${s.roundNumber+1} awaits your orders. Defenders have ${s.supply}/100 supplies, ${s.fort}/100 fortifications and ${s.morale}/100 morale.`;
 showModal(`<div class="gs-siege-letter">
  <div class="gs-falcon-kicker">⚔ BATTLE DISPATCH · ROUND ${G.round}</div>
  <h2>${esc(heading)}</h2><strong>${esc(territory?.name||'The frontier')}</strong>
  <p>${esc(details)}</p><small>${esc(last)}</small>
  <div class="gs-falcon-actions">
   <button class="primary" data-modal="siege-open" data-siege-id="${s.id}">Open Siege Commands</button>
   <button class="secondary" data-modal="siege-ack" data-siege-id="${s.id}">Acknowledge</button>
  </div></div>`);
 return true;
}
function handleSiegeInboxAction(button){
 const id=Number(button.dataset.siegeId),s=(G.sieges||[]).find(s=>s.id===id);
 if(!s)return;
 if(s.status==='active')s.reportedRounds=s.roundNumber;else s.endedRead=true;
 save();closeModal();render();
 if(button.dataset.modal==='siege-open')showSheet('world');
 else setTimeout(presentFalconInbox,140);
}

function presentFalconInbox(){
 if(!active()||sheetMode||!el('modalLayer').classList.contains('hidden'))return;
 if(presentSiegeInbox())return;
 const dispatch=unreadFalconDispatches()[0];if(!dispatch)return;
 const f=dispatch.item,from=G.players[f.from],route=dispatch.type==='route';
 const label=route?(f.revision?'ROAD COUNTEROFFER':'ROAD PROPOSAL'):f.kind==='treaty'?'TREATY PROPOSAL':f.kind==='alliance'?'ALLIANCE PROPOSAL':f.kind==='dissolve'?'AGREEMENT TERMINATED':f.kind==='warning'?'TERRITORIAL WARNING':f.kind==='retract'?'WARNING RESCINDED':f.kind==='war'?'DECLARATION OF WAR':'CEASEFIRE PROPOSAL';
 const body=route?(()=>{
  const a=G.tiles.find(t=>t.id===f.fromTileId),b=G.tiles.find(t=>t.id===f.toTileId);
  return `${from.name} proposes a road from ${a?.name||'their territory'} to ${b?.name||'your territory'}. Your share is ${f.costB} Silver Pents, and their share is ${f.costA}.`;
 })():diplomaticMessageText(f);
 const isTreaty=!route&&['treaty','alliance'].includes(f.kind);
 const actions=(route||f.kind==='peace'||isTreaty)?`<button class="primary" data-modal="falcon-accept" data-inbox-type="${dispatch.type}" data-inbox-id="${f.id}" ${isTreaty&&!canActivateTreaty(f)?'disabled':''}>${route?'Accept route':isTreaty?'Sign agreement':'Accept ceasefire'}</button><button class="secondary" data-modal="falcon-reject" data-inbox-type="${dispatch.type}" data-inbox-id="${f.id}">Decline</button>`:'';
 const oldShare=route?100-f.share:50;
 const suggested=route?ROUTE_SHARE_OPTIONS.filter(v=>v<oldShare).slice(-1)[0]??ROUTE_SHARE_OPTIONS[0]:40;
 const counterForm=route&&(f.revision||0)<3?`<div class="gs-falcon-counter">
   <label>Negotiate · Your new share<select data-falcon-counter-share="${f.id}">${ROUTE_SHARE_OPTIONS.map(v=>`<option value="${v}" ${v===suggested?'selected':''}>${v}% you / ${100-v}% them</option>`).join('')}</select></label>
   <button class="secondary" data-modal="falcon-counter" data-inbox-type="route" data-inbox-id="${f.id}">Send counteroffer by Falcon · 1 SP</button>
   <small>To negotiate the route endpoints too, open World Affairs.</small>
  </div>`:'';

 showModal(`<div class="gs-falcon-letter"><div class="gs-falcon-kicker">${icoMarkup('scroll')} MESSENGER FALCON · ROUND ${G.round}</div><div class="gs-falcon-subject">${esc(label)}</div><h2>${esc(from.name)}</h2><p class="gs-falcon-text">${esc(body)}</p>${counterForm}<div class="gs-falcon-actions">${actions}<button class="secondary" data-modal="falcon-read" data-inbox-type="${dispatch.type}" data-inbox-id="${f.id}">${actions?'Review later':'Acknowledge'}</button><button class="secondary" data-modal="falcon-world" data-inbox-type="${dispatch.type}" data-inbox-id="${f.id}">Open World Affairs</button></div></div>`);
}
function handleFalconMessageAction(button){
 if(!G||!active())return;
 const type=button.dataset.inboxType,id=Number(button.dataset.inboxId),action=button.dataset.modal;
 const target=(type==='route'?G.tradeOffers:G.diplomaticFalcons)?.find(f=>f.id===id&&f.to===0);
 if(!target)return;
 if(action==='falcon-accept'||action==='falcon-reject'){
  const success=type==='route'?respondTradeOffer(id,action==='falcon-accept'):
   ['treaty','alliance'].includes(target.kind)?respondTreatyOffer(id,action==='falcon-accept'):acceptCeasefire(id,action==='falcon-accept');
  if(!success){showToast('Unable to respond. Check the agreement, available SP or active war.');return;}
 }
 if(action==='falcon-counter'){
  if(type!=='route'||target.status!=='pending')return;
  const share=Number(el('modalBody').querySelector(`[data-falcon-counter-share="${id}"]`)?.value);
  if(!counterTradeOffer(id,share,0,target.toTileId,target.fromTileId)){
   showToast('Unable to send counteroffer. Check the route and 1 SP courier cost.');return;
  }
 }
 target.inboxRead=true;target.readRound=G.round;
 save();closeModal();render();
 if(action==='falcon-world')showSheet('world');
 else setTimeout(presentFalconInbox,190);
}
function renderFalconBadge(){
 const button=el('worldQuickBtn');if(!button)return;
 let badge=button.querySelector('.gs-falcon-badge');
 if(!badge){badge=document.createElement('span');badge.className='gs-falcon-badge';button.appendChild(badge);}
 const total=unreadFalconDispatches().length;
 badge.textContent=total>9?'9+':String(total);badge.hidden=!total;
}
function showModal(html){el('modalBody').innerHTML=html;el('modalLayer').classList.remove('hidden');}
function closeModal(){el('modalLayer').classList.add('hidden');}
function mountMapUi(){
 // Reparent the existing, fully functional panels. No duplicated actions or game state.
 const sheet=el('sheetBody');
 const mineralPanel=document.createElement('div');mineralPanel.id='mineralPanel';mineralPanel.className='gs-mineral-panel';mineralPanel.innerHTML='<h3><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-mine"></use></svg> Mineral Exchange</h3><p class="gs-mineral-caption">Sell minerals for Silver Pents. Essential Coal and Iron can also be imported at a premium. Trading uses one major action.</p><div id="mineralBody"></div>';el('economySummary').after(mineralPanel);
 const war=document.createElement('section');war.id='warPanel';war.className='panel gs-war-panel';war.innerHTML='<div class="panel-heading"><h2>Falcon Diplomacy & War Room</h2></div><div id="warBody"></div>';sheet.appendChild(war);
 const trade=document.createElement('section');trade.id='tradePanel';trade.className='panel gs-trade-panel';trade.innerHTML='<div class="panel-heading"><h2>Diplomacy & Trade Routes</h2></div><div id="tradeBody"></div>';sheet.appendChild(trade);
 for(const selector of ['.territory-panel','.build-panel','.research-panel','.treasury-panel','.population-panel','.roster-panel','.feed-panel','.standings-panel']){
  const panel=document.querySelector('#game '+selector);if(panel)sheet.appendChild(panel);
 }
 const hand=document.querySelector('#game .cards-panel');if(hand)el('handDock').appendChild(hand);
 const turn=document.querySelector('#game .turn-panel');if(turn)el('turnMount').appendChild(turn);
 document.body.classList.add('gs-ui-ready');
}
function showSheet(mode='territory'){
 if(!G)return;
 if(mode==='territory'&&!getSelected())return;
 sheetMode=mode;
 showResearch=mode==='research';if(mode!=='territory')showBuild=false;
 el('sheetPanel').dataset.mode=mode;
 const titles={territory:['SELECTED HEX','Territory actions'],nation:['YOUR COUNTRY','Nation & economy'],research:['KNOWLEDGE','Research'],roster:['POPULATION','Citizens & military'],world:['WORLD AFFAIRS','World powers & dispatches']};
 const heading=titles[mode]||titles.territory;el('sheetKicker').textContent=heading[0];el('sheetTitle').textContent=heading[1];
 el('sheetLayer').classList.remove('hidden');el('sheetLayer').setAttribute('aria-hidden','false');
 render();
}
function closeSheet(){sheetMode=null;showBuild=false;showResearch=false;el('sheetLayer').classList.add('hidden');el('sheetLayer').setAttribute('aria-hidden','true');if(G)render();setTimeout(presentFalconInbox,140);}
function suspendSheetForScene(){
 // The player must deliberately reopen overlays after a cinematic action.
 sheetMode=null;showBuild=false;showResearch=false;
 el('sheetLayer').classList.add('hidden');el('sheetLayer').setAttribute('aria-hidden','true');
}
function startMapScenePlayback(tile,kind,buildingIndex=-1,buildingType=null){
 if(scenePlayback)return null;
 const playback={world:G,serial:++scenePlaybackSerial,tileId:tile.id,kind,buildingIndex,buildingType,phase:'prepare'};
 suspendSheetForScene();
 playback.done=new Promise(resolve=>playback.resolve=resolve);
 scenePlayback=playback;
 // The action is already validated and paid for. Rendering now keeps the new structure
 // invisible until we have moved the camera and played its arrival sequence.
 requestAnimationFrame(()=>playMapScenePlayback(playback));
 return playback;
}
function sceneAlive(playback){return scenePlayback===playback&&G===playback.world&&scenePlaybackSerial===playback.serial;}
async function playMapScenePlayback(playback){
 const tile=G.tiles.find(t=>t.id===playback.tileId);
 try{
  if(!tile||!sceneAlive(playback))return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  await moveCamera(tile,cameraYaw,reduced?0:cpuBusy?920:450,mobileCameraWidth(350,435));
  if(!sceneAlive(playback))return;
  playback.phase='play';renderMap();
  if(cpuBusy)await cpuPause(reduced?120:playback.kind==='work'?1050:1250,cpuPlaybackToken);
   else await new Promise(resolve=>setTimeout(resolve,reduced?120:playback.kind==='work'?750:1120));
 }finally{
  if(!sceneAlive(playback))return;
  scenePlayback=null;
  if(playback.fromQueue)G.completedScenes=G.completedScenes.filter(j=>j.projectId!==playback.fromQueue);
  render();
  playback.resolve?.();
  // Leave all sheets closed; taps and quick menus reopen on demand.
  if(playback.kind==='build')showToast(`${BUILDINGS[playback.buildingType]?.name||'Building'} completed`);
  if(playback.kind==='work')showToast(`${BUILDINGS[playback.buildingType]?.name||'Building'} construction underway`);
  else if(playback.kind==='siege')showToast(tile.name+' was destroyed and is now unclaimed');
  else if(playback.kind==='expand')showToast(`${tile.name} claimed`);
  else if(playback.kind==='road')showToast(`Domestic road completed near ${tile.name}`);
 }
}

async function showCompletedProjects(){
 // Project completion belongs to the nation's TURN, not a whole global round.
 // Show each completed project and each claimed territory at its actual location.
 while(G&&!G.finished&&G.completedScenes?.length){
  const item=G.completedScenes[0],tile=G.tiles.find(t=>t.id===item.tileId);
  if(!tile){G.completedScenes.shift();continue;}
  if(scenePlayback){await scenePlayback.done;continue;}
  const playback=startMapScenePlayback(tile,item.kind||'build',item.buildingIndex??-1,item.type||null);
  if(!playback)break;
  playback.fromQueue=item.projectId;
  await playback.done;
 }
 save();
}
function progressProjects(){
 for(const job of [...G.projects]){
  const tile=G.tiles.find(t=>t.id===job.tileId),p=G.players[job.owner];
  if(!tile||tile.owner!==job.owner){G.projects=G.projects.filter(j=>j.id!==job.id);for(const c of p.citizens)if(c.builder?.projectId===job.id)c.builder.projectId=null;continue;}
  const crew=assignedBuilders(p,job.id);
  const arriving=new Set();
  for(const c of crew){
   if(c.builder.travelRemaining>0){c.builder.travelRemaining--;arriving.add(c.id);if(c.builder.travelRemaining===0)c.builder.locationId=tile.id;}
  }
  // Arriving builders must finish traveling before they can work on the next turn.
  const labor=crew.filter(c=>c.builder.travelRemaining===0&&!arriving.has(c.id)).length;
  if(labor===0)continue;
  job.remaining=Math.max(0,job.remaining-labor);
  if(job.remaining>0)continue;
  if(job.upgradeSiteId){
   const index=tile.buildingMeta?.findIndex(m=>m.id===job.upgradeSiteId);
   if(index<0){G.projects=G.projects.filter(j=>j.id!==job.id);for(const c of crew)c.builder.projectId=null;continue;}
   tile.buildingMeta[index].level=Math.min(3,tile.buildingMeta[index].level+1);
  }else{
   tile.buildings.push(job.type);tile.buildingMeta??=[];
   tile.buildingMeta.push({id:G.nextBuildingId++,level:1,autoHire:true,stock:{},routes:{},recipe:FACTORY_RECIPES[job.type]?.[0]||null});
  }
  for(const c of crew){c.builder.projectId=null;c.builder.destinationId=null;c.builder.locationId=tile.id;c.builder.travelRemaining=0;}
  G.projects=G.projects.filter(j=>j.id!==job.id);
  reallocateHousing(p);syncBuilders(p);assignWorkers(p);syncCaravans(p);
  G.completedScenes.push({projectId:job.id,owner:p.id,tileId:tile.id,kind:'build',type:job.type,buildingIndex:job.upgradeSiteId?tile.buildingMeta.findIndex(m=>m.id===job.upgradeSiteId):tile.buildings.length-1});
  addLog(`${p.name} finished ${job.upgradeSiteId?'upgrading':'construction of'} ${BUILDINGS[job.type].name} at ${tile.name}.`);
 }
}
function volunteeringChance(c,p){
 if(c.military||c.builder||c.job?.role==='caravanDriver'||isBusyPorter(c)||isBusyExpedition(c)||c.age<18||c.health<35)return 0;
 const age=c.age<30?1:c.age<45?.8:c.age<60?.42:c.age<70?.1:.008;
 const health=Math.max(0,(c.health-35)/65),morale=Math.max(0,(c.morale-30)/70);
 return Math.min(.65,(.012+.11*health+.12*morale)*age+(p.marketingUntil>=G.round?.22*age:0));
}
function volunteerEachRound(p){
 const posts=getMilitaryPosts(p.id);
 if(!posts.length)return;
 const rng=mulberry32(hash(G.seed+':volunteer:'+G.round+':'+p.id));let count=0;
 const available=p.citizens.filter(c=>c.age>=18&&!c.military).sort((a,b)=>a.id.localeCompare(b.id));
 for(const c of available){
  if(count>=2||nationalResourceCount(p,'food')<1)break;
  const open=posts.filter(t=>postGarrison(p,t.id).length<12);
  if(!open.length)break;
  if(rng()>volunteeringChance(c,p))continue;
  const post=open[randInt(rng,open.length)];
  c.military={postId:post.id,training:1,experience:0,perk:null,gear:null,helmet:null,chest:null,shield:null,weapon:null,skill:29+randInt(rng,23)};spendNationalResource(p,'food',1);count++;
  addLog(`${c.name} volunteered for ${p.name}'s military at ${post.name}.`);
 }
}
function doMarketing(t,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!allowed(p,t)||!buildingCount(t,'post')||!hasMoney(p,4))return false;
 p.gold-=4;p.marketingUntil=G.round+2;
 useAction(p,`${p.name} launched a recruiting campaign. Voluntary enlistment boosted for two rounds.`,{tileId:t.id,kind:'recruit'});
 if(id===0)showToast('Recruiting campaign launched');return true;
}
function animatePlayedCard(type,who){
 const node=el('cardEffectLayer'),card=CARDS[type],p=G.players[who];
 if(!node||!card)return Promise.resolve();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 cardEffectBusy=who===0;
 node.classList.remove('hidden');node.innerHTML=`<div class="gs-activated-card" style="--player-color:${p.color}"><span class="gs-activated-crest">GLOBAL STANDOFF · ${esc(p.name)}</span><span class="gs-activated-icon">${card.icon}</span><strong>${esc(card.name)}</strong><span class="gs-activated-caption">${esc(card.desc)}</span></div><div class="gs-card-particles">${Array.from({length:18},(_,i)=>`<i style="--i:${i};--angle:${i*20}deg;--dx:${Math.round(Math.cos(i*Math.PI/9)*(75+i%4*23))}px;--dy:${Math.round(Math.sin(i*Math.PI/9)*(70+i%3*28))}px"></i>`).join('')}</div>`;
 if(G)render();
 const effect=new Promise(resolve=>{
  const start=performance.now(),duration=reduced?120:1250;
  function tick(now){
   if(now-start<duration&&!(who!==0&&skipCpuPlayback)){requestAnimationFrame(tick);return;}
   node.innerHTML='';node.classList.add('hidden');cardEffectBusy=false;if(G)render();resolve();
  }
  requestAnimationFrame(tick);
 });
 cardEffectPromise=effect;return effect;
}
function cardSuit(type){return ['grant','harvest','supplies'].includes(type)?['◈','ECONOMY']:['charter','permit'].includes(type)?['⌘','DEVELOPMENT']:['<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg>','DISCOVERY'];}
function openCardPreview(index){
 if(!G||!Number.isInteger(index)||index<0||index>=getCountry().hand.length)return;
 previewCardIndex=index;const type=getCountry().hand[index],data=CARDS[type],suit=cardSuit(type);
 const canPlay=active()&&!getCountry().cardPlayed;
 el('cardPreviewContent').innerHTML=`<button class="card-preview-close" type="button" data-preview="close" aria-label="Close card"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-close"></use></svg></button><div class="expanded-card type-${type}"><div class="expanded-card-top"><span>${suit[0]} ${suit[1]}</span><span><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg></span></div><div class="expanded-card-art"><span class="expanded-card-halo"></span><span class="expanded-card-icon">${data.icon}</span></div><div class="expanded-card-details"><div class="expanded-card-name">${esc(data.name)}</div><div class="expanded-card-rule">${esc(data.desc)}</div></div><div class="expanded-card-footer">GLOBAL STANDOFF · ACTION CARD</div></div><div class="preview-actions"><button class="secondary" type="button" data-preview="close">Back to hand</button><button class="primary" type="button" data-preview="play" ${canPlay?'':'disabled'}>${canPlay?'PLAY CARD ↗':!active()?'Wait for your turn':'Card already played this turn'}</button></div>`;
 el('cardPreview').classList.remove('hidden');el('cardPreview').setAttribute('aria-hidden','false');
}
function closeCardPreview(){previewCardIndex=-1;el('cardPreview').classList.add('hidden');el('cardPreview').setAttribute('aria-hidden','true');}

function enterGame(){scenePlayback=null;scenePlaybackSerial++;suppressClick=false;drag=null;document.body.classList.add('gs-playing');lastViewportLayoutKey='';closeCardPreview();sheetMode=null;el('sheetLayer').classList.add('hidden');el('sheetLayer').setAttribute('aria-hidden','true');cpuPlaybackToken++;skipCpuPlayback=false;hideCpuHud();el('lobby').classList.add('hidden');el('game').classList.remove('hidden');el('topMenuBtn').classList.remove('hidden');showBuild=false;showResearch=false;resetView();focusHome(true);render();scheduleMapViewportReflow();requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));setTimeout(presentFalconInbox,300);}
function newMatch(){cardEffectBusy=false;el('cardEffectLayer')?.classList.add('hidden');scenePlayback=null;scenePlaybackSerial++;document.body.classList.remove('gs-playing');closeCardPreview();closeSheet();cpuPlaybackToken++;cancelAnimationFrame(cameraMoveFrame);hideCpuHud();if(cameraResolve){cameraResolve();cameraResolve=null;}G=null;cpuBusy=false;el('lobby').classList.remove('hidden');el('game').classList.add('hidden');el('topMenuBtn').classList.add('hidden');el('roundBadge').textContent='SOLO TEST';closeModal();renderLobby();}
function renderLobby(){
 el('colorOptions').innerHTML=COLORS.map((c,i)=>`<button class="color-swatch" style="--swatch:${c}" aria-label="Choose ${['jade','amber','violet','coral'][i]}" aria-pressed="${i===selectedColor}" data-color="${i}"></button>`).join('');
 const colors=[COLORS[selectedColor],...COLORS.filter((_,i)=>i!==selectedColor)];
 el('cpuPreview').innerHTML=NPCS.map((p,i)=>`<div class="cpu-item"><div class="cpu-avatar" style="background:${colors[i+1]}">${p.sigil}</div><div><div class="cpu-item-title">${esc(p.name)}</div><div class="cpu-item-sub">Capital: ${esc(p.capital)} · Unique personality each world</div></div><span class="cpu-pill">CPU</span></div>`).join('');
 el('resumeBtn').classList.toggle('hidden',!loadSaved());
}
function allowed(p,t){return t&&t.owner===p.id;}
function eligibleExpansion(p,t){return !!t&&t.owner===null&&t.terrain!=='water'&&!pendingClaim(t.id)&&!!idleExpedition(p)&&neighbors(t).some(n=>n.owner===p.id);}
function expansionCost(p){return Math.max(0,5+2*(p.expansionsThisTurn||0)-p.discountExpand-(p.tech.includes('cartography')?2:0));}
function buildingCost(p,b){return Math.max(0,b.gold-p.discountBuild);}
function canBuild(p,t,b){return allowed(p,t)&&idleBuilders(p).length>0&&buildFree(t)>=b.space&&b.allow.includes(t.terrain)&&hasMoney(p,buildingCost(p,b))&&nationalResourceCount(p,'wood')>=b.wood&&nationalResourceCount(p,'iron')>=b.iron;}
function operatingCost(p,meta,type){
 const assigned=worksiteWorkers(p,meta).length;
 const extra=(G.shipments||[]).filter(j=>j.kind==='porter'&&j.owner===p.id&&String(j.from)===String(meta.id)
  &&!p.citizens.find(c=>c.id===j.porterId)?.job).length;
 const fixed=BUILDINGS[type].upkeep+Math.max(0,(meta.level||1)-1)*Math.ceil(BUILDINGS[type].upkeep*.8);
 // Paid employees are included in the building's running budget.
 return {total:Math.max(fixed,assigned+extra),staff:assigned+extra,fixed};
}
function getEconomy(id){
 const p=G.players[id],summary=peopleSummary(p);
 let vals={gold:0,food:0,wood:0,knowledge:0,upkeep:0,wages:0,buildingUpkeep:0,builderExtraUpkeep:0,
  occupiedHomes:summary.households,householdIncome:summary.households*HOUSEHOLD_RENT,
  capitalIncome:0,marketIncome:0,capitalUpkeep:0,farmUpkeep:0,factoryUpkeep:0,
  otherBuildingUpkeep:0,workerWages:0,builderWages:0,militaryUpkeep:0};
 const factories=new Set(['foundry','leatherFactory','woodworks','stoneworks','armory']);
 for(const t of G.tiles.filter(t=>t.owner===id)){
  const y=TERRAIN[t.terrain].yield;for(const k in y)vals[k]+=(y[k]||0);
  if(t.capital){vals.gold+=3;vals.capitalIncome+=3;vals.upkeep+=1;vals.capitalUpkeep+=1;}
  for(let i=0;i<(t.buildings||[]).length;i++){
   const type=t.buildings[i],b=BUILDINGS[type],meta=worksite(t,i);if(!b||!meta)continue;
   const q=workQuality(p,meta,type);
   // Upkeep INCLUDES wages. Don't stack full fixed maintenance and wages.
   const operating=operatingCost(p,meta,type);
   vals.upkeep+=operating.total;vals.buildingUpkeep+=operating.total;
   if(type==='farm')vals.farmUpkeep+=operating.total;
   else if(factories.has(type))vals.factoryUpkeep+=operating.total;
   else vals.otherBuildingUpkeep+=operating.total;
   vals.wages+=operating.staff;vals.workerWages+=operating.staff;
   if(q.count===0)continue;
   const boost=1+(q.level-1)*.6;
   for(const k in b.production){
    const amount=Math.max(0,Math.floor(b.production[k]*boost*q.ratio*q.efficiency+.0001));
    vals[k]+=amount;if(k==='gold'&&type==='market')vals.marketIncome+=amount;
   }
   if(type==='market'&&p.tech.includes('commerce')){
    const bonus=Math.floor(q.ratio*q.efficiency);vals.gold+=bonus;vals.marketIncome+=bonus;
   }
  }
 }
 vals.gold+=vals.householdIncome;
 vals.militaryUpkeep=Math.ceil(summary.soldiers/3);vals.upkeep+=vals.militaryUpkeep;
 vals.builderWages=(p.citizens||[]).filter(c=>!!c.builder).length;
 const bunkBudget=G.tiles.filter(t=>t.owner===id).reduce((sum,t)=>
  sum+(t.buildings||[]).reduce((sub,kind,i)=>kind==='builderBunk'?sub+operatingCost(p,worksite(t,i),kind).total:sub,0),0);
 vals.builderExtraUpkeep=Math.max(0,vals.builderWages-bunkBudget);
 vals.upkeep+=vals.builderExtraUpkeep;vals.wages+=vals.builderWages;
 vals.foodUse=Math.ceil(summary.count/6);
 vals.netFood=vals.food-vals.foodUse;
 vals.netGold=vals.gold-vals.upkeep;
 return vals;
}
function extractMinesForRound(p){
 for(const t of G.tiles){
  if(t.owner!==p.id||t.terrain!=='mountain')continue;
  for(let index=0;index<t.buildings.length;index++){
   if(t.buildings[index]!=='mine')continue;
   const meta=worksite(t,index),q=workQuality(p,meta,'mine');if(!q.count)continue;
   // Stone is available from ALL mountains, even mountains with no ore veins.
   const freeStone=endpointStorageFree(p,meta.id);if(freeStone>=1)addLocal(meta,'stone',Math.min(freeStone,Math.max(1,Math.round(2*q.ratio*q.efficiency*(1+.5*(q.level-1))))));
   for(const vein of [t.vein,t.coalVein]){
    if(!vein||vein.remaining<=0)continue;
    const cfg=MINERALS[vein.kind];if(!cfg)continue;
    const rng=mulberry32(hash(G.seed+':mining:'+t.id+':'+vein.kind+':'+G.round));
    const chance=Math.max(.005,Math.min(.98,cfg.chance*(.50+.50*q.ratio)*q.efficiency*(1+.22*(q.level-1))));
    if(rng()>=chance)continue;
    const amount=Math.min(vein.remaining,endpointStorageFree(p,meta.id),Math.max(1,Math.round(cfg.rate*(1+.5*(q.level-1))*q.ratio*q.efficiency)));
    if(amount<1)continue;addLocal(meta,vein.kind,amount);vein.remaining-=amount;
    if(vein.kind==='diamond'||vein.kind==='goldOre')addLog(`${p.name} mined ${amount} ${cfg.name} at ${t.name}; shipment still required.`);
    else if(vein.remaining===0)addLog(`${p.name} exhausted its ${cfg.name} vein at ${t.name}.`);
   }
  }
 }
}

function canEquip(p,c,tier){
 const cfg=GEAR[tier],old=GEAR_ORDER.indexOf(c?.military?.gear);
 if(!cfg||!c?.military||c.military.missionId||GEAR_ORDER.indexOf(tier)<=old)return false;
 const post=postStock(p,c.military.postId);return !!post&&localCount(post,cfg.item)>=1;
}
function equipSoldier(citizenId,tier,id=0){
 const p=G.players[id],c=p.citizens.find(c=>c.id===citizenId);
 if(!canCountryAct(p,id)||!canEquip(p,c,tier))return false;
 const stock=postStock(p,c.military.postId);addLocal(stock,GEAR[tier].item,-1);
 c.military.gear=tier;
 useAction(p,`${p.name} equipped ${c.name} with delivered ${GEAR[tier].name}.`,{tileId:c.military.postId,kind:'equip'});
 if(id===0)showToast(`${c.name}: ${GEAR[tier].name} issued from post stores`);
 return true;
}
function equipAuxiliary(citizenId,item,id=0){
 const p=G.players[id],c=p.citizens.find(c=>c.id===citizenId);
 if(!canCountryAct(p,id)||!c?.military||c.military.missionId||!['woodShield','stoneAxe','stonePickaxe','stoneSword','stoneClub'].includes(item))return false;
 const stock=postStock(p,c.military.postId),field=item==='woodShield'?'shield':'weapon';
 if(!stock||localCount(stock,item)<1||c.military[field]===item)return false;
 addLocal(stock,item,-1);if(c.military[field])addLocal(stock,c.military[field],1);
 c.military[field]=item;
 useAction(p,`${p.name} issued delivered ${GOOD_NAMES[item]} to ${c.name}.`,{tileId:c.military.postId,kind:'equip'});return true;
}

function smeltSteel(){showToast('Steel requires a staffed Steelworks Factory and delivered Iron + Coal.');return false;}

function mineralTrade(key,direction,id=0){
 const p=G.players[id],mineral=MINERALS[key];if(!mineral||!canCountryAct(p,id))return false;
 const importing=direction==='buy',cost=Math.ceil(mineral.price*2.1);
 if(importing&&!['coal','iron','copper','silver'].includes(key))return false;
 if(importing&&!hasMoney(p,cost))return false;
 if(!importing&&nationalResourceCount(p,key)<1)return false;
 if(importing){p.gold-=cost;addDepot(p,key,1);}else{p.gold+=mineral.price;spendNationalResource(p,key,1);}
 useAction(p,`${p.name} ${importing?'imported':'sold'} 1 ${mineral.name} for ${importing?cost:mineral.price} SP at the Global Exchange.`);
 if(id===0)showToast(`${importing?'Imported':'Sold'} ${mineral.name} · ${importing?'-':'+'}${importing?cost:mineral.price} SP`);
 return true;
}
function renderMineralMarket(){
 const node=el('mineralBody');if(!node||!G)return;
 const p=getCountry();
 node.innerHTML=MINERAL_KEYS.map(key=>{const m=MINERALS[key],q=nationalResourceCount(p,key),buy=Math.ceil(m.price*2.1);
  return `<div class="gs-mineral-item"><span class="gs-mineral-symbol">${m.icon}</span><div class="gs-mineral-copy"><strong>${m.name} × ${q}</strong><small>Sell: ${m.price} SP${['coal','iron','copper','silver'].includes(key)?` · Buy: ${buy} SP`: ' · Mine or trade to acquire'}</small></div><div class="gs-mineral-actions"><button data-mineral="${key}" data-direction="sell" ${!canAct()||q<=0?'disabled':''}>Sell</button>${['coal','iron','copper','silver'].includes(key)?`<button data-mineral="${key}" data-direction="buy" ${!canAct()||!hasMoney(p,buy)?'disabled':''}>Buy</button>`:''}</div></div>`;
 }).join('')+`<div class="gs-mineral-item"><span class="gs-mineral-symbol"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-steel"></use></svg></span><div class="gs-mineral-copy"><strong>Steel × ${mineralCount(p,'steel')}</strong><small>Delivered Steel in capital warehouse · manufacture in staffed Steelworks from 2 Iron + 1 Coal</small></div><div class="gs-mineral-actions"><small>Factory only</small></div></div>`;
}
function useAction(p,text,visual=null){
 p.actionsUsed=actionsUsed(p)+1;p.acted=actionsRemaining(p)===0;
 if(p.id>0)cpuLastAction={nation:p.id,description:text,tileId:visual?.tileId||null,kind:visual?.kind||'action'};
 addLog(text);showBuild=false;showResearch=false;save();render();
}
function doExpand(t,id=0,selectedCitizenIds=null){
 const p=G.players[id],crew=idleExpedition(p);
 if(!crew||!canCountryAct(p,id)||!eligibleExpansion(p,t))return false;
 const eligible=eligibleExpeditionCitizens(p);
 // Human players choose their party explicitly; CPU nations recruit from the
 // same unemployed civilian pool and obey exactly the same 1-2 citizen limit.
 const ids=Array.isArray(selectedCitizenIds)?selectedCitizenIds:
  (id!==0?eligible.slice(0,2).map(c=>c.id):[]);
 if(ids.length<1||ids.length>2||new Set(ids).size!==ids.length||
    !ids.every(chosen=>eligible.some(c=>c.id===chosen))){
  if(id===0)showToast('Choose 1 or 2 unemployed civilians aged 16+ to explore.');
  return false;
 }
 const cost=expansionCost(p);if(!hasMoney(p,cost)||nationalResourceCount(p,'food')<2)return false;
 // Keep the existing departure zoom, overlay suspension and restore behavior.
 const playback=(id===0||cpuBusy)?startMapScenePlayback(t,'dispatch'):null;
 p.gold-=cost;spendNationalResource(p,'food',2);p.discountExpand=0;p.expansionsThisTurn=(p.expansionsThisTurn||0)+1;
 const origin=G.tiles.find(v=>v.id===crew.locationId)||G.tiles.find(v=>v.owner===id&&v.capital);
 crew.targetId=t.id;crew.originId=(origin||t).id;crew.remaining=Math.max(1,countryTravelRoute(id,origin||t,t,true)?.turns??Math.ceil(distance(origin||t,t)));crew.travelTotal=crew.remaining;crew.startedClock=G.turnClock||0;
 crew.citizenIds=[...ids];crew.elapsed=0;crew.legacyInFlight=false;
 const names=crew.citizenIds.map(cid=>p.citizens.find(c=>c.id===cid)).filter(Boolean);
 for(const citizen of names)citizen.morale=Math.max(0,(citizen.morale??50)-1);
 useAction(p,`${p.name} sent ${names.map(c=>c.name).join(' and ')} on an expedition to ${t.name} (${crew.remaining} turn${crew.remaining===1?'':'s'} away).`,{tileId:t.id,kind:'expedition'});
 if(id===0)showToast(`${names.length} civilian explorer${names.length===1?'':'s'} en route to ${t.name}`);
 return true;
}
function doBuild(t,type,id=0){
 const p=G.players[id],b=BUILDINGS[type];if(!canCountryAct(p,id)||!b||!canBuild(p,t,b))return false;
 const playback=(id===0||cpuBusy)?startMapScenePlayback(t,'work',-1,type):null;
 p.gold-=buildingCost(p,b);spendNationalResource(p,'wood',b.wood);spendNationalResource(p,'iron',b.iron);p.discountBuild=0;
 const duration=Math.max(2,b.rounds*2);
 const job={id:G.nextProjectId++,owner:id,tileId:t.id,type,remaining:duration,total:duration,startedRound:G.round,builderIds:[]};
 G.projects.push(job);appointBuilder(p,job,t);
 useAction(p,`${p.name} started ${b.name} at ${t.name} (${b.rounds} round${b.rounds===1?'':'s'}).`,{tileId:t.id,kind:'work'});
 if(id===0&&!playback)showToast(`${b.name} construction started`);
 return true;
}
function doSell(t,idx=0,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!allowed(p,t)||!t.buildings?.[idx])return false;
 const type=t.buildings[idx],b=BUILDINGS[type],siteId=t.buildingMeta?.[idx]?.id;
 if(type==='caravanWarehouse'&&p.caravans.some(c=>String(c.homeSiteId)===String(siteId)&&c.shipmentId)){if(id===0)showToast('Wait for these wagons to finish their cargo or troop journeys before selling the warehouse.');return false;}
 if(type==='post'&&getMilitaryPosts(id).length&&postGarrison(p,t.id).length>0){if(id===0)showToast('Move troops before selling this post.');return false;}
 const stock=worksite(t,idx)?.stock||{};for(const [item,amount] of Object.entries(stock)){if(amount>0)dispatchShipment(id,siteId,'depot',item,amount,true);}
 const refund=Math.max(2,Math.floor(b.gold*.6));p.gold+=refund;t.buildings.splice(idx,1);t.buildingMeta?.splice(idx,1);for(const citizen of p.citizens){if(citizen.job?.siteId===siteId)citizen.job=null;}reallocateHousing(p);syncBuilders(p);assignWorkers(p);syncCaravans(p);
 useAction(p,`${p.name} sold a ${b.name} at ${t.name} to the Global Bank for ${refund} SP.`,{tileId:t.id,kind:'sell'});
 if(id===0)showToast(`${b.name} sold for ${refund} SP`);return true;
}
function doRecruit(t,id=0){return doMarketing(t,id);}
function doTrain(t,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!allowed(p,t)||!buildingCount(t,'post'))return false;
 const soldiers=postGarrison(p,t.id).filter(c=>c.military.training<5&&!c.military.missionId).slice(0,3);
 if(!soldiers.length||!hasMoney(p,3)||nationalResourceCount(p,'food')<1)return false;
 p.gold-=3;spendNationalResource(p,'food',1);
 for(const c of soldiers){c.military.training++;c.military.skill=Math.min(100,warSkill(c)+8);if(c.military.training>=3&&!c.military.perk)c.military.perk='Disciplined';}
 useAction(p,`${p.name} trained ${soldiers.length} troops at ${t.name}.`,{tileId:t.id,kind:'train'});
 if(id===0)showToast('Training completed');return true;
}
function moveSoldier(citizenId,destinationId){
 if(!active())return false;const p=getCountry();if(p.logisticsUsed)return false;
 const citizen=p.citizens.find(c=>c.id===citizenId);
 const destination=G.tiles.find(t=>t.id===destinationId);
 if(!citizen?.military||citizen.military.missionId||!destination||destination.owner!==0||!buildingCount(destination,'post'))return false;
 if(citizen.military.postId===destinationId||postGarrison(p,destinationId).length>=12)return false;
 citizen.military.postId=destinationId;p.logisticsUsed=true;
 addLog(`${citizen.name} reassigned to ${destination.name}.`);save();render();showToast(`${citizen.name} transferred to ${destination.name}`);return true;
}
function doLevy(id=0){const p=G.players[id];if(!canCountryAct(p,id)||p.levyUsed)return false;const foodCost=Math.min(2,nationalResourceCount(p,'food'));p.gold+=6;spendNationalResource(p,'food',foodCost);p.levyUsed=true;useAction(p,`${p.name} raised emergency taxes: +6 SP, −${foodCost} Food.`);if(id===0)showToast('Emergency taxes collected: +6 Silver Pents');return true;}
function doResearch(type,id=0){const p=G.players[id],t=TECHS[type];if(!canCountryAct(p,id)||!t||p.tech.includes(type)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge)return false;p.gold-=t.gold;p.knowledge-=t.knowledge;p.tech.push(type);useAction(p,`${p.name} completed research: ${t.name}.`);if(id===0)showToast(`${t.name} researched`);return true;}
function playCard(id,idx){const p=G.players[id];if(!p||p.cardPlayed||idx<0||idx>=p.hand.length||G.turnIndex!==id||G.finished)return false;const type=p.hand[idx];p.cardPlayed=true;p.hand.splice(idx,1);
 switch(type){case'grant':p.gold+=6;break;case'harvest':p.food+=5;break;case'supplies':p.wood+=3;p.minerals.iron+=2;break;case'insight':p.knowledge+=3;break;case'charter':p.discountExpand+=3;break;case'permit':p.discountBuild+=3;break;}
 addLog(`${p.name} played ${CARDS[type].name}.`);save();render();if(id===0)closeCardPreview();animatePlayedCard(type,id);return true;}
function finishRound(){
 for(const p of G.players){
  const e=getEconomy(p.id),oldGold=p.gold;
  const projectedGold=p.gold+e.netGold;
  const unfunded=Math.max(0,-CREDIT_LIMIT_SP-projectedGold);
  p.gold=Math.max(-CREDIT_LIMIT_SP,projectedGold);
  if(unfunded>0){
   // Charges beyond the credit ceiling cannot be paid. Employees lose morale.
   p.missedOperatingCosts=(p.missedOperatingCosts||0)+unfunded;
   const penalty=Math.min(10,3+Math.ceil(unfunded/3));
   for(const c of p.citizens||[])if(!c.military)c.morale=Math.max(0,(c.morale??50)-penalty);
   addLog(`${p.name} reached its −${CREDIT_LIMIT_SP} SP credit limit; ${unfunded} SP in operating costs could not be paid. Civilian morale fell.`);
  }
  nationalBalance(p,'food',e.netFood);nationalBalance(p,'wood',e.wood);p.knowledge+=e.knowledge;
  const wars=opponentsAtWar(p.id).length;for(const c of p.citizens){if(c.military)continue;c.morale=Math.max(0,Math.min(100,(c.morale??50)-(wars?Math.min(4,wars*2):0)));}
  if(p.gold<0&&oldGold>=0)addLog(`${p.name} entered debt; the −${CREDIT_LIMIT_SP} SP credit ceiling limits spending.`);
  if(nationalResourceCount(p,'food')===0&&e.netFood<0)addLog(`${p.name} is experiencing a food shortage. Population growth paused.`);
  if(G.round%4===0)for(const c of p.citizens)c.age++;
  advanceCitizenHealthAndMortality(p);
  newCitizensForRound(p);
  volunteerEachRound(p);
  assignWorkers(p);
 }
 progressShipments();runAgricultureAndForestry();
 for(const p of G.players)extractMinesForRound(p);
 autoDispatchOutputs();autoDispatchBoats();autoRequestFactoryInputs();processFactories();autoDispatchOutputs();autoDispatchBoats();autoRequestFactoryInputs();
 for(const route of G.tradeRoutes.filter(r=>r.status==='active')){G.players[route.a].gold+=2;G.players[route.b].gold+=2;}
 resolveSieges();expireTreaties();
 addLog(`Round ${G.round} concluded. Population, production and maintenance updated.`);
 if(G.round>=G.maxRounds&&!G.continued){
  const unfinished=(G.sieges||[]).some(s=>['marching','active','breached','aftermath','counterattack'].includes(s.status));
  if(unfinished){G.maxRounds+=4;addLog('Ongoing siege campaigns extend the match by four rounds until the fronts are settled.');}
  else{G.finished=true;save();render();showEndGame();return;}
 }
 G.round++;beginTurn(0);cpuBusy=false;save();render();showToast(`Round ${G.round} — your turn`);
}

function cpuActionLocation(before,after){
 // Fallback only when the actual tile state changed; compare count with count.
 for(let i=0;i<after.length;i++){
  const t=after[i],old=before[i];if(!old)continue;
  const buildings=t.buildings?.length||0,projects=(G.projects||[]).filter(j=>j.tileId===t.id).length;
  if(old.owner!==t.owner||old.buildings!==buildings||old.projects!==projects)return t;
 }
 return null;
}
function showCpuHud(id,description){
 const box=el('cpuCinematic'),p=G?.players[id];if(!box||!p)return;
 box.classList.remove('hidden');el('cpuNation').textContent=p.name;el('cpuNation').style.color=p.color;el('cpuAction').textContent=description;
}
function hideCpuHud(){el('cpuCinematic')?.classList.add('hidden');}
function cpuPause(ms,token){return new Promise(resolve=>{if(skipCpuPlayback||ms<=0){resolve();return;}let start=performance.now();function wait(now){if(token!==cpuPlaybackToken||skipCpuPlayback||now-start>=ms){resolve();return;}setTimeout(()=>requestAnimationFrame(wait),45);}requestAnimationFrame(wait);});}
async function runCpuCinematic(token=cpuPlaybackToken){
 if(!G||G.finished)return;
 for(let id=1;id<=3;id++){
  if(token!==cpuPlaybackToken||!G)return;
  const p=G.players[id],capital=G.tiles.find(t=>t.owner===id&&t.capital)||G.tiles[0];
  actionTileId=null;beginTurn(id);render();showCpuHud(id,`${p.name} · ${cpuPersonality(p).name} · ${cpuPersonality(p).focus}`);
  cpuSecretWarOrder(id);
  // A longer, ease-in/ease-out camera sweep introduces the next country.
  await moveCamera(capital,POV_ANGLES[id],1250,mobileCameraWidth(435,560));
  if(token!==cpuPlaybackToken||!G)return;
  await cpuPause(490,token);
  // Play their card as a distinct, visible event before the major actions.
  if(playCpuOpeningCard(id)){
   showCpuHud(id,`${p.name} played a card`);
   await cardEffectPromise;
   if(token!==cpuPlaybackToken||!G)return;
   await cpuPause(460,token);
  }
  for(let step=0;step<MAJOR_ACTIONS;step++){
   if(token!==cpuPlaybackToken||!G)return;
   const spent=actionsUsed(p);
   const before=G.tiles.map(t=>({owner:t.owner,buildings:t.buildings?.length||0,projects:(G.projects||[]).filter(j=>j.tileId===t.id).length}));
   cpuLastAction=null;
   runCpu(id);
   const action=cpuLastAction;
   const fallback=cpuActionLocation(before,G.tiles);
   const changedTile=action?.tileId?G.tiles.find(t=>t.id===action.tileId):fallback;
   save();render();
   if(actionsUsed(p)===spent){showCpuHud(id,`${p.name} has no further affordable actions.`);await cpuPause(500,token);break;}
   showCpuHud(id,`Action ${actionsUsed(p)}/${MAJOR_ACTIONS}: ${action?.description||G.log[0]?.text||`${p.name} reviewed its plans.`}`);
   // Expansion and construction now play exactly the human on-hex animation.
   // No second flash or misleading fallback to the first map hex.
   const playback=scenePlayback;
   if(playback){await playback.done;}
   else if(changedTile){
    await moveCamera(changedTile,POV_ANGLES[id],1050,mobileCameraWidth(350,445));
    if(token!==cpuPlaybackToken||!G)return;
    flashAction(changedTile,action?.kind||'cpu');
    await cpuPause(900,token);
   }
   if(token!==cpuPlaybackToken||!G)return;
   await cpuPause(playback?690:changedTile?350:950,token);
  }
  if(token!==cpuPlaybackToken||!G)return;
  advanceWorldTurn();
  await showCompletedProjects();
  if(token!==cpuPlaybackToken||!G)return;
  await cpuPause(620,token);
 }
 if(token!==cpuPlaybackToken||!G)return;
 finishRound();
 if(G.finished){hideCpuHud();return;}
 cpuBusy=true;render(); // Keep input locked through the return camera move.
 showCpuHud(0,'The next round begins — your move.');
 const home=G.tiles.find(t=>t.owner===0&&t.capital)||G.tiles[0];
 await moveCamera(home,POV_ANGLES[0],1350,mobileCameraWidth(435,565));
 hideCpuHud();await showCompletedProjects();cpuBusy=false;render();setTimeout(presentFalconInbox,390);
}
function endTurn(){
 if(!active())return;
 closeCardPreview();closeSheet();cpuBusy=true;skipCpuPlayback=false;cpuPlaybackToken++;
 const token=cpuPlaybackToken;save();render();
 if(!document.body.classList.contains('gs-playing'))el('mapWrap').scrollIntoView({behavior:'smooth',block:'center'});
 setTimeout(async()=>{
  try{
   advanceWorldTurn();
   await showCompletedProjects();
   if(token===cpuPlaybackToken)await runCpuCinematic(token);
  }catch(e){console.error('CPU playback failed',e);hideCpuHud();if(G&&!G.finished){scenePlayback=null;cpuBusy=false;G.turnIndex=0;save();render();showToast('CPU playback interrupted; resume your turn.');}}
 },140);
}
function cpuStep(){if(!G||G.finished)return;const id=G.turnIndex;if(id<1||id>3){cpuBusy=false;return;}const p=G.players[id];beginTurn(id);for(let step=0;step<MAJOR_ACTIONS;step++){const spent=actionsUsed(p);runCpu(id);if(actionsUsed(p)===spent)break;}advanceWorldTurn();save();render();if(id===3){setTimeout(()=>{if(G)finishRound();},400);}else{G.turnIndex=id+1;save();setTimeout(cpuStep,470);}}
function playCpuOpeningCard(id){
 const p=G.players[id];if(p.cardPlayed)return false;
 const w=cpuPersonality(p).weights,eco=getEconomy(id);
 const scores={grant:8*w.economy+(p.gold<12?10:0),
  harvest:8*w.food+(nationalResourceCount(p,'food')<9||eco.netFood<0?10:0),
  supplies:8*w.industry+(nationalResourceCount(p,'wood')<9?8:0),
  insight:8*w.science+(p.knowledge<6?4:0),
  charter:8*w.expand,permit:8*Math.max(w.industry,w.science,w.military)};
 const pick=p.hand.map((card,i)=>({i,score:(scores[card]||0)+cpuRoll(p,'card:'+i)*2}))
  .sort((a,b)=>b.score-a.score)[0]?.i;
 return pick==null?false:playCard(id,pick);
}
function cpuSecretWarOrder(id){
 const p=G.players[id],enemies=opponentsAtWar(id),mind=cpuPersonality(p);
 if(!p||!enemies.length||p.siegePlanningRound===G.round)return;
 p.siegePlanningRound=G.round;
 for(const s of G.sieges||[])if(['breached','aftermath'].includes(s.status)){
  if(s.attacker===id&&!s.attackerChoice){
   const tile=G.tiles.find(t=>t.id===s.targetTileId);
   const adjacent=tile?neighbors(tile).filter(t=>t.owner===s.defender&&!t.capital&&!activeSiege(t.id)):[];
   const ready=siegeTeam(s,'attacker').length;
   const choice=ready<2?'retreat':adjacent.length&&ready>=(mind.aggression>.72?4:7)?'push':'claim';
   warChooseAfternath(s,choice,adjacent[0]?.id,id);
  }else if(s.defender===id&&s.lateDefenderIds?.length){
   const able=s.lateDefenderIds.filter(cid=>p.citizens.some(c=>c.id===cid&&c.health>0));
   const choice=able.length>=(mind.aggression>.72?2:5)?'attack':'guard';
   if(!warChooseAfternath(s,choice,null,id))warChooseAfternath(s,'retreat',null,id);
  }
 }
 // CPU submits independent defensive and attacking orders during its normal
 // turn; no instant moves and no hidden knowledge of the other side's order.
 for(const s of G.sieges||[]){
  if(s.status!=='active'||![s.attacker,s.defender].includes(id))continue;
  const side=s.attacker===id?'attacker':'defender';
  const kind=side==='attacker'
   ?(s.roundNumber%4===3&&s.preparation<(mind.aggression>.7?1:3)&&nationalResourceCount(p,'wood')>1?'prepare':'assault')
   :(s.supply<(mind.caution>.75?60:38)&&nationalResourceCount(p,'food')>=3?'resupply':s.fort<(mind.caution>.75?65:36)&&nationalResourceCount(p,'wood')>=2?'fortify':s.morale<45?'rally':s.roundNumber%4===3&&mind.aggression>.7?'counterattack':'hold');
  setSiegeOrder(s.id,kind,id);
 }
 if(p.logisticsUsed)return;
 // Reinforce thin attacking or defending lines before launching another
 // mission; choices are still submitted on the CPU country's own turn.
 for(const siege of G.sieges||[]){
  if(siege.status!=='active'||![siege.attacker,siege.defender].includes(id))continue;
  const side=siege.attacker===id?'attacker':'defender',ready=siegeTeam(siege,side).length;
  if(ready>=4)continue;
  for(const post of getMilitaryPosts(id)){
   if(!canReinforceSiege(siege,post.id,id))continue;
   const available=postGarrison(p,post.id).filter(c=>c.health>0&&!c.military.missionId).length;
   if(available&&reinforceSiege(siege.id,post.id,Math.min(4-ready,available),id))return;
  }
 }
 const readyPosts=getMilitaryPosts(id).filter(t=>postGarrison(p,t.id).some(c=>c.health>0&&!c.military?.missionId));
 if(!readyPosts.length)return;
 const enemyTargets=G.tiles.filter(t=>enemies.includes(t.owner)&&!t.capital&&
  neighbors(t).some(n=>n.owner===id)&&!activeSiege(t.id));
 // Prefer a campaign over passive patrols, but start one at a time per army.
 if(!(G.sieges||[]).some(s=>s.attacker===id&&['marching','active'].includes(s.status))&&
  (mind.aggression>.4||readyPosts.some(post=>postGarrison(p,post.id).filter(c=>!c.military.missionId).length>=8))){
  for(const t of enemyTargets){
   for(const post of readyPosts){
    if(!canStartSiege(t.id,post.id,id))continue;
    const qty=Math.min(6,postGarrison(p,post.id).filter(c=>c.health>0&&!c.military.missionId).length);
    if(qty&&startSiege(t.id,post.id,qty,id))return;
   }
  }
 }
 // Keep previous patrol behavior when no legal siege is available.
 const post=readyPosts[0];
 const target=G.tiles.filter(t=>t.owner===id&&neighbors(t).some(n=>n.owner===null||enemies.includes(n.owner)))
  .sort((a,b)=>Math.min(...enemies.map(e=>distance(a,capitalOf(e))))-Math.min(...enemies.map(e=>distance(b,capitalOf(e)))))[0];
 if(target)orderMilitary(target.id,enemies[0],post.id,Math.min(2,postGarrison(p,post.id).filter(c=>!c.military.missionId).length),'patrol',id);
}

// Distinct CPU strategic reasoning, with persistent priorities and temporary
// economic pressure. Every candidate is attempted through existing player rules.
function cpuEconomyAction(id){
 const p=G.players[id],profile=cpuPersonality(p),w=profile.weights;
 const owned=G.tiles.filter(t=>t.owner===id),eco=getEconomy(id),people=peopleSummary(p);
 const projects=G.projects.filter(j=>j.owner===id),count=type=>owned.reduce((n,t)=>n+t.buildings.filter(b=>b===type).length,0)+projects.filter(j=>j.type===type).length;
 const hasBuilder=idleBuilders(p).length>0,underThreat=owned.some(t=>neighbors(t).some(n=>n.owner!==null&&n.owner!==id));
 const choices=[],add=(tag,focus,score,act)=>choices.push({tag,score:score*(w[focus]||1)+(cpuRoll(p,tag,owned.length)-.5)*4.6,act});
 if(p.gold<=-CREDIT_LIMIT_SP){
  if(!p.levyUsed&&doLevy(id))return true;
  for(const k of ['diamond','goldOre','silver','copper','iron','coal'])if(mineralCount(p,k)>1&&mineralTrade(k,'sell',id))return true;
  // An insolvent country can sell nonessential infrastructure. Keep homes,
  // farms, markets and troops; never sell a warehouse with a wagon in transit.
  for(const t of owned)for(let i=0;i<t.buildings.length;i++){
   const type=t.buildings[i],meta=t.buildingMeta?.[i];
   if(['market','farm','homes'].includes(type)||G.projects.some(j=>j.upgradeSiteId===meta?.id))continue;
   if(type==='post'&&postGarrison(p,t.id).length)continue;
   if(type==='caravanWarehouse'&&p.caravans.some(c=>String(c.homeSiteId)===String(meta?.id)&&c.shipmentId))continue;
   if(doSell(t,i,id))return true;
  }
  return false;
 }
 if(p.gold<5&&eco.netGold<0&&!p.levyUsed&&doLevy(id))return true;
 const landValue=t=>{
  const free=neighbors(t).filter(n=>n.owner===null&&n.terrain!=='water').length;
  const deposits=t.vein?.kind;
  return ({plains:8,forest:6,hills:5,desert:2,mountain:deposits?11:3})[t.terrain]+
   free*(p.cpuPersonality==='frontier'?2:.6)+
   (p.cpuPersonality==='industrial'?(t.terrain==='forest'?12:t.terrain==='mountain'?13:0):0)+
   (p.cpuPersonality==='steward'&&t.terrain==='plains'?9:0)+
   (p.cpuPersonality==='marshal'&&neighbors(t).some(n=>n.owner!==null&&n.owner!==id)?8:0)+
   (p.cpuPersonality==='merchant'&&['plains','hills'].includes(t.terrain)?5:0)+cpuRoll(p,'hex:'+t.id)*3;
 };
 const frontier=G.tiles.filter(t=>eligibleExpansion(p,t)).sort((a,b)=>landValue(b)-landValue(a))[0];
 if(frontier&&nationalResourceCount(p,'food')>=2&&hasMoney(p,expansionCost(p))&&eligibleExpeditionCitizens(p).length){
  const resourceSeek=p.cpuPersonality==='industrial'&&!owned.some(t=>['forest','mountain'].includes(t.terrain));
  add('expand:'+frontier.id,'expand',11+(owned.length<3?5:0)+(resourceSeek?11:0)+(underThreat&&profile.aggression>.8?4:0)
   -(owned.length>8?(owned.length-8)*2:0)-(p.gold<12?6:0),()=>doExpand(frontier,id));
 }
 const goals={
  farm:['food',11+(nationalResourceCount(p,'food')<10?11:0)+(eco.netFood<=0?12:0),4],
  market:['economy',11+(eco.netGold<=0?11:eco.netGold<4?5:0)+(p.gold<15?7:0),5],
  homes:['civic',10+(people.housing<=people.count+2?25:people.housing<=people.count+6?10:0),6],
  lumber:['industry',10+(nationalResourceCount(p,'wood')<8?9:nationalResourceCount(p,'wood')<16?4:0),3],
  mine:['industry',12+(nationalResourceCount(p,'iron')<4?6:0),3],
  academy:['science',13+(p.knowledge<9?5:0),3],
  post:['military',11+(underThreat?7:0),3],
  woodworks:['industry',11+(nationalResourceCount(p,'wood')<10?7:0),3],
  caravanWarehouse:['logistics',9+(count('farm')+count('lumber')+count('mine')>0?6:0),2],
  storageWarehouse:['logistics',9+(count('farm')+count('lumber')+count('mine')>0?5:0),3],
  leatherFactory:['industry',9,2],stoneworks:['industry',9,2],foundry:['industry',10,2],armory:['military',10,2]
 };
 for(const [type,[focus,base,max]] of Object.entries(goals)){
  if(!hasBuilder||count(type)>=max||!BUILDINGS[type])continue;
  if(type==='lumber'&&!owned.some(t=>t.terrain==='forest'))continue;
  if(type==='mine'&&!owned.some(t=>t.terrain==='mountain'))continue;
  if(type==='woodworks'&&!count('lumber')&&nationalResourceCount(p,'wood')>=8)continue;
  if(['leatherFactory','stoneworks','foundry','armory'].includes(type)&&G.round<(type==='leatherFactory'?4:6))continue;
  if(type==='post'&&G.round<2&&p.cpuPersonality!=='marshal')continue;
  if(['caravanWarehouse','storageWarehouse'].includes(type)&&count('farm')+count('mine')+count('lumber')===0&&G.round<3)continue;
  if(type==='homes'&&people.housing>people.count+10&&count(type)>=1)continue;
  const b=BUILDINGS[type];
  if(!hasMoney(p,buildingCost(p,b))||nationalResourceCount(p,'wood')<b.wood||nationalResourceCount(p,'iron')<b.iron)continue;
  if(p.gold<9&&!['market','farm','homes'].includes(type))continue;
  const sites=owned.filter(t=>canBuild(p,t,b)).sort((a,b)=>{
   const siteScore=t=>(type==='farm'&&t.terrain==='plains'?5:0)+(type==='mine'&&t.vein?8:0)
    +(type==='post'?neighbors(t).filter(n=>n.owner!==null&&n.owner!==id).length*6:0)
    +(['farm','mine','lumber'].includes(type)&&(t.capital||t.buildings.includes('storageWarehouse'))?3:0)
    +buildFree(t)*.2+cpuRoll(p,'site:'+type+':'+t.id);
   return siteScore(b)-siteScore(a);
  });
  if(!sites.length)continue;
  let score=base-count(type)*Math.max(4,base*.35)+(count(type)===0?3:0);
  if(type==='farm'&&eco.netFood<0)score+=7;
  if(type==='market'&&eco.netGold<0)score+=7;
  if(type==='homes'&&people.housing<=people.count+2)score+=8;
  if(type==='post'&&underThreat&&profile.aggression>.8)score+=6;
  if(type==='caravanWarehouse'&&!count(type)&&count('farm')+count('lumber')+count('mine')>0)score+=5;
  if(type==='academy'&&p.knowledge>12)score-=8;
  if(eco.netGold<0&&type!=='market'&&type!=='farm'&&type!=='homes')score-=8*profile.caution;
  if(p.gold<15&&type!=='market')score-=7*profile.caution;
  add('build:'+type+':'+sites[0].id,focus,score,()=>doBuild(sites[0],type,id));
 }
 for(const [key,t] of Object.entries(TECHS)){
  if(p.tech.includes(key)||p.knowledge<t.knowledge||!hasMoney(p,t.gold))continue;
  const focus=key==='cartography'?'expand':key==='commerce'?'economy':'food';
  add('research:'+key,focus,15,()=>doResearch(key,id));
 }
 const posts=getMilitaryPosts(id);
 if(posts.length&&G.round>2&&p.gold>=12){
  const post=posts.find(t=>postGarrison(p,t.id).length<8);
  if(post&&p.marketingUntil<G.round)add('recruit','military',12+(underThreat?8:0),()=>doMarketing(post,id));
  const training=posts.find(t=>postGarrison(p,t.id).some(c=>(c.military?.training||0)<4));
  if(training&&nationalResourceCount(p,'food')>=3)add('train','military',11+(underThreat?7:0),()=>doTrain(training,id));
 }
 if(G.round>=4&&p.gold>=19&&nationalResourceCount(p,'wood')>=3&&hasBuilder&&owned.length>=2){
  const road=owned.flatMap(t=>neighbors(t).filter(n=>n.owner===id&&t.id<n.id).map(n=>({t,n})))
   .find(({t,n})=>canStartDomesticRoad(t,n,id));
  if(road)add('road','logistics',10+(p.caravans.length?5:0),()=>startDomesticRoad(road.t.id,road.n.id,id));
 }
 if(!p.levyUsed&&p.gold<16)add('levy','economy',5+(p.gold<8?10:0)+(eco.netGold<0?6:0),()=>doLevy(id));
 if(nationalResourceCount(p,'iron')<2&&p.gold>=16)add('import-iron','industry',9,()=>mineralTrade('iron','buy',id));
 choices.sort((a,b)=>b.score-a.score||a.tag.localeCompare(b.tag));
 for(const c of choices)if(c.score>0&&c.act())return true;
 return false;
}
function runCpu(id){
 const p=G.players[id],mind=cpuPersonality(p);
 if(id!==0)cpuSecretWarOrder(id); // also works during resumed/fast-forwarded CPU turns.
 if(!p.cardPlayed)playCpuOpeningCard(id);
 // CPU nations may warn rivals when their frontiers converge; players can respond by expanding or backing off.
 // Opposing countries can withdraw longstanding warnings by return falcon.
 if(id!==0&&G.round>=5&&!currentWar(id,0)&&hasMoney(p,1)){
  const stale=G.warnings.filter(w=>w.from===id&&w.to===0&&w.status==='active'
   &&G.tiles.some(t=>t.id===w.tileId&&t.owner===null)
   &&G.turnClock-(w.deliveredClock??G.turnClock)>=12
   &&!G.diplomaticFalcons.some(note=>note.kind==='retract'&&note.warningId===w.id&&note.status==='flying'));
  if(stale.length&&G.round%4===id%4){
   const w=stale[0],chance=mulberry32(hash(G.seed+':withdraw-threat:'+w.id+':'+G.round));
   if(chance()<.16+(1-mind.aggression)*.66&&sendDiplomaticFalcon(0,'retract',w.tileId,id,false,w.id))return;
  }
 }
 if(id!==0&&G.round>=3&&!currentWar(id,0)&&p.gold>=5){
  const sent=G.warnings.some(w=>w.from===id&&w.to===0&&(['active','violated','escalated'].includes(w.status)||(w.status==='rescinded'&&G.turnClock-(w.rescindedClock??0)<24)))||G.diplomaticFalcons.some(f=>f.from===id&&f.to===0&&f.kind==='warning'&&f.status==='flying');
  if(!sent&&G.round%3===id%3&&cpuRoll(p,'warn')<mind.aggression*.85){
   const contested=G.tiles.filter(t=>t.owner===null&&t.terrain!=='water'&&
    G.tiles.some(v=>v.owner===0&&distance(v,t)<=2)&&G.tiles.some(v=>v.owner===id&&distance(v,t)<=2));
   if(contested.length&&sendDiplomaticFalcon(0,'warning',contested[0].id,id))return;
  }
 }
 // CPU countries also initiate peace treaties and defensive alliances,
 // delivered through the same Falcon inbox as human proposals.
 if(id!==0&&G.round>=4&&G.round%6===id%6&&actionsRemaining(p)>0&&hasMoney(p,1)
  &&cpuRoll(p,'diplomacy')<.2+mind.diplomacy*.75){
  const candidates=G.players.filter(v=>v.id!==id&&!currentWar(id,v.id)).sort((a,b)=>(a.id===0?-1:0)-(b.id===0?-1:0));
  for(const partner of candidates){
   const existing=activeTreaty(id,partner.id);
   const kind=existing?.type==='treaty'&&mind.diplomacy>.55?'alliance':
    G.round>=9&&mind.diplomacy>.75?'alliance':'treaty';
   if(canProposeTreaty(id,partner.id,kind)&&sendDiplomaticFalcon(partner.id,kind,null,id))return;
  }
 }
 if(G.round>=4&&G.round%4===id%4&&actionsRemaining(p)>0&&cpuRoll(p,'trade')<.12+mind.weights.trade*.36){
  const available=G.players.filter(v=>v.id!==id&&!alreadyLinked(id,v.id)&&idleBuilders(p).length&&idleBuilders(v).length);
  if(available.length&&p.gold>18&&proposeTradeRoute(available[0].id,50,id))return;
 }
 const troops=p.citizens.filter(c=>c.military);
 for(const c of troops){const site=postStock(p,c.military.postId);if(!site)continue;
  for(const tier of ['diamond','gold','steel','iron','leather']){if(canEquip(p,c,tier)&&equipSoldier(c.id,tier,id))return;}
  for(const item of ['woodShield','stoneSword','stoneAxe','stonePickaxe','stoneClub']){
   if(localCount(site,item)>0&&(item==='woodShield'?!c.military.shield:!c.military.weapon)&&equipAuxiliary(c.id,item,id))return;
  }
 }
 return cpuEconomyAction(id);
}
function prosperity(p){const owned=G.tiles.filter(t=>t.owner===p.id),people=peopleSummary(p);
 return owned.length*4+owned.reduce((n,t)=>n+(t.buildings||[]).length,0)*5+people.housed*2-people.homeless*2+people.soldiers*2+Math.max(0,Math.floor(p.gold/4))+Math.max(0,Math.floor(nationalResourceCount(p,'food')/5))+Math.max(0,Math.floor(nationalResourceCount(p,'wood')/5))+Math.max(0,Math.floor(nationalResourceCount(p,'iron')/5))+Math.floor(MINERAL_KEYS.reduce((v,k)=>v+nationalResourceCount(p,k)*MINERALS[k].price,0)/20)+Math.floor(p.knowledge/3)+p.tech.length*3;}
function render(){if(!G)return;
 document.body.classList.toggle('cpu-watching',!!cpuBusy);
 const p=getCountry(),e=getEconomy(0),tile=getSelected(),people=peopleSummary(p);
 el('roundBadge').textContent=`ROUND ${G.round} / ${G.maxRounds}`;
 el('worldTitle').textContent=G.worldName;
 el('nationLabel').textContent=p.name;el('capitalFlag').style.setProperty('--nation-color',p.color);
 el('capitalFlag').innerHTML=icoMarkup('shield')+'<span class="gs-flag-initial">'+esc(p.id===0?'GS':p.name.slice(0,1))+'</span>';
 el('turnCounter').textContent=`Round ${G.round} of ${G.maxRounds} · ${G.tiles.length} hexes · ${G.tiles.filter(t=>t.owner===0).length} owned`;
 el('turnLabel').textContent=G.finished?'TEST COMPLETE':G.turnIndex===0&&!cpuBusy?'YOUR TURN':'CPU TURN';el('turnLabel').classList.toggle('cpu-turn',G.turnIndex!==0||cpuBusy);
 el('resources').innerHTML=[['gold',silverPentIcon(23),'Silver Pents'],['food','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>','Food'],['wood','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-wood"></use></svg>','Logs'],['iron','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg>','Iron'],['knowledge','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg>','Knowledge']].map(([field,icon,name])=>`<div class="resource ${(['food','wood','iron'].includes(field)?nationalResourceCount(p,field):p[field])<0?'negative':''}"><div class="resource-icon">${icon}</div><div class="resource-num">${fmt(['food','wood','iron'].includes(field)?nationalResourceCount(p,field):p[field])}</div><div class="resource-label">${name}</div></div>`).join('');
 el('quickStats').innerHTML=[['gold',silverPentIcon(16)],['food','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>'],['wood','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-wood"></use></svg>'],['iron','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg>'],['knowledge','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg>']].map(([field,icon])=>`<span class="quick-stat" title="${field}">${icon}<b class="${(['food','wood','iron'].includes(field)?nationalResourceCount(p,field):p[field])<0?'negative':''}">${fmt(['food','wood','iron'].includes(field)?nationalResourceCount(p,field):p[field])}</b></span>`).join('');
 el('economySummary').innerHTML=`<div class="gs-econ-totals"><span>Income <strong>+${e.gold} SP</strong></span><span>Operating costs <strong>−${e.upkeep} SP</strong></span><span>Net / round <strong class="${e.netGold>=0?'positive':'negative'}">${e.netGold>=0?'+':''}${e.netGold} SP</strong></span></div>
  <div class="gs-credit-line"><strong>Credit limit −${CREDIT_LIMIT_SP} SP</strong><span>${p.gold<0?`Borrowed ${-p.gold}/${CREDIT_LIMIT_SP} SP`:'No debt'} · ${p.gold<=-CREDIT_LIMIT_SP?'Spending locked':p.gold<0?'Credit still available':'Credit available if needed'}</span></div>
  <div class="gs-econ-ledger" aria-label="Silver Pents income and upkeep breakdown">
   <strong class="gs-econ-ledger-title">Income per round</strong>
   <span>Occupied family homes (${e.occupiedHomes} × ${HOUSEHOLD_RENT} SP)</span><b class="positive">+${e.householdIncome} SP</b>
   <span>Capital revenue</span><b class="positive">+${e.capitalIncome} SP</b>
   <span>Marketplaces</span><b class="positive">+${e.marketIncome} SP</b>
   <strong class="gs-econ-ledger-title">Expenses per round</strong>
   <span>Farm operations (including wages)</span><b class="negative">−${e.farmUpkeep} SP</b>
   <span>Factory & workshop operations</span><b class="negative">−${e.factoryUpkeep} SP</b>
   <span>Other building operations</span><b class="negative">−${e.otherBuildingUpkeep} SP</b>
   <span>Capital upkeep</span><b class="negative">−${e.capitalUpkeep} SP</b>
   ${e.builderExtraUpkeep?'<span>Additional builder expenses</span><b class="negative">−'+e.builderExtraUpkeep+' SP</b>':''}
   <span>Military upkeep</span><b class="negative">−${e.militaryUpkeep} SP</b>
  </div><p class="gs-econ-explainer">Each occupied household (up to ${HOUSEHOLD_SIZE} residents) pays ${HOUSEHOLD_RENT} Silver Pents per round. Empty homes pay nothing. Wages are part of each building's listed operating cost. You pay whichever is higher: base maintenance or the staff required, not both combined. Builder Bunks cover their builders. Upgrades may increase costs.</p><div class="gs-econ-extra">Employed ${workforceSummary(p).employed} · Available ${workforceSummary(p).available} · Food ${e.netFood>=0?'+':''}${e.netFood}/round</div>${p.gold<=-CREDIT_LIMIT_SP?'<div class="economy-alert"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-warning"></use></svg> Credit limit reached (−10 SP). New construction, research and purchases locked. Sell assets, trade or collect income to recover.</div>':p.gold<0?'<div class="gs-credit-warning">Borrowing Silver Pents: spending cannot exceed the −10 SP credit limit.</div>':''}`;
 el('economySummary').innerHTML+=`<div class="gs-depot-note"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg> Capital warehouse: ${Object.entries(p.warehouse||{}).filter(([k,v])=>v>0).map(([k,v])=>`${v} ${GOOD_NAMES[k]||k}`).join(' · ')||'No crafted goods yet'}</div>`+shippingDashboard();
  el('populationSummary').innerHTML=`<div class="population-stat"><strong>${people.count}</strong><span>Citizens</span></div><div class="population-stat"><strong>${people.housed} / ${people.housing}</strong><span>Housed / Beds</span></div><div class="population-stat ${people.homeless?'population-warning':''}"><strong>${people.homeless}</strong><span>Homeless</span></div><div class="population-stat"><strong>${people.soldiers}</strong><span>Troops</span></div><div class="gs-household-population"><strong>${people.households}</strong> occupied family homes · <strong>+${people.households*HOUSEHOLD_RENT} SP</strong> / round</div>`;
 el('populationAdvice').textContent=people.homeless>0?`${people.homeless} citizens need homes. Build on an owned tile with open space, or expand to make room.`:people.housing<=people.count+2?'Housing is nearly full. Consider additional homes before the next population increase.':'Each round can bring new citizens when Food is available. Homes need building space, and terrain limits residents.';
 renderFalconBadge();
 renderMap();renderTile(tile);renderHand();renderResearch();renderStandings();renderLog();renderRoster();renderTradePanel();renderWarPanel();renderMineralMarket();
 el('buildPanel').classList.toggle('hidden',!showBuild);el('researchPanel').classList.toggle('hidden',!showResearch);
 el('endTurnBtn').disabled=!active();el('levyBtn').disabled=!canAct()||!!p.levyUsed;el('researchBtn').disabled=!active();el('levySheetBtn')?.toggleAttribute('disabled',!canAct()||!!p.levyUsed);
 el('endTurnBtn').innerHTML=G.finished?'TEST COMPLETE':scenePlayback?'ANIMATING…':active()?`END TURN <span>→</span>`:'CPU THINKING…';
 const remaining=actionsRemaining(p);
 el('mapActionCounter').innerHTML=G.finished?'TEST COMPLETE':cpuBusy?'◈ CPU ACTIONS':`<span class="action-dots">${Array.from({length:MAJOR_ACTIONS},(_,i)=>`<i class="${i<remaining?'ready':'spent'}"></i>`).join('')}</span><b>${remaining}/${MAJOR_ACTIONS}</b> ACTIONS LEFT`;
 el('actionNotice').innerHTML=G.finished?'Prototype match complete. Review the results or start another world.':scenePlayback?(scenePlayback.kind==='dispatch'?'Expedition departing…':'Construction in progress…'):cpuBusy?'Three CPU nations are taking their turns…':remaining===0?'All 3 major actions used. You can still play a card or transfer troops.':`<b>${remaining} major action${remaining===1?'':'s'} remaining.</b> Expand, build, market enlistment, govern or research.`;
 el('turnFoot').textContent=p.discountBuild||p.discountExpand?`Active discounts: Build −${p.discountBuild} SP · Expand −${p.discountExpand} SP`:'3 major actions + 1 troop transfer per turn · 1 optional card';
}
function renderTile(t){
 const container=el('territoryDetails');
 if(!t){el('territoryTag').textContent='SELECT A HEX';container.innerHTML='<p class="empty-note">Tap a territory on the map to inspect it.</p>';return;}
 const p=getCountry(),terrain=TERRAIN[t.terrain],owner=t.owner===null?null:G.players[t.owner],isOwn=t.owner===0,frontier=eligibleExpansion(p,t);
 const residents=owner?owner.citizens.filter(c=>c.homeId===t.id).length:0;
 el('territoryTag').textContent=t.capital?'CAPITAL':t.terrain.toUpperCase();if(sheetMode==='territory')el('sheetTitle').textContent=t.name;
 let html=`<div class="tile-head"><div><h3 class="tile-title">${esc(t.name)}</h3><div class="tile-sub">${terrain.name} · ${t.q}, ${t.r}</div></div><span class="owner-pill" style="background:${owner?owner.color:'#c6d8c1'}">${owner?esc(owner.name):'Unclaimed'}</span></div><p class="tile-description">${terrain.desc}</p>`;
 const siege=activeSiege(t.id);
 if(siege){
  const involved=[siege.attacker,siege.defender].includes(0);
  html+=`<div class="gs-tile-siege"><strong>⚔ ${siege.status==='marching'?'ARMY APPROACHING':'UNDER SIEGE'}</strong>
   <small>${esc(G.players[siege.attacker].name)} vs ${esc(G.players[siege.defender].name)} · ${siege.status==='marching'?siege.marchRemaining+' travel ticks remaining':'Round '+(siege.roundNumber+1)+' · Supplies '+siege.supply+' · Defenses '+siege.fort}</small>
   ${involved?'<button data-action="siege-world">Open siege command room</button>':''}</div>`;
 }
 const threats=visibleTerritorialWarnings(t.id);
 if(threats.length&&t.owner===null){
  const senders=threats.map(w=>G.players[w.from]?.name).filter(Boolean);
  html+=`<div class="gs-threat-alert"><strong>⚠ THREATENED TERRITORY</strong>
   <span>${esc(senders.join(', '))} warned against claiming this land. Its border glows red until claimed or the warning is rescinded.</span></div>`;
 }
 html+=`<div class="capacity-grid"><div><b>${buildFree(t)} / ${terrain.slots}</b><small>Building space free</small></div><div><b>${residents} / ${tileResidentCap(t)}</b><small>Residents / available housing</small></div><div><b>${terrain.population}</b><small>Terrain population ceiling</small></div></div><div class="terrain-data">`;
 if(t.capital)html+='<span><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-castle"></use></svg> Capital: 2 spaces + 12 housing</span>';
 if(t.river)html+='<span>〰️ River crossing</span>';
  if(t.terrain==='mountain'){html+='<span><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-stone"></use></svg> Stone obtainable from any staffed Mine</span>';html+=t.vein?`<span><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-mine"></use></svg> ${MINERALS[t.vein.kind].name} · ${t.vein.remaining}/${t.vein.capacity} in vein</span>`:'<span><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-mine"></use></svg> Barren of rare minerals — still provides Stone when mined</span>';if(t.coalVein)html+=`<span><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-coal"></use></svg> Coal (secondary) · ${t.coalVein.remaining}/${t.coalVein.capacity} in vein</span>`;}
 for(const k of Object.keys(terrain.yield))html+=`<span>+${terrain.yield[k]} ${k} / round</span>`;
 html+='</div>';
 if(owner&&tileHousing(t)>0)html+=`<div class="gs-resident-revenue">Occupied family homes: <b>${Math.ceil(Math.min(residents,tileResidentCap(t))/HOUSEHOLD_SIZE)}</b> · <b>+${Math.ceil(Math.min(residents,tileResidentCap(t))/HOUSEHOLD_SIZE)*HOUSEHOLD_RENT} SP/round</b></div>`;
 if(t.buildings?.length){html+='<div class="building-roster"><strong>Buildings & jobs in this hex</strong>';
 t.buildings.forEach((type,i)=>{
  const b=BUILDINGS[type],meta=worksite(t,i),q=owner?workQuality(owner,meta,type):null,occupied=type==='post'&&owner?postGarrison(owner,t.id).length:0;
  const upgrade=upgradePrice(t,i),inProgress=G.projects.some(job=>job.upgradeSiteId===meta?.id);
  html+=`<div class="gs-job-card"><div class="gs-job-head"><strong>${b.icon} ${b.name} · Lvl ${meta?.level||1}</strong><small>${type==='homes'?`${8+4*((meta?.level||1)-1)} housing capacity · no employees required`:type==='builderBunk'?`${meta?.level||1} builder position${(meta?.level||1)===1?'':'s'} · provides specialized builders`:type==='caravanWarehouse'?`${meta?.level||1} caravan berth${(meta?.level||1)===1?'':'s'} · ${owner?worksiteWorkers(owner,meta).filter(c=>c.job?.role==='caravanDriver').length:0}/${meta?.level||1} employed drivers`: `${q?.count||0}/${q?.slots||0} workers · Morale ${q?.count?Math.round(q.morale):'—'}/100`} · ${operatingCost(owner||p,meta,type).total} SP/round operating cost (wages included)${type==='post'?` · ${occupied}/12 troops`:''}</small></div>`;
  const stockList=Object.entries(meta?.stock||{}).filter(([k,v])=>v>0);
  const storageLimit=siteStorageCapacity(type,meta.level),stored=stockUsed(meta);
  if(storageLimit>0)html+=`<div class="gs-storage-gauge"><b>Storage:</b> ${stored}/${storageLimit} units${stored>=storageLimit?' · FULL — production halted until collected':''}<div class="gs-storage-track"><span style="width:${Math.min(100,100*stored/storageLimit)}%"></span></div><small>Higher building levels increase storage capacity.</small></div>`;
  const outgoing=G.shipments.filter(job=>job.owner===p.id&&job.from===meta.id);
  html+=`<div class="gs-site-inventory"><small><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg> On-site: ${stockList.length?stockList.map(([k,v])=>`${v} ${GOOD_NAMES[k]||k}`).join(' · '):'Empty'}${outgoing.length?`<br>On the road: ${outgoing.slice(0,4).map(job=>`${shipmentCargoText(job)} (${job.remaining}T)`).join(' · ')}`:''}</small></div>`;
  if(isOwn&&type==='caravanWarehouse')html+=caravanWarehouseStatus(p,meta.id);
  if(isOwn&&boatLanding(t)&&localCount(meta,'boat')>0)html+=`<button class="action-btn" data-action="launch-boat" data-launch-site="${meta.id}" ${!active()?'disabled':''}>Launch Boat · ${localCount(meta,'boat')} ready <span>Reusable 10-unit water transport</span></button>`;
  if(isOwn&&type==='storageWarehouse'&&stockList.length){
   const targets=routingTargets(p,meta.id);
   html+=`<div class="gs-storage-actions"><strong>Ship stored goods by wagon or worker (when allowed)</strong>${stockList.map(([item,qty])=>`<div class="gs-stock-dispatch"><span>${esc(GOOD_NAMES[item]||item)} ×${qty}</span><select data-storage-send-to="${i}" data-storage-good="${esc(item)}">${targets.map(dst=>`<option value="${dst.id}">${esc(dst.name)}</option>`).join('')}</select><button data-action="dispatch-store" data-index="${i}" data-item="${esc(item)}" ${!active()?'disabled':''}>Ship (10 wagon / 2 worker)</button></div>`).join('')}</div>`;
  }
  if(isOwn&&FACTORY_RECIPES[type])html+=`<label class="gs-routing-label">Manufacture <select data-recipe-site="${i}">${FACTORY_RECIPES[type].map(recipe=>`<option value="${recipe}" ${meta.recipe===recipe?'selected':''}>${RECIPES[recipe].name}</option>`).join('')}</select></label>`;
  if(isOwn&&OUTPUTS[type]?.length){
    const mode=sourceUnloadMode(meta),pending=Object.values(meta.unloadOncePending||{}).reduce((sum,n)=>sum+Math.max(0,n||0),0);
    html+=`<label class="gs-routing-label">Unloading schedule <select data-unload-site="${i}">
     <option value="full" ${mode==='full'?'selected':''}>Unload when full</option>
     <option value="continuous" ${mode==='continuous'?'selected':''}>Continuously unload</option>
     <option value="once" ${mode==='once'?'selected':''}>Unload once</option>
    </select></label><small class="gs-routing-help">${mode==='once'?('One-time unload: '+pending+' units remaining, then returns to Unload when full'):mode==='continuous'?'Unloads available production as soon as transport is available':'Keeps goods on-site until this building is full'}. Same-hex storage transfers instantly without a caravan.</small>`;
    const targets=routingTargets(p,meta.id);
   // Recipe identifiers aren't the same as the cargo keys created by each recipe.
   // Only cargo keys can be dispatched or assigned a delivery route.
   const current=FACTORY_RECIPES[type]?[RECIPES[meta.recipe]?.output].filter(Boolean):OUTPUTS[type].filter(item=>type!=='mine'||item==='stone'||(t.vein?.kind===item)||(t.coalVein?.kind===item));
   for(const item of current){const route=meta.routes?.[item]??'auto';
    html+=`<label class="gs-routing-label"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-caravan"></use></svg> ${GOOD_NAMES[item]||item} destination <select data-route-site="${i}" data-route-good="${item}"><option value="auto" ${route==='auto'?'selected':''}>Automatic · nearest storage</option>${targets.map(target=>`<option value="${target.id}" ${String(route)===String(target.id)?'selected':''}>${esc(target.name)}</option>`).join('')}</select></label>`;}
   if(FACTORY_RECIPES[type])html+='<small class="gs-routing-help">Choose Capital warehouse to send finished goods to your capital. A wagon handles up to 10 units per trip.</small>';
   if(type==='lumber')html+='<small class="gs-routing-help">Logs are your construction resource. Once a caravan delivers them to any Storage Warehouse or the capital, they count toward the national Logs total and can pay construction costs. Woodworks can use those same Logs to craft equipment. Uncollected Logs at a Lumber Camp do not count until delivered.</small>';
  }
  if(isOwn){html+=`<div class="gs-job-controls">${q.slots?`<button data-action="hire-worker" data-index="${i}" ${!active()||q.count>=q.slots||!p.citizens.some(c=>eligibleWorker(c)&&!c.job)?'disabled':''}>Hire</button><button data-action="release-worker" data-index="${i}" ${!active()||!q.count?'disabled':''}>Release</button><button data-action="auto-workers" data-index="${i}" ${!active()?'disabled':''}>Auto ${meta.autoHire?'ON':'OFF'}</button>`:''}`;
   if(upgrade)html+=`<button data-action="upgrade" data-index="${i}" ${!canAct()||!idleBuilders(p).length||inProgress||!hasMoney(p,upgrade.gold)||nationalResourceCount(p,'wood')<upgrade.wood||nationalResourceCount(p,'iron')<upgrade.iron?'disabled':''}>${inProgress?'Upgrading…':`Upgrade L${meta.level+1}: ${upgrade.gold} SP ${upgrade.wood} <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-wood"></use></svg> ${upgrade.iron} <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg>`}</button>`;
   html+=`<button data-action="sell" data-index="${i}" ${!canAct()||occupied>0||inProgress||type==='caravanWarehouse'&&p.caravans.some(c=>String(c.homeSiteId)===String(meta.id)&&c.shipmentId)?'disabled':''}>Sell +${Math.max(2,Math.floor(b.gold*.6))} SP</button></div>`;
  }
  html+='</div>';
 });html+='</div>';}

 const jobs=(G.projects||[]).filter(j=>j.tileId===t.id);
 if(jobs.length){html+='<div class="building-roster"><strong><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-construction"></use></svg> Under construction</strong>'+jobs.map(j=>{
  const assigned=assignedBuilders(G.players[j.owner],j.id),enRoute=assigned.filter(c=>c.builder.travelRemaining>0).length;
  const extra=isOwn&&idleBuilders(p).length?`<button data-action="add-builder" data-job="${j.id}"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-plus"></use></svg> Assign another builder</button>`:'';
  return `<div class="building-row"><span>${BUILDINGS[j.type].icon} ${BUILDINGS[j.type].name}<small>${j.remaining} work turns left · ${assigned.length} builder${assigned.length===1?'':'s'} (${enRoute} en route) · ${j.upgradeSiteId?'upgrading existing building':BUILDINGS[j.type].space+' space reserved'}</small></span>${extra}</div>`;
 }).join('')+'</div>';}
 if(isOwn){
   const b=buildersSummary(p),exp=(p.expeditions||[])[0],members=(exp?.citizenIds||[]).map(cid=>p.citizens.find(c=>c.id===cid)?.name).filter(Boolean);
   html+=`<div class="gs-crew-status"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-builder"></use></svg> Builders: ${b.free}/${b.total} available (capacity ${b.capacity}) · <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-compass"></use></svg> Civilian expedition: ${exp?.targetId?'traveling ('+exp.remaining+' turns · '+(members.length?esc(members.join(' and ')):'previous-version expedition')+')':'ready for 1–2 civilians'}</div>`;
  }

 html+='<div class="tile-actions">';
  if(frontier){
   const cost=expansionCost(p),afford=hasMoney(p,cost)&&nationalResourceCount(p,'food')>=2,available=eligibleExpeditionCitizens(p);
   const candidates=available.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · age ${c.age} · morale ${c.morale} · health ${c.health}</option>`).join('');
   html+=`<div class="gs-expedition-selector"><strong>Choose your expedition's citizens</strong>
    <small>Send 1 or 2 unemployed civilians aged 16 or older. Soldiers, builders, employees and haulers cannot go. Travel may lower morale and health.</small>
    <label>First citizen (required)<select data-expedition-citizen="0"><option value="">Choose an eligible citizen…</option>${candidates}</select></label>
    <label>Second citizen (optional)<select data-expedition-citizen="1"><option value="">No second explorer</option>${candidates}</select></label>
    <button class="action-btn primary-action" data-action="expand" data-expedition-affordable="${afford?'yes':'no'}" disabled>Send selected citizens <span>${cost} SP + 2 <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg> · travel required</span></button>
   </div>`;
   if(!available.length)html+='<div class="disabled-help">No unemployed citizens aged 16+ are available. Release an employee, finish a haul, or wait for more citizens.</div>';
   if(!afford)html+='<div class="disabled-help">Not enough Silver Pents or Food to expand.</div>';
  }
  else if(t.owner===null&&pendingClaim(t.id)){
   const exp=expeditionForTile(t.id),nation=G.players[exp.owner];
   const names=(exp.citizenIds||[]).map(cid=>nation.citizens.find(c=>c.id===cid)?.name).filter(Boolean);
   html+=`<div class="feature-locked"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-compass"></use></svg> ${esc(nation.name)} expedition approaching · ${exp.remaining} turn${exp.remaining===1?'':'s'} remaining${names.length?' · Exploring: '+esc(names.join(' and ')):''}</div>`;
  }
 else if(t.owner===null&&t.terrain==='water'){html+='<div class="feature-locked"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-water"></use></svg> Lakes cannot currently be claimed or built upon.</div>';}
 else if(t.owner===null){
   const busy=!!(p.expeditions||[]).some(e=>e.targetId),border=neighbors(t).some(n=>n.owner===p.id);
   html+='<p class="empty-note">'+(busy&&border?'Your civilian expedition is underway. Wait until it returns before sending another.':'Expand from your own border to reach this territory.')+'</p>';
  }
 else if(isOwn){
  if(t.capital&&boatLanding(t)&&depotCount(p,'boat')>0)html+=`<button class="action-btn" data-action="launch-boat" data-launch-site="depot" ${!active()?'disabled':''}>Launch Boat from Capital · ${depotCount(p,'boat')} ready</button>`;
  const docked=(p.boats||[]).filter(boat=>boat.currentTileId===t.id);
  if(docked.length)html+=`<div class="gs-crew-status">⛵ ${docked.length} boat${docked.length===1?'':'s'} here · ${docked.filter(b=>!b.shipmentId).length} available · 10 items each</div>`;
  const adjacentOwned=neighbors(t).filter(n=>n.owner===0&&n.terrain!=='water');
  if(adjacentOwned.length){
   html+='<div class="gs-local-road-list"><strong>Domestic roads · Faster internal travel</strong><small>Pave the shared border for 3 SP + 1 Log. Requires an idle builder, travel time, and 2 construction turns. Completed roads speed up caravans, builders, expeditions and soldiers.</small>';
   for(const n of adjacentOwned){const paved=domesticRoadExists(t,n),job=roadJobBetween(t,n),afford=canStartDomesticRoad(t,n,0);
    html+=`<div class="gs-local-road-row"><span>${esc(n.name)} <small>${paved?'Paved road operational':job?'Crew constructing · '+job.remaining+'T work left':'Unpaved border'}</small></span>${!paved&&!job?`<button data-action="domestic-road" data-road-neighbor="${esc(n.id)}" ${!canAct()||!afford?'disabled':''}>Build road · 3 SP</button>`:''}</div>`;
   }
   html+='</div>';
  }
  const crossingBanks=[...neighbors(t).filter(n=>n.owner===0&&riverCrossing(t,n)),...G.tiles.filter(n=>n.owner===0&&n.id!==t.id&&lakeBridgeSpan(t,n))];
  if(crossingBanks.length){
   html+='<div class="gs-local-road-list"><strong>Bridges · Cross water</strong><small>Craft Bridge Kits at Woodworks and deliver them to storage. A builder uses 1 kit and 2 SP for a bridge over a river border or a one-hex lake gap. Caravans cannot cross until the bridge is completed.</small>';
   for(const n of crossingBanks){
    const finished=bridgeExistsBetween(t,n),job=bridgeJobBetween(t,n),allowed=canStartBridge(t,n,0);
    html+=`<div class="gs-local-road-row"><span>${esc(n.name)} <small>${crossingType(t,n)==='lake'?'Lake span':'River border'} · ${finished?'Bridge open':job?'Under construction · '+job.remaining+'T':'No bridge'}</small></span>${!finished&&!job?`<button data-action="bridge" data-bridge-neighbor="${esc(n.id)}" ${!active()||!allowed?'disabled':''}>Build bridge · 1 kit + 2 SP</button>`:''}</div>`;
   }
   html+='</div>';
  }
  if(buildFree(t)>0)html+=`<button class="action-btn primary-action" data-action="open-build" ${!canAct()?'disabled':''}>Construct building <span>${buildFree(t)} space available →</span></button>`;
  else html+='<div class="feature-locked"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-homes"></use></svg> This hex is full. Expand into another territory for more construction space.</div>';
  if(buildingCount(t,'post')){
   const count=postGarrison(p,t.id).length,available=p.citizens.filter(c=>c.age>=18&&!c.military).length;
   html+=`<div class="post-actions"><strong><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-shield"></use></svg> Military post · ${count}/12 stationed</strong><button class="action-btn" data-action="recruit" ${!canAct()||count>=12||!available||!hasMoney(p,4)?'disabled':''}>Recruitment marketing <span>4 SP · 2 rounds boost</span></button><button class="action-btn" data-action="train" ${!canAct()||!count||!hasMoney(p,3)||nationalResourceCount(p,'food')<1?'disabled':''}>Train up to 3 troops <span>3 SP + 1 <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg></span></button></div>`;
  }
  if(!idleBuilders(p).length)html+='<div class="disabled-help"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-builder"></use></svg> All builders are assigned. Finish a project or upgrade/build another Builders’ Bunk.</div>';
   if(peopleSummary(p).homeless>0)html+='<div class="disabled-help"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg> Build Homes here if space allows. Each adds 8 housing spaces, up to the terrain population ceiling.</div>';
 }else{html+='<div class="feature-locked"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-sword"></use></svg> Warfare and reconnaissance arrive in a later version.</div>';}
 html+='</div>';container.innerHTML=html;
 if(showBuild){if(!isOwn||buildFree(t)<=0){showBuild=false;el('buildPanel').classList.add('hidden');}else renderBuildOptions(t);}
}
function renderBuildOptions(t){
 const p=getCountry();el('buildOptions').innerHTML=Object.entries(BUILDINGS).filter(([k,b])=>b.allow.includes(t.terrain)).map(([k,b])=>`<button class="build-option" data-build="${k}" ${!canAct()||!canBuild(p,t,b)?'disabled':''}><span class="build-symbol">${b.icon}</span><span class="build-main"><span class="build-name">${b.name}</span><span class="build-desc" style="display:block">${b.text} · ${b.space} space · ${Math.max(2,b.rounds*2)} work turns + builder travel · −${b.upkeep} Silver Pents upkeep</span></span><span class="build-cost">${buildingCost(p,b)} SP<br>${b.wood} <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-wood"></use></svg> · ${b.iron} <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg></span></button>`).join('');
}

function warEquipmentControls(p,c){
 const labels={helmet:'Helmet',chest:'Chest / Chain Plate',weapon:'Weapon',shield:'Shield'};
 const stock=postStock(p,c.military.postId),disable=!canAct()||!!c.military.missionId;
 let html='<div class="gs-war-loadout"><small>Skill '+warSkill(c)+'/100 · Accuracy '+
  Math.round(Math.max(.18,Math.min(.94,.26+warSkill(c)*.0067))*100)+'% · Attack speed '+
  warAttackSpeed(c).toFixed(2)+'/s · Damage mitigation '+Math.round(warDefense(c)*100)+'%</small>';
 for(const slot of ['helmet','chest','weapon','shield']){
  const current=c.military[slot],items=WAR_SLOT_ITEMS[slot]||[];
  html+='<label class="roster-transfer">'+labels[slot]+': <b>'+
   esc(current?GOOD_NAMES[current]||current:'None')+'</b><select data-equip-war="'+esc(c.id)+'" data-war-slot="'+slot+'" '+(disable?'disabled':'')+'>'+
   '<option value="">Choose delivered equipment...</option>'+
   items.map(item=>'<option value="'+item+'" '+(!canEquipWarItem(p,c,item)?'disabled':'')+'>'+
    esc(GOOD_NAMES[item]||item)+' · '+(stock?localCount(stock,item):0)+' at post</option>').join('')+
   '</select></label>';
 }
 return html+'</div>';
}
function renderRoster(){
 const p=getCountry(),posts=getMilitaryPosts(0),troops=p.citizens.filter(c=>!!c.military);
 el('rosterCitizensBtn').classList.toggle('active',rosterTab==='citizens');
 el('rosterTroopsBtn').classList.toggle('active',rosterTab==='troops');
 el('rosterCount').textContent=rosterTab==='citizens'?`${p.citizens.length} LIVING · ${p.deathCount||0} DEATHS`:`${troops.length} TROOPS`;
 if(rosterTab==='citizens'){
  el('rosterList').innerHTML=`<p class="gs-citizen-health-note">Poor morale reduces health over time; age, health and morale all influence the chance of death each round. Worker hauling causes fatigue; resting citizens can recover.</p>${(p.recentDeaths||[]).length?'<p class="gs-recent-deaths"><strong>Recent passings:</strong> '+p.recentDeaths.slice(0,3).map(d=>esc(d.name)+' (age '+d.age+', R'+d.round+')').join(' · ')+'</p>':''}<div class="roster-head">Citizen <span>Age · Residence · Role</span></div>`+p.citizens.map(c=>{
   const home=c.homeId?G.tiles.find(t=>t.id===c.homeId)?.name||'Unknown':'Homeless';
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>${c.age} years · Health ${c.health}/100 · Morale ${c.morale}/100 · Mortality ${(100*citizenDeathProbability(c)).toFixed(2)}%/round · ${esc(home)}${c.military?' · Soldier'+(c.military.missionId?.startsWith('siege-')?' (on siege deployment)':''):c.builder?' · Builder'+(c.builder.projectId?' (on assignment)':' (available)'):isBusyExpedition(c)?' · On civilian expedition':isBusyPorter(c)?' · Hand-hauling '+esc((G.shipments||[]).find(j=>j.kind==='porter'&&j.porterId===c.id)?.item||'resources'):c.job?' · '+(c.job.role==='caravanDriver'?('Caravan Driver'+((p.caravans||[]).find(cart=>cart.id===c.job.caravanId)?.shipmentId?' (on delivery)':' (on standby)')):'Employed: '+esc((()=>{const t=G.tiles.find(t=>t.id===c.job.tileId),idx=t?.buildingMeta?.findIndex(m=>m.id===c.job.siteId);return idx>=0?BUILDINGS[t.buildings[idx]].name:'Workplace';})())):' · Unemployed'}</small></div>`;
  }).join('');
 }else{
  el('rosterList').innerHTML=troops.length?`<p class="roster-instructions">Transfer one soldier between your posts each turn, even after using your main action.</p>`+troops.map(c=>{
   const post=G.tiles.find(t=>t.id===c.military.postId);
   const choices=posts.filter(t=>t.id!==c.military.postId&&postGarrison(p,t.id).length<12);
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>Age ${c.age} · Health ${c.health} · Training ${c.military.training}/5 · Armor: ${c.military.gear?GEAR[c.military.gear].name:'Unarmored'} (readiness ${gearReadiness(c)}) · ${c.military.shield?GOOD_NAMES[c.military.shield]:'No Shield'} · ${c.military.weapon?GOOD_NAMES[c.military.weapon]:'No Weapon'} · ${c.military.perk||'No perk'}<br>Stationed: ${esc(post?.name||'Unassigned')} · Experience ${c.military.experience||0}${c.military.missionId?.startsWith('siege-')?' · ⚔ ON SIEGE DUTY':c.military.missionId?' · On military assignment':''}</small>${`<label class="roster-transfer">Equip <select data-equip-soldier="${esc(c.id)}" ${!canAct()||c.military.missionId?'disabled':''}><option value="">Select gear…</option>${GEAR_ORDER.map(tier=>`<option value="${tier}" ${!canEquip(p,c,tier)?'disabled':''}>${GEAR[tier].name} · 1 ${GEAR[tier].name} delivered</option>`).join('')}</select></label>`}${`<label class="roster-transfer">Issue Shield / Stone Weapon <select data-equip-extra="${esc(c.id)}" ${!canAct()||c.military.missionId?'disabled':''}><option value="">Select delivered gear…</option>${['woodShield','stoneAxe','stonePickaxe','stoneSword','stoneClub'].map(item=>`<option value="${item}" ${!postStock(p,c.military.postId)||localCount(postStock(p,c.military.postId),item)<1?'disabled':''}>${GOOD_NAMES[item]} · ${localCount(postStock(p,c.military.postId),item)} at post</option>`).join('')}</select></label>`}${choices.length?`<label class="roster-transfer">Transfer to <select data-move-soldier="${esc(c.id)}" ${!active()||p.logisticsUsed?'disabled':''}><option value="">Choose post…</option>${choices.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>`:''}</div>`;
  }).join(''):`<p class="empty-note">No troops enlisted yet. Build a Military Post, then eligible adults can volunteer each round. Run a marketing campaign to increase interest.</p>`;
 }
 if(rosterTab==='troops'){
  [...el('rosterList').querySelectorAll('.roster-row')].forEach((row,i)=>{
   const c=troops[i];if(c)row.insertAdjacentHTML('beforeend',warEquipmentControls(p,c));
  });
 }
}
function renderResearch(){const p=getCountry();el('researchOptions').innerHTML=Object.entries(TECHS).map(([k,t])=>`<button class="build-option" data-tech="${k}" ${!canAct()||p.tech.includes(k)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge?'disabled':''}><span class="build-symbol">${t.icon}</span><span class="build-main"><span class="build-name">${t.name} ${p.tech.includes(k)?'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-check"></use></svg>':''}</span><span class="build-desc" style="display:block">${t.desc}</span></span><span class="build-cost">${t.gold} SP<br>${t.knowledge} <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg></span></button>`).join('');}
function renderHand(){
 const p=getCountry(),n=p.hand.length;el('cardCount').textContent=cpuBusy?'YOUR HAND':`${n} / 4`;
 if(cpuBusy){
  el('hand').innerHTML=`<div class="gs-watching-hand"><span class="gs-watching-title">YOUR CARDS</span>${p.hand.map(c=>`<span class="gs-watching-name">${esc(CARDS[c].name)}</span>`).join('')}</div>`;
  const cpu=G.players[G.turnIndex],deck=el('opponentDeck');
  if(deck&&cpu){deck.classList.remove('hidden');deck.style.setProperty('--cpu-color',cpu.color);deck.innerHTML=`<span>${esc(cpu.name)} · ${cpu.hand.length} cards</span><div class="gs-deck-backs">${cpu.hand.map((_,i)=>`<div class="gs-card-back" style="--position:${i}"><b>GS <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg></b></div>`).join('')}</div>`;}
  return;
 }
 el('opponentDeck')?.classList.add('hidden');
 const handEffects={grant:'Gain 6 SP',harvest:'Gain 5 Food',supplies:'+3 Logs · +2 Iron',insight:'Gain 3 Knowledge',charter:'Next claim −3 SP',permit:'Next build −3 SP'};
 el('hand').innerHTML=p.hand.map((c,i)=>{
  const fan=i-(n-1)/2,angle=fan*9;
  return `<button type="button" class="card-item" data-card="${i}" style="--fan:${fan};--angle:${angle}deg" aria-label="Enlarge ${esc(CARDS[c].name)} — ${esc(CARDS[c].desc)}"><span class="card-icon">${CARDS[c].icon}</span><span class="card-name">${esc(CARDS[c].name)}</span><span class="card-desc">${esc(handEffects[c]||CARDS[c].desc)}</span></button>`;
 }).join('')||'<p class="hand-empty">No cards in hand. Draw again next turn.</p>';
}
function renderStandings(){
 const sorted=[...G.players].sort((a,b)=>prosperity(b)-prosperity(a));
 el('standings').innerHTML=sorted.map((p,i)=>{
  const mind=p.id>0?cpuPersonality(p):null;
  return `<div class="standing"><span class="standing-rank">${i+1}</span><span class="standing-color" style="background:${p.color}"></span><span class="standing-name"><strong>${esc(p.name)}${p.id===0?' (You)':''}</strong><small>${G.tiles.filter(t=>t.owner===p.id).length} territory · ${G.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+(t.buildings||[]).length,0)} builds · ${fmt(p.gold)} SP</small>${mind?`<small title="${esc(mind.description)}">AI: ${esc(mind.name)} · ${esc(mind.focus)}</small>`:''}</span><span class="standing-score">${prosperity(p)}</span></div>`;
 }).join('');
}
function renderLog(){el('gameLog').innerHTML=G.log.slice(0,10).map(l=>`<div class="log-item"><span class="log-round">R${l.round}</span><span>${esc(l.text)}</span></div>`).join('');}
// Global Standoff: lightweight 2.5D board. All illustrations are vector primitives,
// rendered without third-party libraries or large image downloads.
const coords=t=>({x:HEX*Math.sqrt(3)*(t.q+t.r/2),y:HEX*1.5*t.r});
const VIEW_TILT=.68;
const POV_ANGLES=[-.24,.36,.92,1.48];
// All camera views project the same world drawing; never redraw structures in
// a new screen-facing arrangement at the end of a camera rotation.
const WORLD_SCENE_YAW=POV_ANGLES[0];
const smooth=t=>t*t*(3-2*t);
const blend=(a,b,t)=>a+(b-a)*t;
let cameraYaw=POV_ANGLES[0],cameraMoveFrame=0,cameraResolve=null,cpuPlaybackToken=0,skipCpuPlayback=false,actionTileId=null,actionKind='';
let boardBaseYaw=WORLD_SCENE_YAW,boardBillboards=[],boardWorldStructures=[],boardFootprints=[],boardWagons=[],boardTerrainFaces=[],lastTerrainExtrusionYaw=NaN,lastWorldDepthYaw=NaN;
const wagonMotionSeen=new Set();
function billboardSvg(x,y,contents,alwaysUpdate=false){return `<g data-gs-billboard="1" ${alwaysUpdate?'data-gs-always-update="1" ':''}data-anchor-x="${x.toFixed(2)}" data-anchor-y="${y.toFixed(2)}">${contents}</g>`;}
// Facades stay attached to the world, rather than being repainted to face
// every new player camera angle. Their upright silhouettes turn continuously.
function worldStructureSvg(x,y,contents){return `<g data-gs-world-structure="1" data-anchor-x="${x.toFixed(2)}" data-anchor-y="${y.toFixed(2)}">${contents}</g>`;}
function physicalTileOffset(tile,dx,dy){
 const origin=coords(tile),offset=unprojectScreen(dx,dy,WORLD_SCENE_YAW);
 return project(origin.x+offset.x,origin.y+offset.y);
}
// The hex top turns with the world, but its thickness always extrudes down
// on screen. Invert the camera transform for the vertical thickness and
// reselect the front-facing walls continuously, without replacing any nodes.
function hexExtrusionGeometry(top,center,height,delta){
 const co=Math.cos(delta),sn=Math.sin(delta);
 const vx=sn/VIEW_TILT*height,vy=co*height;
 const bottom=top.map(p=>({x:p.x+vx,y:p.y+vy}));
 const sides=['',''];
 for(let i=0;i<6;i++){
  const a=top[i],b=top[(i+1)%6],lowA=bottom[i],lowB=bottom[(i+1)%6];
  const facing=VIEW_TILT*sn*((a.x+b.x)/2-center.x)+co*((a.y+b.y)/2-center.y);
  if(facing<=.0001)continue;
  sides[i%2]+=`M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}L${lowB.x.toFixed(2)} ${lowB.y.toFixed(2)}L${lowA.x.toFixed(2)} ${lowA.y.toFixed(2)}Z`;
 }
 return {bottom:pts(bottom),sides};
}
function updateTerrainExtrusions(){
 const delta=cameraYaw-WORLD_SCENE_YAW;
 for(const plane of boardTerrainFaces){
  const geo=hexExtrusionGeometry(plane.top,plane.center,plane.height,delta);
  plane.shadow.setAttribute('points',geo.bottom);
  plane.side0.setAttribute('d',geo.sides[0]);
  plane.side1.setAttribute('d',geo.sides[1]);
 }
}
// The plane rotates in camera yaw. These screen-facing sprites counter-rotate
// around their original anchor; flags, houses and labels always remain upright.
function syncBoardRotation(){
 const map=el('mapContent');if(!map)return;
 const d=cameraYaw-boardBaseYaw,co=Math.cos(d),sn=Math.sin(d),b=VIEW_TILT*sn,c=-sn/VIEW_TILT;
 map.setAttribute('transform',`matrix(${co.toFixed(7)} ${b.toFixed(7)} ${c.toFixed(7)} ${co.toFixed(7)} 0 0)`);
 if(!Number.isFinite(lastTerrainExtrusionYaw)||Math.abs(cameraYaw-lastTerrainExtrusionYaw)>.0001){
  updateTerrainExtrusions();lastTerrainExtrusionYaw=cameraYaw;
 }
 const ib=-b,ic=-c;
 for(const {node,x,y} of boardBillboards){
  const px=co*x+c*y,py=b*x+co*y;
  // Billboard culling: far-offscreen 3D scenery need not update every frame.
  if(!node.dataset.gsAlwaysUpdate&&(px<view.x-190||px>view.x+view.w+190||py<view.y-190||py>view.y+view.h+190))continue;
  const tx=x-(co*x+ic*y),ty=y-(ib*x+co*y);
  node.setAttribute('transform',`matrix(${co.toFixed(7)} ${ib.toFixed(7)} ${ic.toFixed(7)} ${co.toFixed(7)} ${tx.toFixed(3)} ${ty.toFixed(3)})`);
 }
 // Reorient the stepping trail when the viewpoint changes so it still points
 // from the expedition origin toward its destination.
 for(const f of boardFootprints){
  const heading=project(f.dx,f.dy,cameraYaw);
  const degrees=Math.atan2(heading.y,heading.x)*180/Math.PI-f.baseHeading;
  f.node.setAttribute('transform',`rotate(${degrees.toFixed(2)} ${f.x.toFixed(1)} ${f.y.toFixed(1)})`);
 }
 // Static structures retain their world orientation and are foreshortened
 // continuously as the camera turns, without changing positions at the end.
 const yawRelative=cameraYaw-WORLD_SCENE_YAW;
 const facade=Math.cos(yawRelative),profile=.84+.16*Math.abs(facade);
 for(const {node,x,y} of boardWorldStructures){
  const shear=Math.sin(yawRelative)*.10;
  node.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) matrix(${profile.toFixed(5)} 0 ${shear.toFixed(5)} 1 0 0) translate(${(-x).toFixed(2)} ${(-y).toFixed(2)})`);
  node.dataset.facing=facade<-.06?'rear':facade<.27?'side':'front';
 }
 // Wagons are screen-facing while their directional view follows the physical
 // road heading; changing a camera angle never requires replacing the SVG map.
 for(const w of boardWagons){
  const heading=project(w.dx,w.dy,cameraYaw);
  const view=Math.abs(heading.y)>Math.abs(heading.x)*.72?(heading.y>0?'front':'rear'):'side';
  w.node.dataset.view=view;
  w.node.dataset.side=heading.x<0?'left':'right';
 }
 if(!Number.isFinite(lastWorldDepthYaw)||Math.abs(cameraYaw-lastWorldDepthYaw)>.025){
  sortWorldDepth();lastWorldDepthYaw=cameraYaw;
 }
}
// Depth-test world scenery frequently enough for buildings to pass in front
// of / behind one another at the actual crossing point, not several degrees
// after it. This reorders existing DOM nodes and never recreates their art.
// Sort all visible sprite feet (terrain, structures and caravans), preserving
// the existing vectors, without rebuilding the hexagon map.
function sortWorldDepth(){
 const parent=el('gsWorldDepth');if(!parent)return;
 const delta=cameraYaw-boardBaseYaw,si=Math.sin(delta),co=Math.cos(delta);
 const nodes=Array.from(parent.children);
 const depth=node=>VIEW_TILT*si*Number(node.dataset.depthX)+co*Number(node.dataset.depthY);
 nodes.sort((a,b)=>{const dy=depth(a)-depth(b);return Math.abs(dy)>.02?dy:Number(a.dataset.depthOrder)-Number(b.dataset.depthOrder);});
 if(nodes.some((n,i)=>n!==parent.children[i]))parent.replaceChildren(...nodes);
 // The front row of raised tiles must occlude the back row at any camera yaw.
 const ground=el('gsWorldTerrain');
 if(ground){
  const tiles=Array.from(ground.children);
  tiles.sort((a,b)=>{const d=depth(a)-depth(b);return Math.abs(d)>.02?d:Number(a.dataset.depthOrder)-Number(b.dataset.depthOrder);});
  if(tiles.some((node,i)=>node!==ground.children[i]))ground.replaceChildren(...tiles);
 }
}
function unprojectScreen(x,y,yaw){const co=Math.cos(yaw),sn=Math.sin(yaw),fy=y/VIEW_TILT;return {x:x*co+fy*sn,y:-x*sn+fy*co};}

const project=(x,y,yaw=cameraYaw)=>({x:x*Math.cos(yaw)-y*Math.sin(yaw),y:(x*Math.sin(yaw)+y*Math.cos(yaw))*VIEW_TILT});
const sceneCoords=(tile,yaw=cameraYaw)=>{const c=coords(tile);return project(c.x,c.y,yaw);};
function hexPoints(tile,r=HEX-1,yaw=cameraYaw){
 const center=coords(tile);return Array.from({length:6},(_,i)=>{
  const a=Math.PI/3*i+Math.PI/6;
  return project(center.x+r*Math.cos(a),center.y+r*Math.sin(a),yaw);
 });
}
const pts=points=>points.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
function treeSprite(x,y,h=24,shade=0){
 const trunk='#75543b',left=['#346e53','#28624b','#2b7258'][shade%3],right=['#4b9470','#448763','#428768'][shade%3];
 return `<g class="map-sprite" pointer-events="none"><ellipse cx="${x}" cy="${y+2}" rx="11" ry="4.8" fill="#172b29" opacity=".19"/><path d="M${x-2} ${y+2}v-11h4v11z" fill="${trunk}"/><path d="M${x} ${y-h}L${x-12} ${y-8}L${x} ${y-4}Z" fill="${left}"/><path d="M${x} ${y-h}L${x+12} ${y-8}L${x} ${y-4}Z" fill="${right}"/><path d="M${x} ${y-h+6}L${x-9} ${y-15}L${x} ${y-11}Z" fill="#548d66" opacity=".8"/></g>`;
}
function mountainSprite(x,y,w=25,h=35){
 return `<g pointer-events="none" class="map-sprite"><ellipse cx="${x}" cy="${y+3}" rx="${w*.92}" ry="6" fill="#27362f" opacity=".23"/><path d="M${x-w} ${y+4}L${x+1} ${y-h}L${x+w} ${y+4}Z" fill="#967c69"/><path d="M${x+1} ${y-h}L${x+w} ${y+4}L${x} ${y+4}Z" fill="#b1a08a"/><path d="M${x+1} ${y-h}l-${w*.34} ${h*.34}l${w*.38} -${h*.08}l${w*.22} ${h*.12}l${w*.21} -${h*.16}Z" fill="#f2e2c4"/></g>`;
}
function terrainSprites(t,x,y){
 const seed=hash(G.seed+'-'+t.id),k=(seed%7)-3;
 switch(t.terrain){
  case'forest':return treeSprite(x-13,y+3,32,seed%3)+treeSprite(x+12,y+6,29,(seed+1)%3)+treeSprite(x+1,y-4,39,(seed+2)%3);
  case'mountain':return mountainSprite(x-10,y+5,25,37)+mountainSprite(x+14,y+4,21,29);
  case'hills':return `<g class="map-sprite" pointer-events="none"><ellipse cx="${x-8}" cy="${y+1}" rx="23" ry="10" fill="#987a5b"/><path d="M${x-30} ${y+4}Q${x-18} ${y-21} ${x-3} ${y-1}Q${x+17} ${y-21} ${x+28} ${y+5}" fill="#bd9e74" stroke="#ddc39b" stroke-width="1.5"/><ellipse cx="${x+7}" cy="${y+5}" rx="10" ry="3" fill="#9b865f"/></g>`+treeSprite(x+20,y+5,21,seed%3);
  case'desert':return `<g class="map-sprite" pointer-events="none"><path d="M${x-28} ${y+10}Q${x-5} ${y-8} ${x+9} ${y+4}T${x+27} ${y+9}" fill="none" stroke="#f4d49b" stroke-width="3.5"/><path d="M${x-22} ${y+3}Q${x+4} ${y-13} ${x+23} ${y+3}" fill="none" stroke="#ca9867" stroke-width="2"/><circle cx="${x+k*2}" cy="${y+3}" r="1.9" fill="#b88a5e"/></g>`;
  case'water':return `<g pointer-events="none" stroke="#b9e8eb" stroke-width="2" stroke-linecap="round" opacity=".68" fill="none"><path d="M${x-20} ${y-4}q8 -5 16 0t16 0"/><path d="M${x-12} ${y+6}q8 -5 16 0t14 0"/></g>`;
  default:return `<g pointer-events="none"><path d="M${x-21} ${y+7}q8 -8 19 -2t21 -3" fill="none" stroke="#e4d88a" stroke-width="2" opacity=".78"/><ellipse cx="${x-15}" cy="${y-4}" rx="3" ry="2" fill="#89ae6a"/><circle cx="${x+18}" cy="${y+7}" r="2" fill="#f2df9b"/></g>`;
 }
}
function hutSprite(x,y,roof='#b96e53',w=20,h=16){
 return `<g class="map-sprite" pointer-events="none"><ellipse cx="${x}" cy="${y+2}" rx="${w*.72}" ry="5" fill="#233a30" opacity=".25"/><path d="M${x-w/2} ${y-h+5}L${x} ${y-h+10}L${x} ${y+2}L${x-w/2} ${y-3}Z" fill="#bea883"/><path d="M${x} ${y-h+10}L${x+w/2} ${y-h+5}L${x+w/2} ${y-3}L${x} ${y+2}Z" fill="#f1dfb7"/><path d="M${x-w/2-3} ${y-h+5}L${x} ${y-h-7}L${x} ${y-h+10}Z" fill="#915a48"/><path d="M${x} ${y-h-7}L${x+w/2+3} ${y-h+5}L${x} ${y-h+10}Z" fill="${roof}"/><path d="M${x+2} ${y-3}v-7h5v7" fill="#796650"/></g>`;
}
function buildingSprite(type,x,y,color){
 if(type==='storageWarehouse')return `<g pointer-events="none" class="map-sprite"><ellipse cx="${x}" cy="${y+10}" rx="25" ry="7" fill="#1b2b2c" opacity=".25"/><path d="M${x-23} ${y-14}h46v25h-46Z" fill="#dbc8a4" stroke="#695a49" stroke-width="2"/><path d="M${x-28} ${y-14}l28 -20 28 20Z" fill="#916d56" stroke="#5a4640" stroke-width="2"/><rect x="${x-14}" y="${y-5}" width="28" height="16" fill="#9b7957" stroke="#e3cda4" stroke-width="2"/><path d="M${x-16} ${y+3}h32m-16 -8v16" stroke="#69523e" stroke-width="2.5"/><rect x="${x-23}" y="${y-24}" width="9" height="9" fill="${color}"/></g>`;
 if(type==='homes')return hutSprite(x-5,y+4,'#ae7154',16,15)+hutSprite(x+9,y-2,'#d9a16d',14,13);
 if(type==='farm')return `<g pointer-events="none" class="map-sprite"><path d="M${x-22} ${y+9}l20 -9 23 8 -20 10z" fill="#c3a265" stroke="#9f8151" stroke-width="1.2"/><path d="M${x-15} ${y+8}l15 -7m-7 12l16 -8m-17 4l15 -7" stroke="#f2d277" stroke-width="2"/></g>`+hutSprite(x+8,y-7,'#c66647',16,15);
 if(type==='lumber')return treeSprite(x-8,y,27,1)+hutSprite(x+8,y+5,'#8c6951',15,12)+`<path d="M${x-20} ${y+11}h18m-17 4h16" stroke="#9e6d41" stroke-width="4" pointer-events="none"/>`;
 if(type==='mine')return mountainSprite(x,y+5,24,28)+`<g pointer-events="none"><path d="M${x-12} ${y+8}v-11q12 -12 24 0v11z" fill="#383e43" stroke="#d5b077" stroke-width="2.2"/></g>`;
 if(type==='builderBunk')return `<g class="map-sprite" pointer-events="none"><rect x="${x-20}" y="${y-12}" width="40" height="22" rx="3" fill="#c8a778"/><path d="M${x-25} ${y-12}l25 -19 25 19Z" fill="#8f684c"/><use href="#gs-i-builder" x="${x-7}" y="${y-5}" width="14" height="14"/></g>`;
 if(type==='post')return `<g pointer-events="none" class="map-sprite"><ellipse cx="${x}" cy="${y+7}" rx="22" ry="7" fill="#26372f" opacity=".2"/><path d="M${x-22} ${y+8}v-15l8 -4v17m28 -1v-16l8 4v15" fill="none" stroke="#82643f" stroke-width="4" stroke-dasharray="3 2"/><path d="M${x-16} ${y+6}l16 -21 16 21z" fill="#f3dbc0" stroke="#94695c"/><path d="M${x} ${y-15}l16 21H${x}Z" fill="#d78365"/><path d="M${x} ${y-15}v-19m1 0h18l-4 8H${x+1}Z" fill="${color}" stroke="#775343" stroke-width="1"/></g>`;
 if(type==='academy')return `<g pointer-events="none" class="map-sprite"><ellipse cx="${x}" cy="${y+5}" rx="22" ry="6" fill="#22352d" opacity=".25"/><path d="M${x-20} ${y+4}v-19h40v19Z" fill="#ead6b2"/><path d="M${x-24} ${y-15}l24 -17 24 17Z" fill="#6f90a2"/><path d="M${x-13} ${y-14}v18m13 -18v18m13 -18v18" stroke="#7d8b8a" stroke-width="4"/></g>`;
 if(type==='foundry')return `<g class="map-sprite" pointer-events="none"><ellipse cx="${x}" cy="${y+6}" rx="23" ry="7" fill="#233431" opacity=".26"/><path d="M${x-22} ${y+5}v-20h44v20Z" fill="#b7a697" stroke="#7d6860" stroke-width="1.5"/><path d="M${x-24} ${y-15}l10 -13 14 10 12 -10 12 13Z" fill="#996e5e"/><rect x="${x+9}" y="${y-40}" width="8" height="29" fill="#82716c"/><path d="M${x+13} ${y-40}q-6 -6 0 -12q8 -4 7 -14" fill="none" stroke="#d0d3c8" stroke-width="5" opacity=".75"/><path d="M${x-12} ${y-9}h8v11h-8zm17 0h8v11h-8z" fill="#f4cb75"/></g>`;
 if(type==='market')return `<g pointer-events="none" class="map-sprite"><ellipse cx="${x}" cy="${y+7}" rx="23" ry="6" fill="#22352d" opacity=".2"/><path d="M${x-19} ${y-7}h38v15h-38z" fill="#f5e3be"/><path d="M${x-23} ${y-7}l9 -18h28l9 18Z" fill="#cf795c"/><path d="M${x-14} ${y-25}l-5 18m19 -18v18m14 -18l5 18" stroke="#f9e4ba" stroke-width="3"/></g>`;
 return hutSprite(x,y,'#af7457');
}
function capitalSprite(t,x,y){
 const color=G.players[t.owner].color;
 return `<g class="map-sprite" pointer-events="none"><ellipse cx="${x}" cy="${y+8}" rx="29" ry="7" fill="#22362f" opacity=".24"/><path d="M${x-20} ${y-18}h40v24h-40z" fill="#e8d2ad" stroke="#927755" stroke-width="1.2"/><path d="M${x-25} ${y-28}h12v34h-12zM${x+13} ${y-28}h12v34h-12z" fill="#c9b58f"/><path d="M${x-28} ${y-28}h18l-9 -13Z M${x+10} ${y-28}h18l-9 -13Z" fill="#bb6b55"/><path d="M${x-9} ${y-20}h18v26H${x-9}z" fill="#f2ddba"/><path d="M${x-12} ${y-20}l12 -16 12 16Z" fill="#bc7455"/><path d="M${x-5} ${y+6}v-11q5 -8 10 0v11" fill="#72614d"/><path d="M${x} ${y-36}v-21" stroke="#6b5037" stroke-width="2.3"/><path d="M${x+1} ${y-57}h20l-6 10H${x+1}Z" fill="${color}" stroke="#8c664f" stroke-width="1.5"/></g>`;
}
function constructionDustSprite(x,y){
 const puffs=[[-24,5,-22,-9,0],[-12,9,-14,-16,70],[1,8,1,-22,110],[14,7,18,-14,40],[25,4,21,-10,95]];
 const circles=puffs.map(([dx,dy,endX,endY,delay],i)=>`<circle class="gs-build-puff" cx="${x+dx}" cy="${y+dy}" r="${7+i%3*2}" style="--drift-x:${endX-dx}px;--drift-y:${endY-dy}px;--puff-delay:${delay}ms"/>`).join('');
 return `<g class="gs-building-dust" pointer-events="none">${circles}<path class="gs-build-spark" d="M${x-17} ${y-18}l-3 -7m21 -13v-9m18 22l7 -5" fill="none" stroke="#f5dfa6" stroke-width="3" stroke-linecap="round"/></g>`;
}
function tileDepthSprites(t,x,y){
 const result=[],seed=hash(G.seed+'-'+t.id);
 const add=(ax,ay,html,depthY=ay)=>{if(html)result.push({x:ax,y:depthY,html:billboardSvg(ax,ay,html)});};
 if(t.terrain==='forest'){
  const a=physicalTileOffset(t,-13,3),b=physicalTileOffset(t,12,6),c=physicalTileOffset(t,1,-4);
  add(a.x,a.y,treeSprite(a.x,a.y,32,seed%3));
  add(b.x,b.y,treeSprite(b.x,b.y,29,(seed+1)%3));
  add(c.x,c.y,treeSprite(c.x,c.y,39,(seed+2)%3));
 }else if(t.terrain==='mountain'){
  const a=physicalTileOffset(t,-10,5),b=physicalTileOffset(t,14,4);
  add(a.x,a.y,mountainSprite(a.x,a.y,25,37));
  add(b.x,b.y,mountainSprite(b.x,b.y,21,29));
 }else add(x,y,terrainSprites(t,x,y));
 if(t.capital){const foot=physicalTileOffset(t,0,8);add(foot.x,foot.y,worldStructureSvg(foot.x,foot.y,capitalSprite(t,x,y)));}
 const builds=t.buildings||[],offsets=t.capital?[[-22,-9],[21,10],[2,19]]:[[-16,-10],[16,5],[0,18]],scale=t.capital?.57:.74;
 for(let i=0;i<Math.min(3,builds.length);i++){
  const [dx,dy]=offsets[i];
  const arriving=scenePlayback?.kind==='build'&&scenePlayback.tileId===t.id&&scenePlayback.buildingIndex===i;
  const queued=G.completedScenes?.some(j=>j.tileId===t.id&&j.buildingIndex===i);
  if((queued&&!arriving)||(arriving&&scenePlayback.phase==='prepare'))continue;
  const growing=arriving&&scenePlayback.phase==='play';
  const sprite=buildingSprite(builds[i],x,y,G.players[t.owner].color);
  const foot=physicalTileOffset(t,dx,dy);
  const transform=`translate(${foot.x.toFixed(1)} ${foot.y.toFixed(1)}) scale(${scale}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})`;
  add(foot.x,foot.y,worldStructureSvg(foot.x,foot.y,`<g transform="${transform}">${growing?'<g class="gs-construction-rise">'+sprite+'</g>':sprite}</g>`),foot.y+scale*8);
  if(growing)add(foot.x,foot.y,constructionDustSprite(foot.x,foot.y));
 }
 const extra=scenePlayback?.kind==='build'&&scenePlayback.tileId===t.id&&scenePlayback.phase==='prepare'&&scenePlayback.buildingIndex>2?builds.length-1:builds.length;
 if(extra>3)add(x+24,y-26,`<g pointer-events="none"><rect x="${x+10}" y="${y-36}" width="28" height="16" rx="8" fill="#182e36" stroke="#e5c994"/><text x="${x+24}" y="${y-25}" font-size="10" font-weight="bold" fill="#fff2d3" text-anchor="middle">+${extra-3}</text></g>`);
 if(scenePlayback?.kind==='build'&&scenePlayback.tileId===t.id&&scenePlayback.buildingIndex>2&&scenePlayback.phase==='play')add(x,y,constructionDustSprite(x,y));
 const jobs=(G.projects||[]).filter(j=>j.tileId===t.id);
 if(jobs.length){
  const working=jobs.some(j=>assignedBuilders(G.players[j.owner],j.id).some(c=>c.builder.travelRemaining===0));
  add(x,y+7,`<g class="gs-worksite" pointer-events="none"><ellipse cx="${x}" cy="${y+6}" rx="23" ry="8" fill="#bd9164"/>
   <path d="M${x-15} ${y+6}v-20h30v20m-30 -20l30 20m-30 0l30 -20" stroke="#654934" stroke-width="2.6" fill="none"/>
   <use href="#gs-i-builder" x="${x-8}" y="${y-31}" width="16" height="16"/>
   ${working?`<g class="gs-work-dust"><circle cx="${x-16}" cy="${y-9}" r="8"/><circle cx="${x+8}" cy="${y-16}" r="9"/><circle cx="${x+18}" cy="${y-6}" r="6"/></g>`:''}</g>`);
 }
 return result;
}
function tileMiniatures(t,x,y){
 let s=terrainSprites(t,x,y);
 if(t.capital)s+=capitalSprite(t,x,y);
 const buildings=t.buildings||[];
 // Show multiple buildings in one hex instead of displaying only the first.
 const offsets=t.capital?[[-22,10],[21,11],[2,18]]:[[-16,5],[16,5],[0,-8]];
 for(let i=0;i<Math.min(3,buildings.length);i++){
  const [dx,dy]=offsets[i];
  const arriving=scenePlayback?.kind==='build'&&scenePlayback.tileId===t.id&&scenePlayback.buildingIndex===i;
  const queued=G.completedScenes?.some(j=>j.tileId===t.id&&j.buildingIndex===i);
  if((queued&&!arriving)||(arriving&&scenePlayback.phase==='prepare'))continue;
  const spring=arriving&&scenePlayback.phase==='play';
  const sprite=buildingSprite(buildings[i],x,y,G.players[t.owner].color);
  s+=`<g transform="translate(${(x+dx).toFixed(1)} ${(y+dy).toFixed(1)}) scale(${t.capital?'.57':'.74'}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})">${spring?'<g class="gs-construction-rise">'+sprite+'</g>':sprite}</g>`;
  if(spring)s+=constructionDustSprite(x+dx,y+dy);
 }
 const extra=scenePlayback?.kind==='build'&&scenePlayback.tileId===t.id&&scenePlayback.phase==='prepare'&&scenePlayback.buildingIndex>2?buildings.length-1:buildings.length;
 if(extra>3)s+=`<g pointer-events="none"><rect x="${x+10}" y="${y-36}" width="28" height="16" rx="8" fill="#182e36" stroke="#e5c994"/><text x="${x+24}" y="${y-25}" font-size="10" font-weight="bold" fill="#fff2d3" text-anchor="middle">+${extra-3}</text></g>`;
 if(scenePlayback?.kind==='build'&&scenePlayback.tileId===t.id&&scenePlayback.buildingIndex>2&&scenePlayback.phase==='play')s+=constructionDustSprite(x,y);
 const jobs=(G.projects||[]).filter(j=>j.tileId===t.id);
 if(jobs.length){
  const working=jobs.some(j=>assignedBuilders(G.players[j.owner],j.id).some(c=>c.builder.travelRemaining===0));
  s+=`<g class="gs-worksite" pointer-events="none"><ellipse cx="${x}" cy="${y+6}" rx="23" ry="8" fill="#bd9164"/>
   <path d="M${x-15} ${y+6}v-20h30v20m-30 -20l30 20m-30 0l30 -20" stroke="#654934" stroke-width="2.6" fill="none"/>
   <use href="#gs-i-builder" x="${x-8}" y="${y-31}" width="16" height="16"/>
   ${working?`<g class="gs-work-dust"><circle cx="${x-16}" cy="${y-9}" r="8"/><circle cx="${x+8}" cy="${y-16}" r="9"/><circle cx="${x+18}" cy="${y-6}" r="6"/></g>`:''}</g>`;
 }

 return s;
}

function routePolyline(points,stroke,width,dash=''){
 if(!points||points.length<2)return '';
 const d='M'+points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
 return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
}
// Draw road surface along the hex edge, preserving country colors on each side.
// The perpendicular offset is signed using the actual adjacent tile center,
// so both players' stripes stay on their respective sides as the camera turns.
function edgedRoadSegment(a,b,banks,constructed=true){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
 const nx=-dy/len,ny=dx/len,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 const stripeColors=[null,null];
 for(const id of banks||[]){
  const tile=G.tiles.find(t=>t.id===id);if(!tile||tile.owner==null)continue;
  const cp=sceneCoords(tile),side=(cp.x-mid.x)*nx+(cp.y-mid.y)*ny>=0?1:0;
  stripeColors[side]=G.players[tile.owner].color;
 }
 const line=(p,q,color,width,dash='')=>`<path d="M${p.x.toFixed(2)} ${p.y.toFixed(2)}L${q.x.toFixed(2)} ${q.y.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
 let svg=line(a,b,'#142d35',9.5);
 svg+=line(a,b,constructed?'#cdb58a':'#816f57',5.2,constructed?'':'4 5');
 if(constructed)svg+=line(a,b,'#eadbb8',1.25);
 for(const side of [-1,1]){
  const color=stripeColors[side===-1?0:1];
  if(!color)continue; // The adjoining territory is unclaimed: no ownership stripe.
  const offset=5.7*side;
  svg+=line({x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset},color,2.7,constructed?'':'4 4');
 }
 return `<g class="gs-edge-road ${constructed?'complete':'building'}" pointer-events="none">${svg}</g>`;
}
// A territory's color needs to remain legible ABOVE rivers and roads.
// Every controlled hex gets its own inset border so roads can sit between
// neighboring nations' colors instead of hiding them.
function ownedTerritoryOutlines(){
 return G.tiles.filter(t=>t.owner!==null).map(t=>{
  if(scenePlayback?.kind==='expand'&&scenePlayback.tileId===t.id&&scenePlayback.phase==='prepare')return '';
  const poly=pts(hexPoints(t,HEX-5));const color=G.players[t.owner].color;
  return `<g class="gs-owned-hex-border" data-owned-tile="${esc(t.id)}" pointer-events="none"><polygon points="${poly}" fill="none" stroke="#112d35" stroke-opacity=".85" stroke-width="7" stroke-linejoin="round"/><polygon points="${poly}" fill="none" stroke="${color}" stroke-width="4.2" stroke-opacity=".98" stroke-linejoin="round"/></g>`;
 }).join('');
}

function foregroundTurnLabel(x,y,label,style='normal'){
 const value=String(label),wide=Math.max(42,Math.min(130,16+value.length*6.1));
 return billboardSvg(x,y,`<g class="gs-world-label ${style==='work'?'gs-label-work':''}" pointer-events="none">
  <rect x="${(x-wide/2).toFixed(1)}" y="${(y-43).toFixed(1)}" width="${wide.toFixed(1)}" height="20" rx="7" fill="#132f3c" fill-opacity=".97" stroke="#e6c784" stroke-width="1.65"/>
  <text x="${x.toFixed(1)}" y="${(y-29.6).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="900">${esc(value)}</text>
 </g>`);
}
function constructionHudLabels(){
 return G.projects.map(job=>{
  const tile=G.tiles.find(t=>t.id===job.tileId),p=G.players[job.owner];if(!tile||!p)return '';
  const v=sceneCoords(tile),crew=assignedBuilders(p,job.id);
  const moving=crew.length&&!crew.some(c=>c.builder.travelRemaining===0);
  const description=moving?'BUILDER EN ROUTE':`${(BUILDINGS[job.type]?.name||'BUILD').toUpperCase()} · ${job.remaining}T`;
  return foregroundTurnLabel(v.x,v.y-6,description,'work');
 }).join('');
}

function roadVisuals(){
 return (G.tradeRoutes||[]).map(route=>{
  const points=(route.points||[]).map(p=>project(p.x,p.y)),len=Math.max(0,points.length-1);
  if(len<1)return '';
  const aBuilt=route.status==='active'?len:Math.min(len,route.aDone||0),bBuilt=route.status==='active'?0:Math.min(len,route.bDone||0);
  let body='<g class="gs-road-lines" pointer-events="none">';
  // Unbuilt sections remain subdued dashed surveys; completed border edges
  // get a stone road with ownership colors flanking the route.
  body+=routePolyline(points,'#384e51',2.5,'4 7');
  for(let i=0;i<len;i++){
   if(i<aBuilt||i>=len-bBuilt||route.status==='active')
    body+=edgedRoadSegment(points[i],points[i+1],route.banks?.[i]||[],true);
  }
  body+='</g>';
  if(route.status!=='active'&&route.status!=='paused')for(const side of ['a','b']){
   const builder=G.players[route[side]].citizens.find(c=>c.id===route[side+'BuilderId']);
   if(!builder?.builder?.projectId)continue;
   const progress=route[side+'Done']||0,at=points[side==='a'?Math.min(len,progress):Math.max(0,len-progress)];
   body+=`<g class="gs-road-builder" transform="translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})" pointer-events="none"><path d="M-9 7L9 7L5 -3L-5 -3Z" fill="${G.players[route[side]].color}" stroke="#142c36" stroke-width="2"/><path d="M-8 -11L-1 -15L11 -5L6 0L-2 -7L-9 2" stroke="#f3d59b" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="0" cy="-7" r="4" fill="#eed4ad"/></g>`;

  }
  return body;
 }).join('');
}
function roadHudLabels(){
 return (G.tradeRoutes||[]).filter(r=>r.status==='construction').map(r=>{
  const points=(r.points||[]).map(p=>project(p.x,p.y));if(points.length<2)return '';
  return ['a','b'].map(side=>{
   const done=r[side+'Done']||0,total=r.split?.[side==='a'?'aSegments':'bSegments']||0;
   if(done>=total)return '';
   const at=points[side==='a'?Math.min(points.length-1,done):Math.max(0,points.length-1-done)];
   return foregroundTurnLabel(at.x,at.y,`ROAD ${done}/${total}`);
  }).join('');
 }).join('');
}

// Falcon artwork must always stay screen-facing: the billboard's inverse
// camera transform keeps its silhouette, pose and wing proportions constant.
// Only the flight anchor follows the rotated 2.5D map.
function fixedFalconBillboard(x,y,art,altitude=0,extraClass=''){
 return billboardSvg(x,y,`<g class="gs-messenger-falcon ${extraClass}" pointer-events="none" transform="translate(${x.toFixed(2)} ${(y+altitude).toFixed(2)})">${art}</g>`,true);
}
function falconVisuals(){
 return (G.tradeOffers||[]).filter(o=>o.status==='falcon').map(offer=>{
  const a=capitalOf(offer.from),b=capitalOf(offer.to);if(!a||!b)return '';
  const from=coords(a),to=coords(b),total=Math.max(1,offer.travelTotal||1),t=Math.max(.07,1-(offer.travelRemaining||0)/total);
  const point=project(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t);
  return fixedFalconBillboard(point.x,point.y,`<path class="gs-falcon-wing" d="M0 -6Q-18 -23 -27 -11Q-11 -12 -4 3Z" fill="#f4deab" stroke="#253e4c" stroke-width="2"/><path class="gs-falcon-wing right" d="M0 -6Q18 -23 27 -11Q11 -12 4 3Z" fill="#e1b878" stroke="#253e4c" stroke-width="2"/><path d="M-7 -2Q0 -12 7 -2L2 10L-2 10Z" fill="#fff4ce" stroke="#253e4c" stroke-width="1.5"/><path d="M-3 10L0 19L3 10" fill="#c78e57"/><path d="M4 -3L12 -1L4 2" fill="#d7a452"/>`)+foregroundTurnLabel(point.x,point.y,`${offer.travelRemaining}T`);
 }).join('');
}
function expeditionTrailVisuals(){
 return G.players.flatMap(p=>(p.expeditions||[]).filter(c=>c.targetId).map(c=>{
  const from=G.tiles.find(t=>t.id===(c.originId||c.locationId)),to=G.tiles.find(t=>t.id===c.targetId);
  if(!from||!to)return '';
  const a=coords(from),b=coords(to),progress=Math.min(.97,Math.max(.04,1-(c.remaining||0)/Math.max(1,c.travelTotal||c.remaining||1)));
  const position=project(a.x+(b.x-a.x)*progress,a.y+(b.y-a.y)*progress);
  const dest=project(b.x,b.y),dx=dest.x-position.x,dy=dest.y-position.y;
  const length=Math.max(1,Math.hypot(dx,dy)),ux=dx/length,uy=dy/length;
  // Keep the original classic bootprint shape. Flip its orientation 180 degrees
  // so the steps point ahead instead of appearing to walk backwards.
  const px=-uy,py=ux;
  const degrees=Math.atan2(uy,ux)*180/Math.PI-90;
  // Lead the moving flag with alternating prints, stepping toward its goal.
  // On short approaches, clip the trail before the destination.
  const forwardSpan=Math.min(28,Math.max(0,length-3));
  const boots=Array.from({length:4},(_,i)=>{
   if(forwardSpan<6)return '';
   const ahead=forwardSpan*(.28+i*.24),side=(i%2===0?-1:1)*Math.min(3.4,forwardSpan*.18);
   const x=position.x+ux*ahead+px*side,y=position.y+uy*ahead+py*side+7;
   return `<g class="gs-expedition-boot" style="--step:${i}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${degrees.toFixed(2)})">
    <path d="M-2 4Q-4 2-3-2L-1-6Q1-8 3-5L3 1Q3 5-2 4Z" fill="#eed9ae" stroke="#304d52" stroke-width="1.1"/>
    <path d="M-2 -4H2" stroke="#b08b5a" stroke-width="1.1"/>
   </g>`;
  }).join('');
  const flag=`<g class="gs-expedition-banner" pointer-events="none"><ellipse cx="${position.x.toFixed(1)}" cy="${(position.y+7).toFixed(1)}" rx="8" ry="3" fill="#10252e" opacity=".4"/>
   <path d="M${position.x.toFixed(1)} ${(position.y+7).toFixed(1)}v-29" stroke="#364a4d" stroke-width="2.7" stroke-linecap="round"/>
   <path d="M${position.x.toFixed(1)} ${(position.y-22).toFixed(1)}l18 5-18 7Z" fill="${p.color}" stroke="#f3e4bb" stroke-width="1.7"/></g>`;
  const baseHeading=Math.atan2(dy,dx)*180/Math.PI;
  const footprintGroup=`<g class="gs-expedition-footprints" data-dir-x="${b.x-a.x}" data-dir-y="${b.y-a.y}" data-base-heading="${baseHeading.toFixed(4)}" data-anchor-x="${position.x.toFixed(2)}" data-anchor-y="${position.y.toFixed(2)}">${boots}</g>`;
  return billboardSvg(position.x,position.y,`<g class="gs-expedition-moving" pointer-events="none">${footprintGroup}${flag}</g>`)+foregroundTurnLabel(position.x,position.y-34,`EXPEDITION · ${c.remaining}T`);
 })).join('');
}

// A wagon's roadway follows corners of a hex perimeter. It never cuts across
// the face of a tile. Consecutive shared-edge midpoints are connected by the
// shorter arc of vertices on the intervening hex's boundary.
function wagonRoadTrace(ids){
 const tiles=(ids||[]).map(id=>G.tiles.find(t=>t.id===id));
 if(tiles.some(t=>!t)||tiles.length<1)return {points:[],atStep:[]};
 const corners=tile=>Array.from({length:6},(_,i)=>{const c=coords(tile),a=i*Math.PI/3+Math.PI/6;return {x:c.x+HEX*Math.cos(a),y:c.y+HEX*Math.sin(a)};});
 const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 if(tiles.length===1){const c=corners(tiles[0]);return {points:[midpoint(c[0],c[1])],atStep:[0]};}
 const crossed=[];
 for(let i=0;i<tiles.length-1;i++){
  if(distance(tiles[i],tiles[i+1])!==1)return {points:[],atStep:[]};
  const shared=domesticRoadEdge(tiles[i],tiles[i+1]);if(shared.length!==2)return {points:[],atStep:[]};
  crossed.push(midpoint(shared[0],shared[1]));
 }
 function edgeIndex(tile,mid){const cs=corners(tile);for(let i=0;i<6;i++){
  const p=midpoint(cs[i],cs[(i+1)%6]);if(Math.hypot(p.x-mid.x,p.y-mid.y)<.5)return i;
 }return -1;}
 function arc(tile,fromEdge,toEdge){
  const cs=corners(tile),a=edgeIndex(tile,fromEdge),b=edgeIndex(tile,toEdge);
  if(a<0||b<0||a===b)return [toEdge];
  const cw=(b-a+6)%6,ccw=(a-b+6)%6,vertices=[];
  if(cw<=ccw){for(let j=0;j<cw;j++)vertices.push(cs[(a+j+1)%6]);}
  else{for(let j=0;j<ccw;j++)vertices.push(cs[(a-j+6)%6]);}
  vertices.push(toEdge);return vertices;
 }
 // Start on a neighboring edge of the origin hex, never its center.
 const firstCorners=corners(tiles[0]),entry=edgeIndex(tiles[0],crossed[0]);
 const start=midpoint(firstCorners[(entry+5)%6],firstCorners[entry]);
 const points=[start],atStep=[0];
 points.push(...arc(tiles[0],start,crossed[0]));atStep.push(points.length-1);
 for(let i=1;i<crossed.length;i++){
  points.push(...arc(tiles[i],crossed[i-1],crossed[i]));atStep.push(points.length-1);
 }
 return {points,atStep};
}
function wagonViewArtwork(countryColor){
 const ink='#263a42',wood='#855839',pale='#f1e5c9',shade='#d6c5a2';
 // Side: short canvas-covered wagon, small wooden bed and two spoked wheels.
 const side=`<g class="gs-wagon-side gs-wagon-view">
  <ellipse cy="7.6" rx="14" ry="2.8" fill="#081a1f" opacity=".24"/>
  <path d="M-13 -3.8H13L11.5 5.5H-11.5Z" fill="${wood}" stroke="${ink}" stroke-width="1.3"/>
  <path d="M-12.7 -4Q-11 -13 0 -13.4Q11.2 -13 12.7 -4Z" fill="${pale}" stroke="${ink}" stroke-width="1.3"/>
  <path d="M-7.7 -12Q-7.2 -8-7.4 -4M0 -13.4Q.2 -8 0 -4M7.7 -12Q7.2 -8 7.4 -4" stroke="${shade}" stroke-width="1" fill="none"/>
  <path d="M-12.7 -4H12.7" stroke="${countryColor}" stroke-width="1.8"/>
  <path d="M-15 4L-18 1" stroke="${wood}" stroke-width="1.4"/>
  ${[-8.5,9].map(x=>`<g class="gs-wagon-wheel" transform="translate(${x} 6.2)"><circle r="3.7" fill="#423c34" stroke="#e5c184" stroke-width="1.25"/><path d="M0-3V3M-3 0H3" stroke="#d0a777" stroke-width=".7"/></g>`).join('')}
 </g>`;
 // Forward-facing three-quarter: front canvas opening and staggered wheels.
 const front=`<g class="gs-wagon-front gs-wagon-view">
  <ellipse cy="8.5" rx="11" ry="3" fill="#081a1f" opacity=".23"/>
  <path d="M-10 -4L6 -6L12 3L-3 6Z" fill="${wood}" stroke="${ink}" stroke-width="1.3"/>
  <path d="M-12 -5Q-13 -15-3 -17Q7 -16 7 -6L12 -5Q5 -11-3 -11Q-11 -10-12 -5Z" fill="${pale}" stroke="${ink}" stroke-width="1.25"/>
  <path d="M-9 -5Q-10 -12-3 -12Q3 -12 4 -5L4 2L-8 3Z" fill="${shade}" stroke="${ink}" stroke-width="1"/>
  <path d="M-7 -5H5" stroke="${countryColor}" stroke-width="1.7"/>
  <g class="gs-wagon-wheel" transform="translate(-7.5 6.5)"><circle r="4" fill="#423c34" stroke="#e5c184" stroke-width="1.2"/><path d="M-2 0H2M0 -2V2" stroke="#d0a777"/></g>
  <g class="gs-wagon-wheel" transform="translate(10 4)"><circle r="3" fill="#423c34" stroke="#e5c184" stroke-width="1.1"/></g>
 </g>`;
 // Rear-facing: arched canvas end and short wagon bed.
 const rear=`<g class="gs-wagon-rear gs-wagon-view">
  <ellipse cy="9" rx="11" ry="3" fill="#081a1f" opacity=".23"/>
  <path d="M-10 -3H11L8.5 5H-10.5Z" fill="${wood}" stroke="${ink}" stroke-width="1.25"/>
  <path d="M-11 -4Q-10.5 -14 0 -14Q10 -14 11 -4Z" fill="${pale}" stroke="${ink}" stroke-width="1.4"/>
  <path d="M-6 -3Q-6.5 -10 0 -10Q6.5 -10 6 -3L6 2H-6Z" fill="#c5b38e" stroke="${ink}" stroke-width=".9"/>
  <path d="M-10 -4H10" stroke="${countryColor}" stroke-width="1.6"/>
  <g class="gs-wagon-wheel" transform="translate(-9.5 5.6)"><ellipse rx="1.7" ry="3.6" fill="#423c34" stroke="#e5c184" stroke-width="1.1"/><path d="M-1 0H1" stroke="#d0a777"/></g>
  <g class="gs-wagon-wheel" transform="translate(9.5 5.6)"><ellipse rx="1.7" ry="3.6" fill="#423c34" stroke="#e5c184" stroke-width="1.1"/><path d="M-1 0H1" stroke="#d0a777"/></g>
 </g>`;
 return side+front+rear;
}
// A tiny worker visibly pushes two timber logs rather than a covered wagon.
// These are world-anchored miniature units and participate in ground depth.
function beanPushCart(lod=beanLod()){
 const detail=lod>=2;
 let wheels='';
 for(const cx of [14,31]){
  wheels+='<g transform="translate('+cx+' 9)"><g class="gs-bean-wheel">'+
   '<circle r="4.5" fill="#3b4147" stroke="#d4bc8d" stroke-width="1.3"/>'+
   '<circle r="2" fill="#8d918c" stroke="#263b46" stroke-width=".5"/>'+
   (detail?'<path d="M0-3.3V3.3M-3.3 0H3.3" stroke="#ecdbbd" stroke-width=".7"/>':'')+
   '</g></g>';
 }
 return '<g class="gs-bean-pushcart" pointer-events="none">'+
  '<ellipse cx="23" cy="14" rx="22" ry="3" fill="#1e3239" opacity=".20"/>'+
  '<path d="M4-8L13-5" fill="none" stroke="#70543b" stroke-width="3.6" stroke-linecap="round"/>'+
  '<path d="M10-5L35-5L34 7L12 7Z" fill="#b78352" stroke="#3b3a36" stroke-width="1.7"/>'+
  '<path d="M11-5L15-10L36-10L35-5Z" fill="#daae75" stroke="#5a473a" stroke-width="1.1"/>'+
  (lod>=1?'<path d="M17-3L17 5M29-3V5" stroke="#916640" stroke-width="1.1"/>':'')+
  wheels+'</g>';
}
function porterVisuals(depthEntries=false){
 const entries=(G.shipments||[]).filter(j=>j.kind==='porter').map(job=>{
  const p=G.players[job.owner],worker=p?.citizens.find(c=>c.id===job.porterId);
  const ids=job.path||[],a=G.tiles.find(t=>t.id===ids[Math.min(job.step,ids.length-1)]);
  if(!p||!worker||!a)return null;
  const b=G.tiles.find(t=>t.id===ids[Math.min(job.step+1,ids.length-1)])||a;
  const duration=a.id===b.id?1:porterTicks(a,b);
  const fraction=a.id===b.id?0:Math.max(0,Math.min(1,(job.stepSpent||0)/duration));
  const from=coords(a),to=coords(b);
  const point=project(from.x+(to.x-from.x)*fraction,from.y+(to.y-from.y)*fraction);
  const lod=beanLod(),scale=lod===0?.50:lod===1?.62:.72;
  const artwork='<g class="gs-bean-hauler" transform="translate('+point.x.toFixed(2)+' '+point.y.toFixed(2)+') scale('+scale+')">'+
   beanPerson(worker,p,'civilian',lod)+beanPushCart(lod)+'</g>';
  const html=billboardSvg(point.x,point.y,artwork);
  return depthEntries?{x:point.x,y:point.y+6,html}:html;
 });
 return depthEntries?entries.filter(Boolean):entries.filter(Boolean).join('');
}
function boatVisuals(depthEntries=false){
 const entries=G.players.flatMap(p=>(p.boats||[]).map(boat=>{
  const tile=G.tiles.find(t=>t.id===boat.currentTileId);if(!tile)return null;
  const world=sceneCoords(tile),pt=project(world.x+11,world.y+7);
  const job=G.shipments.find(j=>j.id===boat.shipmentId),cargo=!!job&&['delivery','unloading'].includes(job.stage);
  const artwork=billboardSvg(pt.x,pt.y,`<g class="gs-boat" transform="translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})" pointer-events="none">
   <ellipse cx="0" cy="8" rx="20" ry="5" fill="#144f66" opacity=".35"/>
   <g><animateTransform attributeName="transform" type="translate" values="0,0;0,1.4;0,0" dur="2s" repeatCount="indefinite"/>
    <path d="M-18 0Q0 7 18 0L12 10Q0 15 -12 10Z" fill="#a16c45" stroke="#51372c" stroke-width="1.5"/>
    <path d="M0 -27V4" stroke="#58432b" stroke-width="2.5"/>
    <path d="M-2 -26Q-14 -11 -3 -1Z" fill="#f9ecd4" stroke="#88785b" stroke-width="1"/>
    <path d="M2 -19Q15 -9 3 -2Z" fill="${p.color}" stroke="#425061" stroke-width="1"/>
    ${cargo?'<rect x="7" y="0" width="7" height="5" fill="#e7c78a" stroke="#53422c" stroke-width="1"/>':''}
   </g></g>`);
  return depthEntries?{x:pt.x,y:pt.y+6,html:artwork}:artwork;
 }));
 return depthEntries?entries.filter(Boolean):entries.filter(Boolean).join('');
}
function caravanVisuals(depthEntries=false){
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 const graphics=G.players.flatMap(p=>(p.caravans||[]).map(cart=>{
  const job=G.shipments.find(s=>s.id===cart.shipmentId);
  const at=G.tiles.find(t=>t.id===cart.currentTileId);if(!at)return '';
  const trace=job?.path?.length?wagonRoadTrace(job.path):wagonRoadTrace([at.id]);
  if(!trace.points.length)return '';
  const step=Math.min(Math.max(0,job?.step||0),trace.atStep.length-1),destination=trace.points[trace.atStep[step]],point=project(destination.x,destination.y);
  const nextIndex=trace.atStep[Math.min(trace.atStep.length-1,step+1)];
  const prevIndex=trace.atStep[Math.max(0,step-1)];
  const neighbor=trace.points[step<trace.atStep.length-1?nextIndex:prevIndex]||destination;
  const dx=(step<trace.atStep.length-1?neighbor.x-destination.x:destination.x-neighbor.x)||1;
  const dy=(step<trace.atStep.length-1?neighbor.y-destination.y:destination.y-neighbor.y)||0;
  const heading=project(dx,dy),direction=Math.abs(heading.y)>Math.abs(heading.x)*.72?(heading.y>0?'front':'rear'):'side',side=heading.x<0?'left':'right';
  let motion='';
  if(job?.visualMove?.clock===G.turnClock && job.visualMove.path?.join('|')===job.path?.join('|')){
   const move=job.visualMove,key=`${job.id}-${move.clock}-${move.fromStep}-${move.toStep}`;
   if(!wagonMotionSeen.has(key)&&!reduced){
    const frm=Math.max(0,Math.min(trace.atStep.length-1,move.fromStep)),to=Math.max(frm,Math.min(trace.atStep.length-1,move.toStep));
    const vertices=trace.points.slice(trace.atStep[frm],trace.atStep[to]+1).map(v=>project(v.x,v.y));
    if(vertices.length>1){
     const local=vertices.map(v=>`${(v.x-point.x).toFixed(2)},${(v.y-point.y).toFixed(2)}`);
     motion=`<animateMotion dur=".86s" begin="0s" fill="freeze" calcMode="linear" path="M${local.join(' L')}"/>`;
     wagonMotionSeen.add(key);
    }
   }
  }
  // The wagon is anchored on a border midpoint/corner, never a tile center.
  const riding=!!job&&['pickup','delivery','return'].includes(job.stage),cargo=job&&job.stage==='delivery'&&job.qty>0;
  const markup=billboardSvg(point.x,point.y,`<g class="gs-covered-wagon" data-gs-wagon="1" data-dir-x="${dx.toFixed(2)}" data-dir-y="${dy.toFixed(2)}" data-view="${direction}" data-side="${side}" data-cargo="${cargo?1:0}" data-roadway="edge" transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})" pointer-events="none">${motion}
   <g class="gs-wagon-scale" transform="scale(.68)"><g class="gs-covered-wagon-rock ${riding?'gs-wagon-moving':''}">${wagonViewArtwork(p.color)}${cargo?'<rect x="7" y="-17" width="7" height="6" rx="1.5" fill="#edcb91" stroke="#243f45" stroke-width="1"/>':''}</g></g>
  </g>`);
  return depthEntries?{x:point.x,y:point.y+7,html:markup}:markup;
 }));
 return depthEntries?graphics.filter(v=>v&&typeof v==='object'):graphics.join('');
}

function diplomaticFalconVisuals(){
 return (G.diplomaticFalcons||[]).filter(f=>f.status==='flying').map(f=>{
  const origin=capitalOf(f.from),dest=capitalOf(f.to);if(!origin||!dest)return '';
  const a=sceneCoords(origin),b=sceneCoords(dest),t=1-(f.remaining/f.travelTotal);
  const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
  return fixedFalconBillboard(x,y,`<path class="gs-falcon-wing" d="M0 0Q-18 -19 -25 -7Q-8 -10 -2 2Z" fill="#e2d6bd" stroke="#263d4e" stroke-width="2"/><path class="gs-falcon-wing right" d="M0 0Q18 -19 25 -7Q8 -10 2 2Z" fill="#d4af74" stroke="#263d4e" stroke-width="2"/><path d="M-5 0Q0 -8 5 0L2 11H-2Z" fill="#faf1d8" stroke="#263d4e" stroke-width="1.5"/><circle cx="0" cy="10" r="3" fill="#8f4e4b"/>`,-25,'gs-diplomatic-falcon');
 }).join('');
}

function renderMap(){
 if(!G)return;
 // Render every tile and static sprite at the same world yaw. The camera's
 // matrix is applied afterward, preventing the end-of-rotation 'snap'.
 const displayYaw=cameraYaw;
 cameraYaw=WORLD_SCENE_YAW;
 const svg=el('worldMap');svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 const sorted=G.tiles.map(t=>({t,c:sceneCoords(t)})).sort((a,b)=>a.c.y-b.c.y||a.c.x-b.c.x);
 const bases=[],decorations=[],depthItems=[],terrainGeometry=[];
 for(const {t,c:{x,y}} of sorted){
  const claiming=scenePlayback?.tileId===t.id&&scenePlayback.kind==='expand';
  const owner=(t.owner===null||(claiming&&scenePlayback.phase==='prepare'))?null:G.players[t.owner],selected=!cpuBusy&&t.id===G.selectedId;
  const top=hexPoints(t,HEX-1),center=sceneCoords(t);
  const extrude=t.terrain==='water'?7:(t.terrain==='mountain'?14:11);
  const relief=hexExtrusionGeometry(top,center,extrude,0);
  terrainGeometry.push({top,center,height:extrude});
  const fill=t.terrain==='water'?'#478aa8':TERRAIN[t.terrain].color;
  const border=owner?owner.color:'#627267';
  const inset=top.map(p=>({x:center.x+(p.x-center.x)*.92,y:center.y+(p.y-center.y)*.92}));
  bases.push(`<g class="tile-base gs-hex-3d" data-depth-x="${center.x.toFixed(2)}" data-depth-y="${center.y.toFixed(2)}" data-depth-order="${terrainGeometry.length}" pointer-events="none">
   <polygon class="gs-hex-under" points="${relief.bottom}" fill="#172d30" opacity=".52"/>
   <path class="gs-hex-side gs-hex-side-0" d="${relief.sides[0]}" fill="${t.terrain==='water'?'#295773':'#776752'}" stroke="#283d3f" stroke-width=".7"/>
   <path class="gs-hex-side gs-hex-side-1" d="${relief.sides[1]}" fill="${t.terrain==='water'?'#295773':'#685b47'}" stroke="#283d3f" stroke-width=".7"/>
   <polygon points="${pts(top)}" fill="${fill}" stroke="#364d4a" stroke-width="2.7"/>
   <polygon points="${pts(inset)}" fill="${fill}" stroke="${t.terrain==='water'?'#8fc8da':'#e8dcad'}" stroke-opacity=".38" stroke-width="1.4"/>
   <path d="M${top[0].x.toFixed(1)} ${top[0].y.toFixed(1)}L${top[1].x.toFixed(1)} ${top[1].y.toFixed(1)}L${top[2].x.toFixed(1)} ${top[2].y.toFixed(1)}" stroke="#f8efc8" opacity=".3" stroke-width="2" fill="none"/>
   <polygon points="${pts(top)}" fill="${owner?owner.color:'#ffffff'}" opacity="${owner?'.11':'.025'}" stroke="${border}" stroke-width="${owner?'2.4':'1.0'}"/>
   ${selected?`<polygon points="${pts(top)}" fill="none" stroke="#fff6c7" stroke-width="3.6"/>`:''}
  </g>`);
  const action=t.id===actionTileId||(scenePlayback?.kind==='dispatch'&&scenePlayback.tileId===t.id&&scenePlayback.phase==='play');
  const scout=expeditionForTile(t.id);
  depthItems.push(...tileDepthSprites(t,x,y));
  decorations.push(`<g class="hex ${selected?'hex-selected':''} ${action?'hex-action-flash':''}" data-hex="${t.id}" tabindex="0" role="button" aria-label="${esc(t.name)}: ${TERRAIN[t.terrain].name}${owner?' owned by '+esc(owner.name):' unclaimed'}">
   <polygon class="hex-hit" points="${pts(top)}" fill="transparent" stroke="none"/>
   ${action?`<ellipse class="tile-spotlight" cx="${x}" cy="${y}" rx="41" ry="28" fill="none" stroke="#fff1ba" stroke-width="3" pointer-events="none"/>`:''}
   ${claiming&&scenePlayback.phase==='play'?`<polygon class="gs-claim-ring" points="${pts(top)}" fill="none" stroke="${owner?.color||'#f4dbac'}" stroke-width="6" pointer-events="none"/>`:''}
  </g>`);
  if(owner)depthItems.push({x:x-24,y:y-13,html:billboardSvg(x-24,y-13,`<circle cx="${x-24}" cy="${y-13}" r="5.5" fill="${owner.color}" stroke="#fff8df" stroke-width="1.3" pointer-events="none"/>`)});
 }
  const waterways=(G.rivers||[]).map(river=>{
   // Vertices are shared by two land hexes; project AFTER camera yaw/tilt.
   const positions=river.points||[];
   if(positions.length<2)return '';
   const projected=positions.map(p=>project(p.x,p.y));
   const d='M'+projected.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
   return `<g class="river-course" pointer-events="none"><path d="${d}" stroke="#49675b" stroke-width="12" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".82"/><path d="${d}" stroke="#398aab" stroke-width="8.2" stroke-linejoin="round" stroke-linecap="round" fill="none"/><path d="${d}" stroke="#a0dbe5" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".77"/></g>`;
  }).join('');
 const tradeLines=roadVisuals()+domesticRoadVisuals()+bridgeMapVisuals();
 const ownerOutlines=ownedTerritoryOutlines(),threatBorders=threatenedHexBorders(),siegeMarks=siegeMapVisuals();
 depthItems.push(...porterVisuals(true));
 depthItems.push(...caravanVisuals(true));
 depthItems.push(...boatVisuals(true));
 const objects=depthItems.map((obj,index)=>`<g data-depth-x="${obj.x.toFixed(2)}" data-depth-y="${obj.y.toFixed(2)}" data-depth-order="${index}" pointer-events="none">${obj.html}</g>`).join('');
 const movementOverlays=falconVisuals()+diplomaticFalconVisuals()+expeditionTrailVisuals()+visibleWarOrderMarkers();
 const upperLabels=constructionHudLabels()+roadHudLabels();
 // Ground-sorted scenery and wagons. Territory taps and labels remain foreground.
 el('mapContent').innerHTML=`<g class="world-terrain" id="gsWorldTerrain">${bases.join('')}</g><g pointer-events="none">${waterways}${tradeLines}</g><g class="gs-national-borders" pointer-events="none">${ownerOutlines}</g><g class="gs-territory-threat-layer" pointer-events="none">${threatBorders}</g><g class="gs-siege-overlay" pointer-events="none">${siegeMarks}</g><g id="gsWorldDepth" class="gs-world-depth" pointer-events="none">${objects}</g><g class="world-features">${decorations.join('')}</g><g class="gs-moving-overlays" pointer-events="none">${movementOverlays}</g><g class="gs-map-frontlabels" pointer-events="none">${upperLabels}</g>`;
 lastWorldDepthYaw=NaN;
 lastTerrainExtrusionYaw=NaN;
 boardBaseYaw=WORLD_SCENE_YAW;
 boardTerrainFaces=[...el('mapContent').querySelectorAll('.gs-hex-3d')].map((node,i)=>({
  ...terrainGeometry[i],
  shadow:node.querySelector('.gs-hex-under'),
  side0:node.querySelector('.gs-hex-side-0'),
  side1:node.querySelector('.gs-hex-side-1')
 }));
 boardBillboards=[...el('mapContent').querySelectorAll('[data-gs-billboard]')].map(node=>({node,x:Number(node.dataset.anchorX),y:Number(node.dataset.anchorY)}));
 boardWorldStructures=[...el('mapContent').querySelectorAll('[data-gs-world-structure]')].map(node=>({node,x:Number(node.dataset.anchorX),y:Number(node.dataset.anchorY)}));
 boardFootprints=[...el('mapContent').querySelectorAll('.gs-expedition-footprints')].map(node=>({node,x:Number(node.dataset.anchorX),y:Number(node.dataset.anchorY),dx:Number(node.dataset.dirX),dy:Number(node.dataset.dirY),baseHeading:Number(node.dataset.baseHeading)}));
 boardWagons=[...el('mapContent').querySelectorAll('[data-gs-wagon]')].map(node=>({node,dx:Number(node.dataset.dirX),dy:Number(node.dataset.dirY)}));
 cameraYaw=displayYaw;
 syncBoardRotation();
}
function mapAspect(){const rect=el('worldMap').getBoundingClientRect();return rect.width>0&&rect.height>0?rect.width/rect.height:1.5;}
function setCenter(cx,cy,width){
 const aspect=mapAspect();
 cameraDesiredWidth=width;
 const fitted=fittedCameraWidth(width,aspect);
 view.w=fitted;view.h=fitted/aspect;view.x=cx-fitted/2;view.y=cy-view.h/2;
 el('worldMap').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
}
function focusHome(immediate=true){if(!G)return;const t=G.tiles.find(t=>t.owner===0&&t.capital)||G.tiles[0];return moveCamera(t,POV_ANGLES[0],immediate?0:750,mobileCameraWidth(420,540));}
function resetView(){
 if(!G)return;
 cameraYaw=POV_ANGLES[0];
 const projected=G.tiles.map(t=>hexPoints(t,HEX+10)).flat(),xs=projected.map(p=>p.x),ys=projected.map(p=>p.y);
 const minx=Math.min(...xs)-25,maxx=Math.max(...xs)+25,miny=Math.min(...ys)-60,maxy=Math.max(...ys)+60,asp=mapAspect();
 const actual=Math.max(maxx-minx,(maxy-miny)*asp),factor=fittedCameraWidth(1,asp);
 setCenter((maxx+minx)/2,(maxy+miny)/2,actual/factor);
 renderMap();
}
function zoom(f){
 const previous=beanLod(),cx=view.x+view.w/2,cy=view.y+view.h/2;
 setCenter(cx,cy,Math.min(2400,Math.max(140,cameraDesiredWidth*f)));
 if(G&&beanLod()!==previous)renderMap();
}
function moveCamera(tile,targetYaw=cameraYaw,duration=800,targetWidth=460){
 if(!G||!tile)return Promise.resolve();
 if(cameraMoveFrame)cancelAnimationFrame(cameraMoveFrame);
 if(cameraResolve){const previous=cameraResolve;cameraResolve=null;previous();}
 const from={yaw:cameraYaw,cx:view.x+view.w/2,cy:view.y+view.h/2,width:cameraDesiredWidth};
 const fromWorld=unprojectScreen(from.cx,from.cy,from.yaw);
 const target=coords(tile),start=performance.now(),token=cpuPlaybackToken;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 return new Promise(resolve=>{
  cameraResolve=resolve;
  const done=()=>{cameraMoveFrame=0;if(cameraResolve===resolve)cameraResolve=null;resolve();};
  function frame(now){
   if(!G||token!==cpuPlaybackToken){done();return;}
   const t=skipCpuPlayback||reduced||duration<=0?1:Math.min(1,(now-start)/duration);
   const k=t*t*t*(t*(6*t-15)+10); // quintic smoothstep without sudden camera acceleration.
   cameraYaw=blend(from.yaw,targetYaw,k);
   syncBoardRotation();
   const worldX=blend(fromWorld.x,target.x,k),worldY=blend(fromWorld.y,target.y,k);
   const center=project(worldX,worldY,cameraYaw);
   cameraDesiredWidth=blend(from.width,targetWidth,k);
   const aspect=mapAspect();view.w=fittedCameraWidth(cameraDesiredWidth,aspect);view.h=view.w/aspect;
   view.x=center.x-view.w/2;view.y=center.y-view.h/2;
   el('worldMap').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
   if(t<1)cameraMoveFrame=requestAnimationFrame(frame);
   else{renderMap();done();} // Reproject each tile face once at final yaw.
  }
  cameraMoveFrame=requestAnimationFrame(frame);
 });
}

function flashAction(tile,kind='action'){
 if(!tile)return;actionTileId=tile.id;actionKind=kind;renderMap();
 const marker=el('mapContent').querySelector(`[data-hex="${tile.id}"]`);if(marker)marker.classList.add('hex-action-pop');
 setTimeout(()=>{if(actionTileId===tile.id){actionTileId=null;renderMap();}},1250);
}

function showEndGame(){const ranking=[...G.players].sort((a,b)=>prosperity(b)-prosperity(a));showModal(`<div class="section-kicker">END OF THE TEST</div><h2>World economy review</h2><p>After ${G.maxRounds} rounds, these countries have built the strongest economies. This is a sandbox score, <b>not</b> the final four-category victory system.</p><div class="modal-summary">${ranking.map((p,i)=>`<div class="mini-row"><span>${i===0?'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-trophy"></use></svg> ':''}${i+1}. ${esc(p.name)}</span><b>${prosperity(p)} pts</b></div>`).join('')}</div><div class="button-stack"><button class="primary" data-modal="continue">Continue playing this world</button><button class="secondary" data-modal="new-confirm">Generate a new world</button></div>`);}
function openMenu(){showModal(`<div class="section-kicker">MATCH SETTINGS</div><h2>${esc(G.worldName)}</h2><p>Round ${G.round}. World seed: <b>${esc(G.seed)}</b><br>Progress saves automatically in this browser.</p><div class="button-stack"><button class="secondary" data-modal="close">Return to match</button><button class="secondary" data-modal="new-confirm">Start a new world</button>${G.finished?'<button class="primary" data-modal="continue">Continue past the round limit</button>':''}</div>`);}
function confirmNew(){showModal(`<div class="section-kicker">NEW WORLD</div><h2>Abandon this match?</h2><p>This will replace the current saved match. Your CPU opponents and map will be generated again.</p><div class="button-stack"><button class="primary" data-modal="new">Yes, start a new match</button><button class="secondary" data-modal="close">Keep playing</button></div>`);}
function bindEvents(){
 el('colorOptions').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(b){selectedColor=Number(b.dataset.color);renderLobby();}});
 el('shuffleSeedBtn').addEventListener('click',()=>{el('seedInput').value=Math.floor(Math.random()*9999999).toString(36).toUpperCase();});
 el('startBtn').addEventListener('click',()=>{
  const country=el('countryInput').value.trim(),capital=el('capitalInput').value.trim();
  if(country.length<2||capital.length<2){showToast('Enter both a country and capital city name.');return;}
  const error=el('launchError'),button=el('startBtn');
  error.classList.add('hidden');button.disabled=true;button.innerHTML='GENERATING WORLD…';
  try{
   const seed=el('seedInput').value.trim()||Math.floor(Math.random()*4294967295).toString(36).toUpperCase();
   createWorld(seed,country,capital,selectedColor);enterGame();
  }catch(e){
   console.error('Global Standoff startup error',e);
   error.textContent='The world could not be started: '+String(e&&e.message||e)+'. Open this game on a normal HTTPS website in Safari or Chrome.';
   error.classList.remove('hidden');button.disabled=false;button.innerHTML='TRY GENERATING AGAIN <span>→</span>';
  }
 });
 el('resumeBtn').addEventListener('click',()=>{const saved=loadSaved();if(!saved)return;G=saved;enterGame();if(G.turnIndex===0&&G.completedScenes?.length)setTimeout(()=>showCompletedProjects(),200);if(G.finished)showEndGame();else if(G.turnIndex!==0){cpuBusy=true;cpuPlaybackToken++;skipCpuPlayback=true;setTimeout(()=>{for(let i=G.turnIndex;i<=3;i++){beginTurn(i);const p=G.players[i];for(let step=0;step<MAJOR_ACTIONS;step++){const spent=actionsUsed(p);runCpu(i);if(actionsUsed(p)===spent)break;}advanceWorldTurn();}finishRound();G.completedScenes=[];focusHome(true);cpuBusy=false;render();setTimeout(presentFalconInbox,220);},80);}});
 el('sheetClose').addEventListener('click',closeSheet);
 el('sheetScrim').addEventListener('click',closeSheet);
 el('nationQuickBtn').addEventListener('click',()=>showSheet('nation'));
 el('rosterQuickBtn').addEventListener('click',()=>showSheet('roster'));
 el('researchQuickBtn').addEventListener('click',()=>showSheet('research'));
 el('worldQuickBtn').addEventListener('click',()=>showSheet('world'));
 el('cardPreviewScrim').addEventListener('click',closeCardPreview);
 el('cardPreviewContent').addEventListener('click',e=>{const b=e.target.closest('[data-preview]');if(!b)return;if(b.dataset.preview==='close')closeCardPreview();if(b.dataset.preview==='play'&&previewCardIndex>=0){const ok=playCard(0,previewCardIndex);if(ok)closeCardPreview();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!el('cardPreview').classList.contains('hidden'))closeCardPreview();else if(!el('sheetLayer').classList.contains('hidden'))closeSheet();}});
 el('levySheetBtn').addEventListener('click',()=>{if(canAct()&&!getCountry().levyUsed)doLevy(0);});
 el('topMenuBtn').addEventListener('click',openMenu);
 el('endTurnBtn').addEventListener('click',endTurn);
 el('levyBtn').addEventListener('click',()=>{if(canAct()&&!getCountry().levyUsed)doLevy(0);});
 el('researchBtn').addEventListener('click',()=>{if(G)showSheet('research');});
 el('closeResearchBtn').addEventListener('click',closeSheet);
 el('closeBuildBtn').addEventListener('click',()=>{showBuild=false;render();});
 el('warBody').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const panel=el('warBody');
  if(b.dataset.afterSiege!=null){const id=Number(b.dataset.afterSiege),siege=(G.sieges||[]).find(x=>x.id===id),target=panel.querySelector('[data-next-hex="'+id+'"]')?.value;if(!warChooseAfternath(siege,b.dataset.choice,target,0))showToast("Could not execute post-battle order.");return;}
  if(b.dataset.startSiege!=null){
   const path=panel.querySelector('#siegeCampaign')?.value||'',split=path.indexOf('|');
   if(split<0||!startSiege(path.slice(split+1),path.slice(0,split),Number(panel.querySelector('#siegeQuantity')?.value||0),0,panel.querySelector('#siegeTransport')?.value||'foot'))
    showToast('Siege unavailable: check available soldiers, owned border and dispatch limit.');
   return;
  }
  if(b.dataset.siegeSubmit!=null){
   const id=Number(b.dataset.siegeSubmit),kind=panel.querySelector(`[data-siege-order="${id}"]`)?.value;
   if(!setSiegeOrder(id,kind))showToast('Could not submit the siege order.');
   return;
  }
  if(b.dataset.siegeReinforce!=null){
   const id=Number(b.dataset.siegeReinforce),box=panel.querySelector(`[data-siege-reinforcement-id="${id}"]`);
   const post=box?.querySelector('[data-siege-reinforce-post]')?.value,number=Number(box?.querySelector('[data-siege-reinforce-qty]')?.value||0);
   if(!reinforceSiege(id,post,number,0,box?.querySelector('[data-siege-reinforce-transport]')?.value||'foot'))showToast('Cannot reinforce: check available soldiers, travel route, or 12-troop capacity.');
   return;
  }
  if(b.dataset.sendWarning!=null){const to=Number(b.dataset.sendWarning),tile=panel.querySelector(`[data-warning-land="${to}"]`)?.value;sendDiplomaticFalcon(to,'warning',tile);return;}
  if(b.dataset.sendWar!=null){sendDiplomaticFalcon(Number(b.dataset.sendWar),'war');return;}
  if(b.dataset.sendPeace!=null){sendDiplomaticFalcon(Number(b.dataset.sendPeace),'peace');return;}
  if(b.dataset.sendTreaty!=null){sendDiplomaticFalcon(Number(b.dataset.sendTreaty),'treaty');return;}
  if(b.dataset.sendAlliance!=null){sendDiplomaticFalcon(Number(b.dataset.sendAlliance),'alliance');return;}
  if(b.dataset.endAgreement!=null){
   const target=Number(b.dataset.endPartner),id=Number(b.dataset.endAgreement);
   if(!sendDiplomaticFalcon(target,'dissolve',null,0,false,null,id))showToast('Unable to terminate agreement. Check SP and remaining actions.');
   return;
  }
  if(b.dataset.treatyAnswer!=null){respondTreatyOffer(Number(b.dataset.treatyAnswer),b.dataset.accept==='yes');return;}
  if(b.dataset.rescindWarning!=null){
   const warning=G.warnings.find(w=>w.id===Number(b.dataset.rescindWarning)&&w.from===0);
   if(warning)sendDiplomaticFalcon(warning.to,'retract',warning.tileId,0,false,warning.id);
   return;
  }
  if(b.dataset.peaceAnswer!=null){acceptCeasefire(Number(b.dataset.peaceAnswer),b.dataset.accept==='yes');return;}
  if(b.dataset.orderWar!=null){orderMilitary(panel.querySelector('#warDestination')?.value,Number(panel.querySelector('#warEnemy')?.value),panel.querySelector('#warPost')?.value,Number(panel.querySelector('#warQuantity')?.value||1),panel.querySelector('#warKind')?.value||'patrol',0,panel.querySelector('#warTransport')?.value||'foot');return;}
  if(b.dataset.recallWar!=null){recallMilitary(Number(b.dataset.recallWar));return;}
 });
 el('warBody').addEventListener('change',e=>{if(e.target.id!=='warKind')return;const panel=el('warBody'),options=panel.querySelector('[data-patrol-options]');if(!options)return;const raw=e.target.value==='flank'?options.dataset.flankOptions:options.dataset.patrolOptions;let list=[];try{list=JSON.parse(raw||'[]');}catch(e){}const select=panel.querySelector('#warDestination');if(select)select.innerHTML=list.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');});
 el('tradeBody').addEventListener('click',e=>{
  const panel=el('tradeBody'),counter=e.target.closest('[data-trade-counter]');
  if(counter){
   const id=Number(counter.dataset.tradeCounter),offer=G.tradeOffers.find(o=>o.id===id&&o.to===0);
   if(!offer)return;
   const own=panel.querySelector(`[data-counter-from="${id}"]`)?.value;
   const foreign=panel.querySelector(`[data-counter-to="${id}"]`)?.value;
   const share=Number(panel.querySelector(`[data-counter-share="${id}"]`)?.value);
   if(!counterTradeOffer(id,share,0,own,foreign))showToast('Cannot send counteroffer: check endpoints and 1 SP courier cost.');
   return;
  }
  const propose=e.target.closest('[data-trade-propose]');
  if(propose){
   const to=Number(propose.dataset.tradePropose);
   const share=panel.querySelector(`[data-trade-share="${to}"]`)?.value;
   const from=panel.querySelector(`[data-road-from="${to}"]`)?.value;
   const dest=panel.querySelector(`[data-road-to="${to}"]`)?.value;
   proposeTradeRoute(to,Number(share||50),0,from,dest);return;
  }
  const answer=e.target.closest('[data-trade-answer]');
  if(answer)respondTradeOffer(Number(answer.dataset.tradeAnswer),answer.dataset.accept==='yes');
 });
 el('economySummary').addEventListener('change',e=>{
  if(e.target.matches('[data-caravan-policy]')){getCountry().caravanPolicy=e.target.value;save();render();}
  if(e.target.matches('[data-hand-haul-policy]')){getCountry().handHaulingPolicy=e.target.value==='allow'?'allow':'wait';save();render();}
 });
 el('tradeBody').addEventListener('change',e=>{
  const choice=e.target.closest('[data-counter-from],[data-counter-to],[data-counter-share]');
  if(choice){refreshCounterEstimate(Number(choice.dataset.counterFrom||choice.dataset.counterTo||choice.dataset.counterShare));return;}
  const field=e.target.closest('[data-road-from],[data-road-to],[data-trade-share]');
  if(field)refreshRouteEstimate(Number(field.dataset.roadFrom||field.dataset.roadTo||field.dataset.tradeShare));
 });
 el('territoryDetails').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button||!active())return;const t=getSelected();if(!t)return;switch(button.dataset.action){case 'siege-world':showSheet('world');break;case 'expand':{const picked=[...el('territoryDetails').querySelectorAll('[data-expedition-citizen]')].map(node=>node.value).filter(Boolean);doExpand(t,0,picked);break;}case 'domestic-road':startDomesticRoad(t.id,button.dataset.roadNeighbor);break;case 'bridge':startBridge(t.id,button.dataset.bridgeNeighbor);break;case 'launch-boat':launchBoat(t,button.dataset.launchSite||'depot');break;case 'open-build':showBuild=true;showResearch=false;render();break;case 'sell':doSell(t,Number(button.dataset.index||0));break;case 'hire-worker':hireAt(t,Number(button.dataset.index||0));break;case 'release-worker':releaseAt(t,Number(button.dataset.index||0));break;case 'auto-workers':toggleAutoHire(t,Number(button.dataset.index||0));break;case 'upgrade':upgradeBuilding(t,Number(button.dataset.index||0));break;case 'add-builder':sendAdditionalBuilder(t,Number(button.dataset.job));break;case 'dispatch-store':{const idx=Number(button.dataset.index),item=button.dataset.item,site=worksite(t,idx);if(t.buildings[idx]!=='storageWarehouse'||!site)return;const select=el('territoryDetails').querySelector(`[data-storage-send-to="${idx}"][data-storage-good="${item}"]`);if(select?.value){const ok=dispatchShipment(0,site.id,select.value,item,Math.min(10,localCount(site,item)),false);showToast(ok?'Shipment dispatched with '+(GOOD_NAMES[item]||item):'No land bridge, reachable boat, available worker, or destination storage space');save();render();}break;}case 'recruit':doRecruit(t);break;case 'train':doTrain(t);break;}});
 el('territoryDetails').addEventListener('change',e=>{
   if(e.target.matches('[data-expedition-citizen]')){
    const panel=el('territoryDetails'),first=panel.querySelector('[data-expedition-citizen="0"]'),second=panel.querySelector('[data-expedition-citizen="1"]');
    if(first&&second&&first.value&&first.value===second.value)second.value='';
    if(second)for(const option of second.options)option.disabled=!!first?.value&&option.value===first.value;
    const send=panel.querySelector('[data-action="expand"]');
    if(send)send.disabled=!canAct()||send.dataset.expeditionAffordable!=='yes'||!first?.value;
    return;
   }
   const t=getSelected();if(!t)return;const choice=e.target.closest('[data-hand-haul-policy]');
  if(choice&&t.owner===0){getCountry().handHaulingPolicy=choice.value==='allow'?'allow':'wait';save();render();return;}
  const r=e.target.closest('[data-route-site]');if(r){setDeliveryRoute(t,Number(r.dataset.routeSite),r.dataset.routeGood,r.value);return;}const recipe=e.target.closest('[data-recipe-site]');if(recipe){setFactoryRecipe(t,Number(recipe.dataset.recipeSite),recipe.value);return;}
   const unload=e.target.closest('[data-unload-site]');if(unload){setUnloadMode(t,Number(unload.dataset.unloadSite),unload.value);return;}
   const driver=e.target.closest('[data-caravan-driver]');if(driver)setCaravanDriver(driver.dataset.caravanDriver,driver.value);});
 el('buildOptions').addEventListener('click',e=>{const b=e.target.closest('[data-build]');if(b&&canAct())doBuild(getSelected(),b.dataset.build);});
 el('researchOptions').addEventListener('click',e=>{const b=e.target.closest('[data-tech]');if(b&&canAct())doResearch(b.dataset.tech);});
 el('hand').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b)openCardPreview(Number(b.dataset.card));});
 el('rosterCitizensBtn').addEventListener('click',()=>{rosterTab='citizens';renderRoster();});
 el('rosterTroopsBtn').addEventListener('click',()=>{rosterTab='troops';renderRoster();});
 el('rosterList').addEventListener('change',e=>{const modern=e.target.closest('[data-equip-war]');if(modern?.value){equipWarItem(modern.dataset.equipWar,modern.value);return;}const equipment=e.target.closest('[data-equip-soldier]');if(equipment?.value){equipSoldier(equipment.dataset.equipSoldier,equipment.value);return;}const extra=e.target.closest('[data-equip-extra]');if(extra?.value){equipAuxiliary(extra.dataset.equipExtra,extra.value);return;}const select=e.target.closest('[data-move-soldier]');if(select?.value)moveSoldier(select.dataset.moveSoldier,select.value);});
 el('mineralBody').addEventListener('click',e=>{const smelt=e.target.closest('[data-smelt-steel]');if(smelt){smeltSteel();return;}const b=e.target.closest('[data-mineral]');if(b)mineralTrade(b.dataset.mineral,b.dataset.direction);});
 el('zoomIn').addEventListener('click',()=>zoom(.78));el('zoomOut').addEventListener('click',()=>zoom(1.28));el('zoomReset').addEventListener('click',resetView);el('focusHomeBtn').addEventListener('click',()=>{if(!cpuBusy)focusHome(false);});el('skipCpuBtn').addEventListener('click',()=>{skipCpuPlayback=true;el('cpuAction').textContent='Finishing remaining turns…';});
 const svg=el('worldMap');
 const pointers=new Map();let pinchLast=null,ignoreSyntheticClickUntil=0;
 // Hit test the current map. During camera transitions Safari may retarget a
 // pointer release to the SVG instead of the hex it originally touched.
 function hexIdAtPoint(clientX,clientY){
  if(!Number.isFinite(clientX)||!Number.isFinite(clientY))return null;
  for(const node of document.elementsFromPoint?.(clientX,clientY)||[]){
   if(!svg.contains(node))continue;
   const match=node.closest?.('[data-hex]');
   if(match&&svg.contains(match))return match.dataset.hex;
  }
  // Geometry fallback for mobile browsers following a map/SVG replacement.
  const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
  for(const poly of svg.querySelectorAll('.hex-hit')){
   const matrix=poly.getScreenCTM();if(!matrix)continue;
   let p;try{p=point.matrixTransform(matrix.inverse());}catch{continue;}
   const verts=poly.points;let inside=false;
   for(let i=0,j=verts.numberOfItems-1;i<verts.numberOfItems;j=i++){
    const a=verts.getItem(i),b=verts.getItem(j);
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
   }
   if(inside)return poly.closest('[data-hex]')?.dataset.hex||null;
  }
  return null;
 }
 svg.addEventListener('pointerdown',e=>{
  if(!G)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{svg.setPointerCapture(e.pointerId);}catch{}
  if(pointers.size===1){suppressClick=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,hexId:hexIdAtPoint(e.clientX,e.clientY)};pinchLast=null;}
  if(pointers.size===2){drag=null;const pts=[...pointers.values()];pinchLast=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);suppressClick=true;}
 });
 svg.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const pts=[...pointers.values()],dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
   if(pinchLast&&dist>0)zoom(Math.min(1.12,Math.max(.88,pinchLast/dist)));
   pinchLast=dist;return;
  }
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)drag.moved=true;
  if(drag.moved){const rect=svg.getBoundingClientRect();view.x-=dx/rect.width*view.w;view.y-=dy/rect.height*view.h;svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}
  drag.x=e.clientX;drag.y=e.clientY;
 });
 const clearPointer=(e,cancelled=false)=>{
  if(!pointers.has(e.pointerId))return;
  const tapped=!cancelled&&!!drag&&drag.id===e.pointerId&&!drag.moved&&pointers.size===1;
  const initialHex=tapped?drag.hexId:null;
  if(cancelled||drag?.moved||pointers.size>1){suppressClick=true;ignoreSyntheticClickUntil=performance.now()+350;}
  pointers.delete(e.pointerId);drag=null;if(pointers.size<2)pinchLast=null;
  if(tapped){ignoreSyntheticClickUntil=performance.now()+350;suppressClick=false;handleMapTap(e,initialHex);}
 };
 svg.addEventListener('pointerup',e=>clearPointer(e));
 svg.addEventListener('pointercancel',e=>clearPointer(e,true));
 function handleMapTap(e,initialHex=null){
  if(!G||cpuBusy||scenePlayback||cardEffectBusy)return;
  const id=initialHex||hexIdAtPoint(e.clientX,e.clientY)||e.target?.closest?.('[data-hex]')?.dataset.hex;
  if(!id||!G.tiles.some(t=>t.id===id))return;
  G.selectedId=id;showBuild=false;render();save();showSheet('territory');
 }
 svg.addEventListener('click',e=>{
  if(suppressClick||performance.now()<ignoreSyntheticClickUntil)return;
  handleMapTap(e);
 });
 svg.addEventListener('keydown',e=>{
  if(scenePlayback||cpuBusy||cardEffectBusy)return;
  if(['Enter',' '].includes(e.key)&&e.target.matches('[data-hex]')){
   e.preventDefault();handleMapTap(e,e.target.dataset.hex);
  }
 });
 svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.12:.89);},{passive:false});
 // Rotation and Safari browser chrome can fire multiple competing resize
 // events. Coalesce them into one viewport-only update without rebuilding SVG
 // world objects, moving the map center or opening/closing the game sheet.
 window.addEventListener('resize',scheduleMapViewportReflow,{passive:true});
 window.addEventListener('orientationchange',()=>{
  // iOS can retain an interrupted touch after a hardware orientation change.
  // Clear stale pan/pinch pointers so a return to portrait doesn't jitter.
  pointers.clear();drag=null;pinchLast=null;suppressClick=true;
  setTimeout(()=>{suppressClick=false;},220);
  lastViewportLayoutKey='';
  scheduleMapViewportReflow();
 },{passive:true});
 window.visualViewport?.addEventListener('resize',scheduleMapViewportReflow,{passive:true});
 el('modalLayer').addEventListener('click',e=>{const b=e.target.closest('[data-modal]');if(b?.dataset.modal?.startsWith('siege-')){handleSiegeInboxAction(b);return;}if(b?.dataset.modal?.startsWith('falcon-')){handleFalconMessageAction(b);return;}if(!b){if(e.target===el('modalBackdrop'))closeModal();return;}switch(b.dataset.modal){case'close':closeModal();break;case'new-confirm':confirmNew();break;case'new':try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(OLD_SAVE_KEY);}catch(e){}newMatch();break;case'continue':G.finished=false;G.continued=true;G.maxRounds=Math.max(G.round+16,G.maxRounds+16);G.round++;beginTurn(0);cpuBusy=false;save();closeModal();render();break;}});
}
try{
 mountMapUi();renderLobby();bindEvents();
 el('runtimeNotice').classList.add('hidden');
}catch(e){
 console.error('Global Standoff initialization error',e);
 const notice=el('runtimeNotice');
 if(notice){notice.innerHTML='<b>The game could not initialize.</b><span>Open this game on a normal HTTPS website in Safari or Chrome.</span>';
   notice.classList.remove('hidden');}
}
// Debug-only hook for automated smoke testing; does not modify the game's rules.
window.GS_TEST={warSkill,warAttackSpeed,warWeaponDamage,warDefense,warChooseAfternath,warDestroyTerritory,warFightWindow,warCartAtPost,warSeatTroops,warDriverReady,beanPerson,beanPushCart,warAftermathPanelHtml,WAR_EQUIPMENT,WAR_SLOT_ITEMS,SIEGE_ATTACK_ORDERS,SIEGE_DEFEND_ORDERS,activeSiege,canStartSiege,startSiege,progressSiegeMarches,setSiegeOrder,resolveSieges,finishSiege,captureSiegeTerritory,siegeMapVisuals,siegeWarPanelHtml,siegeReinforcementHtml,canReinforceSiege,reinforceSiege,progressSiegeReinforcements,siegeBlocksDelivery,pendingSiegeNotice,presentSiegeInbox,TREATY_TYPES,activeTreaty,canProposeTreaty,expireTreaties,respondTreatyOffer,resolveTreatyOffer,startWar,counterTradeOffer,refreshCounterEstimate,visibleTerritorialWarnings,threatenedHexBorders,checkWarningViolation,isBusyExpedition,eligibleExpeditionCitizens,progressExpeditions,clearExpedition,fixedFalconBillboard,falconVisuals,diplomaticFalconVisuals,handHaulingAllowed,availablePorter,progressPorterJob,porterTicks,caravanWarehouseStatus,citizenDeathProbability,advanceCitizenHealthAndMortality,tileDepthSprites,sortWorldDepth,unreadFalconDispatches,presentFalconInbox,handleFalconMessageAction,ownedTerritoryOutlines,edgedRoadSegment,wagonRoadTrace,wagonViewArtwork,caravanVisuals,expeditionTrailVisuals,domesticRoadExists,canStartDomesticRoad,startDomesticRoad,progressDomesticRoads,countryTravelRoute,pathCost,domesticRoadKey,sendDiplomaticFalcon,progressDiplomaticFalcons,currentWar,startWar,sendWarningViolation:checkWarningViolation,orderMilitary,recallMilitary,progressWarOrders,militaryTravelPath,roadExistsBetween,renderWarPanel,acceptCeasefire,getState:()=>G,getCinematic:()=>({lastAction:cpuLastAction,scene:scenePlayback?{tileId:scenePlayback.tileId,kind:scenePlayback.kind,phase:scenePlayback.phase}:null,highlight:actionTileId,cpuBusy}),select:(id)=>{if(!G)return;G.selectedId=id;render();},endTurn,render,doBuild,doExpand,doRecruit,doTrain,moveSoldier,finishRound,peopleSummary,buildUsed,buildFree,focusHome,resetView,moveCamera,runCpuCinematic,sceneCoords,showSheet,closeSheet,openCardPreview,closeCardPreview,actionsRemaining,runCpu,beginTurn,volunteeringChance,proposeTradeRoute,respondTradeOffer,tradePlan,discoverContacts,doMarketing,progressProjects,progressTradeRoutes,progressTradeOffers,tradePlan,decideTradeOffer,showCompletedProjects,migrateGameplay,ensureBuildingMeta,assignWorkers,workQuality,workCapacity,hireAt,releaseAt,toggleAutoHire,upgradeBuilding,extractMinesForRound,processSteelworks,gearReadiness,createWorld,getEconomy,canBuild,upgradePrice,workforceSummary,GEAR,BUILDINGS,RECIPES,siteLookup,dispatchShipment,progressShipments,runAgricultureAndForestry,autoDispatchOutputs,autoRequestFactoryInputs,processFactories,siteStorageCapacity,endpointStorageFree,endpointDeliverySpace,storedAt,nearbyStorage,postStock,setDeliveryRoute,setUnloadMode,sourceUnloadMode,unloadWithinHex,unloadAllowance,clearFullUnloadBatch,optimizedUnloadTask,outputPickupTasks,scheduleAutoCaravan,caravanDriver,caravanHasDriver,setCaravanDriver,syncCaravans,setFactoryRecipe,equipAuxiliary,depotCount,localCount,advanceWorldTurn,buildersSummary,idleBuilders,syncBuilders,showCompletedProjects,progressExpeditions,sendAdditionalBuilder,eligibleExpansion,expeditionForTile,buildingCount,tileHousing};
})();

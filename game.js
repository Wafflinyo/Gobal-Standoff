/* Global Standoff 0.4.15 — bounded debt and two-sided road ownership highlights. */
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
 woodPlanks:{name:'Construction Wood',input:{logs:2},output:'wood',amount:3},
 woodShield:{name:'Wooden Shield',input:{logs:2},output:'woodShield'},
 stoneAxe:{name:'Stone Axe',input:{stone:2,wood:1},output:'stoneAxe'},
 stonePickaxe:{name:'Stone Pickaxe',input:{stone:2,wood:1},output:'stonePickaxe'},
 stoneSword:{name:'Stone Sword',input:{stone:3,wood:1},output:'stoneSword'},
 stoneClub:{name:'Stone Club',input:{stone:2,wood:1},output:'stoneClub'},
 ironArmor:{name:'Iron Armor',input:{iron:2},output:'ironArmor'},
 steelArmor:{name:'Steel Armor',input:{steel:2},output:'steelArmor'},
 goldArmor:{name:'Gold-Reinforced Steel',input:{steel:2,goldOre:1},output:'goldArmor'},
 diamondArmor:{name:'Diamond-Reinforced Steel',input:{steel:2,diamond:1},output:'diamondArmor'}
};
const FACTORY_RECIPES={foundry:['steel'],leatherFactory:['leatherArmor'],woodworks:['woodPlanks','woodShield'],stoneworks:['stoneAxe','stonePickaxe','stoneSword','stoneClub'],armory:['ironArmor','steelArmor','goldArmor','diamondArmor']};
const OUTPUTS={farm:['food','leather'],lumber:['logs'],mine:['stone',...MINERAL_KEYS],foundry:['steel'],leatherFactory:['leatherArmor'],woodworks:['wood','woodShield'],stoneworks:['stoneAxe','stonePickaxe','stoneSword','stoneClub'],armory:['ironArmor','steelArmor','goldArmor','diamondArmor']};
const GOOD_NAMES={food:'Food',logs:'Timber Logs',wood:'Construction Wood',stone:'Stone',leather:'Raw Leather',coal:'Coal',iron:'Iron',copper:'Copper',silver:'Silver',goldOre:'Gold Ore',diamond:'Diamonds',steel:'Steel',woodShield:'Wooden Shield',stoneAxe:'Stone Axe',stonePickaxe:'Stone Pickaxe',stoneSword:'Stone Sword',stoneClub:'Stone Club',leatherArmor:'Leather Armor',ironArmor:'Iron Armor',steelArmor:'Steel Armor',goldArmor:'Gold-Reinforced Steel',diamondArmor:'Diamond-Reinforced Steel'};
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
function gearReadiness(c){return 10+2*(c.military?.training||1)+Math.floor((c.military?.experience||0)/3)+(GEAR[c.military?.gear]?.bonus||0)+(c.military?.shield==='woodShield'?2:0)+(c.military?.weapon?.startsWith('stone')?2:0);}

const BUILDINGS={
 farm:{name:'Farm',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>',gold:4,wood:2,iron:0,space:2,rounds:1,upkeep:1,jobs:[2,4,6],production:{},allow:['plains','forest','hills'],text:'Workers produce Food and raw Leather · both must be delivered'},
 lumber:{name:'Lumber Camp',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-forest"></use></svg>',gold:4,wood:1,iron:0,space:2,rounds:2,upkeep:1,jobs:[2,4,6],production:{},allow:['forest'],text:'Workers harvest Timber Logs · ship logs to Woodworks'},
 mine:{name:'Mine',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-mine"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['mountain'],text:'Produces Stone on EVERY mountain plus any mineral veins'},
 homes:{name:'Homes',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-homes"></use></svg>',gold:5,wood:2,iron:0,space:1,rounds:1,upkeep:1,jobs:[0,0,0],production:{},allow:['plains','forest','hills','desert','mountain'],text:'+8 housing spaces · no workers required · occupied family homes earn Silver Pents'},
 market:{name:'Marketplace',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-market"></use></svg>',gold:7,wood:2,iron:1,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{gold:5},allow:['plains','forest','hills','desert','mountain'],text:'Silver Pents income scales with worker staffing and morale'},
 academy:{name:'Academy',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-book"></use></svg>',gold:8,wood:2,iron:2,space:2,rounds:3,upkeep:2,jobs:[2,3,4],production:{knowledge:3},allow:['plains','forest','hills','desert','mountain'],text:'Research output requires staffed teachers'},
 caravanWarehouse:{name:'Caravan Warehouse',icon:'▣',gold:8,wood:5,iron:0,space:2,rounds:2,upkeep:1,jobs:[0,0,0],production:{},allow:['plains','forest','hills','desert'],text:'Houses 1 / 2 / 3 caravans by level; shipments require an available wagon'},
 storageWarehouse:{name:'Storage Warehouse',icon:'▤',gold:7,wood:4,iron:0,space:2,rounds:2,upkeep:1,jobs:[0,0,0],production:{},allow:['plains','forest','hills','desert','mountain'],text:'Holds 40 / 80 / 140 goods at levels 1 / 2 / 3. Nearby factories can collect supplies here.'},
 builderBunk:{name:'Builders’ Bunk',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-builder"></use></svg>',gold:8,wood:3,iron:0,space:1,rounds:2,upkeep:1,jobs:[0,0,0],production:{},allow:['plains','forest','hills','desert','mountain'],text:'Houses 1 / 2 / 3 active builders by level. Builders travel before working'},
 post:{name:'Military Post',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-shield"></use></svg>',gold:8,wood:2,iron:2,space:2,rounds:2,upkeep:2,jobs:[1,2,3],production:{},allow:['plains','forest','hills','desert','mountain'],text:'Administrative staff support recruitment and the 12-troop garrison'},
 foundry:{name:'Steelworks Factory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-foundry"></use></svg>',gold:10,wood:3,iron:3,space:2,rounds:3,upkeep:3,jobs:[2,4,6],production:{},allow:['plains','hills'],text:'Receives Iron + Coal shipments and smelts Steel'},
 leatherFactory:{name:'Leather Factory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-thread"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['plains','forest','hills'],text:'Raw Leather → Leather Armor; send gear to a military post'},
 woodworks:{name:'Woodworks Factory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-saw"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['forest','plains','hills'],text:'Timber Logs → Construction Wood or Wooden Shields'},
 stoneworks:{name:'Stone Workshop',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-axe"></use></svg>',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,jobs:[2,4,6],production:{},allow:['plains','hills','mountain'],text:'Stone + Wood → axes, pickaxes, swords or clubs'},
 armory:{name:'Armory',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-builder"></use></svg>',gold:10,wood:2,iron:2,space:2,rounds:3,upkeep:3,jobs:[2,4,6],production:{},allow:['plains','hills'],text:'Produces Iron, Steel, SP and Diamond armor from delivered metal'}
};
const TECHS={irrigation:{name:'Irrigation',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-water"></use></svg>',gold:3,knowledge:4,desc:'+1 Food per Farm, every round.'},commerce:{name:'Commerce',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg>',gold:4,knowledge:5,desc:'+1 Silver Pent per Marketplace, every round.'},cartography:{name:'Cartography',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-compass"></use></svg>',gold:4,knowledge:5,desc:'Expansion costs 2 less SP.'}};
const CARDS={grant:{name:'Royal Grant',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-pent"></use></svg>',desc:'Gain 6 SP.'},harvest:{name:'Great Harvest',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>',desc:'Gain 5 Food.'},supplies:{name:'Supply Caravan',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg>',desc:'Gain 3 Wood and 2 Iron.'},insight:{name:'Discovery',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-scroll"></use></svg>',desc:'Gain 3 Knowledge.'},charter:{name:'Frontier Charter',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-map"></use></svg>',desc:'Next expansion costs 3 less SP.'},permit:{name:'Building Permit',icon:'<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg>',desc:'Next building costs 3 less SP.'}};
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
 const candidates=p.citizens.filter(c=>c.age>=18&&!c.military&&!c.builder&&c.health>=25).sort((a,b)=>(!!a.job)-(!!b.job)||b.health-a.health||b.morale-a.morale);
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
  p.expeditions??=[{id:`exp-${p.id}-1`,name:'Frontier Expedition',level:1,locationId:capital.id,targetId:null,remaining:0}];
  for(const c of p.citizens){c.builder??=null;if(c.builder)c.job=null;}
  syncBuilders(p,world);
 }
}
function idleExpedition(p){return (p.expeditions||[]).find(crew=>!crew.targetId);}
function expeditionForTile(tileId){return G.players.flatMap(p=>(p.expeditions||[]).map(crew=>({...crew,owner:p.id}))).find(c=>c.targetId===tileId);}
function pendingClaim(tileId){return G.players.some(p=>(p.expeditions||[]).some(c=>c.targetId===tileId));}
function progressExpeditions(){
 for(const p of G.players)for(const crew of p.expeditions||[]){
  if(!crew.targetId||(G.turnClock||0)<=(crew.startedClock??-2)+1)continue;
  crew.remaining=Math.max(0,crew.remaining-1);
  if(crew.remaining>0)continue;
  const tile=G.tiles.find(t=>t.id===crew.targetId);
  if(tile&&tile.owner===null&&tile.terrain!=='water'&&neighbors(tile).some(n=>n.owner===p.id)){
   tile.owner=p.id;reallocateHousing(p);discoverContacts();checkWarningViolation(tile,p.id);
   G.completedScenes.push({projectId:`claim-${p.id}-${tile.id}-${G.turnClock}`,owner:p.id,tileId:tile.id,kind:'expand'});
   addLog(`${p.name}'s expedition established control of ${tile.name}.`);
  }
  crew.locationId=tile?.owner===p.id?tile.id:crew.locationId;crew.targetId=null;
 }
}
function advanceWorldTurn(){
 G.turnClock=(G.turnClock||0)+1;
 progressExpeditions();progressProjects();progressDomesticRoads();progressDiplomaticFalcons();progressWarOrders();progressTradeOffers();progressTradeRoutes();progressShipments();
 save();
}

function worksite(t,index){return t.buildingMeta?.[index]||null;}
function workCapacity(type,level){const spaces=BUILDINGS[type]?.jobs||[0,0,0];return spaces[Math.max(0,Math.min(2,level-1))]||0;}
function worksiteWorkers(p,site){return site?p.citizens.filter(c=>c.job?.siteId===site.id&&!c.military&&c.age>=18):[];}
function eligibleWorker(c){return c.age>=18&&!c.military&&!c.builder&&c.health>=25;}
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
  if(!site||!eligibleWorker(c)||(staff.get(site.meta.id)||0)>=site.capacity){c.job=null;continue;}
  staff.set(site.meta.id,(staff.get(site.meta.id)||0)+1);
 }
 const priority={builderBunk:20,storageWarehouse:18,caravanWarehouse:18,farm:0,lumber:1,mine:2,leatherFactory:3,woodworks:4,stoneworks:5,foundry:6,armory:7,market:8,academy:9,post:10,homes:11};
 sites.sort((a,b)=>(priority[a.kind]??9)-(priority[b.kind]??9));
 const unemployed=p.citizens.filter(c=>eligibleWorker(c)&&!c.job).sort((a,b)=>b.morale-a.morale||b.health-a.health||a.id.localeCompare(b.id));
 for(const site of sites){
  if(!site.meta.autoHire)continue;
  let used=staff.get(site.meta.id)||0;
  while(used<site.capacity&&unemployed.length){const c=unemployed.shift();c.job={siteId:site.meta.id,tileId:site.tile.id};used++;}
  staff.set(site.meta.id,used);
 }
}
function workforceSummary(p){
 const employed=p.citizens.filter(c=>!!c.job&&!c.military).length;
 const available=p.citizens.filter(c=>eligibleWorker(c)&&!c.job).length;
 return {employed,available,wages:employed};
}
function workQuality(p,site,type){
 const level=site?.level||1,workers=worksiteWorkers(p,site),slots=workCapacity(type,level);
 const morale=workers.length?workers.reduce((sum,c)=>sum+c.morale,0)/workers.length:0;
 const ratio=slots?workers.length/slots:0;
 const efficiency=workers.length?Math.max(.35,Math.min(1.35,.50+morale/110)):0;
 return {count:workers.length,slots,level,morale,ratio,efficiency};
}
function hireAt(t,index,id=0){
 const p=G.players[id],site=worksite(t,index),type=t.buildings[index];
 if(!active()||t.owner!==id||!site)return false;
 const q=workQuality(p,site,type),worker=p.citizens.filter(c=>eligibleWorker(c)&&!c.job).sort((a,b)=>b.morale-a.morale)[0];
 if(!worker||q.count>=q.slots)return false;
 worker.job={tileId:t.id,siteId:site.id};site.autoHire=false;save();render();showToast(`${worker.name} hired at ${BUILDINGS[type].name}`);return true;
}
function releaseAt(t,index,id=0){
 const p=G.players[id],site=worksite(t,index);
 if(!active()||t.owner!==id||!site)return false;
 const workers=worksiteWorkers(p,site);
 if(!workers.length)return false;
 workers[workers.length-1].job=null;site.autoHire=false;save();render();showToast('Worker released');return true;
}
function toggleAutoHire(t,index,id=0){
 const p=G.players[id],site=worksite(t,index);
 if(!active()||t.owner!==id||!site)return false;
 site.autoHire=!site.autoHire;
 if(site.autoHire)assignWorkers(p);
 save();render();return true;
}
function upgradePrice(t,index){
 const meta=worksite(t,index),b=BUILDINGS[t.buildings[index]];
 return meta&&meta.level<3?{gold:b.gold+3*meta.level,wood:2*meta.level,iron:meta.level}:null;
}
function upgradeBuilding(t,index,id=0){
 const p=G.players[id],meta=worksite(t,index),cost=upgradePrice(t,index);
 if(!canCountryAct(p,id)||!allowed(p,t)||!meta||!cost)return false;
 if(!idleBuilders(p).length||G.projects.some(j=>j.upgradeSiteId===meta.id)||!hasMoney(p,cost.gold)||p.wood<cost.wood||mineralCount(p,'iron')<cost.iron)return false;
 p.gold-=cost.gold;p.wood-=cost.wood;p.minerals.iron-=cost.iron;
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
function incomingReserved(owner,endpoint){
 return G.shipments.filter(j=>j.owner===owner&&String(j.to)===String(endpoint)&&j.stage!=='return').reduce((n,j)=>n+(j.qty||0),0);
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
function nearbyStorage(p,tile,item){
 const stores=[{id:'depot',tile:siteLookup(p.id,'depot')?.tile},...G.tiles.filter(t=>t.owner===p.id).flatMap(t=>t.buildings.map((kind,i)=>kind==='storageWarehouse'?{id:t.buildingMeta?.[i]?.id,tile:t}:null).filter(Boolean))];
 return stores.map(o=>({...o,path:o.tile&&ownedPath(p.id,tile,o.tile)})).filter(o=>o.path&&endpointDeliverySpace(p,o.id)>0)
  .sort((a,b)=>a.path.length-b.path.length)[0]||null;
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
function domesticMoveCost(a,b){return roadExistsBetween(a,b)?1:2;}
// Dijkstra prefers a fully paved route, even when it is slightly longer in hexes.
function countryTravelRoute(owner,start,end,allowNeutralDestination=false){
 if(!start||!end||start.owner!==owner||end.terrain==='water'||(end.owner!==owner&&!(allowNeutralDestination&&end.owner===null)))return null;
 const lookup=new Map(G.tiles.map(t=>[t.id,t])),dist=new Map([[start.id,0]]),prev=new Map(),pending=new Set([start.id]);
 while(pending.size){let at=null,best=Infinity;for(const id of pending){const d=dist.get(id);if(d<best){best=d;at=id;}}pending.delete(at);
  if(at===end.id)break;
  const tile=lookup.get(at);if(!tile)continue;
  for(const n of neighbors(tile)){
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
 const p=G.players[owner];return !!a&&!!b&&a.owner===owner&&b.owner===owner&&a.terrain!=='water'&&b.terrain!=='water'&&distance(a,b)===1&&!domesticRoadExists(a,b)&&!roadJobBetween(a,b)&&idleBuilders(p).length>0&&hasMoney(p,LOCAL_ROAD_SP)&&p.wood>=LOCAL_ROAD_WOOD;
}
function startDomesticRoad(aId,bId,owner=0){
 const p=G.players[owner],a=G.tiles.find(t=>t.id===aId),b=G.tiles.find(t=>t.id===bId);
 if(!canCountryAct(p,owner)||!canStartDomesticRoad(a,b,owner))return false;
 const worker=idleBuilders(p)[0],origin=G.tiles.find(t=>t.id===worker.builder.locationId)||capitalOf(owner),roadId=G.nextDomesticRoadId++;
 const route=countryTravelRoute(owner,origin,a);if(!route)return false;
 const job={id:roadId,key:domesticRoadKey(aId,bId),owner,aId,bId,builderId:worker.id,remaining:2,startedClock:G.turnClock||0};
 p.gold-=LOCAL_ROAD_SP;p.wood-=LOCAL_ROAD_WOOD;
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
function domesticRoadVisuals(){
 const visuals=[];
 for(const road of [...(G.domesticRoads||[]),...(G.domesticRoadJobs||[])]){
  const a=G.tiles.find(t=>t.id===road.aId),b=G.tiles.find(t=>t.id===road.bId);if(!a||!b)continue;
  const points=domesticRoadEdge(a,b);if(points.length!==2)continue;
  visuals.push(edgedRoadSegment(project(points[0].x,points[0].y),project(points[1].x,points[1].y),[a.id,b.id],road.remaining==null));
 }
 return `<g class="gs-domestic-road" pointer-events="none">${visuals.join('')}</g>`;
}
// Caravans are physical, limited units housed in Caravan Warehouses, not invisible timers.
function caravanWarehouses(p){
 const sites=[];
 for(const tile of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<tile.buildings.length;i++)if(tile.buildings[i]==='caravanWarehouse')
  sites.push({tile,site:tile.buildingMeta[i],capacity:Math.max(1,Math.min(3,tile.buildingMeta[i].level||1))});
 return sites;
}
function syncCaravans(p){
 p.caravans??=[];const warehouses=caravanWarehouses(p),valid=new Set(warehouses.map(w=>w.site.id));
 for(const cart of [...p.caravans])if(!valid.has(cart.homeSiteId)&&!cart.shipmentId)p.caravans.splice(p.caravans.indexOf(cart),1);
 for(const base of warehouses){
  const home=p.caravans.filter(c=>c.homeSiteId===base.site.id);
  while(home.length<base.capacity){
   const cart={id:p.id+'-cart-'+base.site.id+'-'+home.length,owner:p.id,homeSiteId:base.site.id,currentTileId:base.tile.id,shipmentId:null};
   p.caravans.push(cart);home.push(cart);
  }
  while(home.length>base.capacity){const cart=home.find(c=>!c.shipmentId);if(!cart)break;p.caravans.splice(p.caravans.indexOf(cart),1);home.splice(home.indexOf(cart),1);}
 }
}
function availableCaravan(owner,pickup){
 const p=G.players[owner];syncCaravans(p);
 return p.caravans.filter(c=>!c.shipmentId).map(c=>{
  const from=G.tiles.find(t=>t.id===c.currentTileId),path=ownedPath(owner,from,pickup);
  return {cart:c,path,cost:path?pathCost(owner,path):Infinity};
 }).filter(c=>c.path).sort((a,b)=>a.cost-b.cost)[0]||null;
}
function dispatchShipment(owner,from,to,item,qty,auto=false){
 const p=G.players[owner],src=siteLookup(owner,from),dst=siteLookup(owner,to),amount=Math.floor(qty);
 if(!p||!src?.tile||!dst?.tile||String(from)===String(to)||amount<1)return false;
 const reservedFrom=G.shipments.filter(j=>j.owner===owner&&String(j.from)===String(from)&&j.item===item&&j.stage==='pickup').reduce((n,j)=>n+j.qty,0);
 const freeSource=Math.max(0,endpointCount(p,from,item)-reservedFrom);
 const qtyFit=Math.min(10,amount,freeSource,endpointDeliverySpace(p,to));
 if(qtyFit<1)return false;
 const delivery=ownedPath(owner,src.tile,dst.tile);if(!delivery)return false;
 const available=availableCaravan(owner,src.tile);if(!available)return false;
 const id=G.nextShipmentId++;
 const job={id,owner,from,to,item,qty:qtyFit,stage:'pickup',path:available.path,step:0,
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
function moveCaravanToStage(job,cart,p){
 // Deliveries take at least one later player turn per hex. There is no teleportation.
 const stage=job.stage,path=job.path||[];
 if(job.step<path.length-1){
  // A wagon has two movement points per turn: paved borders cost 1, unpaved cost 2.
  const previousStep=job.step;
  let budget=2;
  while(job.step<path.length-1){
   const a=G.tiles.find(t=>t.id===path[job.step]),b=G.tiles.find(t=>t.id===path[job.step+1]);
   if(!a||!b)break;
   const need=domesticMoveCost(a,b);if(need>budget)break;
   budget-=need;job.step++;cart.currentTileId=path[job.step];
  }
  job.remaining=Math.ceil(pathCost(job.owner,path.slice(job.step))/2);
  if(job.step>previousStep)job.visualMove={clock:G.turnClock||0,path:[...path],fromStep:previousStep,toStep:job.step};
  return;
 }
 if(stage==='pickup'){
  const available=Math.min(job.qty,endpointCount(p,job.from,job.item));
  if(available<=0){job.qty=0;job.stage='return';}
  else {job.qty=available;endpointAdd(p,job.from,job.item,-available);job.stage='delivery';}
  const source=G.tiles.find(t=>t.id===job.fromTileId),dest=G.tiles.find(t=>t.id===job.toTileId);
  job.path=job.stage==='delivery'?ownedPath(job.owner,source,dest):ownedPath(job.owner,source,siteLookup(job.owner,job.homeSiteId)?.tile||source);
  job.step=0;job.remaining=Math.max(1,Math.ceil(pathCost(job.owner,job.path)/2));return;
 }
 if(stage==='delivery'||stage==='unloading'){
  const validDestination=siteLookup(job.owner,job.to);
  if(!validDestination){
   // A demolished site does not magically teleport cargo home; carry it to the capital.
   const capital=siteLookup(job.owner,'depot');
   job.to='depot';job.toTileId=capital?.tile?.id;
   const from=G.tiles.find(t=>t.id===cart.currentTileId);
   job.path=ownedPath(job.owner,from,capital?.tile)||[from?.id].filter(Boolean);
   job.step=0;job.stage='delivery';return;
  }
  const unloaded=endpointAdd(p,job.to,job.item,job.qty);
  job.qty-=unloaded;
  if(job.qty>0){job.stage='unloading';job.remaining=0;return;}
  if(job.owner===0)addLog(`${unloaded} ${GOOD_NAMES[job.item]||job.item} arrived at ${G.tiles.find(t=>t.id===job.toTileId)?.name}.`);
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
function progressShipments(){
 for(const job of [...G.shipments]){
  const p=G.players[job.owner],cart=p?.caravans?.find(c=>c.id===job.caravanId);
  if(!p||!cart){if(p&&job.qty&&['delivery','unloading'].includes(job.stage))addDepot(p,job.item,job.qty);G.shipments.splice(G.shipments.indexOf(job),1);continue;}
  if((G.turnClock||0)<=(job.startedClock??-2)+1)continue;
  moveCaravanToStage(job,cart,p);
 }
}
function shippingDashboard(){
 const p=getCountry(),jobs=G.shipments.filter(j=>j.owner===0),carts=p.caravans||[];
 return `<div class="gs-shipping-summary"><b>Caravan logistics · ${carts.filter(c=>!c.shipmentId).length}/${carts.length} wagons available</b>
  <small>Build Caravan Warehouses with Wood to house wagons. Each shipment travels warehouse → pickup → delivery → warehouse over individual turns.</small>
  <label class="gs-routing-label">After delivery <select data-caravan-policy><option value="nearest" ${p.caravanPolicy==='nearest'?'selected':''}>Closest warehouse</option><option value="home" ${p.caravanPolicy==='home'?'selected':''}>Original warehouse</option><option value="stay" ${p.caravanPolicy==='stay'?'selected':''}>Stay if destination has space</option></select></label>
  ${jobs.slice(0,12).map(j=>`<div class="gs-shipment-row">${j.qty} ${GOOD_NAMES[j.item]||j.item} · ${esc(G.tiles.find(t=>t.id===j.fromTileId)?.name||'Depot')} → ${esc(G.tiles.find(t=>t.id===j.toTileId)?.name||'Depot')} <strong>${esc(j.stage)} · ${j.remaining}T</strong></div>`).join('')}</div>`;
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
  }else{const free=endpointStorageFree(p,site.id);if(free>=1)addLocal(site,'logs',Math.min(free,Math.max(1,Math.round(3*factor))));}
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
function autoDispatchOutputs(){
 for(const p of G.players)for(const t of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<t.buildings.length;i++){
  const kind=t.buildings[i],site=worksite(t,i);
  for(const item of OUTPUTS[kind]||[]){
   const count=localCount(site,item);if(count<1)continue;
   let to=site.routes?.[item]??null;
   if(p.id!==0&&to===null&&(['woodShield','leatherArmor','ironArmor','steelArmor','goldArmor','diamondArmor'].includes(item)||item.startsWith('stone'))){const post=getMilitaryPosts(p.id)[0];if(post)to=postStock(p,post.id)?.id||'depot';}
   if(to===null)to=nearbyStorage(p,t,item)?.id||'depot';
   if(String(to)===String(site.id)||!siteLookup(p.id,to))continue;
   dispatchShipment(p.id,site.id,to,item,Math.min(10,count),true);
  }
 }
}
function autoRequestFactoryInputs(){
 for(const p of G.players)for(const t of G.tiles.filter(t=>t.owner===p.id))for(let i=0;i<t.buildings.length;i++){
  const kind=t.buildings[i],site=worksite(t,i),rec=RECIPES[site?.recipe];
  if(!FACTORY_RECIPES[kind]||!rec)continue;
  for(const [item,amount] of Object.entries(rec.input)){
   const queued=G.shipments.filter(j=>j.owner===p.id&&j.to===site.id&&j.item===item).reduce((n,j)=>n+j.qty,0);
   const needed=Math.max(0,amount*(site.level||1)*2-localCount(site,item)-queued);
   const free=Math.max(0,endpointDeliverySpace(p,site.id));
   if(needed>0&&free>0){
    const sources=storedAt(p,item).map(source=>({...source,path:ownedPath(p.id,source.tile,t)})).filter(o=>o.path&&String(o.id)!==String(site.id)).sort((a,b)=>a.path.length-b.path.length);
    for(const source of sources){if(dispatchShipment(p.id,source.id,site.id,item,Math.min(10,needed,free,source.count),true))break;}
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
 const p=getCountry(),site=worksite(tile,index);
 if(!active()||!site||tile.owner!==0||!(OUTPUTS[tile.buildings[index]]||[]).includes(item)||!siteLookup(0,destination)||destination===String(site.id))return false;
 if(!ownedPath(0,tile,siteLookup(0,destination).tile))return false;
 site.routes??={};site.routes[item]=destination==='depot'?'depot':Number(destination);
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
 age:starting?18+randInt(rng,48):(rng()<.67?18+randInt(rng,38):randInt(rng,17)),health:45+randInt(rng,56),morale:40+randInt(rng,61),homeId:null,military:null,job:null};
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
function newCitizensForRound(p){
 const summary=peopleSummary(p);if(p.food<=0||summary.homeless>=7||summary.count>=150)return;
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
 const players=[{name,capital,sigil:'GS'},...NPCS].map((p,i)=>({id:i,name:p.name,capital:p.capital,sigil:p.sigil,color:colors[i],gold:34,food:14,wood:16,minerals:{...START_MINERALS},knowledge:0,marketingUntil:0,warehouse:{},tech:[],hand:[],discountExpand:0,discountBuild:0,acted:false,actionsUsed:0,expansionsThisTurn:0,levyUsed:false,cardPlayed:false,logisticsUsed:false,citizens:[],nextCitizenId:0,caravans:[],caravanPolicy:'nearest'}));
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
 G={version:2,waterwayVersion:2,seed,worldName,worldOptions:options,rivers,players,tiles,projects:[],completedScenes:[],shipments:[],nextShipmentId:1,logisticsVersion:1,contacts:[],tradeOffers:[],tradeRoutes:[],domesticRoads:[],domesticRoadJobs:[],nextDomesticRoadId:1,diplomaticFalcons:[],warnings:[],wars:[],militaryOrders:[],nextDiplomacyId:1,nextOrderId:1,nextProjectId:1,nextTradeId:1,nextBuildingId:1,turnClock:0,crewVersion:1,round:1,turnIndex:0,maxRounds:MAX_ROUNDS,selectedId:key(...CAPITAL_SPOTS[0]),deck,drawIndex:0,log:[],finished:false,continued:false};
 for(const p of players){const citizenRng=mulberry32(hash(seed+'-people-'+p.id));for(let k=0;k<10;k++)p.citizens.push(makeCitizen(p,citizenRng,true));reallocateHousing(p);drawCard(p);drawCard(p);}
 ensureBuildingMeta(G);ensureStartingCrews(G);for(const p of G.players){reallocateHousing(p);assignWorkers(p);syncCaravans(p);}
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
 s.shipments??=[];s.nextShipmentId??=1; s.diplomaticFalcons??=[];s.warnings??=[];s.wars??=[];s.militaryOrders??=[];s.nextDiplomacyId??=1;s.nextOrderId??=1;
 s.logisticsRouteVersion??=0;
 s.tradeOffers=s.tradeOffers||[];s.tradeRoutes=s.tradeRoutes||[];s.domesticRoads??=[];s.domesticRoadJobs??=[];s.nextDomesticRoadId??=1;
 s.nextProjectId=s.nextProjectId||1;s.nextTradeId=s.nextTradeId||1;
 s.nextBuildingId=s.nextBuildingId||1;
 prepareMineralVeins(s.tiles,s.seed,false);
 ensureBuildingMeta(s);
 // Barren legacy mines keep extracting Stone; never manufacture Iron veins merely to preserve an old mine.
 for(const p of s.players){
  if(p.materials!==undefined){const old=Math.max(0,p.materials);p.wood=(p.wood||0)+Math.ceil(old*.6);p.ore=(p.ore||0)+Math.floor(old*.4);delete p.materials;}
  p.wood??=10;p.marketingUntil??=0;p.warehouse??={};p.caravans??=[];p.caravanPolicy??='nearest';
  if(!Number.isFinite(p.gold))p.gold=0;
  p.gold=Math.max(-CREDIT_LIMIT_SP,p.gold);
  p.minerals??=emptyMinerals();
  for(const key of [...MINERAL_KEYS,'steel'])p.minerals[key]=Math.max(0,Math.floor(p.minerals[key]||0));
  if(p.ore!==undefined){p.minerals.iron+=Math.max(0,Math.floor(p.ore));delete p.ore;}
  for(const c of p.citizens||[]){if(c.health==null||c.morale==null){const rng=mulberry32(hash(s.seed+':traits:'+c.id));c.health=45+randInt(rng,56);c.morale=40+randInt(rng,61);}if(c.military){if(s.logisticsVersion!==1&&(!c.military.gear||['basic','leather'].includes(c.military.gear)))c.military.gear=null; c.military.shield??=null;c.military.weapon??=null;}c.job??=null;}
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
function currentWar(a,b){return (G.wars||[]).find(w=>w.key===warPair(a,b)&&w.status==='war');}
function opponentsAtWar(id){return (G.wars||[]).filter(w=>w.status==='war'&&(w.a===id||w.b===id)).map(w=>w.a===id?w.b:w.a);}
function startWar(a,b,cause='A war declaration arrived by messenger falcon'){
 if(a===b||currentWar(a,b))return false;
 const entry={key:warPair(a,b),a,b,status:'war',startedClock:G.turnClock||0,cause};
 G.wars.push(entry);for(const warning of G.warnings||[])if(warning.status==='active'&&warPair(warning.from,warning.to)===entry.key)warning.status='escalated';
 for(const id of [a,b])for(const c of G.players[id].citizens){if(!c.military)c.morale=Math.max(0,(c.morale??50)-4);}
 addLog(`${G.players[a].name} and ${G.players[b].name} entered the WAR PHASE. Troops may patrol, guard borders and flank. No battle begins automatically.`);
 return true;
}
function endWar(a,b){const w=currentWar(a,b);if(!w)return false;w.status='peace';w.endedClock=G.turnClock||0;addLog(`${G.players[a].name} and ${G.players[b].name} signed a ceasefire.`);return true;}
function diplomaticMessageText(note){const from=G.players[note.from],t=G.tiles.find(t=>t.id===note.tileId);return note.kind==='warning'?`If you expand into ${t?.name||'the warned territory'}, ${from.name} will declare war.`:note.kind==='war'?`${from.name} declares war. A war phase now begins; battles are not automatic.`:`${from.name} proposes a ceasefire.`;}
function sendDiplomaticFalcon(to,kind,tileId=null,id=0,automatic=false){
 const from=G.players[id],other=G.players[to];if(!from||!other||id===to||!['warning','war','peace'].includes(kind))return false;
 if(!automatic&&!canCountryAct(from,id))return false;
 if(kind==='warning'&&(!tileId||!G.tiles.some(t=>t.id===tileId&&t.terrain!=='water'&&t.owner===null)))return false;
 if(kind==='war'&&currentWar(id,to))return false;
 if(kind==='peace'&&!currentWar(id,to))return false;
 if(!automatic&&!hasMoney(from,1))return false;
 if(!automatic)from.gold-=1;
 const dist=distance(capitalOf(id),capitalOf(to)),trip=Math.max(1,Math.ceil(dist/5));
 const note={id:G.nextDiplomacyId++,kind,from:id,to,tileId,createdClock:G.turnClock||0,travelTotal:trip,remaining:trip,status:'flying',automatic};
 G.diplomaticFalcons.push(note);
 if(!automatic)useAction(from,`${from.name} launched a messenger falcon to ${other.capital} carrying a ${kind==='war'?'declaration of war':kind==='peace'?'ceasefire proposal':'territorial warning'}.`);
 else addLog(`${from.name} dispatched a falcon after a territorial warning was violated.`);
 if(id===0)showToast(`Falcon dispatched to ${other.capital}`);
 return true;
}
function checkWarningViolation(tile,newOwner){
 for(const w of G.warnings.filter(x=>x.to===newOwner&&x.tileId===tile.id&&x.status==='active')){
  w.status='violated';
  if(!currentWar(w.from,newOwner)&&!G.diplomaticFalcons.some(f=>f.kind==='war'&&f.from===w.from&&f.to===newOwner&&f.status==='flying'))
   sendDiplomaticFalcon(newOwner,'war',tile.id,w.from,true);
 }
}
function progressDiplomaticFalcons(){
 for(const note of G.diplomaticFalcons.filter(x=>x.status==='flying')){
  if((G.turnClock||0)<=note.createdClock+1)continue; // A 1T order never completes on the sender's own turn.
  note.remaining=Math.max(0,note.remaining-1);if(note.remaining)continue;
  note.status='arrived';const recipient=G.players[note.to];
  const relation=warPair(note.from,note.to);if(!G.contacts.includes(relation))G.contacts.push(relation);
  if(note.kind==='warning'){
   G.warnings.push({id:note.id,from:note.from,to:note.to,tileId:note.tileId,status:'active',deliveredClock:G.turnClock});
   addLog(`Messenger falcon delivered a warning to ${recipient.capital}: ${diplomaticMessageText(note)}`);
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
function orderMilitary(to,enemy,postId,qty,kind='patrol',id=0){
 const p=G.players[id],post=G.tiles.find(t=>t.id===postId),target=G.tiles.find(t=>t.id===to);
 if(!p||!target||!post||!currentWar(id,enemy)||p.logisticsUsed||G.turnIndex!==id)return false;
 if(id===0&&!active())return false;
 if(post.owner!==id||!buildingCount(post,'post')||target.terrain==='water')return false;
 if(kind==='patrol'&&(target.owner!==id||!neighbors(target).some(n=>n.owner===null||n.owner===enemy)))return false;
 if(kind==='flank'&&(target.owner!==null||!G.tiles.some(t=>t.owner===enemy&&distance(t,target)<=3)))return false;
 const soldiers=postGarrison(p,postId).filter(c=>!c.military.missionId).slice(0,Number(qty));
 if(!soldiers.length||soldiers.length!==Number(qty)||soldiers.length>12)return false;
 const route=militaryTravelPath(id,post,target);if(!route)return false;
 const mission={id:G.nextOrderId++,owner:id,enemy,originPostId:post.id,targetTileId:target.id,kind,troopIds:soldiers.map(c=>c.id),path:route.path,index:0,stepSpent:0,totalPoints:route.points,startedClock:G.turnClock||0,status:'traveling'};
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
  const t=G.tiles.find(t=>t.id===m.path[m.index]),next=G.tiles.find(t=>t.id===m.path[m.index+1]);if(!t||!next)continue;
  const need=roadExistsBetween(t,next)?1:(next.owner===m.owner?2:3)+(next.terrain==='mountain'?1:0);
  m.stepSpent++;if(m.stepSpent>=need){m.index++;m.stepSpent=0;}
  if(m.index>=m.path.length-1){m.status=m.kind==='return'?'returned':'patrolling';
   if(m.status==='returned'){const p=G.players[m.owner];for(const c of p.citizens)if(c.military?.missionId===m.id)c.military.missionId=null;}
   else if(m.owner===0)addLog(`Your ${m.kind==='flank'?'flanking party':'border patrol'} reached its assigned position.`);
  }
 }
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
function renderWarPanel(){
 const panel=el('warBody');if(!panel||!G)return;const me=G.players[0],wars=opponentsAtWar(0),incoming=G.diplomaticFalcons.filter(n=>n.to===0&&n.status==='awaiting-reply');
 let html=`<p class="gs-war-intro">Falcons carry territorial warnings, declarations and ceasefire proposals. Declaring war begins a <b>war phase</b>, not combat. Enemy troop movements are concealed. Civilian morale suffers while war continues.</p>`;
 if(wars.length)html+=`<div class="gs-war-alert"><strong>WAR PHASE ACTIVE</strong><span>${wars.map(id=>esc(G.players[id].name)).join(' · ')} · Civilians lose 2 morale per round</span></div>`;
 for(const f of incoming)html+=`<div class="gs-war-order"><b>${esc(G.players[f.from].name)} requests a ceasefire</b><div class="gs-war-actions"><button data-peace-answer="${f.id}" data-accept="yes">Accept</button><button data-peace-answer="${f.id}" data-accept="no">Reject</button></div></div>`;
 const owned=G.tiles.filter(t=>t.owner===0),warnable=G.tiles.filter(t=>t.owner===null&&t.terrain!=='water');
 const flights=G.diplomaticFalcons.filter(f=>(f.from===0||f.to===0)&&['flying','awaiting-reply'].includes(f.status));
 if(flights.length)html+=`<div class="gs-war-order"><strong>Messenger Falcons</strong>${flights.map(f=>`<div class="gs-war-unit"><b>${esc(G.players[f.from].name)} → ${esc(G.players[f.to].capital)}</b><small>${esc(f.kind.toUpperCase())} · ${f.status==='flying'?`${f.remaining}T until delivery`:'Awaiting your response'}${f.tileId?` · ${esc(G.tiles.find(t=>t.id===f.tileId)?.name||'')}`:''}</small></div>`).join('')}</div>`;
 for(const other of G.players.filter(p=>p.id!==0)){
  const atWar=!!currentWar(0,other.id),capital=capitalOf(other.id),warnings=G.warnings.filter(w=>w.status==='active'&&w.to===0&&w.from===other.id);
  html+=`<div class="gs-war-order"><strong>${esc(other.name)} ${atWar?'<span class="gs-war-state">AT WAR</span>':'<span class="gs-war-peace">PEACE</span>'}</strong><small>Falcon destination: ${esc(capital?.name||other.capital)}. Courier cost: 1 SP.</small>`;
  for(const w of warnings){const t=G.tiles.find(x=>x.id===w.tileId);html+=`<p class="gs-warning-text">WARNING RECEIVED: If you take ${esc(t?.name||'the specified land')}, war may be declared.</p>`;}
  if(!atWar){
   html+=`<label class="gs-war-field">Disputed territory<select data-warning-land="${other.id}">${warnable.slice().sort((a,b)=>Math.min(...owned.map(o=>distance(a,o)))-Math.min(...owned.map(o=>distance(b,o)))).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><div class="gs-war-actions"><button data-send-warning="${other.id}" ${!canAct()?'disabled':''}>Send Warning</button><button data-send-war="${other.id}" ${!canAct()?'disabled':''}>Declare War by Falcon</button></div>`;
  }else html+=`<div class="gs-war-actions"><button data-send-peace="${other.id}" ${!canAct()?'disabled':''}>Send Ceasefire Proposal</button></div>`;
  html+='</div>';
 }
 const posts=getMilitaryPosts(0);
 if(wars.length&&posts.length){
  const borderOptions=G.tiles.filter(t=>t.owner===0&&neighbors(t).some(n=>n.owner===null||wars.includes(n.owner)));
  const flankOptions=G.tiles.filter(t=>t.owner===null&&t.terrain!=='water'&&wars.some(w=>G.tiles.some(e=>e.owner===w&&distance(t,e)<=3))).slice(0,45);
  html+=`<div class="gs-war-order"><strong>Confidential Troop Orders</strong><small>One military logistics order per turn. Patrol owned frontier hexes or flank through neutral land. Roads shorten travel. Enemies cannot view the positions.</small><label class="gs-war-field">Enemy<select id="warEnemy">${wars.map(id=>`<option value="${id}">${esc(G.players[id].name)}</option>`).join('')}</select></label><label class="gs-war-field">Military Post<select id="warPost">${posts.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} (${postGarrison(me,t.id).filter(c=>!c.military.missionId).length} ready)</option>`).join('')}</select></label><label class="gs-war-field">Order<select id="warKind"><option value="patrol">Border patrol</option><option value="flank">Flanking through neutral land</option></select></label><label class="gs-war-field">Destination<select id="warDestination">${borderOptions.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><label class="gs-war-field">Soldiers<select id="warQuantity">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i===1?'selected':''}>${i+1}</option>`).join('')}</select></label><button data-order-war="1" ${!active()||me.logisticsUsed?'disabled':''}>Dispatch Troops</button><div class="gs-war-hidden" data-patrol-options="${esc(JSON.stringify(borderOptions.map(t=>[t.id,t.name])))}" data-flank-options="${esc(JSON.stringify(flankOptions.map(t=>[t.id,t.name])))}"></div></div>`;
 }
 const own=G.militaryOrders.filter(m=>m.owner===0&&m.status!=='returned');
 if(own.length)html+=`<div class="gs-war-order"><strong>Your Military Orders</strong>${own.map(m=>{const tile=G.tiles.find(t=>t.id===m.path[m.index]),target=G.tiles.find(t=>t.id===m.targetTileId);return `<div class="gs-war-unit"><b>${m.troopIds.length} troops · ${m.kind.toUpperCase()}</b><small>${esc(tile?.name||'Traveling')} → ${esc(target?.name||'Unknown')} · ${m.status}</small><button data-recall-war="${m.id}" ${!active()?'disabled':''}>Recall</button></div>`;}).join('')}</div>`;
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
 return G.tradeRoutes.some(same)||G.tradeOffers.some(o=>!['rejected','expired'].includes(o.status)&&same(o));
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
  offer.status='pending';
  const link=contactKey(offer.from,offer.to);if(!G.contacts.includes(link))G.contacts.push(link);
  addLog(`${G.players[offer.from].name}'s falcon reached ${G.players[offer.to].capital} with a road proposal.`);
  if(offer.to!==0){
   const partner=G.players[offer.to];
   const canPay=hasMoney(partner,offer.costB)&&hasMoney(G.players[offer.from],offer.costA);
   const labor=idleBuilders(partner).length&&idleBuilders(G.players[offer.from]).length;
   const rng=mulberry32(hash(G.seed+':road-decision:'+offer.id));
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
  html+=`<div class="gs-trade-row"><strong>Messenger · ${esc(other.name)}</strong><small>${esc(start?.name||'Capital')} → ${esc(end?.name||'Capital')} · ${o.status==='falcon'?o.travelRemaining+'T in flight':o.status.toUpperCase()} · ${o.costA}/${o.costB} SP</small>${o.status==='pending'&&o.to===0?`<div class="gs-trade-controls"><button class="primary" data-trade-answer="${o.id}" data-accept="yes">Accept & assign builder</button><button class="small-outline" data-trade-answer="${o.id}" data-accept="no">Decline</button></div>`:''}</div>`;
 }
 for(const r of roads){
  const start=G.tiles.find(t=>t.id===r.fromTileId),end=G.tiles.find(t=>t.id===r.toTileId);
  const progress=r.status==='active'?r.length:(r.aDone||0)+(r.bDone||0);const waiting=r.aWaitingForLand||r.bWaitingForLand;
  html+=`<div class="gs-trade-row"><strong>Border Road · ${esc(start?.name||G.players[r.a].name)} ↔ ${esc(end?.name||G.players[r.b].name)}</strong><small>${r.status==='active'?'OPEN · +2 SP/round to each':(waiting?'WAITING FOR OWNED BORDER · ':'BUILDING · ')+progress+'/'+r.length+' edges complete'} · ${r.costA??0}/${r.costB??0} SP paid by each nation</small></div>`;
 }
 node.innerHTML=html;
 for(const partner of G.players.filter(p=>p.id!==0))refreshRouteEstimate(partner.id);
}
function refreshRouteEstimate(partnerId){
 const panel=el('tradeBody'),a=panel?.querySelector(`[data-road-from="${partnerId}"]`)?.value,b=panel?.querySelector(`[data-road-to="${partnerId}"]`)?.value;
 const share=Number(panel?.querySelector(`[data-trade-share="${partnerId}"]`)?.value||50);
 const label=panel?.querySelector(`[data-road-estimate="${partnerId}"]`);if(!label)return;
 const plan=tradePlan(0,partnerId,a,b),split=routeCostSplit(plan,share);
 label.textContent=plan&&split?`${plan.length} shared hex edges · you pay ${split.costA} SP and build ${split.aSegments} edges; ${G.players[partnerId].name} pays ${split.costB} SP and builds ${split.bSegments}.`:'No valid neutral-land border route found.';
}
function showToast(s){const t=el('toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2650);}
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
function closeSheet(){sheetMode=null;showBuild=false;showResearch=false;el('sheetLayer').classList.add('hidden');el('sheetLayer').setAttribute('aria-hidden','true');if(G)render();}
function suspendSheetForScene(){
 const sheet=el('sheetBody');
 const resume={mode:sheetMode,showBuild,scroll:sheet?.scrollTop||0,tileId:G?.selectedId};
 sheetMode=null;showBuild=false;showResearch=false;
 el('sheetLayer').classList.add('hidden');el('sheetLayer').setAttribute('aria-hidden','true');
 return resume;
}
function startMapScenePlayback(tile,kind,buildingIndex=-1,buildingType=null){
 if(scenePlayback)return null;
 const playback={world:G,serial:++scenePlaybackSerial,tileId:tile.id,kind,buildingIndex,buildingType,phase:'prepare',resume:suspendSheetForScene()};
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
  await moveCamera(tile,cameraYaw,reduced?0:cpuBusy?920:450,window.innerWidth<600?350:435);
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
  if(playback.resume.mode&&G===playback.world&&G.turnIndex===0&&!cpuBusy){
   G.selectedId=playback.resume.tileId;
   showBuild=playback.resume.showBuild;
   showSheet(playback.resume.mode);
   if(el('sheetBody'))el('sheetBody').scrollTop=playback.resume.scroll;
  }
  if(playback.kind==='build')showToast(`${BUILDINGS[playback.buildingType]?.name||'Building'} completed`);
  if(playback.kind==='work')showToast(`${BUILDINGS[playback.buildingType]?.name||'Building'} construction underway`);
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
 if(c.military||c.builder||c.age<18||c.health<35)return 0;
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
  if(count>=2||p.food<1)break;
  const open=posts.filter(t=>postGarrison(p,t.id).length<12);
  if(!open.length)break;
  if(rng()>volunteeringChance(c,p))continue;
  const post=open[randInt(rng,open.length)];
  c.military={postId:post.id,training:1,experience:0,perk:null,gear:null,shield:null,weapon:null};p.food-=1;count++;
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

function enterGame(){scenePlayback=null;scenePlaybackSerial++;document.body.classList.add('gs-playing');closeCardPreview();sheetMode=null;el('sheetLayer').classList.add('hidden');el('sheetLayer').setAttribute('aria-hidden','true');cpuPlaybackToken++;skipCpuPlayback=false;hideCpuHud();el('lobby').classList.add('hidden');el('game').classList.remove('hidden');el('topMenuBtn').classList.remove('hidden');showBuild=false;showResearch=false;resetView();focusHome(true);render();requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));}
function newMatch(){cardEffectBusy=false;el('cardEffectLayer')?.classList.add('hidden');scenePlayback=null;scenePlaybackSerial++;document.body.classList.remove('gs-playing');closeCardPreview();closeSheet();cpuPlaybackToken++;cancelAnimationFrame(cameraMoveFrame);hideCpuHud();if(cameraResolve){cameraResolve();cameraResolve=null;}G=null;cpuBusy=false;el('lobby').classList.remove('hidden');el('game').classList.add('hidden');el('topMenuBtn').classList.add('hidden');el('roundBadge').textContent='SOLO TEST';closeModal();renderLobby();}
function renderLobby(){
 el('colorOptions').innerHTML=COLORS.map((c,i)=>`<button class="color-swatch" style="--swatch:${c}" aria-label="Choose ${['jade','amber','violet','coral'][i]}" aria-pressed="${i===selectedColor}" data-color="${i}"></button>`).join('');
 const colors=[COLORS[selectedColor],...COLORS.filter((_,i)=>i!==selectedColor)];
 el('cpuPreview').innerHTML=NPCS.map((p,i)=>`<div class="cpu-item"><div class="cpu-avatar" style="background:${colors[i+1]}">${p.sigil}</div><div><div class="cpu-item-title">${esc(p.name)}</div><div class="cpu-item-sub">Capital: ${esc(p.capital)}</div></div><span class="cpu-pill">CPU</span></div>`).join('');
 el('resumeBtn').classList.toggle('hidden',!loadSaved());
}
function allowed(p,t){return t&&t.owner===p.id;}
function eligibleExpansion(p,t){return !!t&&t.owner===null&&t.terrain!=='water'&&!pendingClaim(t.id)&&!!idleExpedition(p)&&neighbors(t).some(n=>n.owner===p.id);}
function expansionCost(p){return Math.max(0,5+2*(p.expansionsThisTurn||0)-p.discountExpand-(p.tech.includes('cartography')?2:0));}
function buildingCost(p,b){return Math.max(0,b.gold-p.discountBuild);}
function canBuild(p,t,b){return allowed(p,t)&&idleBuilders(p).length>0&&buildFree(t)>=b.space&&b.allow.includes(t.terrain)&&hasMoney(p,buildingCost(p,b))&&p.wood>=b.wood&&mineralCount(p,'iron')>=b.iron;}
function getEconomy(id){
 const p=G.players[id],summary=peopleSummary(p);
 let vals={gold:0,food:0,wood:0,knowledge:0,upkeep:0,wages:0,buildingUpkeep:0,
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
   // Fixed upkeep applies to completed buildings even if idle. Employees add wages.
   const fixed=b.upkeep+Math.max(0,q.level-1)*Math.ceil(b.upkeep*.8);
   vals.upkeep+=fixed;vals.buildingUpkeep+=fixed;
   if(type==='farm')vals.farmUpkeep+=fixed;
   else if(factories.has(type))vals.factoryUpkeep+=fixed;
   else vals.otherBuildingUpkeep+=fixed;
   vals.upkeep+=q.count;vals.wages+=q.count;vals.workerWages+=q.count;
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
 vals.upkeep+=vals.builderWages;vals.wages+=vals.builderWages;
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
 if(!cfg||!c?.military||GEAR_ORDER.indexOf(tier)<=old)return false;
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
 if(!canCountryAct(p,id)||!c?.military||!['woodShield','stoneAxe','stonePickaxe','stoneSword','stoneClub'].includes(item))return false;
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
 if(!importing&&mineralCount(p,key)<1)return false;
 if(importing){p.gold-=cost;p.minerals[key]++;}else{p.gold+=mineral.price;p.minerals[key]--;}
 useAction(p,`${p.name} ${importing?'imported':'sold'} 1 ${mineral.name} for ${importing?cost:mineral.price} SP at the Global Exchange.`);
 if(id===0)showToast(`${importing?'Imported':'Sold'} ${mineral.name} · ${importing?'-':'+'}${importing?cost:mineral.price} SP`);
 return true;
}
function renderMineralMarket(){
 const node=el('mineralBody');if(!node||!G)return;
 const p=getCountry();
 node.innerHTML=MINERAL_KEYS.map(key=>{const m=MINERALS[key],q=mineralCount(p,key),buy=Math.ceil(m.price*2.1);
  return `<div class="gs-mineral-item"><span class="gs-mineral-symbol">${m.icon}</span><div class="gs-mineral-copy"><strong>${m.name} × ${q}</strong><small>Sell: ${m.price} SP${['coal','iron','copper','silver'].includes(key)?` · Buy: ${buy} SP`: ' · Mine or trade to acquire'}</small></div><div class="gs-mineral-actions"><button data-mineral="${key}" data-direction="sell" ${!canAct()||q<=0?'disabled':''}>Sell</button>${['coal','iron','copper','silver'].includes(key)?`<button data-mineral="${key}" data-direction="buy" ${!canAct()||!hasMoney(p,buy)?'disabled':''}>Buy</button>`:''}</div></div>`;
 }).join('')+`<div class="gs-mineral-item"><span class="gs-mineral-symbol"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-steel"></use></svg></span><div class="gs-mineral-copy"><strong>Steel × ${mineralCount(p,'steel')}</strong><small>Delivered Steel in capital warehouse · manufacture in staffed Steelworks from 2 Iron + 1 Coal</small></div><div class="gs-mineral-actions"><small>Factory only</small></div></div>`;
}
function useAction(p,text,visual=null){
 p.actionsUsed=actionsUsed(p)+1;p.acted=actionsRemaining(p)===0;
 if(p.id>0)cpuLastAction={nation:p.id,description:text,tileId:visual?.tileId||null,kind:visual?.kind||'action'};
 addLog(text);showBuild=false;showResearch=false;save();render();
}
function doExpand(t,id=0){
 const p=G.players[id],crew=idleExpedition(p);
 if(!crew||!canCountryAct(p,id)||!eligibleExpansion(p,t))return false;
 const cost=expansionCost(p);if(!hasMoney(p,cost)||p.food<2)return false;
 p.gold-=cost;p.food-=2;p.discountExpand=0;p.expansionsThisTurn=(p.expansionsThisTurn||0)+1;
 const origin=G.tiles.find(v=>v.id===crew.locationId)||G.tiles.find(v=>v.owner===id&&v.capital);
 crew.targetId=t.id;crew.originId=(origin||t).id;crew.remaining=Math.max(1,countryTravelRoute(id,origin||t,t,true)?.turns??Math.ceil(distance(origin||t,t)));crew.travelTotal=crew.remaining;crew.startedClock=G.turnClock||0;
 useAction(p,`${p.name} dispatched an expedition to ${t.name} (${crew.remaining} turn${crew.remaining===1?'':'s'} away).`,{tileId:t.id,kind:'expedition'});
 if(id===0)showToast(`Expedition en route to ${t.name}`);
 return true;
}
function doBuild(t,type,id=0){
 const p=G.players[id],b=BUILDINGS[type];if(!canCountryAct(p,id)||!b||!canBuild(p,t,b))return false;
 const playback=(id===0||cpuBusy)?startMapScenePlayback(t,'work',-1,type):null;
 p.gold-=buildingCost(p,b);p.wood-=b.wood;p.minerals.iron-=b.iron;p.discountBuild=0;
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
 if(type==='post'&&getMilitaryPosts(id).length&&postGarrison(p,t.id).length>0){if(id===0)showToast('Move troops before selling this post.');return false;}
 const stock=worksite(t,idx)?.stock||{};for(const [item,amount] of Object.entries(stock)){if(amount>0)dispatchShipment(id,siteId,'depot',item,amount,true);}
 const refund=Math.max(2,Math.floor(b.gold*.6));p.gold+=refund;t.buildings.splice(idx,1);t.buildingMeta?.splice(idx,1);for(const citizen of p.citizens){if(citizen.job?.siteId===siteId)citizen.job=null;}reallocateHousing(p);syncBuilders(p);assignWorkers(p);syncCaravans(p);
 useAction(p,`${p.name} sold a ${b.name} at ${t.name} to the Global Bank for ${refund} SP.`,{tileId:t.id,kind:'sell'});
 if(id===0)showToast(`${b.name} sold for ${refund} SP`);return true;
}
function doRecruit(t,id=0){return doMarketing(t,id);}
function doTrain(t,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!allowed(p,t)||!buildingCount(t,'post'))return false;
 const soldiers=postGarrison(p,t.id).filter(c=>c.military.training<5).slice(0,3);
 if(!soldiers.length||!hasMoney(p,3)||p.food<1)return false;
 p.gold-=3;p.food-=1;
 for(const c of soldiers){c.military.training++;if(c.military.training>=3&&!c.military.perk)c.military.perk='Disciplined';}
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
function doLevy(id=0){const p=G.players[id];if(!canCountryAct(p,id)||p.levyUsed)return false;const foodCost=Math.min(2,p.food);p.gold+=6;p.food-=foodCost;p.levyUsed=true;useAction(p,`${p.name} raised emergency taxes: +6 SP, −${foodCost} Food.`);if(id===0)showToast('Emergency taxes collected: +6 Silver Pents');return true;}
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
  p.food=Math.max(0,p.food+e.netFood);p.wood+=e.wood;p.knowledge+=e.knowledge;
  const wars=opponentsAtWar(p.id).length;for(const c of p.citizens){if(c.military)continue;c.morale=Math.max(0,Math.min(100,(c.morale??50)-(wars?Math.min(4,wars*2):0)));}
  if(p.gold<0&&oldGold>=0)addLog(`${p.name} entered debt; the −${CREDIT_LIMIT_SP} SP credit ceiling limits spending.`);
  if(p.food===0&&e.netFood<0)addLog(`${p.name} is experiencing a food shortage. Population growth paused.`);
  if(G.round%4===0)for(const c of p.citizens)c.age++;
  newCitizensForRound(p);
  volunteerEachRound(p);
  assignWorkers(p);
 }
 progressShipments();runAgricultureAndForestry();
 for(const p of G.players)extractMinesForRound(p);
 processFactories();autoDispatchOutputs();autoRequestFactoryInputs();
 for(const route of G.tradeRoutes.filter(r=>r.status==='active')){G.players[route.a].gold+=2;G.players[route.b].gold+=2;}
 addLog(`Round ${G.round} concluded. Population, production and maintenance updated.`);
 if(G.round>=G.maxRounds&&!G.continued){G.finished=true;save();render();showEndGame();return;}
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
  actionTileId=null;beginTurn(id);render();showCpuHud(id,`Viewing ${p.name}'s turn`);
  cpuSecretWarOrder(id);
  // A longer, ease-in/ease-out camera sweep introduces the next country.
  await moveCamera(capital,POV_ANGLES[id],1250,window.innerWidth<600?435:560);
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
    await moveCamera(changedTile,POV_ANGLES[id],1050,window.innerWidth<600?350:445);
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
 await moveCamera(home,POV_ANGLES[0],1350,window.innerWidth<600?435:565);
 hideCpuHud();await showCompletedProjects();cpuBusy=false;render();
}
function endTurn(){
 if(!active())return;
 closeCardPreview();closeSheet();cpuBusy=true;skipCpuPlayback=false;cpuPlaybackToken++;
 const token=cpuPlaybackToken;save();render();
 el('mapWrap').scrollIntoView({behavior:'smooth',block:'center'});
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
 let playable=p.hand.findIndex(c=>['grant','harvest','supplies','insight'].includes(c));
 if(playable<0)playable=p.hand.findIndex(c=>c==='charter');if(playable<0)playable=p.hand.findIndex(c=>c==='permit');
 return playable>=0?playCard(id,playable):false;
}
function cpuSecretWarOrder(id){
 const enemies=opponentsAtWar(id);if(!enemies.length)return;
 const p=G.players[id],post=getMilitaryPosts(id).find(t=>postGarrison(p,t.id).filter(c=>!c.military.missionId).length>=1);
 if(!post||p.logisticsUsed)return;
 const target=G.tiles.filter(t=>t.owner===id&&neighbors(t).some(n=>n.owner===null||enemies.includes(n.owner)))
  .sort((a,b)=>Math.min(...enemies.map(e=>distance(a,capitalOf(e))))-Math.min(...enemies.map(e=>distance(b,capitalOf(e)))))[0];
 if(target)orderMilitary(target.id,enemies[0],post.id,Math.min(2,postGarrison(p,post.id).filter(c=>!c.military.missionId).length),'patrol',id);
}

function runCpu(id){
 const p=G.players[id];
 if(!p.cardPlayed)playCpuOpeningCard(id);
 // CPU nations may warn rivals when their frontiers converge; players can respond by expanding or backing off.
 if(id!==0&&G.round>=3&&!currentWar(id,0)&&p.gold>=5){
  const sent=G.warnings.some(w=>w.from===id&&w.to===0&&['active','violated','escalated'].includes(w.status))||G.diplomaticFalcons.some(f=>f.from===id&&f.to===0&&f.kind==='warning');
  if(!sent&&G.round%3===id%3){
   const contested=G.tiles.filter(t=>t.owner===null&&t.terrain!=='water'&&
    G.tiles.some(v=>v.owner===0&&distance(v,t)<=2)&&G.tiles.some(v=>v.owner===id&&distance(v,t)<=2));
   if(contested.length&&sendDiplomaticFalcon(0,'warning',contested[0].id,id))return;
  }
 }
 if(G.round>=4&&G.round%4===id%4&&actionsRemaining(p)>0){
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
 const owned=G.tiles.filter(t=>t.owner===id),eco=getEconomy(id),people=peopleSummary(p);
 const buildable=owned.filter(t=>buildFree(t)>0).sort((a,b)=>buildFree(b)-buildFree(a));
 const frontiers=G.tiles.filter(t=>eligibleExpansion(p,t)).sort((a,b)=>{
  const value=t=>({plains:8,forest:6,hills:5,desert:3,mountain:t.vein?(t.vein.kind==='diamond'?17:t.vein.kind==='goldOre'?14:10):1})[t.terrain]+neighbors(t).filter(n=>n.owner===null&&n.terrain!=='water').length*.4;
  return value(b)-value(a);
 });
 const tryBuild=type=>{const t=buildable.find(t=>canBuild(p,t,BUILDINGS[type]));return t?doBuild(t,type,id):false;};
 const tryExpand=()=>frontiers.length?doExpand(frontiers[0],id):false;
 // CPUs have the SAME money, jobs and actions as human players. They should
 // save during crises rather than blindly expanding until payroll bankrupts them.
 if(p.gold<=-CREDIT_LIMIT_SP){
  if(!p.levyUsed&&doLevy(id))return;
  for(const k of ['diamond','goldOre','silver','copper','iron','coal'])if(mineralCount(p,k)>1&&mineralTrade(k,'sell',id))return;
  const sale=owned.find(t=>t.buildings.some((kind,i)=>kind!=='market'&&kind!=='farm'&&kind!=='homes'&&!G.projects.some(j=>j.upgradeSiteId===t.buildingMeta?.[i]?.id)&&!(kind==='post'&&postGarrison(p,t.id).length)));
  if(sale){const index=sale.buildings.findIndex((kind,i)=>kind!=='market'&&kind!=='farm'&&kind!=='homes'&&!G.projects.some(j=>j.upgradeSiteId===sale.buildingMeta?.[i]?.id)&&!(kind==='post'&&postGarrison(p,sale.id).length));if(index>=0&&doSell(sale,index,id))return;}
  return;
 }
 if(p.gold<16&&eco.netGold<0){
  if(G.projects.filter(j=>j.owner===id&&j.type==='market').length<2&&tryBuild('market'))return;
  if(!p.levyUsed&&doLevy(id))return;
  return;
 }
 if(p.gold<7&&!p.levyUsed&&doLevy(id))return;
 if(people.housing<=people.count+2&&(tryBuild('homes')||tryExpand()))return;
 if(eco.netGold<=0&&tryBuild('market'))return;
 if(owned.length<3&&tryExpand())return;
 if(G.round>=2&&!caravanWarehouses(p).length&&tryBuild('caravanWarehouse'))return;
 if(G.round>=4&&!owned.some(t=>t.buildings.includes('storageWarehouse'))&&tryBuild('storageWarehouse'))return;
 if(p.food<9&&tryBuild('farm'))return;
 if(p.wood<8&&(tryBuild('lumber')||tryBuild('woodworks')))return;
 if(mineralCount(p,'iron')<4&&p.gold>11&&mineralTrade('iron','buy',id))return;
 if(owned.some(t=>t.vein&&t.vein.remaining>0)&&tryBuild('mine'))return;
 if(eco.netGold<4&&tryBuild('market'))return;
 if(owned.length<9&&tryExpand())return;
 if(p.wood<14&&tryBuild('woodworks'))return;
 if(p.knowledge<9&&tryBuild('academy'))return;
 if(G.round>5&&owned.length>=4&&tryBuild('leatherFactory'))return;
 if(G.round>6&&owned.length>=5&&tryBuild('woodworks'))return;
 if(G.round>7&&owned.length>=5&&tryBuild('stoneworks'))return;
 if(G.round>9&&owned.length>=6&&tryBuild('armory'))return;
 const posts=getMilitaryPosts(id);
 if(!posts.length&&G.round>=5&&tryBuild('post'))return;
 if(posts.length&&G.round%5===0&&p.marketingUntil<G.round&&doMarketing(posts[0],id))return;
 if(G.round>=4&&p.gold>=24&&p.wood>=3&&idleBuilders(p).length&&owned.length>1){
  const candidate=owned.flatMap(t=>neighbors(t).filter(n=>n.owner===id&&t.id<n.id).map(n=>({t,n}))).find(({t,n})=>canStartDomesticRoad(t,n,id));
  if(candidate&&startDomesticRoad(candidate.t.id,candidate.n.id,id))return;
 }
 if(owned.length<15&&tryExpand())return;
 if(tryBuild('homes')||tryBuild('market')||tryBuild('farm')||tryBuild('academy')||tryBuild('lumber')||tryBuild('storageWarehouse')||tryBuild('post')||tryBuild('mine')||tryBuild('leatherFactory')||tryBuild('woodworks')||tryBuild('stoneworks')||tryBuild('armory')||tryBuild('foundry'))return;
 if(tryExpand())return;
 if(p.tech.length<Object.keys(TECHS).length){const tech=Object.keys(TECHS).find(k=>!p.tech.includes(k)&&hasMoney(p,TECHS[k].gold)&&p.knowledge>=TECHS[k].knowledge);if(tech&&doResearch(tech,id))return;}
 const ownedUpgrade=owned.find(t=>t.buildings.some((kind,i)=>!G.projects.some(j=>j.upgradeSiteId===t.buildingMeta?.[i]?.id)&&upgradePrice(t,i)&&hasMoney(p,upgradePrice(t,i).gold)&&p.wood>=upgradePrice(t,i).wood&&mineralCount(p,'iron')>=upgradePrice(t,i).iron));
 if(ownedUpgrade&&upgradeBuilding(ownedUpgrade,ownedUpgrade.buildings.findIndex((kind,i)=>!G.projects.some(j=>j.upgradeSiteId===ownedUpgrade.buildingMeta?.[i]?.id)&&upgradePrice(ownedUpgrade,i)&&hasMoney(p,upgradePrice(ownedUpgrade,i).gold)&&p.wood>=upgradePrice(ownedUpgrade,i).wood&&mineralCount(p,'iron')>=upgradePrice(ownedUpgrade,i).iron),id))return;
 doLevy(id);
}
function prosperity(p){const owned=G.tiles.filter(t=>t.owner===p.id),people=peopleSummary(p);
 return owned.length*4+owned.reduce((n,t)=>n+(t.buildings||[]).length,0)*5+people.housed*2-people.homeless*2+people.soldiers*2+Math.max(0,Math.floor(p.gold/4))+Math.max(0,Math.floor(p.food/5))+Math.max(0,Math.floor(p.wood/5))+Math.max(0,Math.floor(mineralCount(p,'iron')/5))+Math.floor(MINERAL_KEYS.reduce((v,k)=>v+mineralCount(p,k)*MINERALS[k].price,0)/20)+Math.floor(p.knowledge/3)+p.tech.length*3;}
function render(){if(!G)return;
 document.body.classList.toggle('cpu-watching',!!cpuBusy);
 const p=getCountry(),e=getEconomy(0),tile=getSelected(),people=peopleSummary(p);
 el('roundBadge').textContent=`ROUND ${G.round} / ${G.maxRounds}`;
 el('worldTitle').textContent=G.worldName;
 el('nationLabel').textContent=p.name;el('capitalFlag').style.setProperty('--nation-color',p.color);
 el('capitalFlag').innerHTML=icoMarkup('shield')+'<span class="gs-flag-initial">'+esc(p.id===0?'GS':p.name.slice(0,1))+'</span>';
 el('turnCounter').textContent=`Round ${G.round} of ${G.maxRounds} · ${G.tiles.length} hexes · ${G.tiles.filter(t=>t.owner===0).length} owned`;
 el('turnLabel').textContent=G.finished?'TEST COMPLETE':G.turnIndex===0&&!cpuBusy?'YOUR TURN':'CPU TURN';el('turnLabel').classList.toggle('cpu-turn',G.turnIndex!==0||cpuBusy);
 el('resources').innerHTML=[['gold',silverPentIcon(23),'Silver Pents'],['food','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>','Food'],['wood','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-wood"></use></svg>','Wood'],['iron','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg>','Iron'],['knowledge','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg>','Knowledge']].map(([field,icon,name])=>`<div class="resource ${(field==='iron'?mineralCount(p,'iron'):p[field])<0?'negative':''}"><div class="resource-icon">${icon}</div><div class="resource-num">${fmt(field==='iron'?mineralCount(p,'iron'):p[field])}</div><div class="resource-label">${name}</div></div>`).join('');
 el('quickStats').innerHTML=[['gold',silverPentIcon(16)],['food','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg>'],['wood','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-wood"></use></svg>'],['iron','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg>'],['knowledge','<svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-spark"></use></svg>']].map(([field,icon])=>`<span class="quick-stat" title="${field}">${icon}<b class="${(field==='iron'?mineralCount(p,'iron'):p[field])<0?'negative':''}">${fmt(field==='iron'?mineralCount(p,'iron'):p[field])}</b></span>`).join('');
 el('economySummary').innerHTML=`<div class="gs-econ-totals"><span>Income <strong>+${e.gold} SP</strong></span><span>Upkeep & wages <strong>−${e.upkeep} SP</strong></span><span>Net / round <strong class="${e.netGold>=0?'positive':'negative'}">${e.netGold>=0?'+':''}${e.netGold} SP</strong></span></div>
  <div class="gs-credit-line"><strong>Credit limit −${CREDIT_LIMIT_SP} SP</strong><span>${p.gold<0?`Borrowed ${-p.gold}/${CREDIT_LIMIT_SP} SP`:'No debt'} · ${p.gold<=-CREDIT_LIMIT_SP?'Spending locked':p.gold<0?'Credit still available':'Credit available if needed'}</span></div>
  <div class="gs-econ-ledger" aria-label="Silver Pents income and upkeep breakdown">
   <strong class="gs-econ-ledger-title">Income per round</strong>
   <span>Occupied family homes (${e.occupiedHomes} × ${HOUSEHOLD_RENT} SP)</span><b class="positive">+${e.householdIncome} SP</b>
   <span>Capital revenue</span><b class="positive">+${e.capitalIncome} SP</b>
   <span>Marketplaces</span><b class="positive">+${e.marketIncome} SP</b>
   <strong class="gs-econ-ledger-title">Expenses per round</strong>
   <span>Farm upkeep (even if idle)</span><b class="negative">−${e.farmUpkeep} SP</b>
   <span>Factory & workshop upkeep (even if idle)</span><b class="negative">−${e.factoryUpkeep} SP</b>
   <span>Other buildings</span><b class="negative">−${e.otherBuildingUpkeep} SP</b>
   <span>Capital upkeep</span><b class="negative">−${e.capitalUpkeep} SP</b>
   <span>Worker wages</span><b class="negative">−${e.workerWages} SP</b>
   <span>Builder wages</span><b class="negative">−${e.builderWages} SP</b>
   <span>Military upkeep</span><b class="negative">−${e.militaryUpkeep} SP</b>
  </div><p class="gs-econ-explainer">Each occupied household (up to ${HOUSEHOLD_SIZE} residents) pays ${HOUSEHOLD_RENT} Silver Pents per round. Empty homes pay nothing. Wages are in addition to upkeep; level upgrades increase fixed upkeep.</p><div class="gs-econ-extra">Employed ${workforceSummary(p).employed} · Available ${workforceSummary(p).available} · Food ${e.netFood>=0?'+':''}${e.netFood}/round</div>${p.gold<=-CREDIT_LIMIT_SP?'<div class="economy-alert"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-warning"></use></svg> Credit limit reached (−10 SP). New construction, research and purchases locked. Sell assets, trade or collect income to recover.</div>':p.gold<0?'<div class="gs-credit-warning">Borrowing Silver Pents: spending cannot exceed the −10 SP credit limit.</div>':''}`;
 el('economySummary').innerHTML+=`<div class="gs-depot-note"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg> Capital warehouse: ${Object.entries(p.warehouse||{}).filter(([k,v])=>v>0).map(([k,v])=>`${v} ${GOOD_NAMES[k]||k}`).join(' · ')||'No crafted goods yet'}</div>`+shippingDashboard();
  el('populationSummary').innerHTML=`<div class="population-stat"><strong>${people.count}</strong><span>Citizens</span></div><div class="population-stat"><strong>${people.housed} / ${people.housing}</strong><span>Housed / Beds</span></div><div class="population-stat ${people.homeless?'population-warning':''}"><strong>${people.homeless}</strong><span>Homeless</span></div><div class="population-stat"><strong>${people.soldiers}</strong><span>Troops</span></div><div class="gs-household-population"><strong>${people.households}</strong> occupied family homes · <strong>+${people.households*HOUSEHOLD_RENT} SP</strong> / round</div>`;
 el('populationAdvice').textContent=people.homeless>0?`${people.homeless} citizens need homes. Build on an owned tile with open space, or expand to make room.`:people.housing<=people.count+2?'Housing is nearly full. Consider additional homes before the next population increase.':'Each round can bring new citizens when Food is available. Homes need building space, and terrain limits residents.';
 renderMap();renderTile(tile);renderHand();renderResearch();renderStandings();renderLog();renderRoster();renderTradePanel();renderWarPanel();renderMineralMarket();
 el('buildPanel').classList.toggle('hidden',!showBuild);el('researchPanel').classList.toggle('hidden',!showResearch);
 el('endTurnBtn').disabled=!active();el('levyBtn').disabled=!canAct()||!!p.levyUsed;el('researchBtn').disabled=!active();el('levySheetBtn')?.toggleAttribute('disabled',!canAct()||!!p.levyUsed);
 el('endTurnBtn').innerHTML=G.finished?'TEST COMPLETE':scenePlayback?'ANIMATING…':active()?`END TURN <span>→</span>`:'CPU THINKING…';
 const remaining=actionsRemaining(p);
 el('mapActionCounter').innerHTML=G.finished?'TEST COMPLETE':cpuBusy?'◈ CPU ACTIONS':`<span class="action-dots">${Array.from({length:MAJOR_ACTIONS},(_,i)=>`<i class="${i<remaining?'ready':'spent'}"></i>`).join('')}</span><b>${remaining}/${MAJOR_ACTIONS}</b> ACTIONS LEFT`;
 el('actionNotice').innerHTML=G.finished?'Prototype match complete. Review the results or start another world.':scenePlayback?'Construction in progress…':cpuBusy?'Three CPU nations are taking their turns…':remaining===0?'All 3 major actions used. You can still play a card or transfer troops.':`<b>${remaining} major action${remaining===1?'':'s'} remaining.</b> Expand, build, market enlistment, govern or research.`;
 el('turnFoot').textContent=p.discountBuild||p.discountExpand?`Active discounts: Build −${p.discountBuild} SP · Expand −${p.discountExpand} SP`:'3 major actions + 1 troop transfer per turn · 1 optional card';
}
function renderTile(t){
 const container=el('territoryDetails');
 if(!t){el('territoryTag').textContent='SELECT A HEX';container.innerHTML='<p class="empty-note">Tap a territory on the map to inspect it.</p>';return;}
 const p=getCountry(),terrain=TERRAIN[t.terrain],owner=t.owner===null?null:G.players[t.owner],isOwn=t.owner===0,frontier=eligibleExpansion(p,t);
 const residents=owner?owner.citizens.filter(c=>c.homeId===t.id).length:0;
 el('territoryTag').textContent=t.capital?'CAPITAL':t.terrain.toUpperCase();if(sheetMode==='territory')el('sheetTitle').textContent=t.name;
 let html=`<div class="tile-head"><div><h3 class="tile-title">${esc(t.name)}</h3><div class="tile-sub">${terrain.name} · ${t.q}, ${t.r}</div></div><span class="owner-pill" style="background:${owner?owner.color:'#c6d8c1'}">${owner?esc(owner.name):'Unclaimed'}</span></div><p class="tile-description">${terrain.desc}</p>`;
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
  html+=`<div class="gs-job-card"><div class="gs-job-head"><strong>${b.icon} ${b.name} · Lvl ${meta?.level||1}</strong><small>${type==='homes'?`${8+4*((meta?.level||1)-1)} housing capacity · no employees required`:type==='builderBunk'?`${meta?.level||1} builder position${(meta?.level||1)===1?'':'s'} · provides specialized builders`:type==='caravanWarehouse'?`${meta?.level||1} caravan berth${(meta?.level||1)===1?'':'s'} · stores transport wagons`: `${q?.count||0}/${q?.slots||0} workers · Morale ${q?.count?Math.round(q.morale):'—'}/100`} · ${(b.upkeep+(meta.level-1)*Math.ceil(b.upkeep*.8))} base upkeep${q.slots?' + '+q.count+' wages':''}${type==='post'?` · ${occupied}/12 troops`:''}</small></div>`;
  const stockList=Object.entries(meta?.stock||{}).filter(([k,v])=>v>0);
  const storageLimit=siteStorageCapacity(type,meta.level),stored=stockUsed(meta);
  if(storageLimit>0)html+=`<div class="gs-storage-gauge"><b>Storage:</b> ${stored}/${storageLimit} units${stored>=storageLimit?' · FULL — production halted until collected':''}<div class="gs-storage-track"><span style="width:${Math.min(100,100*stored/storageLimit)}%"></span></div><small>Higher building levels increase storage capacity.</small></div>`;
  const outgoing=G.shipments.filter(job=>job.owner===p.id&&job.from===meta.id);
  html+=`<div class="gs-site-inventory"><small><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-storage"></use></svg> On-site: ${stockList.length?stockList.map(([k,v])=>`${v} ${GOOD_NAMES[k]||k}`).join(' · '):'Empty'}${outgoing.length?`<br>On the road: ${outgoing.slice(0,4).map(job=>`${job.qty} ${GOOD_NAMES[job.item]||job.item} (${job.remaining}T)`).join(' · ')}`:''}</small></div>`;
  if(isOwn&&type==='storageWarehouse'&&stockList.length){
   const targets=routingTargets(p,meta.id);
   html+=`<div class="gs-storage-actions"><strong>Send stored goods with an available caravan</strong>${stockList.map(([item,qty])=>`<div class="gs-stock-dispatch"><span>${esc(GOOD_NAMES[item]||item)} ×${qty}</span><select data-storage-send-to="${i}" data-storage-good="${esc(item)}">${targets.map(dst=>`<option value="${dst.id}">${esc(dst.name)}</option>`).join('')}</select><button data-action="dispatch-store" data-index="${i}" data-item="${esc(item)}" ${!active()?'disabled':''}>Ship up to 10</button></div>`).join('')}</div>`;
  }
  if(isOwn&&FACTORY_RECIPES[type])html+=`<label class="gs-routing-label">Manufacture <select data-recipe-site="${i}">${FACTORY_RECIPES[type].map(recipe=>`<option value="${recipe}" ${meta.recipe===recipe?'selected':''}>${RECIPES[recipe].name}</option>`).join('')}</select></label>`;
  if(isOwn&&OUTPUTS[type]?.length){const targets=routingTargets(p,meta.id);
   const current=FACTORY_RECIPES[type]?[meta.recipe]:OUTPUTS[type].filter(item=>type!=='mine'||item==='stone'||(t.vein?.kind===item)||(t.coalVein?.kind===item));
   for(const item of current){const route=meta.routes?.[item]||'depot';
    html+=`<label class="gs-routing-label"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-caravan"></use></svg> ${GOOD_NAMES[item]||item} destination <select data-route-site="${i}" data-route-good="${item}">${targets.map(target=>`<option value="${target.id}" ${String(route)===String(target.id)?'selected':''}>${esc(target.name)}</option>`).join('')}</select></label>`;}
  }
  if(isOwn){html+=`<div class="gs-job-controls">${q.slots?`<button data-action="hire-worker" data-index="${i}" ${!active()||q.count>=q.slots||!p.citizens.some(c=>eligibleWorker(c)&&!c.job)?'disabled':''}>Hire</button><button data-action="release-worker" data-index="${i}" ${!active()||!q.count?'disabled':''}>Release</button><button data-action="auto-workers" data-index="${i}" ${!active()?'disabled':''}>Auto ${meta.autoHire?'ON':'OFF'}</button>`:''}`;
   if(upgrade)html+=`<button data-action="upgrade" data-index="${i}" ${!canAct()||!idleBuilders(p).length||inProgress||!hasMoney(p,upgrade.gold)||p.wood<upgrade.wood||mineralCount(p,'iron')<upgrade.iron?'disabled':''}>${inProgress?'Upgrading…':`Upgrade L${meta.level+1}: ${upgrade.gold} SP ${upgrade.wood} <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-wood"></use></svg> ${upgrade.iron} <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-ingot"></use></svg>`}</button>`;
   html+=`<button data-action="sell" data-index="${i}" ${!canAct()||occupied>0||inProgress?'disabled':''}>Sell +${Math.max(2,Math.floor(b.gold*.6))} SP</button></div>`;
  }
  html+='</div>';
 });html+='</div>';}

 const jobs=(G.projects||[]).filter(j=>j.tileId===t.id);
 if(jobs.length){html+='<div class="building-roster"><strong><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-construction"></use></svg> Under construction</strong>'+jobs.map(j=>{
  const assigned=assignedBuilders(G.players[j.owner],j.id),enRoute=assigned.filter(c=>c.builder.travelRemaining>0).length;
  const extra=isOwn&&idleBuilders(p).length?`<button data-action="add-builder" data-job="${j.id}"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-plus"></use></svg> Assign another builder</button>`:'';
  return `<div class="building-row"><span>${BUILDINGS[j.type].icon} ${BUILDINGS[j.type].name}<small>${j.remaining} work turns left · ${assigned.length} builder${assigned.length===1?'':'s'} (${enRoute} en route) · ${j.upgradeSiteId?'upgrading existing building':BUILDINGS[j.type].space+' space reserved'}</small></span>${extra}</div>`;
 }).join('')+'</div>';}
 if(isOwn){const b=buildersSummary(p),exp=(p.expeditions||[])[0];html+=`<div class="gs-crew-status"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-builder"></use></svg> Builders: ${b.free}/${b.total} available (capacity ${b.capacity}) · <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-compass"></use></svg> Expedition: ${exp?.targetId?'traveling ('+exp.remaining+' turns)':'ready'}</div>`;}

 html+='<div class="tile-actions">';
 if(frontier){const cost=expansionCost(p),afford=hasMoney(p,cost)&&p.food>=2;html+=`<button class="action-btn primary-action" data-action="expand" ${!canAct()||!afford?'disabled':''}>Send expedition <span>${cost} SP + 2 <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg> · travel required</span></button>`;if(!afford)html+='<div class="disabled-help">Not enough Silver Pents or Food to expand.</div>';}
 else if(t.owner===null&&pendingClaim(t.id)){const exp=expeditionForTile(t.id);html+=`<div class="feature-locked"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-compass"></use></svg> ${esc(G.players[exp.owner].name)} expedition approaching · ${exp.remaining} turn${exp.remaining===1?'':'s'} remaining</div>`;}
 else if(t.owner===null&&t.terrain==='water'){html+='<div class="feature-locked"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-water"></use></svg> Lakes cannot currently be claimed or built upon.</div>';}
 else if(t.owner===null){html+='<p class="empty-note">Expand from your own border to reach this territory.</p>';}
 else if(isOwn){
  const adjacentOwned=neighbors(t).filter(n=>n.owner===0&&n.terrain!=='water');
  if(adjacentOwned.length){
   html+='<div class="gs-local-road-list"><strong>Domestic roads · Faster internal travel</strong><small>Pave the shared border for 3 SP + 1 Wood. Requires an idle builder, travel time, and 2 construction turns. Completed roads speed up caravans, builders, expeditions and soldiers.</small>';
   for(const n of adjacentOwned){const paved=domesticRoadExists(t,n),job=roadJobBetween(t,n),afford=canStartDomesticRoad(t,n,0);
    html+=`<div class="gs-local-road-row"><span>${esc(n.name)} <small>${paved?'Paved road operational':job?'Crew constructing · '+job.remaining+'T work left':'Unpaved border'}</small></span>${!paved&&!job?`<button data-action="domestic-road" data-road-neighbor="${esc(n.id)}" ${!canAct()||!afford?'disabled':''}>Build road · 3 SP</button>`:''}</div>`;
   }
   html+='</div>';
  }
  if(buildFree(t)>0)html+=`<button class="action-btn primary-action" data-action="open-build" ${!canAct()?'disabled':''}>Construct building <span>${buildFree(t)} space available →</span></button>`;
  else html+='<div class="feature-locked"><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-homes"></use></svg> This hex is full. Expand into another territory for more construction space.</div>';
  if(buildingCount(t,'post')){
   const count=postGarrison(p,t.id).length,available=p.citizens.filter(c=>c.age>=18&&!c.military).length;
   html+=`<div class="post-actions"><strong><svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-shield"></use></svg> Military post · ${count}/12 stationed</strong><button class="action-btn" data-action="recruit" ${!canAct()||count>=12||!available||!hasMoney(p,4)?'disabled':''}>Recruitment marketing <span>4 SP · 2 rounds boost</span></button><button class="action-btn" data-action="train" ${!canAct()||!count||!hasMoney(p,3)||p.food<1?'disabled':''}>Train up to 3 troops <span>3 SP + 1 <svg class="gs-glyph" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><use href="#gs-i-food"></use></svg></span></button></div>`;
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
function renderRoster(){
 const p=getCountry(),posts=getMilitaryPosts(0),troops=p.citizens.filter(c=>!!c.military);
 el('rosterCitizensBtn').classList.toggle('active',rosterTab==='citizens');
 el('rosterTroopsBtn').classList.toggle('active',rosterTab==='troops');
 el('rosterCount').textContent=rosterTab==='citizens'?`${p.citizens.length} TOTAL`:`${troops.length} TROOPS`;
 if(rosterTab==='citizens'){
  el('rosterList').innerHTML=`<div class="roster-head">Citizen <span>Age · Residence · Role</span></div>`+p.citizens.map(c=>{
   const home=c.homeId?G.tiles.find(t=>t.id===c.homeId)?.name||'Unknown':'Homeless';
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>${c.age} years · Health ${c.health}/100 · Morale ${c.morale}/100 · ${esc(home)}${c.military?' · Soldier':c.builder?' · Builder'+(c.builder.projectId?' (on assignment)':' (available)'):c.job?' · Employed: '+esc((()=>{const t=G.tiles.find(t=>t.id===c.job.tileId),idx=t?.buildingMeta?.findIndex(m=>m.id===c.job.siteId);return idx>=0?BUILDINGS[t.buildings[idx]].name:'Workplace';})()):' · Unemployed'}</small></div>`;
  }).join('');
 }else{
  el('rosterList').innerHTML=troops.length?`<p class="roster-instructions">Transfer one soldier between your posts each turn, even after using your main action.</p>`+troops.map(c=>{
   const post=G.tiles.find(t=>t.id===c.military.postId);
   const choices=posts.filter(t=>t.id!==c.military.postId&&postGarrison(p,t.id).length<12);
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>Age ${c.age} · Health ${c.health} · Training ${c.military.training}/5 · Armor: ${c.military.gear?GEAR[c.military.gear].name:'Unarmored'} (readiness ${gearReadiness(c)}) · ${c.military.shield?GOOD_NAMES[c.military.shield]:'No Shield'} · ${c.military.weapon?GOOD_NAMES[c.military.weapon]:'No Weapon'} · ${c.military.perk||'No perk'}<br>Stationed: ${esc(post?.name||'Unassigned')}</small>${`<label class="roster-transfer">Equip <select data-equip-soldier="${esc(c.id)}" ${!canAct()?'disabled':''}><option value="">Select gear…</option>${GEAR_ORDER.map(tier=>`<option value="${tier}" ${!canEquip(p,c,tier)?'disabled':''}>${GEAR[tier].name} · 1 ${GEAR[tier].name} delivered</option>`).join('')}</select></label>`}${`<label class="roster-transfer">Issue Shield / Stone Weapon <select data-equip-extra="${esc(c.id)}" ${!canAct()?'disabled':''}><option value="">Select delivered gear…</option>${['woodShield','stoneAxe','stonePickaxe','stoneSword','stoneClub'].map(item=>`<option value="${item}" ${!postStock(p,c.military.postId)||localCount(postStock(p,c.military.postId),item)<1?'disabled':''}>${GOOD_NAMES[item]} · ${localCount(postStock(p,c.military.postId),item)} at post</option>`).join('')}</select></label>`}${choices.length?`<label class="roster-transfer">Transfer to <select data-move-soldier="${esc(c.id)}" ${!active()||p.logisticsUsed?'disabled':''}><option value="">Choose post…</option>${choices.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>`:''}</div>`;
  }).join(''):`<p class="empty-note">No troops enlisted yet. Build a Military Post, then eligible adults can volunteer each round. Run a marketing campaign to increase interest.</p>`;
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
 const handEffects={grant:'Gain 6 SP',harvest:'Gain 5 Food',supplies:'+3 Wood · +2 Iron',insight:'Gain 3 Knowledge',charter:'Next claim −3 SP',permit:'Next build −3 SP'};
 el('hand').innerHTML=p.hand.map((c,i)=>{
  const fan=i-(n-1)/2,angle=fan*9;
  return `<button type="button" class="card-item" data-card="${i}" style="--fan:${fan};--angle:${angle}deg" aria-label="Enlarge ${esc(CARDS[c].name)} — ${esc(CARDS[c].desc)}"><span class="card-icon">${CARDS[c].icon}</span><span class="card-name">${esc(CARDS[c].name)}</span><span class="card-desc">${esc(handEffects[c]||CARDS[c].desc)}</span></button>`;
 }).join('')||'<p class="hand-empty">No cards in hand. Draw again next turn.</p>';
}
function renderStandings(){const sorted=[...G.players].sort((a,b)=>prosperity(b)-prosperity(a));el('standings').innerHTML=sorted.map((p,i)=>`<div class="standing"><span class="standing-rank">${i+1}</span><span class="standing-color" style="background:${p.color}"></span><span class="standing-name"><strong>${esc(p.name)}${p.id===0?' (You)':''}</strong><small>${G.tiles.filter(t=>t.owner===p.id).length} territory · ${G.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+(t.buildings||[]).length,0)} builds · ${fmt(p.gold)} SP</small></span><span class="standing-score">${prosperity(p)}</span></div>`).join('');}
function renderLog(){el('gameLog').innerHTML=G.log.slice(0,10).map(l=>`<div class="log-item"><span class="log-round">R${l.round}</span><span>${esc(l.text)}</span></div>`).join('');}
// Global Standoff: lightweight 2.5D board. All illustrations are vector primitives,
// rendered without third-party libraries or large image downloads.
const coords=t=>({x:HEX*Math.sqrt(3)*(t.q+t.r/2),y:HEX*1.5*t.r});
const VIEW_TILT=.68;
const POV_ANGLES=[-.24,.36,.92,1.48];
const smooth=t=>t*t*(3-2*t);
const blend=(a,b,t)=>a+(b-a)*t;
let cameraYaw=POV_ANGLES[0],cameraMoveFrame=0,cameraResolve=null,cpuPlaybackToken=0,skipCpuPlayback=false,actionTileId=null,actionKind='';
let boardBaseYaw=cameraYaw,boardBillboards=[],boardFootprints=[],boardWagons=[];
const wagonMotionSeen=new Set();
function billboardSvg(x,y,contents){return `<g data-gs-billboard="1" data-anchor-x="${x.toFixed(2)}" data-anchor-y="${y.toFixed(2)}">${contents}</g>`;}
// The plane rotates in camera yaw. These screen-facing sprites counter-rotate
// around their original anchor; flags, houses and labels always remain upright.
function syncBoardRotation(){
 const map=el('mapContent');if(!map)return;
 const d=cameraYaw-boardBaseYaw,co=Math.cos(d),sn=Math.sin(d),b=VIEW_TILT*sn,c=-sn/VIEW_TILT;
 map.setAttribute('transform',`matrix(${co.toFixed(7)} ${b.toFixed(7)} ${c.toFixed(7)} ${co.toFixed(7)} 0 0)`);
 const ib=-b,ic=-c;
 for(const {node,x,y} of boardBillboards){
  const px=co*x+c*y,py=b*x+co*y;
  // Billboard culling: far-offscreen 3D scenery need not update every frame.
  if(px<view.x-190||px>view.x+view.w+190||py<view.y-190||py>view.y+view.h+190)continue;
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
 // Wagons are screen-facing while their directional view follows the physical
 // road heading; changing a camera angle never requires replacing the SVG map.
 for(const w of boardWagons){
  const heading=project(w.dx,w.dy,cameraYaw);
  const view=Math.abs(heading.y)>Math.abs(heading.x)*.72?(heading.y>0?'front':'rear'):'side';
  w.node.dataset.view=view;
  w.node.dataset.side=heading.x<0?'left':'right';
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

function falconVisuals(){
 return (G.tradeOffers||[]).filter(o=>o.status==='falcon').map(offer=>{
  const a=capitalOf(offer.from),b=capitalOf(offer.to);if(!a||!b)return '';
  const from=coords(a),to=coords(b),total=Math.max(1,offer.travelTotal||1),t=Math.max(.07,1-(offer.travelRemaining||0)/total);
  const point=project(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t);
  return `<g transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})" class="gs-messenger-falcon" pointer-events="none"><path class="gs-falcon-wing" d="M0 -6Q-18 -23 -27 -11Q-11 -12 -4 3Z" fill="#f4deab" stroke="#253e4c" stroke-width="2"/><path class="gs-falcon-wing right" d="M0 -6Q18 -23 27 -11Q11 -12 4 3Z" fill="#e1b878" stroke="#253e4c" stroke-width="2"/><path d="M-7 -2Q0 -12 7 -2L2 10L-2 10Z" fill="#fff4ce" stroke="#253e4c" stroke-width="1.5"/><path d="M-3 10L0 19L3 10" fill="#c78e57"/><path d="M4 -3L12 -1L4 2" fill="#d7a452"/></g>${foregroundTurnLabel(point.x,point.y,`${offer.travelRemaining}T`)}`;
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
  const boots=Array.from({length:4},(_,i)=>{
   const back=25-i*6,side=(i%2===0?-1:1)*3.4;
   const x=position.x-ux*back+px*side,y=position.y-uy*back+py*side+7;
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
  <g class="gs-wagon-wheel" transform="translate(-8 5.6)"><circle r="3.5" fill="#423c34" stroke="#e5c184" stroke-width="1.2"/><path d="M-2 0H2M0 -2V2" stroke="#d0a777"/></g>
  <g class="gs-wagon-wheel" transform="translate(9 5.6)"><circle r="3.5" fill="#423c34" stroke="#e5c184" stroke-width="1.2"/><path d="M-2 0H2M0 -2V2" stroke="#d0a777"/></g>
 </g>`;
 return side+front+rear;
}
function caravanVisuals(){
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 return G.players.flatMap(p=>(p.caravans||[]).map(cart=>{
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
  return billboardSvg(point.x,point.y,`<g class="gs-covered-wagon" data-gs-wagon="1" data-dir-x="${dx.toFixed(2)}" data-dir-y="${dy.toFixed(2)}" data-view="${direction}" data-side="${side}" data-cargo="${cargo?1:0}" data-roadway="edge" transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})" pointer-events="none">${motion}
   <g class="gs-wagon-scale" transform="scale(.68)"><g class="gs-covered-wagon-rock ${riding?'gs-wagon-moving':''}">${wagonViewArtwork(p.color)}${cargo?'<rect x="7" y="-17" width="7" height="6" rx="1.5" fill="#edcb91" stroke="#243f45" stroke-width="1"/>':''}</g></g>
  </g>`);
 })).join('');
}

function diplomaticFalconVisuals(){
 return (G.diplomaticFalcons||[]).filter(f=>f.status==='flying').map(f=>{
  const origin=capitalOf(f.from),dest=capitalOf(f.to);if(!origin||!dest)return '';
  const a=sceneCoords(origin),b=sceneCoords(dest),t=1-(f.remaining/f.travelTotal);
  const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t-25;
  return `<g class="gs-messenger-falcon gs-diplomatic-falcon" pointer-events="none" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path class="gs-falcon-wing" d="M0 0Q-18 -19 -25 -7Q-8 -10 -2 2Z" fill="#e2d6bd" stroke="#263d4e" stroke-width="2"/><path class="gs-falcon-wing right" d="M0 0Q18 -19 25 -7Q8 -10 2 2Z" fill="#d4af74" stroke="#263d4e" stroke-width="2"/><path d="M-5 0Q0 -8 5 0L2 11H-2Z" fill="#faf1d8" stroke="#263d4e" stroke-width="1.5"/><circle cx="0" cy="10" r="3" fill="#8f4e4b"/></g>`;
 }).join('');
}

function renderMap(){
 if(!G)return;
 const svg=el('worldMap');svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 const sorted=G.tiles.map(t=>({t,c:sceneCoords(t)})).sort((a,b)=>a.c.y-b.c.y||a.c.x-b.c.x);
 const bases=[],decorations=[];
 for(const {t,c:{x,y}} of sorted){
  const claiming=scenePlayback?.tileId===t.id&&scenePlayback.kind==='expand';
  const owner=(t.owner===null||(claiming&&scenePlayback.phase==='prepare'))?null:G.players[t.owner],selected=!cpuBusy&&t.id===G.selectedId;
  const top=hexPoints(t,HEX-1),center=sceneCoords(t);
  const extrude=t.terrain==='water'?7:(t.terrain==='mountain'?14:11);
  const lower=top.map(p=>({x:p.x,y:p.y+extrude}));
  const fill=t.terrain==='water'?'#478aa8':TERRAIN[t.terrain].color;
  const border=owner?owner.color:'#627267';
  const faces=top.map((p,i)=>{const n=(i+1)%6;
   // Render the lower front wall of the miniature hex instead of flipping a fixed wall
   // when the viewing angle changes between countries.
   const front=(p.y+top[n].y)/2>center.y-.3;
   return front?`<polygon class="gs-hex-side" points="${pts([p,top[n],lower[n],lower[i]])}" fill="${t.terrain==='water'?'#295773':i%2?'#685b47':'#776752'}" stroke="#283d3f" stroke-width=".7"/>`:'';
  }).join('');
  const inset=top.map(p=>({x:center.x+(p.x-center.x)*.92,y:center.y+(p.y-center.y)*.92}));
  bases.push(`<g class="tile-base" pointer-events="none">
   <polygon points="${pts(lower)}" fill="#172d30" opacity=".52" transform="translate(1 2)"/>
   ${faces}
   <polygon points="${pts(top)}" fill="${fill}" stroke="#364d4a" stroke-width="2.7"/>
   <polygon points="${pts(inset)}" fill="${fill}" stroke="${t.terrain==='water'?'#8fc8da':'#e8dcad'}" stroke-opacity=".38" stroke-width="1.4"/>
   <path d="M${top[0].x.toFixed(1)} ${top[0].y.toFixed(1)}L${top[1].x.toFixed(1)} ${top[1].y.toFixed(1)}L${top[2].x.toFixed(1)} ${top[2].y.toFixed(1)}" stroke="#f8efc8" opacity=".3" stroke-width="2" fill="none"/>
   <polygon points="${pts(top)}" fill="${owner?owner.color:'#ffffff'}" opacity="${owner?'.11':'.025'}" stroke="${border}" stroke-width="${owner?'2.4':'1.0'}"/>
   ${selected?`<polygon points="${pts(top)}" fill="none" stroke="#fff6c7" stroke-width="3.6"/>`:''}
  </g>`);
  const action=t.id===actionTileId;
  const scout=expeditionForTile(t.id);
  decorations.push(`<g class="hex ${selected?'hex-selected':''} ${action?'hex-action-flash':''}" data-hex="${t.id}" tabindex="0" role="button" aria-label="${esc(t.name)}: ${TERRAIN[t.terrain].name}${owner?' owned by '+esc(owner.name):' unclaimed'}">
   <polygon class="hex-hit" points="${pts(top)}" fill="transparent" stroke="none"/>
   ${billboardSvg(x,y,tileMiniatures(t,x,y)+(owner?`<circle cx="${x-24}" cy="${y-13}" r="5.5" fill="${owner.color}" stroke="#fff8df" stroke-width="1.3" pointer-events="none"/>`:''))}
   ${action?`<ellipse class="tile-spotlight" cx="${x}" cy="${y}" rx="41" ry="28" fill="none" stroke="#fff1ba" stroke-width="3" pointer-events="none"/>`:''}
   ${claiming&&scenePlayback.phase==='play'?`<polygon class="gs-claim-ring" points="${pts(top)}" fill="none" stroke="${owner?.color||'#f4dbac'}" stroke-width="6" pointer-events="none"/>`:''}
  </g>`);
 }
  const waterways=(G.rivers||[]).map(river=>{
   // Vertices are shared by two land hexes; project AFTER camera yaw/tilt.
   const positions=river.points||[];
   if(positions.length<2)return '';
   const projected=positions.map(p=>project(p.x,p.y));
   const d='M'+projected.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
   return `<g class="river-course" pointer-events="none"><path d="${d}" stroke="#49675b" stroke-width="12" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".82"/><path d="${d}" stroke="#398aab" stroke-width="8.2" stroke-linejoin="round" stroke-linecap="round" fill="none"/><path d="${d}" stroke="#a0dbe5" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".77"/></g>`;
  }).join('');
 const tradeLines=roadVisuals()+domesticRoadVisuals();
 const ownerOutlines=ownedTerritoryOutlines();
 const movementOverlays=falconVisuals()+diplomaticFalconVisuals()+expeditionTrailVisuals()+caravanVisuals()+visibleWarOrderMarkers();
 const upperLabels=constructionHudLabels()+roadHudLabels();
 // Ownership is laid over roads so its line is never hidden by paving or rivers.
 el('mapContent').innerHTML=`<g class="world-terrain">${bases.join('')}</g><g pointer-events="none">${waterways}${tradeLines}</g><g class="gs-national-borders" pointer-events="none">${ownerOutlines}</g><g class="world-features">${decorations.join('')}</g><g class="gs-moving-overlays" pointer-events="none">${movementOverlays}</g><g class="gs-map-frontlabels" pointer-events="none">${upperLabels}</g>`;
 boardBaseYaw=cameraYaw;
 boardBillboards=[...el('mapContent').querySelectorAll('[data-gs-billboard]')].map(node=>({node,x:Number(node.dataset.anchorX),y:Number(node.dataset.anchorY)}));
 boardFootprints=[...el('mapContent').querySelectorAll('.gs-expedition-footprints')].map(node=>({node,x:Number(node.dataset.anchorX),y:Number(node.dataset.anchorY),dx:Number(node.dataset.dirX),dy:Number(node.dataset.dirY),baseHeading:Number(node.dataset.baseHeading)}));
 boardWagons=[...el('mapContent').querySelectorAll('[data-gs-wagon]')].map(node=>({node,dx:Number(node.dataset.dirX),dy:Number(node.dataset.dirY)}));
 syncBoardRotation();
}
function mapAspect(){const rect=el('worldMap').getBoundingClientRect();return rect.width>0&&rect.height>0?rect.width/rect.height:1.5;}
function setCenter(cx,cy,width){const aspect=mapAspect();view.w=width;view.h=width/aspect;view.x=cx-width/2;view.y=cy-view.h/2;el('worldMap').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}
function focusHome(immediate=true){if(!G)return;const t=G.tiles.find(t=>t.owner===0&&t.capital)||G.tiles[0];return moveCamera(t,POV_ANGLES[0],immediate?0:750,window.innerWidth<600?420:540);}
function resetView(){if(!G)return;cameraYaw=POV_ANGLES[0];const projected=G.tiles.map(t=>hexPoints(t,HEX+10)).flat();const xs=projected.map(p=>p.x),ys=projected.map(p=>p.y);
 const minx=Math.min(...xs)-25,maxx=Math.max(...xs)+25,miny=Math.min(...ys)-60,maxy=Math.max(...ys)+60,asp=mapAspect();const w=Math.max(maxx-minx,(maxy-miny)*asp);setCenter((maxx+minx)/2,(maxy+miny)/2,w);renderMap();}
function zoom(f){const cx=view.x+view.w/2,cy=view.y+view.h/2;setCenter(cx,cy,Math.min(2400,Math.max(210,view.w*f)));}
function moveCamera(tile,targetYaw=cameraYaw,duration=800,targetWidth=460){
 if(!G||!tile)return Promise.resolve();
 if(cameraMoveFrame)cancelAnimationFrame(cameraMoveFrame);
 if(cameraResolve){const previous=cameraResolve;cameraResolve=null;previous();}
 const from={yaw:cameraYaw,cx:view.x+view.w/2,cy:view.y+view.h/2,width:view.w};
 const fromWorld=unprojectScreen(from.cx,from.cy,from.yaw);
 const target=coords(tile),start=performance.now(),token=cpuPlaybackToken;
 const aspect=mapAspect(),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
   view.w=blend(from.width,targetWidth,k);view.h=view.w/aspect;
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
 el('resumeBtn').addEventListener('click',()=>{const saved=loadSaved();if(!saved)return;G=saved;enterGame();if(G.turnIndex===0&&G.completedScenes?.length)setTimeout(()=>showCompletedProjects(),200);if(G.finished)showEndGame();else if(G.turnIndex!==0){cpuBusy=true;cpuPlaybackToken++;skipCpuPlayback=true;setTimeout(()=>{for(let i=G.turnIndex;i<=3;i++){beginTurn(i);const p=G.players[i];for(let step=0;step<MAJOR_ACTIONS;step++){const spent=actionsUsed(p);runCpu(i);if(actionsUsed(p)===spent)break;}advanceWorldTurn();}finishRound();G.completedScenes=[];focusHome(true);cpuBusy=false;render();},80);}});
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
  if(b.dataset.sendWarning!=null){const to=Number(b.dataset.sendWarning),tile=panel.querySelector(`[data-warning-land="${to}"]`)?.value;sendDiplomaticFalcon(to,'warning',tile);return;}
  if(b.dataset.sendWar!=null){sendDiplomaticFalcon(Number(b.dataset.sendWar),'war');return;}
  if(b.dataset.sendPeace!=null){sendDiplomaticFalcon(Number(b.dataset.sendPeace),'peace');return;}
  if(b.dataset.peaceAnswer!=null){acceptCeasefire(Number(b.dataset.peaceAnswer),b.dataset.accept==='yes');return;}
  if(b.dataset.orderWar!=null){orderMilitary(panel.querySelector('#warDestination')?.value,Number(panel.querySelector('#warEnemy')?.value),panel.querySelector('#warPost')?.value,Number(panel.querySelector('#warQuantity')?.value||1),panel.querySelector('#warKind')?.value||'patrol');return;}
  if(b.dataset.recallWar!=null){recallMilitary(Number(b.dataset.recallWar));return;}
 });
 el('warBody').addEventListener('change',e=>{if(e.target.id!=='warKind')return;const panel=el('warBody'),options=panel.querySelector('[data-patrol-options]');if(!options)return;const raw=e.target.value==='flank'?options.dataset.flankOptions:options.dataset.patrolOptions;let list=[];try{list=JSON.parse(raw||'[]');}catch(e){}const select=panel.querySelector('#warDestination');if(select)select.innerHTML=list.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');});
 el('tradeBody').addEventListener('click',e=>{const propose=e.target.closest('[data-trade-propose]');if(propose){const to=Number(propose.dataset.tradePropose);const panel=el('tradeBody');const select=panel.querySelector(`[data-trade-share="${to}"]`);
  const from=panel.querySelector(`[data-road-from="${to}"]`)?.value,dest=panel.querySelector(`[data-road-to="${to}"]`)?.value;
  proposeTradeRoute(to,Number(select?.value||50),0,from,dest);return;}const ans=e.target.closest('[data-trade-answer]');if(ans)respondTradeOffer(Number(ans.dataset.tradeAnswer),ans.dataset.accept==='yes');});
 el('economySummary').addEventListener('change',e=>{if(e.target.matches('[data-caravan-policy]')){getCountry().caravanPolicy=e.target.value;save();render();}});
 el('tradeBody').addEventListener('change',e=>{const field=e.target.closest('[data-road-from],[data-road-to],[data-trade-share]');if(field)refreshRouteEstimate(Number(field.dataset.roadFrom||field.dataset.roadTo||field.dataset.tradeShare));});
 el('territoryDetails').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button||!active())return;const t=getSelected();if(!t)return;switch(button.dataset.action){case 'expand':doExpand(t);break;case 'domestic-road':startDomesticRoad(t.id,button.dataset.roadNeighbor);break;case 'open-build':showBuild=true;showResearch=false;render();break;case 'sell':doSell(t,Number(button.dataset.index||0));break;case 'hire-worker':hireAt(t,Number(button.dataset.index||0));break;case 'release-worker':releaseAt(t,Number(button.dataset.index||0));break;case 'auto-workers':toggleAutoHire(t,Number(button.dataset.index||0));break;case 'upgrade':upgradeBuilding(t,Number(button.dataset.index||0));break;case 'add-builder':sendAdditionalBuilder(t,Number(button.dataset.job));break;case 'dispatch-store':{const idx=Number(button.dataset.index),item=button.dataset.item,site=worksite(t,idx);if(t.buildings[idx]!=='storageWarehouse'||!site)return;const select=el('territoryDetails').querySelector(`[data-storage-send-to="${idx}"][data-storage-good="${item}"]`);if(select?.value){const ok=dispatchShipment(0,site.id,select.value,item,Math.min(10,localCount(site,item)),false);showToast(ok?'Caravan dispatched with '+(GOOD_NAMES[item]||item):'No free caravan, open road or receiving storage space');save();render();}break;}case 'recruit':doRecruit(t);break;case 'train':doTrain(t);break;}});
 el('territoryDetails').addEventListener('change',e=>{const t=getSelected();if(!t)return;const r=e.target.closest('[data-route-site]');if(r){setDeliveryRoute(t,Number(r.dataset.routeSite),r.dataset.routeGood,r.value);return;}const recipe=e.target.closest('[data-recipe-site]');if(recipe)setFactoryRecipe(t,Number(recipe.dataset.recipeSite),recipe.value);});
 el('buildOptions').addEventListener('click',e=>{const b=e.target.closest('[data-build]');if(b&&canAct())doBuild(getSelected(),b.dataset.build);});
 el('researchOptions').addEventListener('click',e=>{const b=e.target.closest('[data-tech]');if(b&&canAct())doResearch(b.dataset.tech);});
 el('hand').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b)openCardPreview(Number(b.dataset.card));});
 el('rosterCitizensBtn').addEventListener('click',()=>{rosterTab='citizens';renderRoster();});
 el('rosterTroopsBtn').addEventListener('click',()=>{rosterTab='troops';renderRoster();});
 el('rosterList').addEventListener('change',e=>{const equipment=e.target.closest('[data-equip-soldier]');if(equipment?.value){equipSoldier(equipment.dataset.equipSoldier,equipment.value);return;}const extra=e.target.closest('[data-equip-extra]');if(extra?.value){equipAuxiliary(extra.dataset.equipExtra,extra.value);return;}const select=e.target.closest('[data-move-soldier]');if(select?.value)moveSoldier(select.dataset.moveSoldier,select.value);});
 el('mineralBody').addEventListener('click',e=>{const smelt=e.target.closest('[data-smelt-steel]');if(smelt){smeltSteel();return;}const b=e.target.closest('[data-mineral]');if(b)mineralTrade(b.dataset.mineral,b.dataset.direction);});
 el('zoomIn').addEventListener('click',()=>zoom(.78));el('zoomOut').addEventListener('click',()=>zoom(1.28));el('zoomReset').addEventListener('click',resetView);el('focusHomeBtn').addEventListener('click',()=>{if(!cpuBusy)focusHome(false);});el('skipCpuBtn').addEventListener('click',()=>{skipCpuPlayback=true;el('cpuAction').textContent='Finishing remaining turns…';});
 const svg=el('worldMap');
 const pointers=new Map();let pinchLast=null;
 svg.addEventListener('pointerdown',e=>{
  if(!G)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};pinchLast=null;}
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
 const clearPointer=e=>{
  const tapped=!!drag&&!drag.moved&&pointers.size===1;
  if(drag?.moved||pointers.size>1){suppressClick=true;setTimeout(()=>suppressClick=false,120);}
  if(tapped)handleMapTap(e);
  pointers.delete(e.pointerId);drag=null;if(pointers.size<2)pinchLast=null;
 };
 svg.addEventListener('pointerup',clearPointer);svg.addEventListener('pointercancel',clearPointer);
 let lastMapTap=0;
 function handleMapTap(e){
  if(!G||cpuBusy||scenePlayback||cardEffectBusy||suppressClick)return;
  if(performance.now()-lastMapTap<190)return;
  // A tile can be replaced during camera animation between pointerdown and click.
  const element=(document.elementFromPoint?.(e.clientX,e.clientY)||e.target);
  const hit=element?.closest?.('[data-hex]')||e.target?.closest?.('[data-hex]');
  if(!hit)return;
  lastMapTap=performance.now();G.selectedId=hit.dataset.hex;showBuild=false;
  render();save();showSheet('territory');
 }
 svg.addEventListener('click',e=>handleMapTap(e));
 svg.addEventListener('keydown',e=>{if(scenePlayback)return;if(['Enter',' '].includes(e.key)&&e.target.matches('[data-hex]')){e.preventDefault();G.selectedId=e.target.dataset.hex;showBuild=false;render();save();showSheet('territory');}});
 svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.12:.89);},{passive:false});
 el('modalLayer').addEventListener('click',e=>{const b=e.target.closest('[data-modal]');if(!b){if(e.target===el('modalBackdrop'))closeModal();return;}switch(b.dataset.modal){case'close':closeModal();break;case'new-confirm':confirmNew();break;case'new':try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(OLD_SAVE_KEY);}catch(e){}newMatch();break;case'continue':G.finished=false;G.continued=true;G.maxRounds=Math.max(G.round+16,G.maxRounds+16);G.round++;beginTurn(0);cpuBusy=false;save();closeModal();render();break;}});
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
window.GS_TEST={ownedTerritoryOutlines,edgedRoadSegment,wagonRoadTrace,wagonViewArtwork,caravanVisuals,expeditionTrailVisuals,domesticRoadExists,canStartDomesticRoad,startDomesticRoad,progressDomesticRoads,countryTravelRoute,pathCost,domesticRoadKey,sendDiplomaticFalcon,progressDiplomaticFalcons,currentWar,startWar,sendWarningViolation:checkWarningViolation,orderMilitary,recallMilitary,progressWarOrders,militaryTravelPath,roadExistsBetween,renderWarPanel,acceptCeasefire,getState:()=>G,getCinematic:()=>({lastAction:cpuLastAction,scene:scenePlayback?{tileId:scenePlayback.tileId,kind:scenePlayback.kind,phase:scenePlayback.phase}:null,highlight:actionTileId,cpuBusy}),select:(id)=>{if(!G)return;G.selectedId=id;render();},endTurn,render,doBuild,doExpand,doRecruit,doTrain,moveSoldier,finishRound,peopleSummary,buildUsed,buildFree,focusHome,resetView,moveCamera,runCpuCinematic,sceneCoords,showSheet,closeSheet,openCardPreview,closeCardPreview,actionsRemaining,runCpu,beginTurn,volunteeringChance,proposeTradeRoute,respondTradeOffer,tradePlan,discoverContacts,doMarketing,progressProjects,progressTradeRoutes,progressTradeOffers,tradePlan,decideTradeOffer,showCompletedProjects,migrateGameplay,ensureBuildingMeta,assignWorkers,workQuality,workCapacity,hireAt,releaseAt,toggleAutoHire,upgradeBuilding,extractMinesForRound,processSteelworks,gearReadiness,createWorld,getEconomy,canBuild,upgradePrice,workforceSummary,GEAR,BUILDINGS,RECIPES,siteLookup,dispatchShipment,progressShipments,runAgricultureAndForestry,autoDispatchOutputs,autoRequestFactoryInputs,processFactories,siteStorageCapacity,endpointStorageFree,endpointDeliverySpace,storedAt,nearbyStorage,postStock,setDeliveryRoute,setFactoryRecipe,equipAuxiliary,depotCount,localCount,advanceWorldTurn,buildersSummary,idleBuilders,syncBuilders,showCompletedProjects,progressExpeditions,sendAdditionalBuilder,eligibleExpansion,expeditionForTile,buildingCount,tileHousing};
})();

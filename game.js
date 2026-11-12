/* Global Standoff 0.3.6 — finite mineral veins, trade market and troop gear. */
(() => {
'use strict';
const SAVE_KEY='global_standoff_v02_save'; // preserves 0.3.x browser saves
const OLD_SAVE_KEY='global_standoff_v01_save';
const RADIUS=7, HEX=40, MAX_ROUNDS=24, MAJOR_ACTIONS=3; // 169 hexes; three major actions per turn
const COLORS=['#7ed0b7','#e6af79','#b7a1e9','#f08b87'];
const NPCS=[{name:'Alder Union',capital:'Oakspire',sigil:'♣'},{name:'Coral Dominion',capital:'Sunport',sigil:'◆'},{name:'Vesper Republic',capital:'Duskfall',sigil:'✧'}];
const TERRAIN={
 plains:{name:'Plains',color:'#bbc885',yield:{food:1},slots:8,population:30,desc:'Roomy, fertile land ideal for large settlements.'},
 forest:{name:'Forest',color:'#66a17c',yield:{wood:1},slots:6,population:20,desc:'Wooded land with good room for towns and lumber.'},
 hills:{name:'Hills',color:'#baa079',yield:{},slots:5,population:16,desc:'Rolling terrain with mineral deposits.'},
 desert:{name:'Desert',color:'#d2b879',yield:{},slots:3,population:10,desc:'Arid land with little space for growing communities.'},
 mountain:{name:'Mountains',color:'#97a0a0',yield:{},slots:2,population:6,desc:'Mountain mineral veins; prospect, mine and trade their output.'},
 water:{name:'Lake',color:'#4d97b7',yield:{},slots:0,population:0,desc:'A freshwater lake. Construction and claiming are unavailable.'}
};
// Mountain mineral veins are fixed at world generation. Diamonds are rare both
// as deposits and as individual mining successes; no generic Ore is produced.
const MINERALS={
 coal:{name:'Coal',icon:'⚫',weight:26,price:2,chance:1,rate:2,reserve:36},
 iron:{name:'Iron',icon:'🔩',weight:20,price:3,chance:.95,rate:2,reserve:30},
 copper:{name:'Copper',icon:'🟠',weight:9,price:5,chance:.85,rate:2,reserve:18},
 silver:{name:'Silver',icon:'🥈',weight:5,price:9,chance:.6,rate:1,reserve:12},
 goldOre:{name:'Gold Ore',icon:'🥇',weight:3,price:16,chance:.35,rate:1,reserve:8},
 diamond:{name:'Diamonds',icon:'💎',weight:1,price:40,chance:.12,rate:1,reserve:4}
};
const MINERAL_KEYS=Object.keys(MINERALS);
const START_MINERALS={coal:2,iron:5,copper:0,silver:0,goldOre:0,diamond:0,steel:0};
// Gold Ore is a mineral, separate from spendable Gold coins.
// Gilded equipment uses gold ornamentation; Diamond represents reinforced edges.
const GEAR={
 basic:{name:'Basic',icon:'🧥',bonus:0,requires:{},gold:0},
 iron:{name:'Iron Gear',icon:'🛡',bonus:4,requires:{iron:2},gold:2},
 gold:{name:'Gold Gear',icon:'🥇',bonus:7,requires:{steel:1,goldOre:1},gold:4},
 diamond:{name:'Diamond Gear',icon:'💎',bonus:11,requires:{steel:2,diamond:1},gold:7}
};
const GEAR_ORDER=['basic','iron','gold','diamond'];
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
  if(t.vein!==undefined)continue;
  t.vein=veinFor(seed,t.id);
  // Existing players' mines remain productive after save migration.
  if(!t.vein&&legacy&&(t.buildings||[]).includes('mine')){const cap=26;t.vein={kind:'iron',remaining:cap,capacity:cap};}
 }
}
function mineralCount(p,key){return Math.max(0,Math.floor(p.minerals?.[key]||0));}
function gearReadiness(c){return 10+2*(c.military?.training||1)+Math.floor((c.military?.experience||0)/3)+(GEAR[c.military?.gear||'basic']?.bonus||0);}

const BUILDINGS={
 farm:{name:'Farm',icon:'🌾',gold:4,wood:2,iron:0,space:2,rounds:1,upkeep:1,production:{food:4},allow:['plains','forest','hills'],text:'+4 Food/round (rivers add +1)'},
 lumber:{name:'Lumber Camp',icon:'🌲',gold:4,wood:1,iron:0,space:2,rounds:2,upkeep:1,production:{wood:3},allow:['forest'],text:'+3 Wood/round · forests only'},
 mine:{name:'Mine',icon:'⛏',gold:6,wood:2,iron:0,space:2,rounds:2,upkeep:2,production:{},allow:['mountain'],text:'Extracts the mountain’s fixed mineral vein; rarer minerals yield less often'},
 homes:{name:'Homes',icon:'🏘',gold:5,wood:2,iron:0,space:1,rounds:1,upkeep:1,production:{},allow:['plains','forest','hills','desert','mountain'],text:'+8 housing spaces, limited by terrain'},
 market:{name:'Marketplace',icon:'⚖',gold:7,wood:2,iron:1,space:2,rounds:2,upkeep:2,production:{gold:5},allow:['plains','forest','hills','desert','mountain'],text:'+5 Gold/round'},
 academy:{name:'Academy',icon:'📚',gold:8,wood:2,iron:2,space:2,rounds:3,upkeep:2,production:{knowledge:3},allow:['plains','forest','hills','desert','mountain'],text:'+3 Knowledge/round'},
 post:{name:'Military Post',icon:'🛡',gold:8,wood:2,iron:2,space:2,rounds:2,upkeep:2,production:{},allow:['plains','forest','hills','desert','mountain'],text:'12-troop garrison · voluntary enlistment each round'}
};
const TECHS={irrigation:{name:'Irrigation',icon:'💧',gold:3,knowledge:4,desc:'+1 Food per Farm, every round.'},commerce:{name:'Commerce',icon:'⚜',gold:4,knowledge:5,desc:'+1 Gold per Marketplace, every round.'},cartography:{name:'Cartography',icon:'🧭',gold:4,knowledge:5,desc:'Expansion costs 2 less Gold.'}};
const CARDS={grant:{name:'Royal Grant',icon:'🪙',desc:'Gain 6 Gold.'},harvest:{name:'Great Harvest',icon:'🌽',desc:'Gain 5 Food.'},supplies:{name:'Supply Caravan',icon:'📦',desc:'Gain 3 Wood and 2 Iron.'},insight:{name:'Discovery',icon:'📜',desc:'Gain 3 Knowledge.'},charter:{name:'Frontier Charter',icon:'🗺',desc:'Next expansion costs 3 less Gold.'},permit:{name:'Building Permit',icon:'🏛',desc:'Next building costs 3 less Gold.'}};
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
function hasMoney(p,n){return p.gold>=n&&p.gold>=0;}
function makeCitizen(p,rng,starting=false){
 const n=p.nextCitizenId++;
 return {id:`${p.id}-${n}`,name:FIRST_NAMES[randInt(rng,FIRST_NAMES.length)]+' '+LAST_NAMES[randInt(rng,LAST_NAMES.length)],
 age:starting?18+randInt(rng,48):(rng()<.67?18+randInt(rng,38):randInt(rng,17)),health:45+randInt(rng,56),morale:40+randInt(rng,61),homeId:null,military:null};
}
function buildUsed(t){return (t.capital?2:0)+(t.buildings||[]).reduce((sum,type)=>sum+(BUILDINGS[type]?.space||0),0)+(G?.projects||[]).filter(j=>j.tileId===t.id).reduce((sum,j)=>sum+(BUILDINGS[j.type]?.space||0),0);}
function buildFree(t){return Math.max(0,TERRAIN[t.terrain].slots-buildUsed(t));}
function buildingCount(t,type){return (t.buildings||[]).filter(b=>b===type).length;}
function tileHousing(t){return (t.capital?12:0)+8*buildingCount(t,'homes');}
function tileResidentCap(t){return Math.min(TERRAIN[t.terrain].population,tileHousing(t));}
function reallocateHousing(p){
 const territories=G.tiles.filter(t=>t.owner===p.id).sort((a,b)=>Number(b.capital)-Number(a.capital));
 const remaining=Object.fromEntries(territories.map(t=>[t.id,tileResidentCap(t)]));
 // Keep existing homes stable whenever possible; move the unplaced citizens to vacancies.
 for(const c of p.citizens){if(c.homeId&&remaining[c.homeId]>0)remaining[c.homeId]--;else c.homeId=null;}
 for(const c of p.citizens){if(c.homeId)continue;const t=territories.find(t=>remaining[t.id]>0);if(t){c.homeId=t.id;remaining[t.id]--;}}
}
function peopleSummary(p){const people=p.citizens||[];const housed=people.filter(c=>!!c.homeId).length;
 return {count:people.length,housed,homeless:people.length-housed,housing:G.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+tileResidentCap(t),0),soldiers:people.filter(c=>!!c.military).length};}
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
 const players=[{name,capital,sigil:'✦'},...NPCS].map((p,i)=>({id:i,name:p.name,capital:p.capital,sigil:p.sigil,color:colors[i],gold:24,food:14,wood:10,minerals:{...START_MINERALS},knowledge:0,marketingUntil:0,tech:[],hand:[],discountExpand:0,discountBuild:0,acted:false,actionsUsed:0,expansionsThisTurn:0,levyUsed:false,cardPlayed:false,logisticsUsed:false,citizens:[],nextCitizenId:0}));
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
 G={version:2,waterwayVersion:2,seed,worldName,worldOptions:options,rivers,players,tiles,projects:[],completedScenes:[],contacts:[],tradeOffers:[],tradeRoutes:[],nextProjectId:1,nextTradeId:1,round:1,turnIndex:0,maxRounds:MAX_ROUNDS,selectedId:key(...CAPITAL_SPOTS[0]),deck,drawIndex:0,log:[],finished:false,continued:false};
 for(const p of players){const citizenRng=mulberry32(hash(seed+'-people-'+p.id));for(let k=0;k<10;k++)p.citizens.push(makeCitizen(p,citizenRng,true));reallocateHousing(p);drawCard(p);drawCard(p);}
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
 s.tradeOffers=s.tradeOffers||[];s.tradeRoutes=s.tradeRoutes||[];
 s.nextProjectId=s.nextProjectId||1;s.nextTradeId=s.nextTradeId||1;
 prepareMineralVeins(s.tiles,s.seed,true);
 // Old under-construction mines keep a functioning Iron vein even if their
 // migrated mountain would otherwise be barren.
 for(const job of s.projects.filter(j=>j.type==='mine')){const t=s.tiles.find(t=>t.id===job.tileId);if(t&&t.terrain==='mountain'&&!t.vein){t.vein={kind:'iron',remaining:26,capacity:26};}}
 for(const p of s.players){
  if(p.materials!==undefined){const old=Math.max(0,p.materials);p.wood=(p.wood||0)+Math.ceil(old*.6);p.ore=(p.ore||0)+Math.floor(old*.4);delete p.materials;}
  p.wood??=10;p.marketingUntil??=0;
  p.minerals??=emptyMinerals();
  for(const key of [...MINERAL_KEYS,'steel'])p.minerals[key]=Math.max(0,Math.floor(p.minerals[key]||0));
  if(p.ore!==undefined){p.minerals.iron+=Math.max(0,Math.floor(p.ore));delete p.ore;}
  for(const c of p.citizens||[]){if(c.health==null||c.morale==null){const rng=mulberry32(hash(s.seed+':traits:'+c.id));c.health=45+randInt(rng,56);c.morale=40+randInt(rng,61);}if(c.military)c.military.gear??='basic';}
 }
 return s;
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
const tradePlanCache=new Map();
function tradePlan(a,b){
 const cacheKey=G.seed+':'+contactKey(a,b);
 if(tradePlanCache.has(cacheKey))return tradePlanCache.get(cacheKey);
 const capitalA=G.tiles.find(t=>t.owner===a&&t.capital),capitalB=G.tiles.find(t=>t.owner===b&&t.capital);
 if(!capitalA||!capitalB)return null;
 const rng=mulberry32(hash(G.seed+':route:'+contactKey(a,b))),graph=borderRiverGraph(G.tiles,rng);
 const aKeys=[...new Set(graph.edges.filter(e=>e.land.includes(capitalA.id)).flatMap(e=>[e.a,e.b]))];
 const bKeys=[...new Set(graph.edges.filter(e=>e.land.includes(capitalB.id)).flatMap(e=>[e.a,e.b]))];
 const options=[];
 for(const x of aKeys)for(const y of bKeys){const route=riverPath(graph,x,y);if(route)options.push(route);}
 options.sort((a,b)=>a.banks.length-b.banks.length);
 if(!options.length)return null;
 const path=options[0],length=path.banks.length;
 const plan={...path,length,totalGold:6+Math.ceil(length/4),rounds:Math.max(2,Math.ceil(length/7))};
 tradePlanCache.set(cacheKey,plan);return plan;
}
function alreadyLinked(a,b){return G.tradeRoutes.some(r=>contactKey(r.a,r.b)===contactKey(a,b))||G.tradeOffers.some(o=>o.status==='pending'&&contactKey(o.from,o.to)===contactKey(a,b));}
function proposeTradeRoute(to,share,id=0){
 const p=G.players[id],target=G.players[to];if(!target||!hasContact(id,to)||alreadyLinked(id,to)||!canCountryAct(p,id))return false;
 const plan=tradePlan(id,to);if(!plan)return false;
 const percent=Number(share);if(![25,50,75].includes(percent))return false;
 const mine=Math.ceil(plan.totalGold*percent/100),theirs=plan.totalGold-mine;
 if(!hasMoney(p,mine)){if(id===0)showToast(`Need ${mine} Gold for your proposed share`);return false;}
 G.tradeOffers.push({id:G.nextTradeId++,from:id,to,share:percent,costA:mine,costB:theirs,plan,createdRound:G.round,status:'pending'});
 useAction(p,`${p.name} proposed a ${plan.length}-edge trade route to ${target.name}, paying ${percent}% of construction.`);
 if(id===0)showToast('Trade proposal dispatched · awaiting agreement');return true;
}
function decideTradeOffer(offer,accepted){
 if(!offer||offer.status!=='pending')return false;
 const a=G.players[offer.from],b=G.players[offer.to];
 if(!accepted||!hasMoney(a,offer.costA)||!hasMoney(b,offer.costB)){
  offer.status='rejected';addLog(`${b.name} rejected the proposed trade route with ${a.name}.`);return true;
 }
 a.gold-=offer.costA;b.gold-=offer.costB;
 offer.status='accepted';G.tradeRoutes.push({id:offer.id,a:a.id,b:b.id,points:offer.plan.points,banks:offer.plan.banks,length:offer.plan.length,rounds:offer.plan.rounds,remaining:offer.plan.rounds,startedRound:G.round,status:'construction'});
 addLog(`${a.name} and ${b.name} agreed to build a trade route. Costs: ${offer.costA}/${offer.costB} Gold. Completion in ${offer.plan.rounds} rounds.`);
 return true;
}
function progressTradeOffers(){
 for(const offer of G.tradeOffers.filter(o=>o.status==='pending'&&o.createdRound<G.round&&o.to!==0)){
  const b=G.players[offer.to],rng=mulberry32(hash(G.seed+':tradeResponse:'+offer.id));
  decideTradeOffer(offer,hasMoney(b,offer.costB)&&rng()>.17);
 }
}
function progressTradeRoutes(){
 for(const route of G.tradeRoutes.filter(r=>r.status==='construction'&&r.startedRound<G.round)){
  route.remaining=Math.max(0,route.remaining-1);
  if(route.remaining===0){route.status='active';addLog(`Trade route opened between ${G.players[route.a].name} and ${G.players[route.b].name}.`);}
 }
 for(const route of G.tradeRoutes.filter(r=>r.status==='active')){
  G.players[route.a].gold+=2;G.players[route.b].gold+=2;
 }
}
function respondTradeOffer(id,yes){
 const offer=G.tradeOffers.find(o=>o.id===id&&o.to===0&&o.status==='pending');
 if(!offer||!active())return false;
 decideTradeOffer(offer,yes);save();render();return true;
}
function renderTradePanel(){
 const node=el('tradeBody');if(!node||!G)return;
 const contacts=G.players.filter(p=>p.id!==0&&hasContact(0,p.id));
 const offers=G.tradeOffers.filter(o=>o.from===0||o.to===0);
 const routes=G.tradeRoutes.filter(r=>r.a===0||r.b===0);
 let html='<p class="gs-trade-caption">Trade routes require first contact, a cost-sharing proposal, and both countries’ agreement. Work follows shared land-hex edges and takes time.</p>';
 if(!contacts.length)html+='<p class="empty-note">No diplomatic contacts yet. Expand toward other borders to meet their countries.</p>';
 for(const p of contacts){
  const pending=alreadyLinked(0,p.id),plan=tradePlan(0,p.id);
  html+=`<div class="gs-trade-row"><strong>${esc(p.name)}</strong><small>${plan?`${plan.length} hex edges · ${plan.rounds} construction rounds · ${plan.totalGold} Gold total`:'Route unavailable'}</small>${pending?'<span class="gs-trade-caption">A proposal or route already exists</span>':`<div class="gs-trade-controls"><label>Our cost share <select data-trade-share="${p.id}"><option value="25">25%</option><option value="50" selected>50%</option><option value="75">75%</option></select></label><button class="small-outline" data-trade-propose="${p.id}" ${!canAct()||!plan?'disabled':''}>Propose route</button></div>`}</div>`;
 }
 for(const o of offers){const other=G.players[o.from===0?o.to:o.from];html+=`<div class="gs-trade-row"><strong>${o.status==='pending'?'✉️':'📜'} ${esc(other.name)}</strong><small>${o.status.toUpperCase()} · proposer pays ${o.costA} Gold, partner ${o.costB} Gold</small>${o.status==='pending'&&o.to===0?`<div class="gs-trade-controls"><button class="primary" data-trade-answer="${o.id}" data-accept="yes">Accept</button><button class="small-outline" data-trade-answer="${o.id}" data-accept="no">Decline</button></div>`:''}</div>`;}
 for(const r of routes){const other=G.players[r.a===0?r.b:r.a];html+=`<div class="gs-trade-row"><strong>🛤 ${esc(other.name)}</strong><small>${r.status==='active'?'Trade active · +2 Gold per round':`Under construction · ${r.remaining} rounds left`} · ${r.length} hex edges</small></div>`;}
 node.innerHTML=html;
}
function showToast(s){const t=el('toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2650);}
function showModal(html){el('modalBody').innerHTML=html;el('modalLayer').classList.remove('hidden');}
function closeModal(){el('modalLayer').classList.add('hidden');}
function mountMapUi(){
 // Reparent the existing, fully functional panels. No duplicated actions or game state.
 const sheet=el('sheetBody');
 const mineralPanel=document.createElement('div');mineralPanel.id='mineralPanel';mineralPanel.className='gs-mineral-panel';mineralPanel.innerHTML='<h3>⛏ Mineral Exchange</h3><p class="gs-mineral-caption">Sell minerals for Gold coins. Essential Coal and Iron can also be imported at a premium. Trading uses one major action.</p><div id="mineralBody"></div>';el('economySummary').after(mineralPanel);
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
  await moveCamera(tile,cameraYaw,reduced?0:450,window.innerWidth<600?335:430);
  if(!sceneAlive(playback))return;
  playback.phase='play';renderMap();
  await new Promise(resolve=>setTimeout(resolve,reduced?120:playback.kind==='work'?750:1120));
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
 }
}

async function showCompletedProjects(){
 // Show completed construction at the start of the human turn, sequentially.
 while(G&&!G.finished&&G.turnIndex===0&&G.completedScenes?.length){
  const completion=G.completedScenes[0],tile=G.tiles.find(t=>t.id===completion.tileId);
  if(!tile){G.completedScenes.shift();continue;}
  const playback=startMapScenePlayback(tile,'build',completion.buildingIndex,completion.type);
  if(!playback)break;
  playback.fromQueue=completion.projectId;
  await playback.done;
 }
 save();
}
function progressProjects(){
 for(const job of [...G.projects]){
  job.remaining=Math.max(0,job.remaining-1);
  if(job.remaining>0)continue;
  const tile=G.tiles.find(t=>t.id===job.tileId);
  if(tile&&tile.owner===job.owner){
   tile.buildings.push(job.type);
   reallocateHousing(G.players[job.owner]);
   if(job.owner===0)G.completedScenes.push({projectId:job.id,tileId:job.tileId,type:job.type,buildingIndex:tile.buildings.length-1});
   addLog(`${G.players[job.owner].name} completed ${BUILDINGS[job.type].name} at ${tile.name}.`);
  }
  G.projects=G.projects.filter(j=>j.id!==job.id);
 }
}
function volunteeringChance(c,p){
 if(c.military||c.age<18||c.health<35)return 0;
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
  c.military={postId:post.id,training:1,experience:0,perk:null};p.food-=1;count++;
  addLog(`${c.name} volunteered for ${p.name}'s military at ${post.name}.`);
 }
}
function doMarketing(t,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!allowed(p,t)||!buildingCount(t,'post')||!hasMoney(p,4))return false;
 p.gold-=4;p.marketingUntil=G.round+2;
 useAction(p,`${p.name} launched a recruiting campaign. Voluntary enlistment boosted for two rounds.`);
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
function cardSuit(type){return ['grant','harvest','supplies'].includes(type)?['◈','ECONOMY']:['charter','permit'].includes(type)?['⌘','DEVELOPMENT']:['✦','DISCOVERY'];}
function openCardPreview(index){
 if(!G||!Number.isInteger(index)||index<0||index>=getCountry().hand.length)return;
 previewCardIndex=index;const type=getCountry().hand[index],data=CARDS[type],suit=cardSuit(type);
 const canPlay=active()&&!getCountry().cardPlayed;
 el('cardPreviewContent').innerHTML=`<button class="card-preview-close" type="button" data-preview="close" aria-label="Close card">✕</button><div class="expanded-card type-${type}"><div class="expanded-card-top"><span>${suit[0]} ${suit[1]}</span><span>✧</span></div><div class="expanded-card-art"><span class="expanded-card-halo"></span><span class="expanded-card-icon">${data.icon}</span></div><div class="expanded-card-details"><div class="expanded-card-name">${esc(data.name)}</div><div class="expanded-card-rule">${esc(data.desc)}</div></div><div class="expanded-card-footer">GLOBAL STANDOFF · ACTION CARD</div></div><div class="preview-actions"><button class="secondary" type="button" data-preview="close">Back to hand</button><button class="primary" type="button" data-preview="play" ${canPlay?'':'disabled'}>${canPlay?'PLAY CARD ↗':!active()?'Wait for your turn':'Card already played this turn'}</button></div>`;
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
function eligibleExpansion(p,t){return !!t&&t.owner===null&&t.terrain!=='water'&&neighbors(t).some(n=>n.owner===p.id);}
function expansionCost(p){return Math.max(0,5+2*(p.expansionsThisTurn||0)-p.discountExpand-(p.tech.includes('cartography')?2:0));}
function buildingCost(p,b){return Math.max(0,b.gold-p.discountBuild);}
function canBuild(p,t,b){return allowed(p,t)&&buildFree(t)>=b.space&&b.allow.includes(t.terrain)&&hasMoney(p,buildingCost(p,b))&&p.wood>=b.wood&&mineralCount(p,'iron')>=b.iron&&(b!==BUILDINGS.mine||!!t.vein&&t.vein.remaining>0);}
function getEconomy(id){
 const p=G.players[id],summary=peopleSummary(p);
 let vals={gold:0,food:0,wood:0,knowledge:0,upkeep:0};
 for(const t of G.tiles.filter(t=>t.owner===id)){
  const y=TERRAIN[t.terrain].yield;for(const k in y)vals[k]+=(y[k]||0);
  if(t.capital){vals.gold+=3;vals.food+=1;vals.upkeep+=1;}
  for(const type of t.buildings||[]){const b=BUILDINGS[type];if(!b)continue;
   for(const k in b.production)vals[k]+=b.production[k];
   vals.upkeep+=b.upkeep;
   if(type==='farm'&&p.tech.includes('irrigation'))vals.food++;
   if(type==='farm'&&t.river)vals.food++;
   if(type==='market'&&p.tech.includes('commerce'))vals.gold++;
  }
 }
 vals.gold+=Math.floor(p.citizens.filter(c=>c.homeId&&c.age>=18).length/4);
 vals.upkeep+=Math.ceil(summary.soldiers/3);
 vals.foodUse=Math.ceil(summary.count/6);
 vals.netFood=vals.food-vals.foodUse;
 vals.netGold=vals.gold-vals.upkeep;
 return vals;
}
function extractMinesForRound(p){
 for(const t of G.tiles){
  if(t.owner!==p.id||t.terrain!=='mountain'||!buildingCount(t,'mine'))continue;
  const vein=t.vein;
  if(!vein||vein.remaining<=0)continue;
  const cfg=MINERALS[vein.kind];
  const rng=mulberry32(hash(G.seed+':mining:'+t.id+':'+G.round));
  if(rng()>=cfg.chance)continue;
  const amount=Math.min(cfg.rate,vein.remaining);
  p.minerals[vein.kind]+=amount;vein.remaining-=amount;
  if(vein.kind==='diamond'||vein.kind==='goldOre')addLog(`${p.name} extracted ${amount} ${cfg.name} at ${t.name}!${vein.remaining===0?' Deposit exhausted.':''}`);
  else if(vein.remaining===0)addLog(`${p.name} exhausted its ${cfg.name} vein at ${t.name}.`);
 }
}
function canEquip(p,c,tier){
 const cfg=GEAR[tier],old=GEAR_ORDER.indexOf(c?.military?.gear||'basic');
 return !!cfg&&tier!=='basic'&&!!c?.military&&GEAR_ORDER.indexOf(tier)>old&&
   !!G.tiles.find(t=>t.id===c.military.postId&&t.owner===p.id&&buildingCount(t,'post'))&&
   hasMoney(p,cfg.gold)&&Object.entries(cfg.requires).every(([k,v])=>mineralCount(p,k)>=v);
}
function equipSoldier(citizenId,tier,id=0){
 const p=G.players[id],c=p.citizens.find(c=>c.id===citizenId);
 if(!canCountryAct(p,id)||!canEquip(p,c,tier))return false;
 const cfg=GEAR[tier];p.gold-=cfg.gold;
 for(const [k,v] of Object.entries(cfg.requires))p.minerals[k]-=v;
 c.military.gear=tier;
 useAction(p,`${p.name} equipped ${c.name} with ${cfg.name} (+${cfg.bonus} readiness).`);
 if(id===0)showToast(`${c.name}: ${cfg.name} equipped`);
 return true;
}
function smeltSteel(id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!hasMoney(p,1)||mineralCount(p,'iron')<2||mineralCount(p,'coal')<1)return false;
 p.minerals.iron-=2;p.minerals.coal--;p.gold--;p.minerals.steel++;
 useAction(p,`${p.name} smelted 2 Iron and 1 Coal into 1 Steel.`);
 if(id===0)showToast('Steel produced: +1');return true;
}
function mineralTrade(key,direction,id=0){
 const p=G.players[id],mineral=MINERALS[key];if(!mineral||!canCountryAct(p,id))return false;
 const importing=direction==='buy',cost=Math.ceil(mineral.price*2.1);
 if(importing&&!['coal','iron','copper','silver'].includes(key))return false;
 if(importing&&!hasMoney(p,cost))return false;
 if(!importing&&mineralCount(p,key)<1)return false;
 if(importing){p.gold-=cost;p.minerals[key]++;}else{p.gold+=mineral.price;p.minerals[key]--;}
 useAction(p,`${p.name} ${importing?'imported':'sold'} 1 ${mineral.name} for ${importing?cost:mineral.price} Gold at the Global Exchange.`);
 if(id===0)showToast(`${importing?'Imported':'Sold'} ${mineral.name} · ${importing?'-':'+'}${importing?cost:mineral.price} Gold`);
 return true;
}
function renderMineralMarket(){
 const node=el('mineralBody');if(!node||!G)return;
 const p=getCountry();
 node.innerHTML=MINERAL_KEYS.map(key=>{const m=MINERALS[key],q=mineralCount(p,key),buy=Math.ceil(m.price*2.1);
  return `<div class="gs-mineral-item"><span class="gs-mineral-symbol">${m.icon}</span><div class="gs-mineral-copy"><strong>${m.name} × ${q}</strong><small>Sell: ${m.price} 🪙${['coal','iron','copper','silver'].includes(key)?` · Buy: ${buy} 🪙`: ' · Mine or trade to acquire'}</small></div><div class="gs-mineral-actions"><button data-mineral="${key}" data-direction="sell" ${!canAct()||q<=0?'disabled':''}>Sell</button>${['coal','iron','copper','silver'].includes(key)?`<button data-mineral="${key}" data-direction="buy" ${!canAct()||!hasMoney(p,buy)?'disabled':''}>Buy</button>`:''}</div></div>`;
 }).join('')+`<div class="gs-mineral-item"><span class="gs-mineral-symbol">⚙️</span><div class="gs-mineral-copy"><strong>Steel × ${mineralCount(p,'steel')}</strong><small>Manufactured, never mined · 2 Iron + 1 Coal + 1 🪙</small></div><div class="gs-mineral-actions"><button data-smelt-steel="1" ${!canAct()||!hasMoney(p,1)||mineralCount(p,'iron')<2||mineralCount(p,'coal')<1?'disabled':''}>Smelt</button></div></div>`;
}
function useAction(p,text){p.actionsUsed=actionsUsed(p)+1;p.acted=actionsRemaining(p)===0;addLog(text);showBuild=false;showResearch=false;save();render();}
function doExpand(t,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!eligibleExpansion(p,t))return false;
 const cost=expansionCost(p);if(!hasMoney(p,cost)||p.food<2)return false;
 const playback=id===0?startMapScenePlayback(t,'expand'):null;
 p.gold-=cost;p.food-=2;p.discountExpand=0;p.expansionsThisTurn=(p.expansionsThisTurn||0)+1;t.owner=id;reallocateHousing(p);discoverContacts();
 useAction(p,`${p.name} expanded into ${t.name} (${TERRAIN[t.terrain].name.toLowerCase()}).`);
 if(id===0&&!playback){showToast(`Territory claimed: ${t.name}`);flashAction(t,'expand');}
 return true;
}
function doBuild(t,type,id=0){
 const p=G.players[id],b=BUILDINGS[type];if(!canCountryAct(p,id)||!b||!canBuild(p,t,b))return false;
 const playback=id===0?startMapScenePlayback(t,'work',-1,type):null;
 p.gold-=buildingCost(p,b);p.wood-=b.wood;p.minerals.iron-=b.iron;p.discountBuild=0;
 G.projects.push({id:G.nextProjectId++,owner:id,tileId:t.id,type,remaining:b.rounds,total:b.rounds,startedRound:G.round});
 useAction(p,`${p.name} started ${b.name} at ${t.name} (${b.rounds} round${b.rounds===1?'':'s'}).`);
 if(id===0&&!playback)showToast(`${b.name} construction started`);
 return true;
}
function doSell(t,idx=0,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!allowed(p,t)||!t.buildings?.[idx])return false;
 const type=t.buildings[idx],b=BUILDINGS[type];
 if(type==='post'&&getMilitaryPosts(id).length&&postGarrison(p,t.id).length>0){if(id===0)showToast('Move troops before selling this post.');return false;}
 const refund=Math.max(2,Math.floor(b.gold*.6));p.gold+=refund;t.buildings.splice(idx,1);reallocateHousing(p);
 useAction(p,`${p.name} sold a ${b.name} at ${t.name} to the Global Bank for ${refund} Gold.`);
 if(id===0)showToast(`${b.name} sold for ${refund} Gold`);return true;
}
function doRecruit(t,id=0){return doMarketing(t,id);}
function doTrain(t,id=0){
 const p=G.players[id];if(!canCountryAct(p,id)||!allowed(p,t)||!buildingCount(t,'post'))return false;
 const soldiers=postGarrison(p,t.id).filter(c=>c.military.training<5).slice(0,3);
 if(!soldiers.length||!hasMoney(p,3)||p.food<1)return false;
 p.gold-=3;p.food-=1;
 for(const c of soldiers){c.military.training++;if(c.military.training>=3&&!c.military.perk)c.military.perk='Disciplined';}
 useAction(p,`${p.name} trained ${soldiers.length} troops at ${t.name}.`);
 if(id===0)showToast('Training completed');return true;
}
function moveSoldier(citizenId,destinationId){
 if(!active())return false;const p=getCountry();if(p.logisticsUsed)return false;
 const citizen=p.citizens.find(c=>c.id===citizenId);
 const destination=G.tiles.find(t=>t.id===destinationId);
 if(!citizen?.military||!destination||destination.owner!==0||!buildingCount(destination,'post'))return false;
 if(citizen.military.postId===destinationId||postGarrison(p,destinationId).length>=12)return false;
 citizen.military.postId=destinationId;p.logisticsUsed=true;
 addLog(`${citizen.name} reassigned to ${destination.name}.`);save();render();showToast(`${citizen.name} transferred to ${destination.name}`);return true;
}
function doLevy(id=0){const p=G.players[id];if(!canCountryAct(p,id)||p.levyUsed)return false;const foodCost=Math.min(2,p.food);p.gold+=6;p.food-=foodCost;p.levyUsed=true;useAction(p,`${p.name} raised emergency taxes: +6 Gold, −${foodCost} Food.`);if(id===0)showToast('Emergency taxes collected: +6 Gold');return true;}
function doResearch(type,id=0){const p=G.players[id],t=TECHS[type];if(!canCountryAct(p,id)||!t||p.tech.includes(type)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge)return false;p.gold-=t.gold;p.knowledge-=t.knowledge;p.tech.push(type);useAction(p,`${p.name} completed research: ${t.name}.`);if(id===0)showToast(`${t.name} researched`);return true;}
function playCard(id,idx){const p=G.players[id];if(!p||p.cardPlayed||idx<0||idx>=p.hand.length||G.turnIndex!==id||G.finished)return false;const type=p.hand[idx];p.cardPlayed=true;p.hand.splice(idx,1);
 switch(type){case'grant':p.gold+=6;break;case'harvest':p.food+=5;break;case'supplies':p.wood+=3;p.minerals.iron+=2;break;case'insight':p.knowledge+=3;break;case'charter':p.discountExpand+=3;break;case'permit':p.discountBuild+=3;break;}
 addLog(`${p.name} played ${CARDS[type].name}.`);save();render();if(id===0)closeCardPreview();animatePlayedCard(type,id);return true;}
function finishRound(){
 for(const p of G.players){
  const e=getEconomy(p.id),oldGold=p.gold;
  p.gold+=e.netGold;p.food=Math.max(0,p.food+e.netFood);p.wood+=e.wood;p.knowledge+=e.knowledge;
  extractMinesForRound(p);
  if(p.gold<0&&oldGold>=0)addLog(`${p.name} has entered debt. It must repair its treasury to construct or recruit.`);
  if(p.food===0&&e.netFood<0)addLog(`${p.name} is experiencing a food shortage. Population growth paused.`);
  if(G.round%4===0)for(const c of p.citizens)c.age++;
  newCitizensForRound(p);
  volunteerEachRound(p);
 }
 progressProjects();progressTradeOffers();progressTradeRoutes();
 addLog(`Round ${G.round} concluded. Population, production and maintenance updated.`);
 if(G.round>=G.maxRounds&&!G.continued){G.finished=true;save();render();showEndGame();return;}
 G.round++;beginTurn(0);cpuBusy=false;save();render();showToast(`Round ${G.round} — your turn`);
}

function cpuActionLocation(before,after){
 for(let i=0;i<after.length;i++)if(before[i].owner!==after[i].owner||(before[i].buildings||0)!==(after[i].buildings||0)||(before[i].projects||0)!==(G.projects||[]).filter(j=>j.tileId===after[i].id).length)return G.tiles[i];
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
  beginTurn(id);render();showCpuHud(id,'Taking command of the nation…');
  await moveCamera(capital,POV_ANGLES[id],640,window.innerWidth<600?400:515);
  if(token!==cpuPlaybackToken||!G)return;
  for(let step=0;step<MAJOR_ACTIONS;step++){
   if(token!==cpuPlaybackToken||!G)return;
   const spent=actionsUsed(p);
   const before=G.tiles.map(t=>({owner:t.owner,buildings:t.buildings?.length||0,projects:(G.projects||[]).filter(j=>j.tileId===t.id).length}));
   const prevLog=G.log[0]?.text;
   runCpu(id);
   if(cardEffectPromise)await cardEffectPromise;
   const change=cpuActionLocation(before,G.tiles),last=G.log[0]?.text;
   save();render();
   if(actionsUsed(p)===spent){showCpuHud(id,`${p.name} has no further affordable actions.`);break;}
   showCpuHud(id,`Action ${actionsUsed(p)}/${MAJOR_ACTIONS}: ${last&&last!==prevLog?last:`${p.name} reviewed its plans.`}`);
   if(change){await moveCamera(change,POV_ANGLES[id],320,window.innerWidth<600?330:415);flashAction(change,'cpu');}
   if(token!==cpuPlaybackToken||!G)return;
   await cpuPause(change?340:190,token);
  }
 }
 if(token!==cpuPlaybackToken||!G)return;
 finishRound();
 if(G.finished){hideCpuHud();return;}
 showCpuHud(0,'The next round begins — your move.');
 const home=G.tiles.find(t=>t.owner===0&&t.capital)||G.tiles[0];
 await moveCamera(home,POV_ANGLES[0],700,window.innerWidth<600?420:540);
 hideCpuHud();render();await showCompletedProjects();
}
function endTurn(){if(!active())return;closeCardPreview();closeSheet();cpuBusy=true;skipCpuPlayback=false;cpuPlaybackToken++;G.turnIndex=1;save();render();el('mapWrap').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>runCpuCinematic(cpuPlaybackToken).catch(e=>{console.error('CPU playback failed',e);hideCpuHud();if(G&&!G.finished){cpuBusy=false;G.turnIndex=0;save();render();showToast('CPU playback interrupted; resume your turn.');}}),200);}
function cpuStep(){if(!G||G.finished)return;const id=G.turnIndex;if(id<1||id>3){cpuBusy=false;return;}const p=G.players[id];beginTurn(id);for(let step=0;step<MAJOR_ACTIONS;step++){const spent=actionsUsed(p);runCpu(id);if(actionsUsed(p)===spent)break;}save();render();if(id===3){setTimeout(()=>{if(G)finishRound();},400);}else{G.turnIndex=id+1;save();setTimeout(cpuStep,470);}}
function runCpu(id){
 const p=G.players[id];let playable=p.hand.findIndex(c=>['grant','harvest','supplies','insight'].includes(c));
 if(playable<0)playable=p.hand.findIndex(c=>c==='charter');if(playable<0)playable=p.hand.findIndex(c=>c==='permit');
 if(playable>=0&&!p.cardPlayed)playCard(id,playable);
 if(G.round>=4&&G.round%4===id%4&&actionsRemaining(p)>0){
  const available=G.players.filter(v=>v.id!==id&&hasContact(id,v.id)&&!alreadyLinked(id,v.id));
  if(available.length&&p.gold>12&&proposeTradeRoute(available[0].id,50,id))return;
 }
 const owned=G.tiles.filter(t=>t.owner===id),eco=getEconomy(id),people=peopleSummary(p);
 const buildable=owned.filter(t=>buildFree(t)>0).sort((a,b)=>buildFree(b)-buildFree(a));
 const frontiers=G.tiles.filter(t=>eligibleExpansion(p,t)).sort((a,b)=>{
  const value=t=>({plains:8,forest:6,hills:5,desert:3,mountain:t.vein?(t.vein.kind==='diamond'?17:t.vein.kind==='goldOre'?14:10):1})[t.terrain]+neighbors(t).filter(n=>n.owner===null&&n.terrain!=='water').length*.4;
  return value(b)-value(a);
 });
 const tryBuild=type=>{const t=buildable.find(t=>canBuild(p,t,BUILDINGS[type]));return t?doBuild(t,type,id):false;};
 const tryExpand=()=>frontiers.length?doExpand(frontiers[0],id):false;
 if(p.gold<0){doLevy(id);return;}
 if(people.housing<=people.count+2&&(tryBuild('homes')||tryExpand()))return;
 if(eco.netGold<=0&&tryBuild('market'))return;
 if(owned.length<3&&tryExpand())return;
 if(p.food<9&&tryBuild('farm'))return;
 if(p.wood<6&&tryBuild('lumber'))return;
 if(mineralCount(p,'iron')<4&&p.gold>11&&mineralTrade('iron','buy',id))return;
 if(owned.some(t=>t.vein&&t.vein.remaining>0)&&tryBuild('mine'))return;
 if(eco.netGold<4&&tryBuild('market'))return;
 if(owned.length<9&&tryExpand())return;
 if(p.knowledge<9&&tryBuild('academy'))return;
 const posts=getMilitaryPosts(id);
 if(!posts.length&&G.round>=5&&tryBuild('post'))return;
 if(posts.length&&G.round%5===0&&p.marketingUntil<G.round&&doMarketing(posts[0],id))return;
 if(owned.length<15&&tryExpand())return;
 if(tryBuild('homes')||tryBuild('market')||tryBuild('farm')||tryBuild('academy')||tryBuild('lumber')||tryBuild('post')||tryBuild('mine'))return;
 if(tryExpand())return;
 if(p.tech.length<Object.keys(TECHS).length){const tech=Object.keys(TECHS).find(k=>!p.tech.includes(k)&&hasMoney(p,TECHS[k].gold)&&p.knowledge>=TECHS[k].knowledge);if(tech&&doResearch(tech,id))return;}
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
 el('capitalFlag').textContent=p.sigil;
 el('turnCounter').textContent=`Round ${G.round} of ${G.maxRounds} · ${G.tiles.length} hexes · ${G.tiles.filter(t=>t.owner===0).length} owned`;
 el('turnLabel').textContent=G.finished?'TEST COMPLETE':G.turnIndex===0&&!cpuBusy?'YOUR TURN':'CPU TURN';el('turnLabel').classList.toggle('cpu-turn',G.turnIndex!==0||cpuBusy);
 el('resources').innerHTML=[['gold','🪙','Gold'],['food','🌾','Food'],['wood','🪵','Wood'],['iron','🔩','Iron'],['knowledge','✦','Knowledge']].map(([field,icon,name])=>`<div class="resource ${(field==='iron'?mineralCount(p,'iron'):p[field])<0?'negative':''}"><div class="resource-icon">${icon}</div><div class="resource-num">${fmt(field==='iron'?mineralCount(p,'iron'):p[field])}</div><div class="resource-label">${name}</div></div>`).join('');
 el('quickStats').innerHTML=[['gold','🪙'],['food','🌾'],['wood','🪵'],['iron','🔩'],['knowledge','✦']].map(([field,icon])=>`<span class="quick-stat" title="${field}">${icon}<b class="${(field==='iron'?mineralCount(p,'iron'):p[field])<0?'negative':''}">${fmt(field==='iron'?mineralCount(p,'iron'):p[field])}</b></span>`).join('');
 el('economySummary').innerHTML=`<span>Gold income <strong>+${e.gold}</strong></span> · <span>Upkeep <strong>−${e.upkeep}</strong></span> · <span>Net <strong class="${e.netGold>=0?'positive':'negative'}">${e.netGold>=0?'+':''}${e.netGold}</strong>/round</span><span> · Food <strong class="${e.netFood>=0?'positive':'negative'}">${e.netFood>=0?'+':''}${e.netFood}</strong>/round</span>${p.gold<0?'<div class="economy-alert">⚠ In debt: building and recruitment are locked until the treasury recovers.</div>':''}`;
 el('populationSummary').innerHTML=`<div class="population-stat"><strong>${people.count}</strong><span>Citizens</span></div><div class="population-stat"><strong>${people.housed} / ${people.housing}</strong><span>Housed / Beds</span></div><div class="population-stat ${people.homeless?'population-warning':''}"><strong>${people.homeless}</strong><span>Homeless</span></div><div class="population-stat"><strong>${people.soldiers}</strong><span>Troops</span></div>`;
 el('populationAdvice').textContent=people.homeless>0?`${people.homeless} citizens need homes. Build on an owned tile with open space, or expand to make room.`:people.housing<=people.count+2?'Housing is nearly full. Consider additional homes before the next population increase.':'Each round can bring new citizens when Food is available. Homes need building space, and terrain limits residents.';
 renderMap();renderTile(tile);renderHand();renderResearch();renderStandings();renderLog();renderRoster();renderTradePanel();renderMineralMarket();
 el('buildPanel').classList.toggle('hidden',!showBuild);el('researchPanel').classList.toggle('hidden',!showResearch);
 el('endTurnBtn').disabled=!active();el('levyBtn').disabled=!canAct()||!!p.levyUsed;el('researchBtn').disabled=!active();el('levySheetBtn')?.toggleAttribute('disabled',!canAct()||!!p.levyUsed);
 el('endTurnBtn').innerHTML=G.finished?'TEST COMPLETE':scenePlayback?'ANIMATING…':active()?`END TURN <span>→</span>`:'CPU THINKING…';
 const remaining=actionsRemaining(p);
 el('mapActionCounter').innerHTML=G.finished?'TEST COMPLETE':cpuBusy?'◈ CPU ACTIONS':`<span class="action-dots">${Array.from({length:MAJOR_ACTIONS},(_,i)=>`<i class="${i<remaining?'ready':'spent'}"></i>`).join('')}</span><b>${remaining}/${MAJOR_ACTIONS}</b> ACTIONS LEFT`;
 el('actionNotice').innerHTML=G.finished?'Prototype match complete. Review the results or start another world.':scenePlayback?'Construction in progress…':cpuBusy?'Three CPU nations are taking their turns…':remaining===0?'All 3 major actions used. You can still play a card or transfer troops.':`<b>${remaining} major action${remaining===1?'':'s'} remaining.</b> Expand, build, market enlistment, govern or research.`;
 el('turnFoot').textContent=p.discountBuild||p.discountExpand?`Active discounts: Build −${p.discountBuild} Gold · Expand −${p.discountExpand} Gold`:'3 major actions + 1 troop transfer per turn · 1 optional card';
}
function renderTile(t){
 const container=el('territoryDetails');
 if(!t){el('territoryTag').textContent='SELECT A HEX';container.innerHTML='<p class="empty-note">Tap a territory on the map to inspect it.</p>';return;}
 const p=getCountry(),terrain=TERRAIN[t.terrain],owner=t.owner===null?null:G.players[t.owner],isOwn=t.owner===0,frontier=eligibleExpansion(p,t);
 const residents=owner?owner.citizens.filter(c=>c.homeId===t.id).length:0;
 el('territoryTag').textContent=t.capital?'CAPITAL':t.terrain.toUpperCase();if(sheetMode==='territory')el('sheetTitle').textContent=t.name;
 let html=`<div class="tile-head"><div><h3 class="tile-title">${esc(t.name)}</h3><div class="tile-sub">${terrain.name} · ${t.q}, ${t.r}</div></div><span class="owner-pill" style="background:${owner?owner.color:'#c6d8c1'}">${owner?esc(owner.name):'Unclaimed'}</span></div><p class="tile-description">${terrain.desc}</p>`;
 html+=`<div class="capacity-grid"><div><b>${buildFree(t)} / ${terrain.slots}</b><small>Building space free</small></div><div><b>${residents} / ${tileResidentCap(t)}</b><small>Residents / available housing</small></div><div><b>${terrain.population}</b><small>Terrain population ceiling</small></div></div><div class="terrain-data">`;
 if(t.capital)html+='<span>🏰 Capital: 2 spaces + 12 housing</span>';
 if(t.river)html+='<span>〰️ River crossing</span>';
  if(t.terrain==='mountain')html+=t.vein?`<span>⛏ ${MINERALS[t.vein.kind].name} deposit · ${t.vein.remaining}/${t.vein.capacity} remaining · ${Math.round(MINERALS[t.vein.kind].chance*100)}% round extraction chance</span>`:'<span>⛰ Barren mountain — no mineral deposit</span>';
 for(const k of Object.keys(terrain.yield))html+=`<span>+${terrain.yield[k]} ${k} / round</span>`;
 html+='</div>';
 if(t.buildings?.length){html+='<div class="building-roster"><strong>Buildings in this hex</strong>';
 t.buildings.forEach((type,i)=>{const b=BUILDINGS[type],occupied=type==='post'&&owner?postGarrison(owner,t.id).length:0;
  html+=`<div class="building-row"><span>${b.icon} ${b.name} <small>${b.space} space · −${b.upkeep} Gold/round${type==='post'?` · ${occupied}/12 soldiers`:''}</small></span>${isOwn?`<button data-action="sell" data-index="${i}" ${!canAct()||occupied>0?'disabled':''} title="Sell to Global Bank">Sell +${Math.max(2,Math.floor(b.gold*.6))} 🪙</button>`:''}</div>`;
 });html+='</div>';}
 const jobs=(G.projects||[]).filter(j=>j.tileId===t.id);
 if(jobs.length){html+='<div class="building-roster"><strong>🚧 Under construction</strong>'+jobs.map(j=>`<div class="building-row"><span>${BUILDINGS[j.type].icon} ${BUILDINGS[j.type].name}<small>${j.remaining} round${j.remaining===1?'':'s'} until ready · ${BUILDINGS[j.type].space} space reserved</small></span></div>`).join('')+'</div>';}
 html+='<div class="tile-actions">';
 if(frontier){const cost=expansionCost(p),afford=hasMoney(p,cost)&&p.food>=2;html+=`<button class="action-btn primary-action" data-action="expand" ${!canAct()||!afford?'disabled':''}>Claim territory <span>${cost} 🪙 + 2 🌾</span></button>`;if(!afford)html+='<div class="disabled-help">Not enough Gold or Food to expand.</div>';}
 else if(t.owner===null&&t.terrain==='water'){html+='<div class="feature-locked">🌊 Lakes cannot currently be claimed or built upon.</div>';}
 else if(t.owner===null){html+='<p class="empty-note">Expand from your own border to reach this territory.</p>';}
 else if(isOwn){
  if(buildFree(t)>0)html+=`<button class="action-btn primary-action" data-action="open-build" ${!canAct()?'disabled':''}>Construct building <span>${buildFree(t)} space available →</span></button>`;
  else html+='<div class="feature-locked">🏘 This hex is full. Expand into another territory for more construction space.</div>';
  if(buildingCount(t,'post')){
   const count=postGarrison(p,t.id).length,available=p.citizens.filter(c=>c.age>=18&&!c.military).length;
   html+=`<div class="post-actions"><strong>🛡 Military post · ${count}/12 stationed</strong><button class="action-btn" data-action="recruit" ${!canAct()||count>=12||!available||!hasMoney(p,4)?'disabled':''}>Recruitment marketing <span>4 🪙 · 2 rounds boost</span></button><button class="action-btn" data-action="train" ${!canAct()||!count||!hasMoney(p,3)||p.food<1?'disabled':''}>Train up to 3 troops <span>3 🪙 + 1 🌾</span></button></div>`;
  }
  if(peopleSummary(p).homeless>0)html+='<div class="disabled-help">💡 Build Homes here if space allows. Each adds 8 housing spaces, up to the terrain population ceiling.</div>';
 }else{html+='<div class="feature-locked">⚔ Warfare and reconnaissance arrive in a later version.</div>';}
 html+='</div>';container.innerHTML=html;
 if(showBuild){if(!isOwn||buildFree(t)<=0){showBuild=false;el('buildPanel').classList.add('hidden');}else renderBuildOptions(t);}
}
function renderBuildOptions(t){
 const p=getCountry();el('buildOptions').innerHTML=Object.entries(BUILDINGS).filter(([k,b])=>b.allow.includes(t.terrain)&&(k!=='mine'||!!t.vein&&t.vein.remaining>0)).map(([k,b])=>`<button class="build-option" data-build="${k}" ${!canAct()||!canBuild(p,t,b)?'disabled':''}><span class="build-symbol">${b.icon}</span><span class="build-main"><span class="build-name">${b.name}</span><span class="build-desc" style="display:block">${b.text} · ${b.space} space · ${b.rounds} round(s) build · −${b.upkeep} Gold upkeep</span></span><span class="build-cost">${buildingCost(p,b)} 🪙<br>${b.wood} 🪵 · ${b.iron} 🔩</span></button>`).join('');
}
function renderRoster(){
 const p=getCountry(),posts=getMilitaryPosts(0),troops=p.citizens.filter(c=>!!c.military);
 el('rosterCitizensBtn').classList.toggle('active',rosterTab==='citizens');
 el('rosterTroopsBtn').classList.toggle('active',rosterTab==='troops');
 el('rosterCount').textContent=rosterTab==='citizens'?`${p.citizens.length} TOTAL`:`${troops.length} TROOPS`;
 if(rosterTab==='citizens'){
  el('rosterList').innerHTML=`<div class="roster-head">Citizen <span>Age · Residence · Role</span></div>`+p.citizens.map(c=>{
   const home=c.homeId?G.tiles.find(t=>t.id===c.homeId)?.name||'Unknown':'Homeless';
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>${c.age} years · Health ${c.health}/100 · Morale ${c.morale}/100 · ${esc(home)}${c.military?' · Soldier':''}</small></div>`;
  }).join('');
 }else{
  el('rosterList').innerHTML=troops.length?`<p class="roster-instructions">Transfer one soldier between your posts each turn, even after using your main action.</p>`+troops.map(c=>{
   const post=G.tiles.find(t=>t.id===c.military.postId);
   const choices=posts.filter(t=>t.id!==c.military.postId&&postGarrison(p,t.id).length<12);
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>Age ${c.age} · Health ${c.health} · Training ${c.military.training}/5 · Gear: ${GEAR[c.military.gear||'basic'].name} (readiness ${gearReadiness(c)}) · ${c.military.perk||'No perk'}<br>Stationed: ${esc(post?.name||'Unassigned')}</small>${`<label class="roster-transfer">Equip <select data-equip-soldier="${esc(c.id)}" ${!canAct()?'disabled':''}><option value="">Select gear…</option>${GEAR_ORDER.slice(1).map(tier=>`<option value="${tier}" ${!canEquip(p,c,tier)?'disabled':''}>${GEAR[tier].name} · ${GEAR[tier].gold} 🪙 + ${Object.entries(GEAR[tier].requires).map(([m,n])=>n+' '+(MINERALS[m]?.name||m)).join(', ')}</option>`).join('')}</select></label>`}${choices.length?`<label class="roster-transfer">Transfer to <select data-move-soldier="${esc(c.id)}" ${!active()||p.logisticsUsed?'disabled':''}><option value="">Choose post…</option>${choices.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>`:''}</div>`;
  }).join(''):`<p class="empty-note">No troops enlisted yet. Build a Military Post, then eligible adults can volunteer each round. Run a marketing campaign to increase interest.</p>`;
 }
}
function renderResearch(){const p=getCountry();el('researchOptions').innerHTML=Object.entries(TECHS).map(([k,t])=>`<button class="build-option" data-tech="${k}" ${!canAct()||p.tech.includes(k)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge?'disabled':''}><span class="build-symbol">${t.icon}</span><span class="build-main"><span class="build-name">${t.name} ${p.tech.includes(k)?'✓':''}</span><span class="build-desc" style="display:block">${t.desc}</span></span><span class="build-cost">${t.gold} 🪙<br>${t.knowledge} ✦</span></button>`).join('');}
function renderHand(){
 const p=getCountry(),n=p.hand.length;el('cardCount').textContent=cpuBusy?'YOUR HAND':`${n} / 4`;
 if(cpuBusy){
  el('hand').innerHTML=`<div class="gs-watching-hand"><span class="gs-watching-title">YOUR CARDS</span>${p.hand.map(c=>`<span class="gs-watching-name">${esc(CARDS[c].name)}</span>`).join('')}</div>`;
  const cpu=G.players[G.turnIndex],deck=el('opponentDeck');
  if(deck&&cpu){deck.classList.remove('hidden');deck.style.setProperty('--cpu-color',cpu.color);deck.innerHTML=`<span>${esc(cpu.name)} · ${cpu.hand.length} cards</span><div class="gs-deck-backs">${cpu.hand.map((_,i)=>`<div class="gs-card-back" style="--position:${i}"><b>GS ✦</b></div>`).join('')}</div>`;}
  return;
 }
 el('opponentDeck')?.classList.add('hidden');
 el('hand').innerHTML=p.hand.map((c,i)=>{
  const fan=i-(n-1)/2,angle=fan*9;
  return `<button type="button" class="card-item" data-card="${i}" style="--fan:${fan};--angle:${angle}deg" aria-label="Inspect ${esc(CARDS[c].name)}"><span class="card-icon">${CARDS[c].icon}</span><span class="card-name">${esc(CARDS[c].name)}</span><span class="card-desc">TAP TO VIEW</span></button>`;
 }).join('')||'<p class="hand-empty">No cards in hand. Draw again next turn.</p>';
}
function renderStandings(){const sorted=[...G.players].sort((a,b)=>prosperity(b)-prosperity(a));el('standings').innerHTML=sorted.map((p,i)=>`<div class="standing"><span class="standing-rank">${i+1}</span><span class="standing-color" style="background:${p.color}"></span><span class="standing-name"><strong>${esc(p.name)}${p.id===0?' (You)':''}</strong><small>${G.tiles.filter(t=>t.owner===p.id).length} territory · ${G.tiles.filter(t=>t.owner===p.id).reduce((n,t)=>n+(t.buildings||[]).length,0)} builds · ${fmt(p.gold)} Gold</small></span><span class="standing-score">${prosperity(p)}</span></div>`).join('');}
function renderLog(){el('gameLog').innerHTML=G.log.slice(0,10).map(l=>`<div class="log-item"><span class="log-round">R${l.round}</span><span>${esc(l.text)}</span></div>`).join('');}
// Global Standoff: lightweight 2.5D board. All illustrations are vector primitives,
// rendered without third-party libraries or large image downloads.
const coords=t=>({x:HEX*Math.sqrt(3)*(t.q+t.r/2),y:HEX*1.5*t.r});
const VIEW_TILT=.68;
const POV_ANGLES=[-.24,.36,.92,1.48];
const smooth=t=>t*t*(3-2*t);
const blend=(a,b,t)=>a+(b-a)*t;
let cameraYaw=POV_ANGLES[0],cameraMoveFrame=0,cameraResolve=null,cpuPlaybackToken=0,skipCpuPlayback=false,actionTileId=null,actionKind='';
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
 if(type==='homes')return hutSprite(x-5,y+4,'#ae7154',16,15)+hutSprite(x+9,y-2,'#d9a16d',14,13);
 if(type==='farm')return `<g pointer-events="none" class="map-sprite"><path d="M${x-22} ${y+9}l20 -9 23 8 -20 10z" fill="#c3a265" stroke="#9f8151" stroke-width="1.2"/><path d="M${x-15} ${y+8}l15 -7m-7 12l16 -8m-17 4l15 -7" stroke="#f2d277" stroke-width="2"/></g>`+hutSprite(x+8,y-7,'#c66647',16,15);
 if(type==='lumber')return treeSprite(x-8,y,27,1)+hutSprite(x+8,y+5,'#8c6951',15,12)+`<path d="M${x-20} ${y+11}h18m-17 4h16" stroke="#9e6d41" stroke-width="4" pointer-events="none"/>`;
 if(type==='mine')return mountainSprite(x,y+5,24,28)+`<g pointer-events="none"><path d="M${x-12} ${y+8}v-11q12 -12 24 0v11z" fill="#383e43" stroke="#d5b077" stroke-width="2.2"/></g>`;
 if(type==='post')return `<g pointer-events="none" class="map-sprite"><ellipse cx="${x}" cy="${y+7}" rx="22" ry="7" fill="#26372f" opacity=".2"/><path d="M${x-22} ${y+8}v-15l8 -4v17m28 -1v-16l8 4v15" fill="none" stroke="#82643f" stroke-width="4" stroke-dasharray="3 2"/><path d="M${x-16} ${y+6}l16 -21 16 21z" fill="#f3dbc0" stroke="#94695c"/><path d="M${x} ${y-15}l16 21H${x}Z" fill="#d78365"/><path d="M${x} ${y-15}v-19m1 0h18l-4 8H${x+1}Z" fill="${color}" stroke="#775343" stroke-width="1"/></g>`;
 if(type==='academy')return `<g pointer-events="none" class="map-sprite"><ellipse cx="${x}" cy="${y+5}" rx="22" ry="6" fill="#22352d" opacity=".25"/><path d="M${x-20} ${y+4}v-19h40v19Z" fill="#ead6b2"/><path d="M${x-24} ${y-15}l24 -17 24 17Z" fill="#6f90a2"/><path d="M${x-13} ${y-14}v18m13 -18v18m13 -18v18" stroke="#7d8b8a" stroke-width="4"/></g>`;
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
 if(jobs.length){s+=`<g class="gs-worksite" pointer-events="none"><ellipse cx="${x}" cy="${y+6}" rx="23" ry="8" fill="#bd9164"/><path d="M${x-15} ${y+6}v-20h30v20m-30 -20l30 20m-30 0l30 -20" stroke="#654934" stroke-width="2.6" fill="none"/><text x="${x}" y="${y-22}" text-anchor="middle" font-size="11" fill="#fff0c5">🔨</text><g class="gs-work-dust"><circle cx="${x-16}" cy="${y-9}" r="8"/><circle cx="${x+8}" cy="${y-16}" r="9"/><circle cx="${x+18}" cy="${y-6}" r="6"/></g><text x="${x}" y="${y+23}" text-anchor="middle" fill="#fff1c9" font-size="10" font-weight="bold">${Math.min(...jobs.map(j=>j.remaining))}r</text></g>`;}
 return s;
}
function renderMap(){
 if(!G)return;
 const svg=el('worldMap');svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 const sorted=G.tiles.map(t=>({t,c:sceneCoords(t)})).sort((a,b)=>a.c.y-b.c.y||a.c.x-b.c.x);
 const bases=[],decorations=[];
 for(const {t,c:{x,y}} of sorted){
  const claiming=scenePlayback?.tileId===t.id&&scenePlayback.kind==='expand';
  const owner=(t.owner===null||(claiming&&scenePlayback.phase==='prepare'))?null:G.players[t.owner],selected=t.id===G.selectedId;
  const top=hexPoints(t,HEX-1),lower=top.map(p=>({x:p.x,y:p.y+10}));
  const fill=t.terrain==='water'?'#478aa8':TERRAIN[t.terrain].color;
  const border=owner?owner.color:'#6b775d';
  const faces=top.map((p,i)=>{const n=(i+1)%6;return `<polygon points="${pts([p,top[n],lower[n],lower[i]])}" fill="${i<3?'#6d6549':'#514e3c'}" opacity=".9"/>`;}).join('');
  bases.push(`<g class="tile-base" pointer-events="none"><polygon points="${pts(lower)}" fill="#202f2b" opacity=".33" transform="translate(2 2)"/>${faces}<polygon points="${pts(top)}" fill="${fill}" stroke="${border}" stroke-width="${owner?'2.5':'1.4'}"/><polygon points="${pts([top[4],top[5],top[0]])}" fill="#fff3c9" opacity=".07"/><polygon points="${pts([top[1],top[2],top[3]])}" fill="#2d312f" opacity=".08"/>${owner?`<polygon points="${pts(top)}" fill="${owner.color}" opacity=".14"/>`:''}${selected?`<polygon points="${pts(top)}" fill="none" stroke="#fff6c7" stroke-width="3.6"/>`:''}</g>`);
  const action=t.id===actionTileId;
  decorations.push(`<g class="hex ${selected?'hex-selected':''} ${action?'hex-action-flash':''}" data-hex="${t.id}" tabindex="0" role="button" aria-label="${esc(t.name)}: ${TERRAIN[t.terrain].name}${owner?' owned by '+esc(owner.name):' unclaimed'}"><polygon class="hex-hit" points="${pts(top)}" fill="transparent" stroke="none"/>${tileMiniatures(t,x,y)}${owner?`<circle cx="${x-24}" cy="${y-13}" r="5.5" fill="${owner.color}" stroke="#fff8df" stroke-width="1.3" pointer-events="none"/>`:''}${action?`<ellipse class="tile-spotlight" cx="${x}" cy="${y}" rx="41" ry="28" fill="none" stroke="#fff1ba" stroke-width="3" pointer-events="none"/>`:''}${claiming&&scenePlayback.phase==='play'?`<polygon class="gs-claim-ring" points="${pts(top)}" fill="none" stroke="${owner?.color||'#f4dbac'}" stroke-width="6" pointer-events="none"/>`:''}</g>`);
 }
  const waterways=(G.rivers||[]).map(river=>{
   // Vertices are shared by two land hexes; project AFTER camera yaw/tilt.
   const positions=river.points||[];
   if(positions.length<2)return '';
   const projected=positions.map(p=>project(p.x,p.y));
   const d='M'+projected.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
   return `<g class="river-course" pointer-events="none"><path d="${d}" stroke="#49675b" stroke-width="12" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".82"/><path d="${d}" stroke="#398aab" stroke-width="8.2" stroke-linejoin="round" stroke-linecap="round" fill="none"/><path d="${d}" stroke="#a0dbe5" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".77"/></g>`;
  }).join('');
 const tradeLines=(G.tradeRoutes||[]).map(route=>{
  const points=(route.points||[]).map(p=>project(p.x,p.y));if(points.length<2)return '';
  const progress=route.status==='active'?1:(route.rounds-route.remaining)/route.rounds;
  const length=Math.max(2,Math.floor((points.length-1)*Math.max(.07,progress)));
  const visible=route.status==='active'?points:points.slice(0,Math.min(points.length,length+1));
  const d='M'+visible.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
  return `<g class="gs-trade-path ${route.status==='active'?'active':'building'}" pointer-events="none"><path d="${d}" fill="none" stroke="#4a3c27" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#edc277" stroke-width="3.4" stroke-linejoin="round" ${route.status==='active'?'':'stroke-dasharray="6 4"'}/></g>`;
 }).join('');
 el('mapContent').innerHTML=`<g class="world-terrain">${bases.join('')}</g><g pointer-events="none">${waterways}${tradeLines}</g><g class="world-features">${decorations.join('')}</g>`;
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
 const target=coords(tile),start=performance.now(),token=cpuPlaybackToken;
 return new Promise(resolve=>{
  cameraResolve=resolve;
  const done=()=>{cameraMoveFrame=0;if(cameraResolve===resolve)cameraResolve=null;resolve();};
  let lastDraw=-1000;function frame(now){
   if(!G||token!==cpuPlaybackToken){done();return;}
   const t=skipCpuPlayback||window.matchMedia('(prefers-reduced-motion: reduce)').matches||duration<=0?1:Math.min(1,(now-start)/duration),k=smooth(t);
   cameraYaw=blend(from.yaw,targetYaw,k);
   const dest=project(target.x,target.y,cameraYaw);
   setCenter(blend(from.cx,dest.x,k),blend(from.cy,dest.y,k),blend(from.width,targetWidth,k));
   if(now-lastDraw>34||t>=1){renderMap();lastDraw=now;}
   if(t<1)cameraMoveFrame=requestAnimationFrame(frame);else done();
  }
  cameraMoveFrame=requestAnimationFrame(frame);
 });
}
function flashAction(tile,kind='action'){
 if(!tile)return;actionTileId=tile.id;actionKind=kind;renderMap();
 const marker=el('mapContent').querySelector(`[data-hex="${tile.id}"]`);if(marker)marker.classList.add('hex-action-pop');
 setTimeout(()=>{if(actionTileId===tile.id){actionTileId=null;renderMap();}},1250);
}

function showEndGame(){const ranking=[...G.players].sort((a,b)=>prosperity(b)-prosperity(a));showModal(`<div class="section-kicker">END OF THE TEST</div><h2>World economy review</h2><p>After ${G.maxRounds} rounds, these countries have built the strongest economies. This is a sandbox score, <b>not</b> the final four-category victory system.</p><div class="modal-summary">${ranking.map((p,i)=>`<div class="mini-row"><span>${i===0?'🏆 ':''}${i+1}. ${esc(p.name)}</span><b>${prosperity(p)} pts</b></div>`).join('')}</div><div class="button-stack"><button class="primary" data-modal="continue">Continue playing this world</button><button class="secondary" data-modal="new-confirm">Generate a new world</button></div>`);}
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
 el('resumeBtn').addEventListener('click',()=>{const saved=loadSaved();if(!saved)return;G=saved;enterGame();if(G.turnIndex===0&&G.completedScenes?.length)setTimeout(()=>showCompletedProjects(),200);if(G.finished)showEndGame();else if(G.turnIndex!==0){cpuBusy=true;cpuPlaybackToken++;skipCpuPlayback=true;setTimeout(()=>{for(let i=G.turnIndex;i<=3;i++){beginTurn(i);const p=G.players[i];for(let step=0;step<MAJOR_ACTIONS;step++){const spent=actionsUsed(p);runCpu(i);if(actionsUsed(p)===spent)break;}}finishRound();focusHome(true);render();},80);}});
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
 el('tradeBody').addEventListener('click',e=>{const propose=e.target.closest('[data-trade-propose]');if(propose){const to=Number(propose.dataset.tradePropose);const select=el('tradeBody').querySelector(`[data-trade-share="${to}"]`);proposeTradeRoute(to,Number(select?.value||50));return;}const ans=e.target.closest('[data-trade-answer]');if(ans)respondTradeOffer(Number(ans.dataset.tradeAnswer),ans.dataset.accept==='yes');});
 el('territoryDetails').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button||!canAct())return;const t=getSelected();if(!t)return;switch(button.dataset.action){case 'expand':doExpand(t);break;case 'open-build':showBuild=true;showResearch=false;render();break;case 'sell':doSell(t,Number(button.dataset.index||0));break;case 'recruit':doRecruit(t);break;case 'train':doTrain(t);break;}});
 el('buildOptions').addEventListener('click',e=>{const b=e.target.closest('[data-build]');if(b&&canAct())doBuild(getSelected(),b.dataset.build);});
 el('researchOptions').addEventListener('click',e=>{const b=e.target.closest('[data-tech]');if(b&&canAct())doResearch(b.dataset.tech);});
 el('hand').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b)openCardPreview(Number(b.dataset.card));});
 el('rosterCitizensBtn').addEventListener('click',()=>{rosterTab='citizens';renderRoster();});
 el('rosterTroopsBtn').addEventListener('click',()=>{rosterTab='troops';renderRoster();});
 el('rosterList').addEventListener('change',e=>{const equipment=e.target.closest('[data-equip-soldier]');if(equipment?.value){equipSoldier(equipment.dataset.equipSoldier,equipment.value);return;}const select=e.target.closest('[data-move-soldier]');if(select?.value)moveSoldier(select.dataset.moveSoldier,select.value);});
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
  if(drag?.moved||pointers.size>1){suppressClick=true;setTimeout(()=>suppressClick=false,120);}
  pointers.delete(e.pointerId);drag=null;if(pointers.size<2)pinchLast=null;
 };
 svg.addEventListener('pointerup',clearPointer);svg.addEventListener('pointercancel',clearPointer);
 svg.addEventListener('click',e=>{if(suppressClick||!G||scenePlayback)return;const t=e.target.closest('[data-hex]');if(t){G.selectedId=t.dataset.hex;showBuild=false;render();save();showSheet('territory');}});
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
window.GS_TEST={getState:()=>G,select:(id)=>{if(!G)return;G.selectedId=id;render();},endTurn,render,doBuild,doExpand,doRecruit,doTrain,moveSoldier,finishRound,peopleSummary,buildUsed,buildFree,focusHome,resetView,moveCamera,runCpuCinematic,sceneCoords,showSheet,closeSheet,openCardPreview,closeCardPreview,actionsRemaining,runCpu,beginTurn,volunteeringChance,proposeTradeRoute,respondTradeOffer,tradePlan,discoverContacts,doMarketing,progressProjects,progressTradeRoutes,showCompletedProjects,migrateGameplay};
})();

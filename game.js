/* Global Standoff 0.3 — single-player 4-nation strategy sandbox. */
(() => {
'use strict';
const SAVE_KEY='global_standoff_v02_save';
const OLD_SAVE_KEY='global_standoff_v01_save';
const RADIUS=7, HEX=40, MAX_ROUNDS=24; // 169 hexes instead of 61
const COLORS=['#7ed0b7','#e6af79','#b7a1e9','#f08b87'];
const NPCS=[{name:'Alder Union',capital:'Oakspire',sigil:'♣'},{name:'Coral Dominion',capital:'Sunport',sigil:'◆'},{name:'Vesper Republic',capital:'Duskfall',sigil:'✧'}];
const TERRAIN={
 plains:{name:'Plains',color:'#bbc885',yield:{food:1},slots:8,population:30,desc:'Roomy, fertile land ideal for large settlements.'},
 forest:{name:'Forest',color:'#66a17c',yield:{materials:1},slots:6,population:20,desc:'Wooded land with good room for towns and lumber.'},
 hills:{name:'Hills',color:'#baa079',yield:{materials:1},slots:5,population:16,desc:'Rolling terrain with mineral deposits.'},
 desert:{name:'Desert',color:'#d2b879',yield:{},slots:3,population:10,desc:'Arid land with little space for growing communities.'},
 mountain:{name:'Mountains',color:'#97a0a0',yield:{materials:2},slots:2,population:6,desc:'Harsh peaks, smallest building and population capacity.'},
 water:{name:'Lake',color:'#4d97b7',yield:{},slots:0,population:0,desc:'A freshwater lake. Construction and claiming are unavailable.'}
};
const BUILDINGS={
 farm:{name:'Farm',icon:'🌾',gold:4,materials:2,space:2,upkeep:1,production:{food:4},allow:['plains','forest','hills'],text:'+4 Food/round (rivers add +1)'},
 lumber:{name:'Lumber Camp',icon:'🌲',gold:4,materials:1,space:2,upkeep:1,production:{materials:3},allow:['forest','plains','hills'],text:'+3 Materials/round'},
 mine:{name:'Mine',icon:'⛏',gold:6,materials:2,space:2,upkeep:2,production:{materials:4},allow:['hills','mountain','desert'],text:'+4 Materials/round'},
 homes:{name:'Homes',icon:'🏘',gold:5,materials:2,space:1,upkeep:1,production:{},allow:['plains','forest','hills','desert','mountain'],text:'+8 housing spaces, capped by terrain population'},
 market:{name:'Marketplace',icon:'⚖',gold:7,materials:3,space:2,upkeep:2,production:{gold:5},allow:['plains','forest','hills','desert','mountain'],text:'+5 Gold/round'},
 academy:{name:'Academy',icon:'📚',gold:8,materials:3,space:2,upkeep:2,production:{knowledge:3},allow:['plains','forest','hills','desert','mountain'],text:'+3 Knowledge/round'},
 post:{name:'Military Post',icon:'🛡',gold:8,materials:4,space:2,upkeep:2,production:{},allow:['plains','forest','hills','desert','mountain'],text:'Stations up to 12 troops; adds Gold upkeep'}
};
const TECHS={irrigation:{name:'Irrigation',icon:'💧',gold:3,knowledge:4,desc:'+1 Food per Farm, every round.'},commerce:{name:'Commerce',icon:'⚜',gold:4,knowledge:5,desc:'+1 Gold per Marketplace, every round.'},cartography:{name:'Cartography',icon:'🧭',gold:4,knowledge:5,desc:'Expansion costs 2 less Gold.'}};
const CARDS={grant:{name:'Royal Grant',icon:'🪙',desc:'Gain 6 Gold.'},harvest:{name:'Great Harvest',icon:'🌽',desc:'Gain 5 Food.'},supplies:{name:'Supply Caravan',icon:'📦',desc:'Gain 4 Materials.'},insight:{name:'Discovery',icon:'📜',desc:'Gain 3 Knowledge.'},charter:{name:'Frontier Charter',icon:'🗺',desc:'Next expansion costs 3 less Gold.'},permit:{name:'Building Permit',icon:'🏛',desc:'Next building costs 3 less Gold.'}};
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
function getCountry(){return G.players[0];}
function getSelected(){return G.tiles.find(t=>t.id===G.selectedId)||null;}
function active(){return G&&!G.finished&&!cpuBusy&&G.turnIndex===0;}
function canAct(){return active()&&!getCountry().acted;}
function hasMoney(p,n){return p.gold>=n&&p.gold>=0;}
function makeCitizen(p,rng,starting=false){
 const n=p.nextCitizenId++;
 return {id:`${p.id}-${n}`,name:FIRST_NAMES[randInt(rng,FIRST_NAMES.length)]+' '+LAST_NAMES[randInt(rng,LAST_NAMES.length)],
 age:starting?18+randInt(rng,48):(rng()<.67?18+randInt(rng,38):randInt(rng,17)),homeId:null,military:null};
}
function buildUsed(t){return (t.capital?2:0)+(t.buildings||[]).reduce((sum,type)=>sum+(BUILDINGS[type]?.space||0),0);}
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
 const players=[{name,capital,sigil:'✦'},...NPCS].map((p,i)=>({id:i,name:p.name,capital:p.capital,sigil:p.sigil,color:colors[i],gold:24,food:14,materials:12,knowledge:0,tech:[],hand:[],discountExpand:0,discountBuild:0,acted:false,cardPlayed:false,logisticsUsed:false,citizens:[],nextCitizenId:0}));
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
 const deck=Array.from({length:6},()=>CARD_POOL).flat().sort(()=>rng()-.5);
 const worldName=['The Wild Marches','The Broken Coast','The Emerald Frontier','The Hinterlands','The New Continent'][randInt(rng,5)];
 G={version:2,waterwayVersion:2,seed,worldName,worldOptions:options,rivers,players,tiles,round:1,turnIndex:0,maxRounds:MAX_ROUNDS,selectedId:key(...CAPITAL_SPOTS[0]),deck,drawIndex:0,log:[],finished:false,continued:false};
 for(const p of players){const citizenRng=mulberry32(hash(seed+'-people-'+p.id));for(let k=0;k<10;k++)p.citizens.push(makeCitizen(p,citizenRng,true));reallocateHousing(p);drawCard(p);drawCard(p);}
 beginTurn(0);
 addLog(`${name} established its capital at ${capital}. Four nations have entered a ${tiles.length}-hex world.`);
 save();
}
function drawCard(p){if(p.hand.length>=4)return; if(G.drawIndex>=G.deck.length){const rng=mulberry32(hash(G.seed+'-'+G.round+'-'+G.drawIndex));G.deck=Array.from({length:6},()=>CARD_POOL).flat().sort(()=>rng()-.5);G.drawIndex=0;}
 p.hand.push(G.deck[G.drawIndex++]);}
function beginTurn(id){G.turnIndex=id;const p=G.players[id];p.acted=false;p.cardPlayed=false;p.logisticsUsed=false;drawCard(p);save();}
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
function loadSaved(){
 try{
  const s=JSON.parse(localStorage.getItem(SAVE_KEY));
  if(s&&s.version===2&&Array.isArray(s.players)&&s.players.length===4&&Array.isArray(s.tiles))return upgradeSavedWaterways(s);
  const previous=JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
  if(previous&&previous.version===1&&previous.players?.length===4&&previous.tiles?.length){
   // Preserve old matches; a newly generated match is required for the bigger world.
   previous.version=2;previous.rivers=[];previous.worldOptions={rivers:false,lakes:false};
   for(const t of previous.tiles){t.buildings=t.building?[t.building]:[];delete t.building;t.river=false;}
   for(const p of previous.players){p.citizens=[];p.nextCitizenId=0;p.logisticsUsed=false;const rng=mulberry32(hash(previous.seed+'-people-'+p.id));for(let k=0;k<10;k++)p.citizens.push(makeCitizen(p,rng,true));}
   const old=G;G=previous;for(const p of previous.players)reallocateHousing(p);G=old;
   localStorage.setItem(SAVE_KEY,JSON.stringify(previous));return upgradeSavedWaterways(previous);
  }
 }catch(e){console.warn('Save could not be restored',e);}return null;
}
function showToast(s){const t=el('toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2650);}
function showModal(html){el('modalBody').innerHTML=html;el('modalLayer').classList.remove('hidden');}
function closeModal(){el('modalLayer').classList.add('hidden');}
function enterGame(){cpuPlaybackToken++;skipCpuPlayback=false;hideCpuHud();el('lobby').classList.add('hidden');el('game').classList.remove('hidden');el('topMenuBtn').classList.remove('hidden');showBuild=false;showResearch=false;resetView();focusHome(true);render();requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));}
function newMatch(){cpuPlaybackToken++;cancelAnimationFrame(cameraMoveFrame);hideCpuHud();if(cameraResolve){cameraResolve();cameraResolve=null;}G=null;cpuBusy=false;el('lobby').classList.remove('hidden');el('game').classList.add('hidden');el('topMenuBtn').classList.add('hidden');el('roundBadge').textContent='SOLO TEST';closeModal();renderLobby();}
function renderLobby(){
 el('colorOptions').innerHTML=COLORS.map((c,i)=>`<button class="color-swatch" style="--swatch:${c}" aria-label="Choose ${['jade','amber','violet','coral'][i]}" aria-pressed="${i===selectedColor}" data-color="${i}"></button>`).join('');
 const colors=[COLORS[selectedColor],...COLORS.filter((_,i)=>i!==selectedColor)];
 el('cpuPreview').innerHTML=NPCS.map((p,i)=>`<div class="cpu-item"><div class="cpu-avatar" style="background:${colors[i+1]}">${p.sigil}</div><div><div class="cpu-item-title">${esc(p.name)}</div><div class="cpu-item-sub">Capital: ${esc(p.capital)}</div></div><span class="cpu-pill">CPU</span></div>`).join('');
 el('resumeBtn').classList.toggle('hidden',!loadSaved());
}
function allowed(p,t){return t&&t.owner===p.id;}
function eligibleExpansion(p,t){return !!t&&t.owner===null&&t.terrain!=='water'&&neighbors(t).some(n=>n.owner===p.id);}
function expansionCost(p){return Math.max(0,5-p.discountExpand-(p.tech.includes('cartography')?2:0));}
function buildingCost(p,b){return Math.max(0,b.gold-p.discountBuild);}
function canBuild(p,t,b){return allowed(p,t)&&buildFree(t)>=b.space&&b.allow.includes(t.terrain)&&hasMoney(p,buildingCost(p,b))&&p.materials>=b.materials;}
function getEconomy(id){
 const p=G.players[id],summary=peopleSummary(p);
 let vals={gold:0,food:0,materials:0,knowledge:0,upkeep:0};
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
function useAction(p,text){p.acted=true;addLog(text);showBuild=false;showResearch=false;save();render();}
function doExpand(t,id=0){const p=G.players[id];if(!eligibleExpansion(p,t))return false;const cost=expansionCost(p);if(!hasMoney(p,cost)||p.food<2)return false;p.gold-=cost;p.food-=2;p.discountExpand=0;t.owner=id;reallocateHousing(p);useAction(p,`${p.name} expanded into ${t.name} (${TERRAIN[t.terrain].name.toLowerCase()}).`);if(id===0){showToast(`Territory claimed: ${t.name}`);flashAction(t,'expand');}return true;}
function doBuild(t,type,id=0){const p=G.players[id],b=BUILDINGS[type];if(!b||!canBuild(p,t,b))return false;p.gold-=buildingCost(p,b);p.materials-=b.materials;p.discountBuild=0;t.buildings.push(type);reallocateHousing(p);useAction(p,`${p.name} constructed ${b.name} at ${t.name}.`);if(id===0){showToast(`${b.name} completed at ${t.name}`);flashAction(t,'build');}return true;}
function doSell(t,idx=0,id=0){
 const p=G.players[id];if(!allowed(p,t)||!t.buildings?.[idx])return false;
 const type=t.buildings[idx],b=BUILDINGS[type];
 if(type==='post'&&getMilitaryPosts(id).length&&postGarrison(p,t.id).length>0){if(id===0)showToast('Move troops before selling this post.');return false;}
 const refund=Math.max(2,Math.floor(b.gold*.6));p.gold+=refund;t.buildings.splice(idx,1);reallocateHousing(p);
 useAction(p,`${p.name} sold a ${b.name} at ${t.name} to the Global Bank for ${refund} Gold.`);
 if(id===0)showToast(`${b.name} sold for ${refund} Gold`);return true;
}
function doRecruit(t,id=0){
 const p=G.players[id];if(!allowed(p,t)||!buildingCount(t,'post'))return false;
 const count=Math.min(2,12-postGarrison(p,t.id).length,p.citizens.filter(c=>c.age>=18&&!c.military).length);
 if(count<1||!hasMoney(p,count*2)||p.food<count)return false;
 const recruits=p.citizens.filter(c=>c.age>=18&&!c.military).slice(0,count);
 p.gold-=count*2;p.food-=count;
 for(const c of recruits)c.military={postId:t.id,training:1,experience:0,perk:null};
 useAction(p,`${p.name} recruited ${count} citizen${count===1?'':'s'} at ${t.name}.`);
 if(id===0)showToast(`${count} citizens enlisted at ${t.name}`);return true;
}
function doTrain(t,id=0){
 const p=G.players[id];if(!allowed(p,t)||!buildingCount(t,'post'))return false;
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
function doLevy(id=0){const p=G.players[id];if(p.acted)return false;const foodCost=Math.min(2,p.food);p.gold+=6;p.food-=foodCost;useAction(p,`${p.name} raised emergency taxes: +6 Gold, −${foodCost} Food.`);if(id===0)showToast('Emergency taxes collected: +6 Gold');return true;}
function doResearch(type,id=0){const p=G.players[id],t=TECHS[type];if(!t||p.tech.includes(type)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge)return false;p.gold-=t.gold;p.knowledge-=t.knowledge;p.tech.push(type);useAction(p,`${p.name} completed research: ${t.name}.`);if(id===0)showToast(`${t.name} researched`);return true;}
function playCard(id,idx){const p=G.players[id];if(!p||p.cardPlayed||idx<0||idx>=p.hand.length||G.turnIndex!==id||G.finished)return false;const type=p.hand[idx];p.cardPlayed=true;p.hand.splice(idx,1);
 switch(type){case'grant':p.gold+=6;break;case'harvest':p.food+=5;break;case'supplies':p.materials+=4;break;case'insight':p.knowledge+=3;break;case'charter':p.discountExpand+=3;break;case'permit':p.discountBuild+=3;break;}
 addLog(`${p.name} played ${CARDS[type].name}.`);save();render();if(id===0)showToast(CARDS[type].name+' played');return true;}
function finishRound(){
 for(const p of G.players){
  const e=getEconomy(p.id),oldGold=p.gold;
  p.gold+=e.netGold;p.food=Math.max(0,p.food+e.netFood);p.materials+=e.materials;p.knowledge+=e.knowledge;
  if(p.gold<0&&oldGold>=0)addLog(`${p.name} has entered debt. It must repair its treasury to construct or recruit.`);
  if(p.food===0&&e.netFood<0)addLog(`${p.name} is experiencing a food shortage. Population growth paused.`);
  if(G.round%4===0)for(const c of p.citizens)c.age++;
  newCitizensForRound(p);
 }
 addLog(`Round ${G.round} concluded. Population, production and maintenance updated.`);
 if(G.round>=G.maxRounds&&!G.continued){G.finished=true;save();render();showEndGame();return;}
 G.round++;beginTurn(0);cpuBusy=false;save();render();showToast(`Round ${G.round} — your turn`);
}

function cpuActionLocation(before,after){
 for(let i=0;i<after.length;i++)if(before[i].owner!==after[i].owner||(before[i].buildings||0)!==(after[i].buildings||0))return G.tiles[i];
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
  await moveCamera(capital,POV_ANGLES[id],840,window.innerWidth<600?400:515);
  if(token!==cpuPlaybackToken||!G)return;
  const before=G.tiles.map(t=>({owner:t.owner,buildings:t.buildings?.length||0}));
  const prevLog=G.log[0]?.text;runCpu(id);
  const change=cpuActionLocation(before,G.tiles),last=G.log[0]?.text;
  save();render();showCpuHud(id,last&&last!==prevLog?last:`${p.name} reviewed its plans.`);
  if(change){await moveCamera(change,POV_ANGLES[id],480,window.innerWidth<600?330:415);flashAction(change,'cpu');}
  if(token!==cpuPlaybackToken||!G)return;
  await cpuPause(change?620:450,token);
 }
 if(token!==cpuPlaybackToken||!G)return;
 finishRound();
 if(G.finished){hideCpuHud();return;}
 showCpuHud(0,'The next round begins — your move.');
 const home=G.tiles.find(t=>t.owner===0&&t.capital)||G.tiles[0];
 await moveCamera(home,POV_ANGLES[0],850,window.innerWidth<600?420:540);
 hideCpuHud();render();
}
function endTurn(){if(!active())return;cpuBusy=true;skipCpuPlayback=false;cpuPlaybackToken++;G.turnIndex=1;save();render();el('mapWrap').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>runCpuCinematic(cpuPlaybackToken).catch(e=>{console.error('CPU playback failed',e);hideCpuHud();if(G&&!G.finished){cpuBusy=false;G.turnIndex=0;save();render();showToast('CPU playback interrupted; resume your turn.');}}),200);}
function cpuStep(){if(!G||G.finished)return;const id=G.turnIndex;if(id<1||id>3){cpuBusy=false;return;}const p=G.players[id];beginTurn(id);runCpu(id);save();render();if(id===3){setTimeout(()=>{if(G)finishRound();},400);}else{G.turnIndex=id+1;save();setTimeout(cpuStep,470);}}
function runCpu(id){
 const p=G.players[id];let playable=p.hand.findIndex(c=>['grant','harvest','supplies','insight'].includes(c));
 if(playable<0)playable=p.hand.findIndex(c=>c==='charter');if(playable<0)playable=p.hand.findIndex(c=>c==='permit');
 if(playable>=0)playCard(id,playable);
 const owned=G.tiles.filter(t=>t.owner===id),eco=getEconomy(id),people=peopleSummary(p);
 const buildable=owned.filter(t=>buildFree(t)>0).sort((a,b)=>buildFree(b)-buildFree(a));
 const frontiers=G.tiles.filter(t=>eligibleExpansion(p,t)).sort((a,b)=>{
  const value=t=>({plains:8,forest:6,hills:5,desert:3,mountain:2})[t.terrain]+neighbors(t).filter(n=>n.owner===null&&n.terrain!=='water').length*.4;
  return value(b)-value(a);
 });
 const tryBuild=type=>{const t=buildable.find(t=>canBuild(p,t,BUILDINGS[type]));return t?doBuild(t,type,id):false;};
 const tryExpand=()=>frontiers.length?doExpand(frontiers[0],id):false;
 if(p.gold<0){doLevy(id);return;}
 if(people.housing<=people.count+2&&(tryBuild('homes')||tryExpand()))return;
 if(eco.netGold<=0&&tryBuild('market'))return;
 if(owned.length<3&&tryExpand())return;
 if(p.food<9&&tryBuild('farm'))return;
 if(p.materials<6&&(tryBuild('mine')||tryBuild('lumber')))return;
 if(eco.netGold<4&&tryBuild('market'))return;
 if(owned.length<9&&tryExpand())return;
 if(p.knowledge<9&&tryBuild('academy'))return;
 const posts=getMilitaryPosts(id);
 if(!posts.length&&G.round>=5&&tryBuild('post'))return;
 if(posts.length&&G.round%4===0&&doRecruit(posts[0],id))return;
 if(owned.length<15&&tryExpand())return;
 if(tryBuild('homes')||tryBuild('market')||tryBuild('farm')||tryBuild('academy')||tryBuild('lumber')||tryBuild('post')||tryBuild('mine'))return;
 if(tryExpand())return;
 if(p.tech.length<Object.keys(TECHS).length){const tech=Object.keys(TECHS).find(k=>!p.tech.includes(k)&&hasMoney(p,TECHS[k].gold)&&p.knowledge>=TECHS[k].knowledge);if(tech&&doResearch(tech,id))return;}
 doLevy(id);
}
function prosperity(p){const owned=G.tiles.filter(t=>t.owner===p.id),people=peopleSummary(p);
 return owned.length*4+owned.reduce((n,t)=>n+(t.buildings||[]).length,0)*5+people.housed*2-people.homeless*2+people.soldiers*2+Math.max(0,Math.floor(p.gold/4))+Math.max(0,Math.floor(p.food/5))+Math.max(0,Math.floor(p.materials/5))+Math.floor(p.knowledge/3)+p.tech.length*3;}
function render(){if(!G)return;
 const p=getCountry(),e=getEconomy(0),tile=getSelected(),people=peopleSummary(p);
 el('roundBadge').textContent=`ROUND ${G.round} / ${G.maxRounds}`;
 el('worldTitle').textContent=G.worldName;
 el('nationLabel').textContent=p.name;el('capitalFlag').style.setProperty('--nation-color',p.color);
 el('capitalFlag').textContent=p.sigil;
 el('turnCounter').textContent=`Round ${G.round} of ${G.maxRounds} · ${G.tiles.length} hexes · ${G.tiles.filter(t=>t.owner===0).length} owned`;
 el('turnLabel').textContent=G.finished?'TEST COMPLETE':active()?'YOUR TURN':'CPU TURN';el('turnLabel').classList.toggle('cpu-turn',!active());
 el('resources').innerHTML=[['gold','🪙','Gold'],['food','🌾','Food'],['materials','🪨','Materials'],['knowledge','✦','Knowledge']].map(([field,icon,name])=>`<div class="resource ${p[field]<0?'negative':''}"><div class="resource-icon">${icon}</div><div class="resource-num">${fmt(p[field])}</div><div class="resource-label">${name}</div></div>`).join('');
 el('economySummary').innerHTML=`<span>Gold income <strong>+${e.gold}</strong></span> · <span>Upkeep <strong>−${e.upkeep}</strong></span> · <span>Net <strong class="${e.netGold>=0?'positive':'negative'}">${e.netGold>=0?'+':''}${e.netGold}</strong>/round</span><span> · Food <strong class="${e.netFood>=0?'positive':'negative'}">${e.netFood>=0?'+':''}${e.netFood}</strong>/round</span>${p.gold<0?'<div class="economy-alert">⚠ In debt: building and recruitment are locked until the treasury recovers.</div>':''}`;
 el('populationSummary').innerHTML=`<div class="population-stat"><strong>${people.count}</strong><span>Citizens</span></div><div class="population-stat"><strong>${people.housed} / ${people.housing}</strong><span>Housed / Beds</span></div><div class="population-stat ${people.homeless?'population-warning':''}"><strong>${people.homeless}</strong><span>Homeless</span></div><div class="population-stat"><strong>${people.soldiers}</strong><span>Troops</span></div>`;
 el('populationAdvice').textContent=people.homeless>0?`${people.homeless} citizens need homes. Build on an owned tile with open space, or expand to make room.`:people.housing<=people.count+2?'Housing is nearly full. Consider additional homes before the next population increase.':'Each round can bring new citizens when Food is available. Homes need building space, and terrain limits residents.';
 renderMap();renderTile(tile);renderHand();renderResearch();renderStandings();renderLog();renderRoster();
 el('buildPanel').classList.toggle('hidden',!showBuild);el('researchPanel').classList.toggle('hidden',!showResearch);
 el('endTurnBtn').disabled=!active();el('levyBtn').disabled=!canAct();el('researchBtn').disabled=!active();
 el('endTurnBtn').innerHTML=G.finished?'TEST COMPLETE':active()?`END TURN <span>→</span>`:'CPU THINKING…';
 el('actionNotice').innerHTML=G.finished?'Prototype match complete. Review the results or start another world.':cpuBusy?'Three CPU nations are taking their turns…':p.acted?'Major action used. You can still use your military logistics order and play a card.':`<b>1 major action available.</b> Select territory, build homes, recruit, or use research.`;
 el('turnFoot').textContent=p.discountBuild||p.discountExpand?`Active discounts: Build −${p.discountBuild} Gold · Expand −${p.discountExpand} Gold`:'One major action + one troop transfer per turn · One optional card';
}
function renderTile(t){
 const container=el('territoryDetails');
 if(!t){el('territoryTag').textContent='SELECT A HEX';container.innerHTML='<p class="empty-note">Tap a territory on the map to inspect it.</p>';return;}
 const p=getCountry(),terrain=TERRAIN[t.terrain],owner=t.owner===null?null:G.players[t.owner],isOwn=t.owner===0,frontier=eligibleExpansion(p,t);
 const residents=owner?owner.citizens.filter(c=>c.homeId===t.id).length:0;
 el('territoryTag').textContent=t.capital?'CAPITAL':t.terrain.toUpperCase();
 let html=`<div class="tile-head"><div><h3 class="tile-title">${esc(t.name)}</h3><div class="tile-sub">${terrain.name} · ${t.q}, ${t.r}</div></div><span class="owner-pill" style="background:${owner?owner.color:'#c6d8c1'}">${owner?esc(owner.name):'Unclaimed'}</span></div><p class="tile-description">${terrain.desc}</p>`;
 html+=`<div class="capacity-grid"><div><b>${buildFree(t)} / ${terrain.slots}</b><small>Building space free</small></div><div><b>${residents} / ${tileResidentCap(t)}</b><small>Residents / available housing</small></div><div><b>${terrain.population}</b><small>Terrain population ceiling</small></div></div><div class="terrain-data">`;
 if(t.capital)html+='<span>🏰 Capital: 2 spaces + 12 housing</span>';
 if(t.river)html+='<span>〰️ River crossing</span>';
 for(const k of Object.keys(terrain.yield))html+=`<span>+${terrain.yield[k]} ${k} / round</span>`;
 html+='</div>';
 if(t.buildings?.length){html+='<div class="building-roster"><strong>Buildings in this hex</strong>';
 t.buildings.forEach((type,i)=>{const b=BUILDINGS[type],occupied=type==='post'&&owner?postGarrison(owner,t.id).length:0;
  html+=`<div class="building-row"><span>${b.icon} ${b.name} <small>${b.space} space · −${b.upkeep} Gold/round${type==='post'?` · ${occupied}/12 soldiers`:''}</small></span>${isOwn?`<button data-action="sell" data-index="${i}" ${!canAct()||occupied>0?'disabled':''} title="Sell to Global Bank">Sell +${Math.max(2,Math.floor(b.gold*.6))} 🪙</button>`:''}</div>`;
 });html+='</div>';}
 html+='<div class="tile-actions">';
 if(frontier){const cost=expansionCost(p),afford=hasMoney(p,cost)&&p.food>=2;html+=`<button class="action-btn primary-action" data-action="expand" ${!canAct()||!afford?'disabled':''}>Claim territory <span>${cost} 🪙 + 2 🌾</span></button>`;if(!afford)html+='<div class="disabled-help">Not enough Gold or Food to expand.</div>';}
 else if(t.owner===null&&t.terrain==='water'){html+='<div class="feature-locked">🌊 Lakes cannot currently be claimed or built upon.</div>';}
 else if(t.owner===null){html+='<p class="empty-note">Expand from your own border to reach this territory.</p>';}
 else if(isOwn){
  if(buildFree(t)>0)html+=`<button class="action-btn primary-action" data-action="open-build" ${!canAct()?'disabled':''}>Construct building <span>${buildFree(t)} space available →</span></button>`;
  else html+='<div class="feature-locked">🏘 This hex is full. Expand into another territory for more construction space.</div>';
  if(buildingCount(t,'post')){
   const count=postGarrison(p,t.id).length,available=p.citizens.filter(c=>c.age>=18&&!c.military).length;
   html+=`<div class="post-actions"><strong>🛡 Military post · ${count}/12 stationed</strong><button class="action-btn" data-action="recruit" ${!canAct()||count>=12||!available||!hasMoney(p,2)||p.food<1?'disabled':''}>Enlist up to 2 citizens <span>2 🪙 + 1 🌾 each</span></button><button class="action-btn" data-action="train" ${!canAct()||!count||!hasMoney(p,3)||p.food<1?'disabled':''}>Train up to 3 troops <span>3 🪙 + 1 🌾</span></button></div>`;
  }
  if(peopleSummary(p).homeless>0)html+='<div class="disabled-help">💡 Build Homes here if space allows. Each adds 8 housing spaces, up to the terrain population ceiling.</div>';
 }else{html+='<div class="feature-locked">⚔ Warfare and reconnaissance arrive in a later version.</div>';}
 html+='</div>';container.innerHTML=html;
 if(showBuild){if(!isOwn||buildFree(t)<=0){showBuild=false;el('buildPanel').classList.add('hidden');}else renderBuildOptions(t);}
}
function renderBuildOptions(t){
 const p=getCountry();el('buildOptions').innerHTML=Object.entries(BUILDINGS).filter(([k,b])=>b.allow.includes(t.terrain)).map(([k,b])=>`<button class="build-option" data-build="${k}" ${!canAct()||!canBuild(p,t,b)?'disabled':''}><span class="build-symbol">${b.icon}</span><span class="build-main"><span class="build-name">${b.name}</span><span class="build-desc" style="display:block">${b.text} · ${b.space} space · −${b.upkeep} Gold upkeep</span></span><span class="build-cost">${buildingCost(p,b)} 🪙<br>${b.materials} 🪨</span></button>`).join('');
}
function renderRoster(){
 const p=getCountry(),posts=getMilitaryPosts(0),troops=p.citizens.filter(c=>!!c.military);
 el('rosterCitizensBtn').classList.toggle('active',rosterTab==='citizens');
 el('rosterTroopsBtn').classList.toggle('active',rosterTab==='troops');
 el('rosterCount').textContent=rosterTab==='citizens'?`${p.citizens.length} TOTAL`:`${troops.length} TROOPS`;
 if(rosterTab==='citizens'){
  el('rosterList').innerHTML=`<div class="roster-head">Citizen <span>Age · Residence · Role</span></div>`+p.citizens.map(c=>{
   const home=c.homeId?G.tiles.find(t=>t.id===c.homeId)?.name||'Unknown':'Homeless';
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>${c.age} years · ${esc(home)}${c.military?' · Soldier':''}</small></div>`;
  }).join('');
 }else{
  el('rosterList').innerHTML=troops.length?`<p class="roster-instructions">Transfer one soldier between your posts each turn, even after using your main action.</p>`+troops.map(c=>{
   const post=G.tiles.find(t=>t.id===c.military.postId);
   const choices=posts.filter(t=>t.id!==c.military.postId&&postGarrison(p,t.id).length<12);
   return `<div class="roster-row"><strong>${esc(c.name)}</strong><small>Age ${c.age} · Training ${c.military.training}/5 · ${c.military.perk||'No perk'}<br>Stationed: ${esc(post?.name||'Unassigned')}</small>${choices.length?`<label class="roster-transfer">Transfer to <select data-move-soldier="${esc(c.id)}" ${!active()||p.logisticsUsed?'disabled':''}><option value="">Choose post…</option>${choices.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>`:''}</div>`;
  }).join(''):`<p class="empty-note">No troops enlisted yet. Build a Military Post, then select its territory to recruit adult citizens.</p>`;
 }
}
function renderResearch(){const p=getCountry();el('researchOptions').innerHTML=Object.entries(TECHS).map(([k,t])=>`<button class="build-option" data-tech="${k}" ${!canAct()||p.tech.includes(k)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge?'disabled':''}><span class="build-symbol">${t.icon}</span><span class="build-main"><span class="build-name">${t.name} ${p.tech.includes(k)?'✓':''}</span><span class="build-desc" style="display:block">${t.desc}</span></span><span class="build-cost">${t.gold} 🪙<br>${t.knowledge} ✦</span></button>`).join('');}
function renderHand(){const p=getCountry();el('cardCount').textContent=`${p.hand.length} / 4`;el('hand').innerHTML=p.hand.map((c,i)=>`<button class="card-item" data-card="${i}" ${!active()||p.cardPlayed?'disabled':''} aria-label="Play ${CARDS[c].name}"><span class="card-icon">${CARDS[c].icon}</span><span class="card-name">${CARDS[c].name}</span><span class="card-desc">${CARDS[c].desc}</span></button>`).join('')||'<p class="empty-note">No cards in hand. Draw again next turn.</p>';}
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
function tileMiniatures(t,x,y){
 let s=terrainSprites(t,x,y);
 if(t.capital)s+=capitalSprite(t,x,y);
 const buildings=t.buildings||[];
 // Show multiple buildings in one hex instead of displaying only the first.
 const offsets=t.capital?[[-22,10],[21,11],[2,18]]:[[-16,5],[16,5],[0,-8]];
 for(let i=0;i<Math.min(3,buildings.length);i++){
  const [dx,dy]=offsets[i];s+=`<g transform="translate(${(x+dx).toFixed(1)} ${(y+dy).toFixed(1)}) scale(${t.capital?'.57':'.74'}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})">${buildingSprite(buildings[i],x,y,G.players[t.owner].color)}</g>`;
 }
 if(buildings.length>3)s+=`<g pointer-events="none"><rect x="${x+10}" y="${y-36}" width="28" height="16" rx="8" fill="#182e36" stroke="#e5c994"/><text x="${x+24}" y="${y-25}" font-size="10" font-weight="bold" fill="#fff2d3" text-anchor="middle">+${buildings.length-3}</text></g>`;
 return s;
}
function renderMap(){
 if(!G)return;
 const svg=el('worldMap');svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 const sorted=G.tiles.map(t=>({t,c:sceneCoords(t)})).sort((a,b)=>a.c.y-b.c.y||a.c.x-b.c.x);
 const bases=[],decorations=[];
 for(const {t,c:{x,y}} of sorted){
  const owner=t.owner===null?null:G.players[t.owner],selected=t.id===G.selectedId;
  const top=hexPoints(t,HEX-1),lower=top.map(p=>({x:p.x,y:p.y+10}));
  const fill=t.terrain==='water'?'#478aa8':TERRAIN[t.terrain].color;
  const border=owner?owner.color:'#6b775d';
  const faces=top.map((p,i)=>{const n=(i+1)%6;return `<polygon points="${pts([p,top[n],lower[n],lower[i]])}" fill="${i<3?'#6d6549':'#514e3c'}" opacity=".9"/>`;}).join('');
  bases.push(`<g class="tile-base" pointer-events="none"><polygon points="${pts(lower)}" fill="#202f2b" opacity=".33" transform="translate(2 2)"/>${faces}<polygon points="${pts(top)}" fill="${fill}" stroke="${border}" stroke-width="${owner?'2.5':'1.4'}"/><polygon points="${pts([top[4],top[5],top[0]])}" fill="#fff3c9" opacity=".07"/><polygon points="${pts([top[1],top[2],top[3]])}" fill="#2d312f" opacity=".08"/>${owner?`<polygon points="${pts(top)}" fill="${owner.color}" opacity=".14"/>`:''}${selected?`<polygon points="${pts(top)}" fill="none" stroke="#fff6c7" stroke-width="3.6"/>`:''}</g>`);
  const action=t.id===actionTileId;
  decorations.push(`<g class="hex ${selected?'hex-selected':''} ${action?'hex-action-flash':''}" data-hex="${t.id}" tabindex="0" role="button" aria-label="${esc(t.name)}: ${TERRAIN[t.terrain].name}${owner?' owned by '+esc(owner.name):' unclaimed'}"><polygon class="hex-hit" points="${pts(top)}" fill="transparent" stroke="none"/>${tileMiniatures(t,x,y)}${owner?`<circle cx="${x-24}" cy="${y-13}" r="5.5" fill="${owner.color}" stroke="#fff8df" stroke-width="1.3" pointer-events="none"/>`:''}${action?`<ellipse class="tile-spotlight" cx="${x}" cy="${y}" rx="41" ry="28" fill="none" stroke="#fff1ba" stroke-width="3" pointer-events="none"/>`:''}</g>`);
 }
  const waterways=(G.rivers||[]).map(river=>{
   // Vertices are shared by two land hexes; project AFTER camera yaw/tilt.
   const positions=river.points||[];
   if(positions.length<2)return '';
   const projected=positions.map(p=>project(p.x,p.y));
   const d='M'+projected.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
   return `<g class="river-course" pointer-events="none"><path d="${d}" stroke="#49675b" stroke-width="12" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".82"/><path d="${d}" stroke="#398aab" stroke-width="8.2" stroke-linejoin="round" stroke-linecap="round" fill="none"/><path d="${d}" stroke="#a0dbe5" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="none" opacity=".77"/></g>`;
  }).join('');
 el('mapContent').innerHTML=`<g class="world-terrain">${bases.join('')}</g><g pointer-events="none">${waterways}</g><g class="world-features">${decorations.join('')}</g>`;
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
 el('resumeBtn').addEventListener('click',()=>{const saved=loadSaved();if(!saved)return;G=saved;enterGame();if(G.finished)showEndGame();else if(G.turnIndex!==0){cpuBusy=true;cpuPlaybackToken++;skipCpuPlayback=true;setTimeout(()=>{for(let i=G.turnIndex;i<=3;i++){beginTurn(i);runCpu(i);}finishRound();focusHome(true);render();},80);}});
 el('topMenuBtn').addEventListener('click',openMenu);
 el('endTurnBtn').addEventListener('click',endTurn);
 el('levyBtn').addEventListener('click',()=>{if(canAct())doLevy(0);});
 el('researchBtn').addEventListener('click',()=>{if(!G||!active())return;showResearch=!showResearch;showBuild=false;render();});
 el('closeResearchBtn').addEventListener('click',()=>{showResearch=false;render();});
 el('closeBuildBtn').addEventListener('click',()=>{showBuild=false;render();});
 el('territoryDetails').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button||!canAct())return;const t=getSelected();if(!t)return;switch(button.dataset.action){case 'expand':doExpand(t);break;case 'open-build':showBuild=true;showResearch=false;render();break;case 'sell':doSell(t,Number(button.dataset.index||0));break;case 'recruit':doRecruit(t);break;case 'train':doTrain(t);break;}});
 el('buildOptions').addEventListener('click',e=>{const b=e.target.closest('[data-build]');if(b&&canAct())doBuild(getSelected(),b.dataset.build);});
 el('researchOptions').addEventListener('click',e=>{const b=e.target.closest('[data-tech]');if(b&&canAct())doResearch(b.dataset.tech);});
 el('hand').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b&&active())playCard(0,Number(b.dataset.card));});
 el('rosterCitizensBtn').addEventListener('click',()=>{rosterTab='citizens';renderRoster();});
 el('rosterTroopsBtn').addEventListener('click',()=>{rosterTab='troops';renderRoster();});
 el('rosterList').addEventListener('change',e=>{const select=e.target.closest('[data-move-soldier]');if(select?.value)moveSoldier(select.dataset.moveSoldier,select.value);});
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
 svg.addEventListener('click',e=>{if(suppressClick||!G)return;const t=e.target.closest('[data-hex]');if(t){G.selectedId=t.dataset.hex;showBuild=false;render();save();}});
 svg.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-hex]')){e.preventDefault();G.selectedId=e.target.dataset.hex;showBuild=false;render();save();}});
 svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.12:.89);},{passive:false});
 el('modalLayer').addEventListener('click',e=>{const b=e.target.closest('[data-modal]');if(!b){if(e.target===el('modalBackdrop'))closeModal();return;}switch(b.dataset.modal){case'close':closeModal();break;case'new-confirm':confirmNew();break;case'new':try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(OLD_SAVE_KEY);}catch(e){}newMatch();break;case'continue':G.finished=false;G.continued=true;G.maxRounds=Math.max(G.round+16,G.maxRounds+16);G.round++;beginTurn(0);cpuBusy=false;save();closeModal();render();break;}});
}
try{
 renderLobby();bindEvents();
 el('runtimeNotice').classList.add('hidden');
}catch(e){
 console.error('Global Standoff initialization error',e);
 const notice=el('runtimeNotice');
 if(notice){notice.innerHTML='<b>The game could not initialize.</b><span>Open this game on a normal HTTPS website in Safari or Chrome.</span>';
   notice.classList.remove('hidden');}
}
// Debug-only hook for automated smoke testing; does not modify the game's rules.
window.GS_TEST={getState:()=>G,select:(id)=>{if(!G)return;G.selectedId=id;render();},endTurn,render,doBuild,doExpand,doRecruit,doTrain,moveSoldier,finishRound,peopleSummary,buildUsed,buildFree,focusHome,resetView,moveCamera,runCpuCinematic,sceneCoords};
})();

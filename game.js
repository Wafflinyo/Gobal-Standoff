/* Global Standoff 0.1 — self-contained, offline sandbox. No external libraries. */
(() => {
'use strict';
const SAVE_KEY='global_standoff_v01_save';
const RADIUS=4, HEX=40, MAX_ROUNDS=16;
const COLORS=['#7ed0b7','#e6af79','#b7a1e9','#f08b87'];
const NPCS=[{name:'Alder Union',capital:'Oakspire',sigil:'♣'},{name:'Coral Dominion',capital:'Sunport',sigil:'◆'},{name:'Vesper Republic',capital:'Duskfall',sigil:'✧'}];
const TERRAIN={plains:{name:'Plains',color:'#bbc885',yield:{food:1},desc:'Fertile ground, well suited for farms and settlements.'},forest:{name:'Forest',color:'#66a17c',yield:{materials:1},desc:'Woodlands that naturally provide materials.'},hills:{name:'Hills',color:'#baa079',yield:{materials:1},desc:'Rolling terrain with accessible mineral deposits.'},mountain:{name:'Mountains',color:'#97a0a0',yield:{materials:2},desc:'Harsh peaks with abundant raw materials.'},water:{name:'Water',color:'#4d97b7',yield:{},desc:'Open water. Coastal expansion requires future naval technology.'}};
const BUILDINGS={farm:{name:'Farm',icon:'🌾',gold:4,materials:2,upkeep:1,production:{food:4},allow:['plains','forest'],text:'+4 Food each round'},lumber:{name:'Lumber Camp',icon:'🌲',gold:4,materials:1,upkeep:1,production:{materials:3},allow:['forest','plains'],text:'+3 Materials each round'},mine:{name:'Mine',icon:'⛏',gold:6,materials:2,upkeep:2,production:{materials:4},allow:['hills','mountain'],text:'+4 Materials each round'},homes:{name:'Homes',icon:'🏘',gold:5,materials:2,upkeep:1,production:{gold:3},allow:['plains','forest','hills','mountain'],text:'+3 Gold taxes each round'},market:{name:'Marketplace',icon:'⚖',gold:7,materials:3,upkeep:2,production:{gold:5},allow:['plains','forest','hills','mountain'],text:'+5 Gold each round'},academy:{name:'Academy',icon:'📚',gold:8,materials:3,upkeep:2,production:{knowledge:3},allow:['plains','forest','hills','mountain'],text:'+3 Knowledge each round'},post:{name:'Military Post',icon:'🛡',gold:8,materials:4,upkeep:2,production:{},allow:['plains','forest','hills','mountain'],text:'Defensive infrastructure (combat coming later)'}};
const TECHS={irrigation:{name:'Irrigation',icon:'💧',gold:3,knowledge:4,desc:'+1 Food per Farm, every round.'},commerce:{name:'Commerce',icon:'⚜',gold:4,knowledge:5,desc:'+1 Gold per Marketplace, every round.'},cartography:{name:'Cartography',icon:'🧭',gold:4,knowledge:5,desc:'Expansion costs 2 less Gold.'}};
const CARDS={grant:{name:'Royal Grant',icon:'🪙',desc:'Gain 6 Gold.'},harvest:{name:'Great Harvest',icon:'🌽',desc:'Gain 5 Food.'},supplies:{name:'Supply Caravan',icon:'📦',desc:'Gain 4 Materials.'},insight:{name:'Discovery',icon:'📜',desc:'Gain 3 Knowledge.'},charter:{name:'Frontier Charter',icon:'🗺',desc:'Next expansion costs 3 less Gold.'},permit:{name:'Building Permit',icon:'🏛',desc:'Next building costs 3 less Gold.'}};
const CARD_POOL=['grant','harvest','supplies','grant','insight','charter','permit','supplies','harvest','grant','insight','permit'];
const CAPITAL_SPOTS=[[-3,-1],[3,1],[-1,3],[1,-3]];
const PREFIX=['Silver','Oak','Raven','Stone','High','Dawn','West','Green','Amber','Cinder','Iron','Sun','River','Frost','Moss','Ash','Bright','Elder','Wolf','Pine','Star','Cloud'];
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
let G=null,selectedColor=0,showBuild=false,showResearch=false,cpuBusy=false,toastTimer=0,suppressClick=false,drag=null;
let view={x:-400,y:-325,w:800,h:650};
function getCountry(){return G.players[0];}
function getSelected(){return G.tiles.find(t=>t.id===G.selectedId)||null;}
function active(){return G&&!G.finished&&!cpuBusy&&G.turnIndex===0;}
function canAct(){return active()&&!getCountry().acted;}
function hasMoney(p,n){return p.gold>=n&&p.gold>=0;}
function createWorld(seed,name,capital,color){
 const rng=mulberry32(hash(seed));
 let colors=[COLORS[color],...COLORS.filter((_,i)=>i!==color)];
 const players=[{name,capital,sigil:'✦'},...NPCS].map((p,i)=>({id:i,name:p.name,capital:p.capital,sigil:p.sigil,color:colors[i],gold:18,food:8,materials:8,knowledge:0,tech:[],hand:[],discountExpand:0,discountBuild:0,acted:false,cardPlayed:false}));
 let usedNames=new Set();
 let tiles=[];
 for(let q=-RADIUS;q<=RADIUS;q++)for(let r=-RADIUS;r<=RADIUS;r++){
   if(Math.abs(q+r)>RADIUS)continue;
   const roll=rng();let terrain=roll<.11?'water':roll<.45?'plains':roll<.68?'forest':roll<.89?'hills':'mountain';
   let nearest=Math.min(...CAPITAL_SPOTS.map(([cq,cr])=>distance({q,r},{q:cq,r:cr})));
   if(nearest<=1&&terrain==='water')terrain=['plains','forest','hills'][randInt(rng,3)];
   const n=PREFIX[randInt(rng,PREFIX.length)]+SUFFIX[randInt(rng,SUFFIX.length)];
   let unique=n,ctr=2;while(usedNames.has(unique))unique=n+' '+ctr++;usedNames.add(unique);
   tiles.push({id:key(q,r),q,r,terrain,name:unique,owner:null,building:null,capital:false});
 }
 CAPITAL_SPOTS.forEach(([q,r],i)=>{let t=tiles.find(t=>t.q===q&&t.r===r);t.terrain='plains';t.owner=i;t.capital=true;t.name=players[i].capital;});
 const deck=Array.from({length:6},()=>CARD_POOL).flat().sort(()=>rng()-.5);
 const worldName=['The Wild Marches','The Broken Coast','The Emerald Frontier','The Hinterlands','The New Continent'][randInt(rng,5)];
 G={version:1,seed,worldName,players,tiles,round:1,turnIndex:0,maxRounds:MAX_ROUNDS,selectedId:key(...CAPITAL_SPOTS[0]),deck,drawIndex:0,log:[],finished:false,continued:false};
 for(let i=0;i<4;i++){drawCard(players[i]);drawCard(players[i]);}
 beginTurn(0);
 addLog(`${name} established its capital at ${capital}. Four nations have entered the world.`);
 save();
}
function drawCard(p){if(p.hand.length>=4)return; if(G.drawIndex>=G.deck.length){const rng=mulberry32(hash(G.seed+'-'+G.round+'-'+G.drawIndex));G.deck=Array.from({length:6},()=>CARD_POOL).flat().sort(()=>rng()-.5);G.drawIndex=0;}
 p.hand.push(G.deck[G.drawIndex++]);}
function beginTurn(id){G.turnIndex=id;const p=G.players[id];p.acted=false;p.cardPlayed=false;drawCard(p);save();}
function addLog(text){G.log.unshift({round:G.round,text});G.log=G.log.slice(0,28);}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(G));}catch(e){/* local storage may be disabled */}}
function loadSaved(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s&&s.version===1&&Array.isArray(s.players)&&s.players.length===4&&Array.isArray(s.tiles))return s;}catch(e){}return null;}
function showToast(s){const t=el('toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2650);}
function showModal(html){el('modalBody').innerHTML=html;el('modalLayer').classList.remove('hidden');}
function closeModal(){el('modalLayer').classList.add('hidden');}
function enterGame(){el('lobby').classList.add('hidden');el('game').classList.remove('hidden');el('topMenuBtn').classList.remove('hidden');showBuild=false;showResearch=false;resetView();render();}
function newMatch(){G=null;cpuBusy=false;el('lobby').classList.remove('hidden');el('game').classList.add('hidden');el('topMenuBtn').classList.add('hidden');el('roundBadge').textContent='SOLO TEST';closeModal();renderLobby();}
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
function canBuild(p,t,b){return allowed(p,t)&&!t.building&&b.allow.includes(t.terrain)&&hasMoney(p,buildingCost(p,b))&&p.materials>=b.materials;}
function getEconomy(id){const p=G.players[id];let vals={gold:0,food:0,materials:0,knowledge:0,upkeep:0};for(const t of G.tiles.filter(t=>t.owner===id)){
  const y=TERRAIN[t.terrain].yield;for(const k in y)vals[k]+=(y[k]||0);
  if(t.capital){vals.gold+=4;vals.food+=1;vals.upkeep+=1;}
  if(t.building){const b=BUILDINGS[t.building];for(const k in b.production)vals[k]+=b.production[k];vals.upkeep+=b.upkeep;if(t.building==='farm'&&p.tech.includes('irrigation'))vals.food++;if(t.building==='market'&&p.tech.includes('commerce'))vals.gold++;}
 } vals.netGold=vals.gold-vals.upkeep;return vals;}
function useAction(p,text){p.acted=true;addLog(text);showBuild=false;showResearch=false;save();render();}
function doExpand(t,id=0){const p=G.players[id];if(!eligibleExpansion(p,t))return false;const cost=expansionCost(p);if(!hasMoney(p,cost)||p.food<2)return false;p.gold-=cost;p.food-=2;p.discountExpand=0;t.owner=id;useAction(p,`${p.name} expanded into ${t.name} (${TERRAIN[t.terrain].name.toLowerCase()}).`);if(id===0)showToast(`Territory claimed: ${t.name}`);return true;}
function doBuild(t,type,id=0){const p=G.players[id],b=BUILDINGS[type];if(!b||!canBuild(p,t,b))return false;p.gold-=buildingCost(p,b);p.materials-=b.materials;p.discountBuild=0;t.building=type;useAction(p,`${p.name} constructed ${b.name} at ${t.name}.`);if(id===0)showToast(`${b.name} completed at ${t.name}`);return true;}
function doSell(t,id=0){const p=G.players[id];if(!allowed(p,t)||!t.building)return false;const b=BUILDINGS[t.building],refund=Math.max(2,Math.floor(b.gold*.6));p.gold+=refund;t.building=null;useAction(p,`${p.name} sold infrastructure at ${t.name} to the Global Bank for ${refund} Gold.`);if(id===0)showToast(`Asset sold for ${refund} Gold`);return true;}
function doLevy(id=0){const p=G.players[id];if(p.acted)return false;const foodCost=Math.min(2,p.food);p.gold+=6;p.food-=foodCost;useAction(p,`${p.name} raised emergency taxes: +6 Gold, −${foodCost} Food.`);if(id===0)showToast('Emergency taxes collected: +6 Gold');return true;}
function doResearch(type,id=0){const p=G.players[id],t=TECHS[type];if(!t||p.tech.includes(type)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge)return false;p.gold-=t.gold;p.knowledge-=t.knowledge;p.tech.push(type);useAction(p,`${p.name} completed research: ${t.name}.`);if(id===0)showToast(`${t.name} researched`);return true;}
function playCard(id,idx){const p=G.players[id];if(!p||p.cardPlayed||idx<0||idx>=p.hand.length||G.turnIndex!==id||G.finished)return false;const type=p.hand[idx];p.cardPlayed=true;p.hand.splice(idx,1);
 switch(type){case'grant':p.gold+=6;break;case'harvest':p.food+=5;break;case'supplies':p.materials+=4;break;case'insight':p.knowledge+=3;break;case'charter':p.discountExpand+=3;break;case'permit':p.discountBuild+=3;break;}
 addLog(`${p.name} played ${CARDS[type].name}.`);save();render();if(id===0)showToast(CARDS[type].name+' played');return true;}
function finishRound(){for(const p of G.players){const e=getEconomy(p.id);p.gold+=e.netGold;p.food+=e.food;p.materials+=e.materials;p.knowledge+=e.knowledge;if(p.gold<0&&p.gold-e.netGold>=0)addLog(`${p.name} has entered debt. Buildings can be sold to the Global Bank.`);}
 addLog(`Round ${G.round} concluded. Production and maintenance have been applied.`);
 if(G.round>=G.maxRounds&&!G.continued){G.finished=true;save();render();showEndGame();return;}
 G.round++;beginTurn(0);cpuBusy=false;save();render();showToast(`Round ${G.round} — your turn`);
}
function endTurn(){if(!active())return;cpuBusy=true;G.turnIndex=1;save();render();setTimeout(cpuStep,340);}
function cpuStep(){if(!G||G.finished)return;const id=G.turnIndex;if(id<1||id>3){cpuBusy=false;return;}const p=G.players[id];beginTurn(id);runCpu(id);save();render();if(id===3){setTimeout(()=>{if(G)finishRound();},400);}else{G.turnIndex=id+1;save();setTimeout(cpuStep,470);}}
function runCpu(id){const p=G.players[id];let playable=p.hand.findIndex(c=>['grant','harvest','supplies','insight'].includes(c));if(playable<0)playable=p.hand.findIndex(c=>c==='charter');if(playable<0)playable=p.hand.findIndex(c=>c==='permit');if(playable>=0)playCard(id,playable);
 const owned=G.tiles.filter(t=>t.owner===id),eco=getEconomy(id),buildable=owned.filter(t=>!t.building);
 const frontiers=G.tiles.filter(t=>eligibleExpansion(p,t)).sort((a,b)=>{const val=t=>({plains:3,forest:2,hills:2,mountain:1})[t.terrain]+neighbors(t).filter(n=>n.owner===null&&n.terrain!=='water').length*.35;return val(b)-val(a);});
 const tryBuild=(type)=>{const t=buildable.find(t=>canBuild(p,t,BUILDINGS[type]));return t?doBuild(t,type,id):false;};
 const tryExpand=()=>frontiers.length?doExpand(frontiers[0],id):false;
 // Prioritize cashflow first, then balanced territory and infrastructure.
 if(p.gold<0){doLevy(id);return;}
 if(eco.netGold<=0&&(tryBuild('market')||tryBuild('homes')) )return;
 if(owned.length<3&&tryExpand())return;
 if(p.food<7&&tryBuild('farm'))return;
 if(p.materials<6&&(tryBuild('mine')||tryBuild('lumber')))return;
 if(eco.netGold<3&&(tryBuild('market')||tryBuild('homes')))return;
 if(owned.length<7&&tryExpand())return;
 if(p.knowledge<8&&tryBuild('academy'))return;
 if(owned.length<10&&tryExpand())return;
 if(tryBuild('market')||tryBuild('farm')||tryBuild('homes')||tryBuild('mine')||tryBuild('lumber')||tryBuild('academy'))return;
 if(tryExpand())return;
 if(p.tech.length<3){const can=Object.keys(TECHS).find(k=>!p.tech.includes(k)&&hasMoney(p,TECHS[k].gold)&&p.knowledge>=TECHS[k].knowledge);if(can&&doResearch(can,id))return;}
 doLevy(id);
}
function prosperity(p){const owned=G.tiles.filter(t=>t.owner===p.id);return owned.length*4+owned.filter(t=>t.building).length*5+Math.max(0,Math.floor(p.gold/4))+Math.max(0,Math.floor(p.food/5))+Math.max(0,Math.floor(p.materials/5))+Math.floor(p.knowledge/3)+p.tech.length*3;}
function render(){if(!G)return;
 const p=getCountry(),e=getEconomy(0),tile=getSelected();
 el('roundBadge').textContent=`ROUND ${G.round} / ${G.maxRounds}`;
 el('worldTitle').textContent=G.worldName;
 el('nationLabel').textContent=p.name;el('capitalFlag').style.setProperty('--nation-color',p.color);
 el('capitalFlag').textContent=p.sigil;
 el('turnCounter').textContent=`Round ${G.round} of ${G.maxRounds} · ${G.tiles.filter(t=>t.owner===0).length} territories`;
 el('turnLabel').textContent=G.finished?'TEST COMPLETE':active()?'YOUR TURN':'CPU TURN';el('turnLabel').classList.toggle('cpu-turn',!active());
 el('resources').innerHTML=[['gold','🪙','Gold'],['food','🌾','Food'],['materials','🪨','Materials'],['knowledge','✦','Knowledge']].map(([field,icon,name])=>`<div class="resource ${p[field]<0?'negative':''}"><div class="resource-icon">${icon}</div><div class="resource-num">${fmt(p[field])}</div><div class="resource-label">${name}</div></div>`).join('');
 el('economySummary').innerHTML=`<span>Gold income <strong>+${e.gold}</strong></span> · <span>Upkeep <strong>−${e.upkeep}</strong></span> · <span>Net <strong class="${e.netGold>=0?'positive':'negative'}">${e.netGold>=0?'+':''}${e.netGold}</strong>/round</span>${p.gold<0?'<div class="economy-alert">⚠ Your nation is in debt. Restore the treasury through taxes, resource cards or asset sales.</div>':''}`;
 renderMap();renderTile(tile);renderHand();renderResearch();renderStandings();renderLog();
 el('buildPanel').classList.toggle('hidden',!showBuild);el('researchPanel').classList.toggle('hidden',!showResearch);
 el('endTurnBtn').disabled=!active();el('levyBtn').disabled=!canAct();el('researchBtn').disabled=!active();
 el('endTurnBtn').innerHTML=G.finished?'TEST COMPLETE':active()?`END TURN <span>→</span>`:'CPU THINKING…';
 el('actionNotice').innerHTML=G.finished?'Prototype match complete. Review the results or start another world.':cpuBusy?'Three CPU nations are taking their turns…':p.acted?'Major action used. You may still play a card, then end your turn.':`<b>1 major action available.</b> Select a territory or use Research / Emergency Taxes.`;
 el('turnFoot').textContent=p.discountBuild||p.discountExpand?`Active discounts: Build −${p.discountBuild} Gold · Expand −${p.discountExpand} Gold`:'One major action per turn · One card may be played';
}
function renderTile(t){const container=el('territoryDetails');if(!t){el('territoryTag').textContent='SELECT A HEX';container.innerHTML='<p class="empty-note">Tap a territory on the map to inspect it.</p>';return;}
 const p=getCountry(),terrain=TERRAIN[t.terrain],owner=t.owner===null?null:G.players[t.owner],isOwn=t.owner===0,frontier=eligibleExpansion(p,t),b=t.building?BUILDINGS[t.building]:null;
 el('territoryTag').textContent=t.capital?'CAPITAL':t.terrain.toUpperCase();
 let html=`<div class="tile-head"><div><h3 class="tile-title">${esc(t.name)}</h3><div class="tile-sub">${terrain.name} · ${t.q}, ${t.r}</div></div><span class="owner-pill" style="background:${owner?owner.color:'#c6d8c1'}">${owner?esc(owner.name):'Unclaimed'}</span></div><p class="tile-description">${terrain.desc}</p><div class="terrain-data">`;
 if(t.capital)html+='<span>🏰 Capital city</span>';
 for(const k of Object.keys(terrain.yield))html+=`<span>+${terrain.yield[k]} ${k} / round</span>`;
 if(b)html+=`<span>${b.icon} ${b.name}</span><span>−${b.upkeep} Gold / round</span>`;
 html+='</div><div class="tile-actions">';
 if(frontier){const cost=expansionCost(p),afford=hasMoney(p,cost)&&p.food>=2;html+=`<button class="action-btn primary-action" data-action="expand" ${!canAct()||!afford?'disabled':''}>Claim territory <span>${cost} 🪙 + 2 🌾</span></button>`;if(!afford)html+='<div class="disabled-help">Not enough Gold or Food to expand.</div>';}
 else if(t.owner===null&&t.terrain==='water'){html+='<div class="feature-locked">⚓ Naval expansion unlocks in a future version.</div>';}
 else if(t.owner===null){html+='<p class="empty-note">Expand from your own border to reach this territory.</p>';}
 else if(isOwn){
   if(!b)html+=`<button class="action-btn primary-action" data-action="open-build" ${!canAct()?'disabled':''}>Construct a building <span>View options →</span></button>`;
   else if(!t.capital)html+=`<button class="action-btn danger-action" data-action="sell" ${!canAct()?'disabled':''}>Sell ${b.name} to Global Bank <span>+${Math.max(2,Math.floor(b.gold*.6))} 🪙</span></button>`;
   else html+=`<button class="action-btn danger-action" data-action="sell" ${!canAct()?'disabled':''}>Sell ${b.name} to Global Bank <span>+${Math.max(2,Math.floor(b.gold*.6))} 🪙</span></button>`;
   if(b)html+='<div class="disabled-help">One building per territory in this test version. Upgrades and multi-slot cities will follow.</div>';
 }else{html+='<div class="feature-locked">⚔ Wars, military movement and reconnaissance are planned for the combat update.</div>';}
 html+='</div>';container.innerHTML=html;
 if(showBuild){if(!isOwn||!!b){showBuild=false;el('buildPanel').classList.add('hidden');}else renderBuildOptions(t);}
}
function renderBuildOptions(t){const p=getCountry();el('buildOptions').innerHTML=Object.entries(BUILDINGS).filter(([k,b])=>b.allow.includes(t.terrain)).map(([k,b])=>`<button class="build-option" data-build="${k}" ${!canAct()||!canBuild(p,t,b)?'disabled':''}><span class="build-symbol">${b.icon}</span><span class="build-main"><span class="build-name">${b.name}</span><span class="build-desc" style="display:block">${b.text} · −${b.upkeep} Gold upkeep</span></span><span class="build-cost">${buildingCost(p,b)} 🪙<br>${b.materials} 🪨</span></button>`).join('');}
function renderResearch(){const p=getCountry();el('researchOptions').innerHTML=Object.entries(TECHS).map(([k,t])=>`<button class="build-option" data-tech="${k}" ${!canAct()||p.tech.includes(k)||!hasMoney(p,t.gold)||p.knowledge<t.knowledge?'disabled':''}><span class="build-symbol">${t.icon}</span><span class="build-main"><span class="build-name">${t.name} ${p.tech.includes(k)?'✓':''}</span><span class="build-desc" style="display:block">${t.desc}</span></span><span class="build-cost">${t.gold} 🪙<br>${t.knowledge} ✦</span></button>`).join('');}
function renderHand(){const p=getCountry();el('cardCount').textContent=`${p.hand.length} / 4`;el('hand').innerHTML=p.hand.map((c,i)=>`<button class="card-item" data-card="${i}" ${!active()||p.cardPlayed?'disabled':''} aria-label="Play ${CARDS[c].name}"><span class="card-icon">${CARDS[c].icon}</span><span class="card-name">${CARDS[c].name}</span><span class="card-desc">${CARDS[c].desc}</span></button>`).join('')||'<p class="empty-note">No cards in hand. Draw again next turn.</p>';}
function renderStandings(){const sorted=[...G.players].sort((a,b)=>prosperity(b)-prosperity(a));el('standings').innerHTML=sorted.map((p,i)=>`<div class="standing"><span class="standing-rank">${i+1}</span><span class="standing-color" style="background:${p.color}"></span><span class="standing-name"><strong>${esc(p.name)}${p.id===0?' (You)':''}</strong><small>${G.tiles.filter(t=>t.owner===p.id).length} territory · ${G.tiles.filter(t=>t.owner===p.id&&t.building).length} builds · ${fmt(p.gold)} Gold</small></span><span class="standing-score">${prosperity(p)}</span></div>`).join('');}
function renderLog(){el('gameLog').innerHTML=G.log.slice(0,10).map(l=>`<div class="log-item"><span class="log-round">R${l.round}</span><span>${esc(l.text)}</span></div>`).join('');}
const coords=t=>({x:HEX*Math.sqrt(3)*(t.q+t.r/2),y:HEX*1.5*t.r});
function polygon(x,y,r){return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i+Math.PI/6;return (x+r*Math.cos(a)).toFixed(2)+','+(y+r*Math.sin(a)).toFixed(2);}).join(' ');}
function art(t,x,y){const seed=hash(t.id+'-'+G.seed);const jitter=((seed%9)-4)*.6;
 const c=(dx,dy)=>`${(x+dx).toFixed(1)} ${(y+dy).toFixed(1)}`;
 switch(t.terrain){
  case'forest':return `<g class="hex-icon"><path d="M${c(-13,11)} l8 -16 8 16Z" fill="#1f6954"/><path d="M${c(-13,4)} l8 -18 8 18Z" fill="#367b54"/><path d="M${c(1,13)} l8 -17 8 17Z" fill="#195d4e"/><path d="M${c(1,5)} l8 -15 8 15Z" fill="#397a54"/></g>`;
  case'mountain':return `<g class="hex-icon"><path d="M${c(-22,15)} L${c(-3,-18)} L${c(17,15)}Z" fill="#687d8c"/><path d="M${c(-3,-18)} L${c(-13,-1)} L${c(-2,-7)} L${c(5,-1)}Z" fill="#e4e9dc"/><path d="M${c(0,15)} L${c(13,-9)} L${c(26,15)}Z" fill="#73808c"/><path d="M${c(13,-9)} L${c(8,1)} L${c(14,-2)} L${c(19,1)}Z" fill="#f4eadd"/></g>`;
  case'hills':return `<g class="hex-icon"><ellipse cx="${x-4}" cy="${y+9}" rx="22" ry="10" fill="#ab9066"/><path d="M${c(-20,8)} Q${c(-9,-12)} ${c(5,6)} Q${c(17,-5)} ${c(25,9)}" fill="none" stroke="#ddc18c" stroke-width="3" stroke-linecap="round"/></g>`;
  case'water':return `<g class="hex-icon" fill="none" stroke="#a4d4db" stroke-width="2" stroke-linecap="round" opacity=".66"><path d="M${c(-16,-5+jitter)} q8 -5 16 0 t16 0"/><path d="M${c(-13,6+jitter)} q8 -5 16 0 t13 0"/></g>`;
  default:return `<g class="hex-icon"><path d="M${c(-16,10)} Q${c(-12,1)} ${c(-5,5)} T${c(7,5)} T${c(21,4)}" fill="none" stroke="#e3d18f" stroke-width="2" opacity=".8"/><circle cx="${x-9}" cy="${y-9}" r="2.3" fill="#e4b65f"/><circle cx="${x+13}" cy="${y+11}" r="1.8" fill="#fbefbd"/></g>`;
 }
}
function buildingArt(t,x,y){const owner=G.players[t.owner];if(t.capital)return `<g class="hex-icon"><rect x="${x-16}" y="${y-1}" width="32" height="23" rx="2" fill="#f0dec0" stroke="#594838" stroke-width="2"/><rect x="${x-20}" y="${y-13}" width="11" height="23" rx="1.8" fill="#e8cfac" stroke="#6a4a3e" stroke-width="1.5"/><rect x="${x+9}" y="${y-13}" width="11" height="23" rx="1.8" fill="#e8cfac" stroke="#6a4a3e" stroke-width="1.5"/><path d="M${x-21} ${y-13} l6 -9 6 9 M${x+8} ${y-13} l6 -9 6 9 M${x-17} ${y-1} l17 -15 17 15" fill="${owner.color}" stroke="#704e39" stroke-width="1.5"/><path d="M${x-2} ${y+21}v-13a5 5 0 0110 0v13" fill="#614a3f"/><path d="M${x} ${y-17}v-16" stroke="#594838" stroke-width="2"/><path d="M${x+1} ${y-33}h17l-4 8H${x+1}Z" fill="${owner.color}"/></g>`;
 const typ=t.building;const color=owner.color;
 if(typ==='farm')return `<g class="hex-icon"><rect x="${x-16}" y="${y-1}" width="31" height="19" rx="2" fill="#ddbb79" stroke="#756044"/><path d="M${x-18} ${y}l18 -17 18 17Z" fill="#b85e4f" stroke="#75483a"/><path d="M${x-2} ${y+18}v-13h9v13" fill="#6e5140"/><path d="M${x-26} ${y+18}h12m-9 -6h11" stroke="#e6d477" stroke-width="3"/></g>`;
 if(typ==='mine')return `<g class="hex-icon"><path d="M${x-22} ${y+15}L${x-4} ${y-17}L${x+21} ${y+15}Z" fill="#647181"/><path d="M${x-10} ${y+14}v-13q8 -10 16 0v13" fill="#413f48" stroke="#d8b56b" stroke-width="3"/><path d="M${x+13} ${y-17}l10 16m-5 -21l-10 21" stroke="#d5a96d" stroke-width="3"/></g>`;
 if(typ==='lumber')return `<g class="hex-icon"><path d="M${x-13} ${y+9}l9 -23 9 23Z" fill="#265d43"/><rect x="${x-3}" y="${y+7}" width="5" height="12" fill="#744b30"/><rect x="${x+4}" y="${y+9}" width="19" height="7" rx="3" fill="#9d6b3e" stroke="#e5bb82"/><rect x="${x+1}" y="${y+15}" width="19" height="7" rx="3" fill="#9d6b3e" stroke="#e5bb82"/></g>`;
 if(typ==='post')return `<g class="hex-icon"><rect x="${x-17}" y="${y-8}" width="34" height="28" fill="#d0c4ae" stroke="#4b5357" stroke-width="2"/><path d="M${x-20} ${y-8}h40l-4 -11h-32z" fill="#63768a"/><path d="M${x} ${y-18}v-17" stroke="#eee" stroke-width="2"/><path d="M${x+1} ${y-35}h15l-3 9H${x+1}" fill="${color}"/><path d="M${x-4} ${y+20}v-12a5 5 0 0110 0v12" fill="#4f5253"/></g>`;
 return `<g class="hex-icon"><rect x="${x-18}" y="${y-1}" width="36" height="23" rx="3" fill="#decfae" stroke="#735541" stroke-width="2"/><path d="M${x-21} ${y-1}l21 -20 21 20Z" fill="${typ==='academy'?'#6b8aa1':typ==='market'?'#c68b5e':'#9c785d'}" stroke="#745343" stroke-width="2"/><rect x="${x-3}" y="${y+7}" width="9" height="15" fill="#7d6650"/><path d="M${x-12} ${y+6}h6v6h-6z M${x+10} ${y+6}h6v6h-6z" fill="#6f9c9d"/></g>`;
}
function renderMap(){const svg=el('worldMap');svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 const out=G.tiles.map(t=>{const {x,y}=coords(t);const owner=t.owner===null?null:G.players[t.owner],selected=t.id===G.selectedId;
 const c=TERRAIN[t.terrain].color,border=owner?owner.color:'#e5e0bb68';const bg=t.terrain==='water'?'#357c9d':c;
 return `<g class="hex ${selected?'hex-selected':''}" tabindex="0" role="button" aria-label="${esc(t.name)}: ${TERRAIN[t.terrain].name}${owner?' owned by '+esc(owner.name):' unclaimed'}" data-hex="${t.id}"><polygon class="hex-bg" points="${polygon(x,y,HEX-1)}" fill="${bg}" stroke="${border}" stroke-width="${owner?'3.5':'1.8'}"/><polygon points="${polygon(x,y,HEX-5)}" fill="${owner?owner.color:'#fff'}" opacity="${owner?'.14':'.04'}" pointer-events="none"/>${t.building||t.capital?buildingArt(t,x,y):art(t,x,y)}${owner?`<circle cx="${x-23}" cy="${y-22}" r="7" fill="${owner.color}" stroke="#f6eedb" stroke-width="1.2"/>`:''}${selected?`<polygon class="hex-highlight" points="${polygon(x,y,HEX-2)}" fill="none" stroke="#ffefb1" stroke-width="3"/>`:''}</g>`;
 });
 el('mapContent').innerHTML=out.join('');
}
function resetView(){view={x:-385,y:-316,w:770,h:632};el('worldMap').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}
function zoom(f){const cx=view.x+view.w/2,cy=view.y+view.h/2;view.w=Math.min(1150,Math.max(235,view.w*f));view.h=view.w*632/770;view.x=cx-view.w/2;view.y=cy-view.h/2;el('worldMap').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}
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
 el('resumeBtn').addEventListener('click',()=>{const saved=loadSaved();if(!saved)return;G=saved;enterGame();if(G.finished)showEndGame();else if(G.turnIndex!==0){cpuBusy=true;setTimeout(cpuStep,400);}});
 el('topMenuBtn').addEventListener('click',openMenu);
 el('endTurnBtn').addEventListener('click',endTurn);
 el('levyBtn').addEventListener('click',()=>{if(canAct())doLevy(0);});
 el('researchBtn').addEventListener('click',()=>{if(!G||!active())return;showResearch=!showResearch;showBuild=false;render();});
 el('closeResearchBtn').addEventListener('click',()=>{showResearch=false;render();});
 el('closeBuildBtn').addEventListener('click',()=>{showBuild=false;render();});
 el('territoryDetails').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button||!canAct())return;const t=getSelected();if(!t)return;switch(button.dataset.action){case 'expand':doExpand(t);break;case 'open-build':showBuild=true;showResearch=false;render();break;case 'sell':doSell(t);break;}});
 el('buildOptions').addEventListener('click',e=>{const b=e.target.closest('[data-build]');if(b&&canAct())doBuild(getSelected(),b.dataset.build);});
 el('researchOptions').addEventListener('click',e=>{const b=e.target.closest('[data-tech]');if(b&&canAct())doResearch(b.dataset.tech);});
 el('hand').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b&&active())playCard(0,Number(b.dataset.card));});
 el('zoomIn').addEventListener('click',()=>zoom(.78));el('zoomOut').addEventListener('click',()=>zoom(1.28));el('zoomReset').addEventListener('click',resetView);
 const svg=el('worldMap');
 svg.addEventListener('pointerdown',e=>{if(!G)return;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};});
 svg.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>7)drag.moved=true;if(drag.moved){const rect=svg.getBoundingClientRect();view.x-=dx/rect.width*view.w;view.y-=dy/rect.height*view.h;svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}drag.x=e.clientX;drag.y=e.clientY;});
 svg.addEventListener('pointerup',()=>{if(drag?.moved){suppressClick=true;setTimeout(()=>suppressClick=false,80);}drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});
 svg.addEventListener('click',e=>{if(suppressClick||!G)return;const t=e.target.closest('[data-hex]');if(t){G.selectedId=t.dataset.hex;showBuild=false;render();save();}});
 svg.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-hex]')){e.preventDefault();G.selectedId=e.target.dataset.hex;showBuild=false;render();save();}});
 svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.12:.89);},{passive:false});
 el('modalLayer').addEventListener('click',e=>{const b=e.target.closest('[data-modal]');if(!b){if(e.target===el('modalBackdrop'))closeModal();return;}switch(b.dataset.modal){case'close':closeModal();break;case'new-confirm':confirmNew();break;case'new':try{localStorage.removeItem(SAVE_KEY);}catch(e){}newMatch();break;case'continue':G.finished=false;G.continued=true;G.maxRounds=Math.max(G.round+16,G.maxRounds+16);G.round++;beginTurn(0);cpuBusy=false;save();closeModal();render();break;}});
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
window.GS_TEST={getState:()=>G,select:(id)=>{if(!G)return;G.selectedId=id;render();},endTurn,render};
})();

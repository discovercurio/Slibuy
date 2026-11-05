import { CONFIG } from './config.js';
import { loadAuctions, nextRefresh, centralDayKey } from './data.js';

const $ = id => document.getElementById(id);
const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5"/>',
  sparkles:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4zM20 2v4M18 4h4"/>',
  external:'<path d="M14 3h7v7M21 3 10 14M10 3H4v17h17v-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
  sliders:'<path d="M4 21v-7M4 9V3M12 21v-9M12 7V3M20 21v-3M20 13V3M1 10h6M9 8h6M17 16h6"/>',
  'arrow-down':'<path d="M12 4v16m-6-6 6 6 6-6"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  box:'<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7.5 5l9 4"/>',
  restore:'<path d="M3 5v6h6M3 11a9 9 0 1 1 1 6"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
  tech:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  tools:'<path d="m14 7 3 3 4-4a6 6 0 0 1-8 8L5 22l-3-3 8-8a6 6 0 0 1 8-8z"/>',
  shirt:'<path d="m8 3-6 4 3 5 3-1v10h8V11l3 1 3-5-6-4a4 4 0 0 1-8 0z"/>',
  leaf:'<path d="M20 3C7 1 1 10 6 17s17 0 14-14zM4 21 16 9"/>',
  kitchen:'<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M20 21V3c-6 0-6 11 0 11"/>',
  car:'<path d="m5 5-3 8v7h3v-3h14v3h3v-7l-3-8zM3 12h18M6 14h2M16 14h2"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const currency = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
const stamp = value => value ? new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value)) : 'Scan time unavailable';
const shortDate = value => new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00-06:00`));
const STORAGE_KEY = `daily-find:trash:v1:${CONFIG.sheetId}`;
let storageBlocked = false;
function readTrash() {
  try { const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return new Set(Array.isArray(ids) ? ids.filter(id => /^\d+$/.test(String(id))).map(String) : []); }
  catch { storageBlocked = true; return new Set(); }
}
let state = {items:[],data:null,view:'all',category:'',query:'',condition:'',min:'',max:'',savings:0,location:'',showEnded:false,sort:'ending',limit:CONFIG.pageSize,layout:'grid',trashed:readTrash(),loading:false,error:null};
let lastAttempt = 0, toastTimer, undoAction, searchTimer, previousMinute = '', previousDay = centralDayKey();
const today = () => centralDayKey();
function isEnded(item) { return item.end ? Date.parse(item.end) <= Date.now() : item.endDate ? item.endDate < today() : false; }
function isToday(item) { return (item.endDate || (item.end ? centralDayKey(new Date(item.end)) : '')) === today() && !isEnded(item); }
function discount(item) { return item.msrp > 0 && item.price !== null ? 100 * (1 - item.price / item.msrp) : null; }
function saveTrash() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.trashed])); } catch { storageBlocked = true; } }
function toast(message, undo) {
  clearTimeout(toastTimer); $('toastMessage').textContent = message; undoAction = undo;
  $('undoButton').hidden = !undo; $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, 8000);
}
function notice() {
  const notes = [];
  if (state.error) notes.push(state.items.length ? 'The sheet could not be refreshed. Showing the previous snapshot; bids may be out of date.' : 'We couldn’t connect to the auction sheet. Check your connection and public Viewer access to the sheet, then retry.');
  if (state.data?.warnings?.length) notes.push(...state.data.warnings);
  if (state.data?.scannedAt && Date.now() - Date.parse(state.data.scannedAt) > 30 * 3600000) notes.push('This bid snapshot is over 30 hours old. The source scanner may not have completed its daily scan.');
  if (storageBlocked) notes.push('Browser storage is unavailable. Trash changes will last for this visit only.');
  if (state.items.length && state.items.some(item => !item.end && item.endDate)) notes.push('Some closing times are unavailable in the public sheet. Those cards show a date; check the official auction for the time.');
  $('dataNotice').hidden = !notes.length;
  $('dataNotice').classList.toggle('error', !!state.error);
  $('dataNotice').replaceChildren(document.createTextNode(notes.join(' ')));
  if (state.error) { const button = document.createElement('button'); button.textContent='Retry'; button.addEventListener('click',refresh); $('dataNotice').append(button); }
}
function categoryIcon(name) {
  if (/electronics|appliance/i.test(name)) return 'tech';
  if (/apparel/i.test(name)) return 'shirt';
  if (/tools|improvement/i.test(name)) return 'tools';
  if (/kitchen|food/i.test(name)) return 'kitchen';
  if (/furniture/i.test(name)) return 'home';
  if (/outdoor|pet/i.test(name)) return 'leaf';
  if (/automotive/i.test(name)) return 'car';
  if (/health|baby/i.test(name)) return 'heart';
  return 'box';
}
function contextItems() {
  return state.items.filter(item => state.view==='trash' ? state.trashed.has(item.id) : !state.trashed.has(item.id) && (state.showEnded || !isEnded(item)) && (state.view!=='today' || isToday(item)));
}
function renderCategories() {
  const items = contextItems(), counts = new Map();
  items.forEach(item => (item.categories.length ? item.categories : ['Uncategorized']).forEach(cat => counts.set(cat,(counts.get(cat)||0)+1)));
  const allCats = [...new Set(state.items.flatMap(item => item.categories.length ? item.categories : ['Uncategorized']))].sort((a,b)=>a.localeCompare(b));
  $('categoryList').innerHTML = [['',items.length],...allCats.map(cat=>[cat,counts.get(cat)||0])].map(([cat,count]) => `<button data-category="${esc(cat)}" class="${state.category===cat?'active':''}" aria-pressed="${state.category===cat}"><span>${icon(cat?categoryIcon(cat):'grid')}</span><span>${esc(cat||'All categories')}</span><small>${count.toLocaleString()}</small></button>`).join('');
}
function renderOptions() {
  for (const [id,key,first] of [['condition','condition','All conditions'],['location','location','All locations']]) {
    const values = [...new Set(state.items.map(item=>item[key]).filter(Boolean))].sort();
    $(id).innerHTML = `<option value="">${first}</option>`+values.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
    $(id).value = state[key];
  }
}
function filteredItems() {
  const terms = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return contextItems().filter(item => {
    const categories = item.categories.length ? item.categories : ['Uncategorized'];
    if (state.category && !categories.includes(state.category)) return false;
    if (state.condition && item.condition!==state.condition) return false;
    if (state.location && item.location!==state.location) return false;
    if (state.min!=='' && (item.price===null || item.price<Number(state.min))) return false;
    if (state.max!=='' && (item.price===null || item.price>Number(state.max))) return false;
    if (state.savings && (discount(item)===null || discount(item)<state.savings)) return false;
    const text = `${item.title} ${item.id} ${item.category} ${item.condition} ${item.location}`.toLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a,b) => {
    const nullLast = (x,y,desc=false) => x===null ? y===null?0:1 : y===null?-1:desc?y-x:x-y;
    if (state.sort==='price-low') return nullLast(a.price,b.price)||a.id.localeCompare(b.id);
    if (state.sort==='price-high') return nullLast(a.price,b.price,true)||a.id.localeCompare(b.id);
    if (state.sort==='savings') return nullLast(discount(a),discount(b),true)||a.id.localeCompare(b.id);
    if (state.sort==='msrp') return nullLast(a.msrp,b.msrp,true)||a.id.localeCompare(b.id);
    if (state.sort==='title') return a.title.localeCompare(b.title);
    const value = item => item.end ? Date.parse(item.end) : item.endDate ? Date.parse(`${item.endDate}T23:59:59-06:00`) : Number.MAX_SAFE_INTEGER;
    return value(a)-value(b)||a.id.localeCompare(b.id);
  });
}
function endLabel(item) {
  if (item.end) {
    const ms = Date.parse(item.end)-Date.now();
    if (ms<=0) return {label:'Ended',className:'ended'};
    const min = Math.floor(ms/60000), hours=Math.floor(min/60), days=Math.floor(hours/24);
    return {label: days ? `${days}d ${hours%24}h left` : hours ? `${hours}h ${min%60}m left` : min ? `${min}m left` : 'Under 1m left',className:ms<86400000?'urgent':''};
  }
  return {label:item.endDate ? `${item.endDate<today()?'Ended':'Ends'} ${shortDate(item.endDate)} · time unavailable`:'Check closing time',className:item.endDate && item.endDate<today()?'ended':''};
}
function card(item) {
  const end=endLabel(item), saved=state.view==='trash', below=discount(item), categories=item.categories.slice(0,2).join(' / ')||'Uncategorized';
  const image=item.image?`<img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<span class="placeholder-image">${icon('box')}<span>Photo unavailable</span></span>`;
  const tooltip=`${item.end?`Ends ${stamp(item.end)}`:'Exact closing time unavailable; check sliBuy.'} · Bid snapshot: ${item.scannedAt?stamp(item.scannedAt):'time unavailable'}`;
  return `<article class="auction-card" data-id="${esc(item.id)}"><div class="product-photo"><a class="photo-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="View auction ${esc(item.id)}: ${esc(item.title)} (opens sliBuy)">${image}</a><span class="condition-badge ${/appears new/i.test(item.condition)?'appears-new':''}">${esc(item.condition)}</span>${saved?'':`<button class="trash-item" data-trash="${esc(item.id)}" aria-label="Trash auction ${esc(item.id)}" title="Hide this auction in your browser">${icon('trash')}</button>`}<span class="end-badge ${end.className}" data-end-id="${esc(item.id)}" title="${esc(tooltip)}">${icon('clock')}<span>${esc(end.label)}</span></span></div><div class="card-body"><p class="card-category" title="${esc(item.category)}">${esc(categories)}</p><h3 class="card-title"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" title="${esc(item.title)}">${esc(item.title)}</a></h3><div class="bid-row"><div class="bid-info" title="${esc(item.scannedAt?`Bids captured during scan started ${stamp(item.scannedAt)}`:'Capture time unavailable')}"><small>${/starting/i.test(item.priceLabel)?'STARTING PRICE':/snapshot/i.test(item.priceLabel)?'PRICE SNAPSHOT':'SNAPSHOT BID'}</small><strong>${currency(item.price)}</strong></div><div class="msrp-info">${item.msrp!==null?`MSRP ${currency(item.msrp)}`:'MSRP unavailable'}${below!==null&&below>0?`<span>${Math.floor(below)}% below MSRP</span>`:''}</div></div>${saved?`<button class="restore-item" data-restore="${esc(item.id)}">${icon('restore')} Restore auction</button>`:`<a class="auction-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">View auction ${icon('external')}</a>`}<div class="card-bottom"><span>${icon('pin')}${esc(item.location||'Check pickup location')}</span><span>#${esc(item.id)}</span></div></div></article>`;
}
function imageFallbacks() {
  $('auctionGrid').querySelectorAll('img').forEach(img => img.addEventListener('error',()=>{
    if (!img.dataset.retried && img.src.includes('/product/') && !img.src.includes('/product/thumbnail/')) { img.dataset.retried='true'; img.src=img.src.replace('/product/','/product/thumbnail/'); }
    else { const span=document.createElement('span');span.className='placeholder-image';span.innerHTML=`${icon('box')}<span>Photo unavailable</span>`;img.replaceWith(span); }
  }));
}
function renderChips() {
  const chips=[];
  if (state.query) chips.push(['query',`Search: ${state.query}`]);
  if (state.category) chips.push(['category',state.category]);
  if (state.condition) chips.push(['condition',state.condition]);
  if (state.min!==''||state.max!=='') chips.push(['price',`Bid: ${state.min!==''?currency(Number(state.min)):'$0'} – ${state.max!==''?currency(Number(state.max)):'any'}`]);
  if (state.savings) chips.push(['savings',`${state.savings}%+ below MSRP`]);
  if (state.location) chips.push(['location',state.location]);
  if (state.showEnded) chips.push(['showEnded','Including ended']);
  $('activeFilters').innerHTML=chips.map(([key,label])=>`<button data-remove="${key}" aria-label="Remove filter: ${esc(label)}">${esc(label)}${icon('close')}</button>`).join('');
}
function render() {
  const focused=document.activeElement;
  const categoryFocus=focused?.dataset?.category;
  const gridFocus=$('auctionGrid').contains(focused);
  const cardIndex=gridFocus?[...$('auctionGrid').querySelectorAll('.auction-card')].indexOf(focused.closest('.auction-card')):-1;
  const itemFocus=gridFocus?{id:focused.closest('.auction-card')?.dataset.id,action:focused.hasAttribute('data-trash')?'trash':focused.hasAttribute('data-restore')?'restore':'link'}:null;
  const chipFocus=focused?.dataset?.remove;
  const visible=state.items.filter(item=>!state.trashed.has(item.id)&&!isEnded(item));
  $('statTotal').textContent=state.data?visible.length.toLocaleString():'—';
  $('statToday').textContent=state.data?visible.filter(isToday).length.toLocaleString():'—';
  $('statCategories').textContent=state.data?new Set(visible.flatMap(item=>item.categories)).size:'—';
  $('allCount').textContent=state.data?state.items.filter(item=>!state.trashed.has(item.id)&&(state.showEnded||!isEnded(item))).length.toLocaleString():'—';
  $('todayCount').textContent=state.data?visible.filter(isToday).length.toLocaleString():'—';
  ['trashCount','headerTrashCount'].forEach(id=>$(id).textContent=state.trashed.size.toLocaleString());
  document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===state.view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  const title=state.category || ({all:'All auctions',today:'Ending today',trash:'My trash'})[state.view];
  $('resultsTitle').firstChild.textContent=title+' ';
  $('resultsEyebrow').textContent=state.view==='trash'?'A LITTLE LESS CLUTTER':state.view==='today'?'LAST CHANCE FINDS':'THE GOOD STUFF';
  $('restoreAll').hidden=state.view!=='trash'||!state.trashed.size;
  $('auctionGrid').setAttribute('aria-busy',String(state.loading));
  $('auctionGrid').classList.toggle('list-layout',state.layout==='list');
  $('priceError').hidden=!(state.min!==''&&state.max!==''&&Number(state.max)<Number(state.min));
  renderCategories();renderChips();notice();
  if (state.loading&&!state.data) {
    $('auctionGrid').innerHTML=Array.from({length:6},()=>'<div class="skeleton" aria-hidden="true"></div>').join('');
    $('emptyState').hidden=true;$('loadMore').hidden=true;$('pageProgress').textContent='';return;
  }
  const matches=filteredItems(), count=matches.length;
  $('resultCount').textContent=state.data?`(${count.toLocaleString()})`:'';
  $('showingText').textContent=state.error&&!state.data?'The source sheet is unavailable.':state.view==='trash'?`${count.toLocaleString()} matching auctions from this scan · ${state.trashed.size} IDs saved in your trash`:`Showing ${Math.min(state.limit,count).toLocaleString()} of ${count.toLocaleString()} finds · bids are a scan-time snapshot`;
  $('auctionGrid').innerHTML=matches.slice(0,state.limit).map(card).join('');imageFallbacks();
  $('emptyState').hidden=count>0;
  $('emptyTitle').textContent=state.error&&!state.data?'Let’s reconnect your finds':state.view==='trash'?'A clean slate.':state.view==='today'?'No more finds ending today.':'No finds match just yet.';
  $('emptyMessage').textContent=state.error&&!state.data?'This page needs public read-only access to your Google Sheet. Check the sheet’s sharing and your connection, then try again.':state.view==='trash'?'Trashed auctions from the current scan will appear here. Trashed IDs from older scans stay hidden if they return.':!state.items.length?'The sheet is connected, but there are no auction rows yet. Run the scanner, then refresh.':'Try a different keyword, another category, or a wider bid range. You can also include ended auctions.';
  $('emptyAction').textContent=state.error&&!state.data?'Retry connection':!state.items.length?'Refresh auctions':state.view==='trash'?'Back to all auctions':'Clear filters';
  $('loadMore').hidden=state.limit>=count;
  $('pageProgress').textContent=count?`${Math.min(state.limit,count).toLocaleString()} / ${count.toLocaleString()} finds`:'';
  // Rendering replaces controls: keep the keyboard user's place in the new DOM.
  if(categoryFocus!==undefined) [...$('categoryList').querySelectorAll('button')].find(button=>button.dataset.category===categoryFocus)?.focus({preventScroll:true});
  else if(itemFocus){
    const cards=[...$('auctionGrid').querySelectorAll('.auction-card')];
    const next=cards.find(el=>el.dataset.id===itemFocus.id)||cards[Math.min(cardIndex,cards.length-1)];
    const selector=itemFocus.action==='trash'?'[data-trash]':itemFocus.action==='restore'?'[data-restore]':'a';
    (next?.querySelector(selector)||next?.querySelector('a')||$('emptyAction')).focus({preventScroll:true});
  } else if(chipFocus) ($('activeFilters').querySelector('button')||$('search')).focus({preventScroll:true});
}
function syncInputs() {
  $('search').value=state.query;$('condition').value=state.condition;$('location').value=state.location;
  $('minPrice').value=state.min;$('maxPrice').value=state.max;$('savings').value=state.savings;$('showEnded').checked=state.showEnded;
}
function resetFilters() { Object.assign(state,{category:'',query:'',condition:'',location:'',min:'',max:'',savings:0,showEnded:false,limit:CONFIG.pageSize});syncInputs();render(); }
function setView(view) {state.view=view;state.limit=CONFIG.pageSize;render();}
async function refresh() {
  if (state.loading) return;
  state.loading=true;lastAttempt=Date.now();$('refreshButton').disabled=true;$('refreshButton').classList.add('loading');render();
  try {
    const data=await loadAuctions(CONFIG);state.data=data;state.items=data.items;state.error=null;
    $('scanTime').textContent=stamp(data.scannedAt);$('scanTime').title='Source report Last scan: when the scanner started. Bids were collected during that scan.';
    $('sheetLink').href=data.sheetUrl;renderOptions();
  } catch(error) {state.error=error;if(!state.data)$('scanTime').textContent='Connection unavailable';}
  finally {state.loading=false;$('refreshButton').disabled=false;$('refreshButton').classList.remove('loading');render();}
}
function updateTimers() {
  const now=new Date(), next=nextRefresh(now), seconds=Math.max(0,Math.floor((next-now)/1000));
  $('refreshHours').textContent=String(Math.floor(seconds/3600)).padStart(2,'0');
  $('refreshMinutes').textContent=String(Math.floor(seconds%3600/60)).padStart(2,'0');
  $('refreshSeconds').textContent=String(seconds%60).padStart(2,'0');
  const minute=now.toISOString().slice(0,16), day=today();
  if (minute!==previousMinute) {
    previousMinute=minute;
    if (state.data&&!state.loading) {
      if($('auctionGrid').contains(document.activeElement)||$('categoryList').contains(document.activeElement)){
        $('auctionGrid').querySelectorAll('[data-end-id]').forEach(badge=>{
          const item=state.items.find(item=>item.id===badge.dataset.endId);if(!item)return;
          const end=endLabel(item);badge.className=`end-badge ${end.className}`;badge.lastElementChild.textContent=end.label;
        });
      }else render();
    }
  }
  if (day!==previousDay) {previousDay=day;if(!document.hidden)refresh();}
}
function hideFilters() {$('filters').classList.remove('open');$('filters').removeAttribute('role');$('filters').removeAttribute('aria-modal');$('openFilters').setAttribute('aria-expanded','false');$('filterBackdrop').hidden=true;document.body.style.overflow='';}

$('refreshButton').addEventListener('click',refresh);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('headerTrash').addEventListener('click',()=>{setView('trash');$('browse').scrollIntoView({behavior:'smooth'});});
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=$('search').value;state.limit=CONFIG.pageSize;render();},160);});
for (const [id,key] of [['condition','condition'],['location','location'],['minPrice','min'],['maxPrice','max'],['savings','savings'],['showEnded','showEnded'],['sort','sort']]) {
  $(id).addEventListener(id==='minPrice'||id==='maxPrice'?'input':'change',()=>{state[key]=id==='showEnded'?$(id).checked:id==='savings'?Number($(id).value):$(id).value;state.limit=CONFIG.pageSize;render();});
}
$('categoryList').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(button){state.category=button.dataset.category;state.limit=CONFIG.pageSize;render();}});
$('activeFilters').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove]');if(!button)return;
  const key=button.dataset.remove;
  if(key==='price'){state.min='';state.max='';}else state[key]=key==='savings'?0:key==='showEnded'?false:'';
  state.limit=CONFIG.pageSize;syncInputs();render();
});
$('resetFilters').addEventListener('click',resetFilters);
$('emptyAction').addEventListener('click',()=>{if(state.error&&!state.data||!state.items.length)refresh();else if(state.view==='trash'){resetFilters();setView('all');}else resetFilters();});
$('loadMore').addEventListener('click',()=>{state.limit+=CONFIG.pageSize;render();});
$('auctionGrid').addEventListener('click',event=>{
  const trash=event.target.closest('[data-trash]'), restore=event.target.closest('[data-restore]');
  if(trash){const id=trash.dataset.trash;state.trashed.add(id);saveTrash();render();toast('Auction moved to your trash.',()=>{state.trashed.delete(id);saveTrash();render();});}
  if(restore){const id=restore.dataset.restore;state.trashed.delete(id);saveTrash();render();toast('Auction restored to your finds.',()=>{state.trashed.add(id);saveTrash();render();});}
});
$('restoreAll').addEventListener('click',()=>{const previous=new Set(state.trashed);state.trashed.clear();saveTrash();render();toast('All trashed auctions restored.',()=>{previous.forEach(id=>state.trashed.add(id));saveTrash();render();});});
$('undoButton').addEventListener('click',()=>{undoAction?.();$('toast').hidden=true;clearTimeout(toastTimer);});
$('dismissToast').addEventListener('click',()=>{$('toast').hidden=true;clearTimeout(toastTimer);});
for (const layout of ['grid','list']) $(layout+'View').addEventListener('click',()=>{state.layout=layout;for(const name of ['grid','list']){$(name+'View').classList.toggle('active',name===layout);$(name+'View').setAttribute('aria-pressed',String(name===layout));}render();});
$('openFilters').addEventListener('click',()=>{$('filters').classList.add('open');$('filters').setAttribute('role','dialog');$('filters').setAttribute('aria-modal','true');$('openFilters').setAttribute('aria-expanded','true');$('filterBackdrop').hidden=false;document.body.style.overflow='hidden';$('closeFilters').focus();});
$('closeFilters').addEventListener('click',()=>{hideFilters();$('openFilters').focus();});
$('filterBackdrop').addEventListener('click',hideFilters);
$('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());
$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());
$('aboutDialog').addEventListener('click',event=>{if(event.target===$('aboutDialog')){const r=$('aboutDialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('aboutDialog').close();}});
document.addEventListener('keydown',event=>{
  if(event.key==='Tab'&&$('filters').classList.contains('open')){
    const controls=[...$('filters').querySelectorAll('button, input, select, a[href]')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(first&&last){
      if(event.shiftKey&&(document.activeElement===first||!$('filters').contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!$('filters').contains(document.activeElement))){event.preventDefault();first.focus();}
    }
  }
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!$('aboutDialog').open){event.preventDefault();$('search').focus();}
  if(event.key==='Escape'&&$('filters').classList.contains('open')){hideFilters();$('openFilters').focus();}
});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){state.trashed=readTrash();render();}});
window.addEventListener('resize',()=>{if(window.innerWidth>800&&$('filters').classList.contains('open'))hideFilters();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateTimers();if(Date.now()-lastAttempt>CONFIG.pollIntervalMs)refresh();}});
setInterval(()=>{if(!document.hidden)refresh();},CONFIG.pollIntervalMs);
setInterval(updateTimers,1000);
updateTimers();refresh();

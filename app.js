import { CONFIG } from './config.js';
import { loadAuctions, nextRefresh, centralDayKey } from './data.js';

const $ = id => document.getElementById(id);
const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  star:'<path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.1 6.6 20l1.1-6.1-4.5-4.3 6.1-.8z"/>',
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
  'arrow-up':'<path d="M12 20V4m-6 6 6-6 6 6"/>',
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
const icon = (name, filled = false) => `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const currency = value => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
const stamp = value => value ? new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value)) : 'Scan time unavailable';
const shortStamp = value => value ? new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)) : 'time unavailable';
const shortDate = value => new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00-06:00`));

/* ---------- Browser storage: trash (IDs), favorites (IDs + a snapshot), view prefs ---------- */
const STORAGE_KEY = `daily-find:trash:v1:${CONFIG.sheetId}`;
const FAV_KEY = `daily-find:favorites:v1:${CONFIG.sheetId}`;
const PREFS_KEY = `daily-find:prefs:v1:${CONFIG.sheetId}`;
let storageBlocked = false;
function readTrash() {
  try { const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return new Set(Array.isArray(ids) ? ids.filter(id => /^\d+$/.test(String(id))).map(String) : []); }
  catch { storageBlocked = true; return new Set(); }
}
/** Favorites keep a snapshot so a saved find still shows after it drops out of the latest scan. */
function snapshotOf(item) {
  return {id:item.id,title:item.title,image:item.image,url:item.url,price:item.price,msrp:item.msrp,end:item.end,endDate:item.endDate,
    condition:item.condition,category:item.category,categories:item.categories||[],location:item.location,priceLabel:item.priceLabel,
    scannedAt:item.scannedAt,savedAt:item.savedAt||new Date().toISOString()};
}
function readFavorites() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    const map = new Map();
    (Array.isArray(list) ? list : []).forEach(entry => {
      const id = String(entry?.id ?? entry ?? '');
      if (!/^\d+$/.test(id)) return;
      const snap = typeof entry === 'object' && entry ? entry : {id};
      map.set(id, {...snap, id, title:String(snap.title||`Auction ${id}`), categories:Array.isArray(snap.categories)?snap.categories.map(String):[],
        url: /^https:\/\/(www\.)?slibuy\.com\//.test(snap.url||'') ? snap.url : `https://www.slibuy.com/search?searchbar=${id}`,
        image: /^https?:\/\//.test(snap.image||'') ? snap.image : '', price: typeof snap.price==='number'?snap.price:null, msrp: typeof snap.msrp==='number'?snap.msrp:null});
    });
    return map;
  } catch { storageBlocked = true; return new Map(); }
}
function readPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { return {}; } }
const prefs = readPrefs();
const SORTS = ['ending','price-low','price-high','savings','msrp','title'];

let state = {items:[],data:null,view:'all',category:'',query:'',condition:'',min:'',max:'',savings:0,msrpMin:'',soon:false,location:'',showEnded:false,
  sort:SORTS.includes(prefs.sort)?prefs.sort:'ending',limit:CONFIG.pageSize,layout:prefs.layout==='list'?'list':'grid',
  trashed:readTrash(),favorites:readFavorites(),loading:false,error:null};
let lastAttempt = 0, toastTimer, undoAction, searchTimer, previousMinute = '', previousDay = centralDayKey();
const today = () => centralDayKey();
function isEnded(item) { return item.end ? Date.parse(item.end) <= Date.now() : item.endDate ? item.endDate < today() : false; }
function isToday(item) { return (item.endDate || (item.end ? centralDayKey(new Date(item.end)) : '')) === today() && !isEnded(item); }
function endsWithinHour(item) { return !!item.end && !isEnded(item) && Date.parse(item.end) - Date.now() <= 3600000; }
function discount(item) { return item.msrp > 0 && item.price !== null && item.price !== undefined ? 100 * (1 - item.price / item.msrp) : null; }
function saveTrash() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.trashed])); } catch { storageBlocked = true; } }
function saveFavorites() { try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites.values()])); } catch { storageBlocked = true; } }
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify({sort:state.sort,layout:state.layout})); } catch { /* optional */ } }
function toast(message, undo) {
  clearTimeout(toastTimer); $('toastMessage').textContent = message; undoAction = undo;
  $('undoButton').hidden = !undo; $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, 8000);
}

/** Errors get a banner; routine data notes collapse into one small expandable line. */
function notice() {
  const errors = [], notes = [];
  if (state.error) errors.push(state.items.length ? 'The sheet could not be refreshed. Showing the previous snapshot; bids may be out of date.' : 'We couldn’t connect to the auction sheet. Check your connection and public Viewer access to the sheet, then retry.');
  if (state.data?.scannedAt && Date.now() - Date.parse(state.data.scannedAt) > 30 * 3600000) errors.push('This bid snapshot is over 30 hours old. The source scanner may not have completed its daily scan.');
  if (state.data?.warnings?.length) notes.push(...state.data.warnings);
  if (storageBlocked) notes.push('Browser storage is unavailable. Favorites and trash changes will last for this visit only.');
  if (state.items.length && state.items.some(item => !item.end && item.endDate)) notes.push('Some closing times are unavailable in the public sheet. Those cards show a date; check the official auction for the time.');
  const box = $('dataNotice');
  box.hidden = !errors.length && !notes.length;
  box.classList.toggle('error', !!errors.length);
  box.classList.toggle('compact', !errors.length);
  box.replaceChildren();
  if (errors.length) {
    box.append(document.createTextNode(errors.join(' ')));
    if (state.error) { const button = document.createElement('button'); button.textContent = 'Retry'; button.addEventListener('click', refresh); box.append(button); }
  }
  if (notes.length) {
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = `Data notes (${notes.length})`;
    details.append(summary);
    const list = document.createElement('ul');
    notes.forEach(text => { const li = document.createElement('li'); li.textContent = text; list.append(li); });
    details.append(list);
    if (notice.open) details.open = true;
    details.addEventListener('toggle', () => { notice.open = details.open; });
    box.append(details);
  }
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
/** Saved favorites: the live item when it is in this scan, otherwise the saved snapshot (flagged). */
function favoriteItems() {
  const live = new Map(state.items.map(item => [item.id, item]));
  return [...state.favorites.values()].map(snap => live.has(snap.id) ? live.get(snap.id) : {...snap, stale:true});
}
function contextItems() {
  if (state.view === 'trash') return state.items.filter(item => state.trashed.has(item.id));
  if (state.view === 'favorites') return favoriteItems();
  return state.items.filter(item => !state.trashed.has(item.id) && (state.showEnded || !isEnded(item)) && (state.view !== 'today' || isToday(item)));
}
function renderCategories() {
  const items = contextItems(), counts = new Map();
  items.forEach(item => (item.categories?.length ? item.categories : ['Uncategorized']).forEach(cat => counts.set(cat,(counts.get(cat)||0)+1)));
  const pool = state.view === 'favorites' ? items : state.items;
  const allCats = [...new Set(pool.flatMap(item => item.categories?.length ? item.categories : ['Uncategorized']))].sort((a,b)=>a.localeCompare(b));
  $('categoryList').innerHTML = [['',items.length],...allCats.map(cat=>[cat,counts.get(cat)||0])].map(([cat,count]) => `<button data-category="${esc(cat)}" class="${state.category===cat?'active':''}${count?'':' empty'}" aria-pressed="${state.category===cat}"><span>${icon(cat?categoryIcon(cat):'grid')}</span><span>${esc(cat||'All categories')}</span><small>${count.toLocaleString()}</small></button>`).join('');
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
    const categories = item.categories?.length ? item.categories : ['Uncategorized'];
    if (state.category && !categories.includes(state.category)) return false;
    if (state.condition && item.condition!==state.condition) return false;
    if (state.location && item.location!==state.location) return false;
    if (state.min!=='' && (item.price===null || item.price<Number(state.min))) return false;
    if (state.max!=='' && (item.price===null || item.price>Number(state.max))) return false;
    if (state.savings && (discount(item)===null || discount(item)<state.savings)) return false;
    if (state.msrpMin!=='' && (item.msrp===null || item.msrp===undefined || item.msrp<Number(state.msrpMin))) return false;
    if (state.soon && !endsWithinHour(item)) return false;
    const text = `${item.title} ${item.id} ${item.category} ${item.condition} ${item.location}`.toLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a,b) => {
    const nullLast = (x,y,desc=false) => x===null||x===undefined ? (y===null||y===undefined)?0:1 : y===null||y===undefined?-1:desc?y-x:x-y;
    if (state.sort==='price-low') return nullLast(a.price,b.price)||a.id.localeCompare(b.id);
    if (state.sort==='price-high') return nullLast(a.price,b.price,true)||a.id.localeCompare(b.id);
    if (state.sort==='savings') return nullLast(discount(a),discount(b),true)||a.id.localeCompare(b.id);
    if (state.sort==='msrp') return nullLast(a.msrp,b.msrp,true)||a.id.localeCompare(b.id);
    if (state.sort==='title') return a.title.localeCompare(b.title);
    const value = item => item.end ? Date.parse(item.end) : item.endDate ? Date.parse(`${item.endDate}T23:59:59-06:00`) : Number.MAX_SAFE_INTEGER;
    // Ended items (only visible with "include ended" or in Favorites) go after live ones.
    return (isEnded(a)-isEnded(b)) || value(a)-value(b) || a.id.localeCompare(b.id);
  });
}
function endLabel(item) {
  if (item.end) {
    const ms = Date.parse(item.end)-Date.now();
    if (ms<=0) return {label:'Ended',className:'ended'};
    const min = Math.floor(ms/60000), hours=Math.floor(min/60), days=Math.floor(hours/24);
    return {label: days ? `${days}d ${hours%24}h left` : hours ? `${hours}h ${min%60}m left` : min ? `${min}m left` : 'Under 1m left',className:ms<3600000?'urgent critical':ms<86400000?'urgent':''};
  }
  return {label:item.endDate ? `${item.endDate<today()?'Ended':'Ends'} ${shortDate(item.endDate)} · time unavailable`:'Check closing time',className:item.endDate && item.endDate<today()?'ended':''};
}
function card(item) {
  const end=endLabel(item), inTrash=state.view==='trash', below=discount(item), categories=(item.categories||[]).slice(0,2).join(' / ')||'Uncategorized';
  const fav=state.favorites.has(item.id);
  const image=item.image?`<img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<span class="placeholder-image">${icon('box')}<span>Photo unavailable</span></span>`;
  const tooltip=`${item.end?`Ends ${stamp(item.end)}`:'Exact closing time unavailable; check sliBuy.'} · Bid snapshot: ${item.scannedAt?stamp(item.scannedAt):'time unavailable'}`;
  const actions=inTrash?'':`<div class="card-actions"><button class="fav-item${fav?' on':''}" data-fav="${esc(item.id)}" aria-pressed="${fav}" aria-label="${fav?'Remove auction '+esc(item.id)+' from favorites':'Save auction '+esc(item.id)+' to favorites'}" title="${fav?'Saved to your favorites — click to remove':'Save to your favorites'}">${icon('star',fav)}</button><button class="trash-item" data-trash="${esc(item.id)}" aria-label="Trash auction ${esc(item.id)}" title="Hide this auction in your browser">${icon('trash')}</button></div>`;
  const staleNote=item.stale?`<p class="stale-note">${icon('clock')} Not in the latest scan · saved ${esc(shortStamp(item.savedAt))}. Price and time are from when you saved it.</p>`:'';
  const priceTag=/starting/i.test(item.priceLabel)?'STARTING PRICE':/snapshot/i.test(item.priceLabel)||item.stale?'PRICE SNAPSHOT':'SNAPSHOT BID';
  return `<article class="auction-card${fav?' is-fav':''}${item.stale?' is-stale':''}" data-id="${esc(item.id)}"><div class="product-photo"><a class="photo-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="View auction ${esc(item.id)}: ${esc(item.title)} (opens sliBuy)">${image}</a><span class="condition-badge ${/appears new/i.test(item.condition||'')?'appears-new':''}">${esc(item.condition||'Condition unknown')}</span>${actions}<span class="end-badge ${end.className}" data-end-id="${esc(item.id)}" title="${esc(tooltip)}">${icon('clock')}<span>${esc(end.label)}</span></span>${below!==null&&below>0?`<span class="deal-badge${below>=75?' big':''}">${Math.floor(below)}% off<span class="deal-msrp"> MSRP</span></span>`:''}</div><div class="card-body"><p class="card-category" title="${esc(item.category)}"><span class="cond-inline">${esc(item.condition||'')} · </span>${esc(categories)}</p><h3 class="card-title"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" title="${esc(item.title)}">${esc(item.title)}</a></h3>${staleNote}<div class="bid-row"><div class="bid-info" title="${esc(item.scannedAt?`Bids captured during scan started ${stamp(item.scannedAt)}`:'Capture time unavailable')}"><small>${priceTag}</small><strong>${currency(item.price)}</strong></div><div class="msrp-info">${item.msrp!==null&&item.msrp!==undefined?`MSRP <b>${currency(item.msrp)}</b>`:'No MSRP listed'}</div></div>${inTrash?`<button class="restore-item" data-restore="${esc(item.id)}">${icon('restore')} Restore auction</button>`:`<a class="auction-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">View on sliBuy ${icon('external')}</a>`}<div class="card-bottom"><span>${icon('pin')}${esc(item.location||'Check pickup location')}</span><span>#${esc(item.id)}</span></div></div></article>`;
}
function imageFallbacks() {
  $('auctionGrid').querySelectorAll('img').forEach(img => img.addEventListener('error',()=>{
    if (!img.dataset.retried && img.src.includes('/product/') && !img.src.includes('/product/thumbnail/')) { img.dataset.retried='true'; img.src=img.src.replace('/product/','/product/thumbnail/'); }
    else { const span=document.createElement('span');span.className='placeholder-image';span.innerHTML=`${icon('box')}<span>Photo unavailable</span>`;img.replaceWith(span); }
  }));
}
/* ---------- Quick picks: one-tap presets on top of the regular filters ---------- */
const PICKS = {
  soon:{on:()=>state.soon, toggle:on=>{state.soon=on;}},
  cheap:{on:()=>state.max==='10'&&state.min==='', toggle:on=>{state.max=on?'10':'';if(on)state.min='';}},
  deal:{on:()=>state.savings===75, toggle:on=>{state.savings=on?75:0;}},
  highmsrp:{on:()=>state.msrpMin===300, toggle:on=>{state.msrpMin=on?300:'';}}
};
function renderPicks() {
  document.querySelectorAll('[data-pick]').forEach(button => { const on=PICKS[button.dataset.pick].on(); button.classList.toggle('active',on); button.setAttribute('aria-pressed',String(on)); });
}
function activeFilterCount() {
  return [state.category,state.condition,state.location,state.min!==''||state.max!=='',state.savings,state.msrpMin!=='',state.soon,state.showEnded].filter(Boolean).length;
}
function renderChips() {
  const chips=[];
  if (state.query) chips.push(['query',`Search: ${state.query}`]);
  if (state.category) chips.push(['category',state.category]);
  if (state.condition) chips.push(['condition',state.condition]);
  if (state.min!==''||state.max!=='') chips.push(['price',`Bid: ${state.min!==''?currency(Number(state.min)):'$0'} – ${state.max!==''?currency(Number(state.max)):'any'}`]);
  if (state.savings) chips.push(['savings',`${state.savings}%+ below MSRP`]);
  if (state.msrpMin!=='') chips.push(['msrpMin',`MSRP ${currency(Number(state.msrpMin))}+`]);
  if (state.soon) chips.push(['soon','Ends within 1 hour']);
  if (state.location) chips.push(['location',state.location]);
  if (state.showEnded) chips.push(['showEnded','Including ended']);
  $('activeFilters').innerHTML=chips.map(([key,label])=>`<button data-remove="${key}" aria-label="Remove filter: ${esc(label)}">${esc(label)}${icon('close')}</button>`).join('')+(chips.length>1?`<button class="clear-all" data-remove="all">Clear all</button>`:'');
  const n=activeFilterCount();$('filterCount').hidden=!n;$('filterCount').textContent=n;
}
function render() {
  const focused=document.activeElement;
  const categoryFocus=focused?.dataset?.category;
  const gridFocus=$('auctionGrid').contains(focused);
  const cardIndex=gridFocus?[...$('auctionGrid').querySelectorAll('.auction-card')].indexOf(focused.closest('.auction-card')):-1;
  const itemFocus=gridFocus?{id:focused.closest('.auction-card')?.dataset.id,action:focused.hasAttribute('data-trash')?'trash':focused.hasAttribute('data-restore')?'restore':focused.hasAttribute('data-fav')?'fav':'link'}:null;
  const chipFocus=focused?.dataset?.remove;
  const visible=state.items.filter(item=>!state.trashed.has(item.id)&&!isEnded(item));
  $('statTotal').textContent=state.data?visible.length.toLocaleString():'—';
  $('statToday').textContent=state.data?visible.filter(isToday).length.toLocaleString():'—';
  $('allCount').textContent=state.data?state.items.filter(item=>!state.trashed.has(item.id)&&(state.showEnded||!isEnded(item))).length.toLocaleString():'—';
  $('todayCount').textContent=state.data?visible.filter(isToday).length.toLocaleString():'—';
  ['trashCount','headerTrashCount'].forEach(id=>$(id).textContent=state.trashed.size.toLocaleString());
  ['favoritesCount','headerFavoritesCount','statFavorites'].forEach(id=>$(id).textContent=state.favorites.size.toLocaleString());
  $('headerFavorites').classList.toggle('has-items',state.favorites.size>0);
  document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===state.view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-jump]').forEach(button=>button.classList.toggle('active',button.dataset.jump===state.view));
  const title=state.category || ({all:'All auctions',today:'Ending today',favorites:'Your favorites',trash:'My trash'})[state.view];
  $('resultsTitle').firstChild.textContent=title+' ';
  $('resultsEyebrow').textContent=state.view==='trash'?'A LITTLE LESS CLUTTER':state.view==='today'?'LAST CHANCE FINDS':state.view==='favorites'?'SAVED IN THIS BROWSER':'THE GOOD STUFF';
  $('restoreAll').hidden=state.view!=='trash'||!state.trashed.size;
  $('clearFavorites').hidden=state.view!=='favorites'||!state.favorites.size;
  $('auctionGrid').setAttribute('aria-busy',String(state.loading));
  $('auctionGrid').classList.toggle('list-layout',state.layout==='list');
  $('priceError').hidden=!(state.min!==''&&state.max!==''&&Number(state.max)<Number(state.min));
  renderCategories();renderChips();renderPicks();notice();
  if (state.loading&&!state.data) {
    $('auctionGrid').innerHTML=Array.from({length:6},()=>'<div class="skeleton" aria-hidden="true"></div>').join('');
    $('emptyState').hidden=true;$('loadMore').hidden=true;$('pageProgress').textContent='';return;
  }
  const matches=filteredItems(), count=matches.length;
  $('resultCount').textContent=state.data||state.view==='favorites'?`(${count.toLocaleString()})`:'';
  const staleCount=state.view==='favorites'?matches.filter(item=>item.stale).length:0;
  $('showingText').textContent=state.error&&!state.data&&state.view!=='favorites'?'The source sheet is unavailable.'
    :state.view==='trash'?`${count.toLocaleString()} matching auctions from this scan · ${state.trashed.size} IDs saved in your trash`
    :state.view==='favorites'?`${count.toLocaleString()} of ${state.favorites.size.toLocaleString()} saved favorites${staleCount?` · ${staleCount} not in the latest scan`:''}`
    :`Showing ${Math.min(state.limit,count).toLocaleString()} of ${count.toLocaleString()} finds · bids are a scan-time snapshot`;
  $('auctionGrid').innerHTML=matches.slice(0,state.limit).map(card).join('');imageFallbacks();
  $('emptyState').hidden=count>0;
  const noFavs=state.view==='favorites'&&!state.favorites.size;
  $('emptyIcon').innerHTML=icon(noFavs?'star':state.view==='trash'?'trash':'search');
  $('emptyTitle').textContent=state.error&&!state.data&&state.view!=='favorites'?'Let’s reconnect your finds':noFavs?'No favorites yet.':state.view==='trash'?'A clean slate.':state.view==='today'?'No more finds ending today.':'No finds match just yet.';
  $('emptyMessage').textContent=state.error&&!state.data&&state.view!=='favorites'?'This page needs public read-only access to your Google Sheet. Check the sheet’s sharing and your connection, then try again.'
    :noFavs?'Tap the star on any auction to save it here. Favorites are kept in this browser and stay listed even after they drop out of the next scan.'
    :state.view==='trash'?'Trashed auctions from the current scan will appear here. Trashed IDs from older scans stay hidden if they return.'
    :!state.items.length&&state.view!=='favorites'?'The sheet is connected, but there are no auction rows yet. Run the scanner, then refresh.'
    :'Try a different keyword, another category, or a wider bid range. You can also include ended auctions.';
  $('emptyAction').textContent=state.error&&!state.data&&state.view!=='favorites'?'Retry connection':noFavs?'Browse all auctions':!state.items.length&&state.view!=='favorites'?'Refresh auctions':state.view==='trash'?'Back to all auctions':'Clear filters';
  $('loadMore').hidden=state.limit>=count;
  $('pageProgress').textContent=count>CONFIG.pageSize?`${Math.min(state.limit,count).toLocaleString()} / ${count.toLocaleString()} finds`:'';
  // Rendering replaces controls: keep the keyboard user's place in the new DOM.
  if(categoryFocus!==undefined) [...$('categoryList').querySelectorAll('button')].find(button=>button.dataset.category===categoryFocus)?.focus({preventScroll:true});
  else if(itemFocus){
    const cards=[...$('auctionGrid').querySelectorAll('.auction-card')];
    const next=cards.find(el=>el.dataset.id===itemFocus.id)||cards[Math.min(cardIndex,cards.length-1)];
    const selector=itemFocus.action==='trash'?'[data-trash]':itemFocus.action==='restore'?'[data-restore]':itemFocus.action==='fav'?'[data-fav]':'a';
    (next?.querySelector(selector)||next?.querySelector('a')||$('emptyAction')).focus({preventScroll:true});
  } else if(chipFocus) ($('activeFilters').querySelector('button')||$('search')).focus({preventScroll:true});
}
/** After a filter / view change, bring the top of the results back into view if the user had scrolled past it. */
function resultsToTop() {
  const top=$('results').getBoundingClientRect().top;
  const sticky=document.querySelector('.browse-head')?.getBoundingClientRect().height||0;
  if (top < sticky) window.scrollTo({top:window.scrollY+top-sticky-12,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function syncInputs() {
  $('search').value=state.query;$('condition').value=state.condition;$('location').value=state.location;
  $('minPrice').value=state.min;$('maxPrice').value=state.max;$('savings').value=state.savings;$('showEnded').checked=state.showEnded;$('sort').value=state.sort;
}
function resetFilters() { Object.assign(state,{category:'',query:'',condition:'',location:'',min:'',max:'',savings:0,msrpMin:'',soon:false,showEnded:false,limit:CONFIG.pageSize});syncInputs();render(); }
function setView(view) {state.view=view;state.limit=CONFIG.pageSize;render();resultsToTop();}
function goToView(view) {
  state.view=view;state.limit=CONFIG.pageSize;render();
  const head=document.querySelector('.browse-head');
  window.scrollTo({top:window.scrollY+$('browse').getBoundingClientRect().top-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  head?.querySelector(`[data-view="${view}"]`)?.focus({preventScroll:true});
}
async function refresh() {
  if (state.loading) return;
  state.loading=true;lastAttempt=Date.now();$('refreshButton').disabled=true;$('refreshButton').classList.add('loading');render();
  try {
    const data=await loadAuctions(CONFIG);state.data=data;state.items=data.items;state.error=null;
    $('scanTime').textContent=shortStamp(data.scannedAt);$('scanTime').title=`Scan started ${stamp(data.scannedAt)}. Bids were collected during that scan.`;
    $('sheetLink').href=data.sheetUrl;renderOptions();
    // Keep saved favorites' snapshots current while they are still in the scan.
    let changed=false;
    for (const item of data.items) if (state.favorites.has(item.id)) { state.favorites.set(item.id,snapshotOf({...item,savedAt:state.favorites.get(item.id).savedAt})); changed=true; }
    if (changed) saveFavorites();
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
    if ((state.data||state.favorites.size)&&!state.loading) {
      if($('auctionGrid').contains(document.activeElement)||$('categoryList').contains(document.activeElement)){
        const all=[...state.items,...favoriteItems()];
        $('auctionGrid').querySelectorAll('[data-end-id]').forEach(badge=>{
          const item=all.find(item=>item.id===badge.dataset.endId);if(!item)return;
          const end=endLabel(item);badge.className=`end-badge ${end.className}`;badge.lastElementChild.textContent=end.label;
        });
      }else render();
    }
  }
  if (day!==previousDay) {previousDay=day;if(!document.hidden)refresh();}
}
function hideFilters() {$('filters').classList.remove('open');$('filters').removeAttribute('role');$('filters').removeAttribute('aria-modal');$('openFilters').setAttribute('aria-expanded','false');$('filterBackdrop').hidden=true;document.body.style.overflow='';}
function findItem(id) { return state.items.find(item=>item.id===id) || (state.favorites.has(id)?{...state.favorites.get(id),stale:true}:null); }
function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    const previous=state.favorites.get(id);
    state.favorites.delete(id);saveFavorites();render();
    toast('Removed from your favorites.',()=>{state.favorites.set(id,previous);saveFavorites();render();});
  } else {
    const item=findItem(id);if(!item)return;
    state.favorites.set(id,snapshotOf(item));saveFavorites();render();
    toast('Saved to your favorites.',()=>{state.favorites.delete(id);saveFavorites();render();});
  }
}

$('refreshButton').addEventListener('click',refresh);
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>goToView(button.dataset.jump)));
$('headerTrash').addEventListener('click',()=>goToView('trash'));
$('headerFavorites').addEventListener('click',()=>goToView('favorites'));
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=$('search').value;state.limit=CONFIG.pageSize;render();resultsToTop();},160);});
for (const [id,key] of [['condition','condition'],['location','location'],['minPrice','min'],['maxPrice','max'],['savings','savings'],['showEnded','showEnded'],['sort','sort']]) {
  $(id).addEventListener(id==='minPrice'||id==='maxPrice'?'input':'change',()=>{
    state[key]=id==='showEnded'?$(id).checked:id==='savings'?Number($(id).value):$(id).value;state.limit=CONFIG.pageSize;
    if(key==='sort')savePrefs();
    render();if(id!=='minPrice'&&id!=='maxPrice')resultsToTop();
  });
}
document.querySelectorAll('[data-pick]').forEach(button=>button.addEventListener('click',()=>{
  const pick=PICKS[button.dataset.pick];pick.toggle(!pick.on());state.limit=CONFIG.pageSize;syncInputs();render();resultsToTop();
}));
$('categoryList').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(button){state.category=button.dataset.category;state.limit=CONFIG.pageSize;render();if(window.innerWidth>800)resultsToTop();}});
$('activeFilters').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove]');if(!button)return;
  const key=button.dataset.remove;
  if(key==='all'){resetFilters();return;}
  if(key==='price'){state.min='';state.max='';}else state[key]=key==='savings'?0:key==='showEnded'||key==='soon'?false:'';
  state.limit=CONFIG.pageSize;syncInputs();render();
});
$('resetFilters').addEventListener('click',resetFilters);
$('emptyAction').addEventListener('click',()=>{
  if(state.view==='favorites'&&!state.favorites.size){resetFilters();setView('all');}
  else if(state.view!=='favorites'&&(state.error&&!state.data||!state.items.length))refresh();
  else if(state.view==='trash'){resetFilters();setView('all');}
  else resetFilters();
});
$('loadMore').addEventListener('click',()=>{state.limit+=CONFIG.pageSize;render();});
$('auctionGrid').addEventListener('click',event=>{
  const fav=event.target.closest('[data-fav]'), trash=event.target.closest('[data-trash]'), restore=event.target.closest('[data-restore]');
  if(fav){toggleFavorite(fav.dataset.fav);return;}
  if(trash){
    const id=trash.dataset.trash, wasFav=state.favorites.get(id);
    state.trashed.add(id);if(wasFav){state.favorites.delete(id);saveFavorites();}
    saveTrash();render();
    toast(wasFav?'Moved to your trash and removed from favorites.':'Auction moved to your trash.',()=>{state.trashed.delete(id);if(wasFav){state.favorites.set(id,wasFav);saveFavorites();}saveTrash();render();});
  }
  if(restore){const id=restore.dataset.restore;state.trashed.delete(id);saveTrash();render();toast('Auction restored to your finds.',()=>{state.trashed.add(id);saveTrash();render();});}
});
$('restoreAll').addEventListener('click',()=>{const previous=new Set(state.trashed);state.trashed.clear();saveTrash();render();toast('All trashed auctions restored.',()=>{previous.forEach(id=>state.trashed.add(id));saveTrash();render();});});
$('clearFavorites').addEventListener('click',()=>{const previous=new Map(state.favorites);state.favorites.clear();saveFavorites();render();toast('All favorites cleared.',()=>{state.favorites=previous;saveFavorites();render();});});
$('undoButton').addEventListener('click',()=>{undoAction?.();$('toast').hidden=true;clearTimeout(toastTimer);});
$('dismissToast').addEventListener('click',()=>{$('toast').hidden=true;clearTimeout(toastTimer);});
function setLayout(layout){state.layout=layout;for(const name of ['grid','list']){$(name+'View').classList.toggle('active',name===layout);$(name+'View').setAttribute('aria-pressed',String(name===layout));}}
for (const layout of ['grid','list']) $(layout+'View').addEventListener('click',()=>{setLayout(layout);savePrefs();render();});
$('openFilters').addEventListener('click',()=>{$('filters').classList.add('open');$('filters').setAttribute('role','dialog');$('filters').setAttribute('aria-modal','true');$('openFilters').setAttribute('aria-expanded','true');$('filterBackdrop').hidden=false;document.body.style.overflow='hidden';$('closeFilters').focus();});
$('closeFilters').addEventListener('click',()=>{hideFilters();$('openFilters').focus();});
$('filterBackdrop').addEventListener('click',hideFilters);
$('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());
$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());
$('aboutDialog').addEventListener('click',event=>{if(event.target===$('aboutDialog')){const r=$('aboutDialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('aboutDialog').close();}});
$('backToTop').addEventListener('click',()=>{window.scrollTo({top:window.scrollY+$('browse').getBoundingClientRect().top-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});$('search').focus({preventScroll:true});});
// Pin the desktop filter column just under the sticky search / tabs bar.
const headSize=()=>document.documentElement.style.setProperty('--head-h',`${Math.round(document.querySelector('.browse-head').getBoundingClientRect().height)}px`);
new ResizeObserver(headSize).observe(document.querySelector('.browse-head'));headSize();
let scrollTick=false;
window.addEventListener('scroll',()=>{if(scrollTick)return;scrollTick=true;requestAnimationFrame(()=>{scrollTick=false;
  $('backToTop').hidden=window.scrollY<1100;
  document.querySelector('.browse-head').classList.toggle('stuck',$('browse').getBoundingClientRect().top<=0);
});},{passive:true});
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
window.addEventListener('storage',event=>{
  if(event.key===STORAGE_KEY){state.trashed=readTrash();render();}
  if(event.key===FAV_KEY){state.favorites=readFavorites();render();}
});
window.addEventListener('resize',()=>{if(window.innerWidth>800&&$('filters').classList.contains('open'))hideFilters();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateTimers();if(Date.now()-lastAttempt>CONFIG.pollIntervalMs)refresh();}});
setLayout(state.layout);syncInputs();
setInterval(()=>{if(!document.hidden)refresh();},CONFIG.pollIntervalMs);
setInterval(updateTimers,1000);
updateTimers();refresh();

/** Public, credential-free Google Sheets reader. No Apps Script or API key is used. */
export const CENTRAL_ZONE = 'America/Chicago';
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CENTRAL_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function centralParts(date = new Date()) {
  const result = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  return result;
}

/** Interpret spreadsheet wall-clock fields in Central time, including DST. */
export function centralWallDate(year, month, day, hour = 0, minute = 0, second = 0) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = centralParts(new Date(instant));
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const adjustment = target - represented;
    instant += adjustment;
    if (!adjustment) break;
  }
  return new Date(instant);
}

export function centralDayKey(date = new Date()) {
  const p = centralParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** The next 7 AM America/Chicago, rather than a fixed UTC offset. */
export function nextRefresh(now = new Date()) {
  const p = centralParts(now);
  let next = centralWallDate(p.year, p.month, p.day, 7);
  if (next <= now) {
    const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
    next = centralWallDate(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), 7);
  }
  return next;
}

export function parseCentralDate(value) {
  if (value instanceof Date) return Number.isNaN(+value) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    // Sheets serial dates have no time zone: their fields are Central wall time.
    if (value > 0 && value < 200000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
      return centralWallDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
    }
    return null;
  }
  const text = String(value).trim();
  let m = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}))?(?:,(\d{1,2}))?(?:,(\d{1,2}))?(?:,\d+)?\)$/.exec(text);
  if (m) return centralWallDate(+m[1], +m[2] + 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  // Explicit offsets / GMT strings already identify an absolute instant.
  if (/GMT|(?:Z|[+-]\d\d:?\d\d)$/i.test(text)) {
    const d = new Date(text);
    return Number.isNaN(+d) ? null : d;
  }
  m = /^(?:[A-Za-z]+\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(text);
  if (m) {
    let hour = +(m[4] || 0);
    if (m[7]) hour = hour % 12 + (m[7].toUpperCase() === 'PM' ? 12 : 0);
    return centralWallDate(+m[3], +m[1], +m[2], hour, +(m[5] || 0), +(m[6] || 0));
  }
  m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d)(?:\.\d+)?)?)?$/.exec(text);
  if (m) return centralWallDate(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return null;
}

/** RFC 4180 CSV, including quoted commas, quotes, newlines and a BOM. */
export function parseCSV(input) {
  const text = String(input).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('The sheet returned incomplete CSV data.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function cell(value) {
  if (value && typeof value === 'object' && 'v' in value) return value.v ?? value.f ?? '';
  return value ?? '';
}
function text(value) { return String(cell(value)).trim(); }
function money(value) {
  const raw = cell(value);
  if (raw === '' || raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
  const numeric = Number(String(raw).replace(/[$,\s]/g, ''));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}
function msrpFromTitle(title) {
  const match = /\$\s*([\d,]+(?:\.\d+)?)\s*MSRP\b/i.exec(title) || /\bMSRP\s*(?:of|:|-)?\s*\$\s*([\d,]+(?:\.\d+)?)/i.exec(title);
  return match ? money(match[1]) : null;
}
function safeImage(value) {
  const raw = text(value);
  const image = /^=IMAGE\(\s*"((?:[^"]|"")+)"/i.exec(raw);
  const candidate = image ? image[1].replace(/""/g, '"') : raw;
  try { const url = new URL(candidate); return /^https?:$/.test(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function idFrom(value) {
  const raw = text(value);
  const match = /^(?:Auction\s*#?\s*)?(\d+)$/i.exec(raw) || /[?&]searchbar=(\d+)/.exec(raw);
  return match ? match[1] : '';
}
function headerKey(value) { return text(value).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function mergeItem(existing, incoming) {
  if (!existing) return incoming;
  return {
    ...existing,
    categories: unique([...existing.categories, ...incoming.categories]),
    category: unique([...existing.categories, ...incoming.categories]).join(', '),
    collections: unique([...existing.collections, ...incoming.collections]),
    image: existing.image || incoming.image,
    condition: existing.condition || incoming.condition,
    scannedAt: existing.scannedAt || incoming.scannedAt
  };
}

/** Accept a Gviz table, its response object, or CSV rows. */
export function parseSheet(input, options = {}) {
  const table = input?.table || input;
  const rows = Array.isArray(table) ? [...table] : (table?.rows || []).map(row => row.c || []);
  let headerIndex = rows.findIndex(row => {
    const keys = row.map(headerKey);
    return keys.includes('auctionid') && keys.includes('title') || keys.includes('auctionlink') && keys.includes('title');
  });
  // Gviz may promote the first header row to column labels even with headers=0.
  if (headerIndex === -1 && table?.cols?.length) {
    const labels = table.cols.map(col => col.label || '');
    const keys = labels.map(headerKey);
    if ((keys.includes('auctionid') || keys.includes('auctionlink')) && keys.includes('title')) {
      rows.unshift(labels); headerIndex = 0;
    }
  }
  if (headerIndex === -1) throw new Error(`The ${options.sheet || 'auction'} tab does not contain the expected auction columns.`);
  const keys = rows[headerIndex].map(headerKey);
  const raw = keys.includes('auctionid');
  const index = (...names) => keys.findIndex(key => names.includes(key));
  const columns = {
    id: index('auctionid', 'auctionlink'), title: index('title'),
    end: index('end', 'endsdatetime', 'enddate', 'ends'), price: index('price', 'currentbid'),
    msrp: index('msrp'), condition: index('condition'), category: index('category', 'categories'),
    image: index('imageurl', 'photo', 'image'), location: index('location'), priceLabel: index('pricelabel')
  };
  // Google discards text headers in predominantly numeric/date columns.
  // The scanner's report schema is stable even when C5/D5/E5 become null.
  if (!raw && keys.includes('auctionlink') && keys.includes('title')) {
    if (columns.end < 0) columns.end = 2;
    if (columns.price < 0) columns.price = 3;
    if (columns.msrp < 0) columns.msrp = 4;
  }
  let scannedAt = null;
  for (const row of rows.slice(0, headerIndex)) {
    const labelIndex = row.findIndex(value => /^last\s+scan\s*:/i.test(text(value)));
    if (labelIndex >= 0) scannedAt = parseCentralDate(cell(row[labelIndex + 1]))?.toISOString() || null;
  }
  const heading = rows.slice(0, headerIndex).flat().map(text).join(' ');
  const condition = options.condition || (/Appears New/i.test(heading) ? 'Appears New' : /Factory Sealed/i.test(heading) ? 'Factory Sealed' : '');
  const collection = options.label || options.sheet || (raw ? 'All scanned auctions' : 'Auction report');
  const byId = new Map();
  let skippedRows = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const id = idFrom(row[columns.id]);
    if (!id) continue; // Decorative day headers and empty-state copy are not auctions.
    const title = text(row[columns.title]);
    if (!title) { skippedRows++; continue; }
    const endValue = cell(row[columns.end]);
    const parsedEnd = parseCentralDate(endValue);
    // Raw Sheets columns inferred as `date` lose their clock fields in Gviz.
    // Keep the day separately; never pretend that an unknown close time is midnight.
    const dateOnly = raw && typeof endValue === 'string' &&
      (/^Date\(\d{4},\d{1,2},\d{1,2}\)$/.test(endValue) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(endValue) || /^\d{4}-\d{2}-\d{2}$/.test(endValue));
    const end = dateOnly ? null : parsedEnd;
    const categories = unique(text(row[columns.category]).split(/\s*,\s*/));
    const item = {
      id, title, end: end?.toISOString() || null,
      endDate: parsedEnd ? centralDayKey(parsedEnd) : null,
      condition: text(row[columns.condition]) || condition || 'Not specified',
      category: categories.join(', '), categories,
      price: money(row[columns.price]),
      msrp: money(row[columns.msrp]) ?? msrpFromTitle(title),
      image: safeImage(row[columns.image]),
      url: `https://www.slibuy.com/search?searchbar=${encodeURIComponent(id)}`,
      location: text(row[columns.location]),
      priceLabel: text(row[columns.priceLabel]) || 'Current bid',
      scannedAt, collections: [collection]
    };
    byId.set(id, mergeItem(byId.get(id), item));
  }
  const hasFilters = !raw && rows[1]?.some(value => /^Category$/i.test(text(value))) && rows[2] &&
    (text(rows[2][0]) && !/^all(?: categories)?$/i.test(text(rows[2][0])) || rows[2].slice(2, 6).some(value => text(value) !== ''));
  return {items: [...byId.values()], scannedAt, raw, skippedRows, hasFilters: !!hasFilters};
}

function parseGviz(body) {
  // The JSON is wrapped in google.visualization.Query.setResponse(...).
  // Parse only JSON; never execute spreadsheet-provided JavaScript.
  const marker = 'google.visualization.Query.setResponse(';
  const start = body.indexOf(marker);
  if (start < 0) throw new Error('The sheet is not publicly readable.');
  const end = body.lastIndexOf(')');
  const result = JSON.parse(body.slice(start + marker.length, end));
  if (result.status === 'error' || !result.table) throw new Error('The sheet feed is unavailable. Check public viewer access and the tab name.');
  return result;
}

async function fetchTab(config, source, fetcher) {
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.sheetId)}/gviz/tq`;
  const params = new URLSearchParams({tqx: 'out:json', headers: source.raw ? '1' : '0', tq: 'select *', _: String(Date.now())});
  if (source.sheet) params.set('sheet', source.sheet);
  else if (source.gid !== undefined) params.set('gid', String(source.gid));
  else throw new Error('Configure an auction sheet name.');
  const request = async format => {
    params.set('tqx', `out:${format}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs || 12000);
    try {
      const response = await fetcher(`${base}?${params}`, {signal: controller.signal, credentials: 'omit', cache: 'no-store'});
      if (!response.ok) throw new Error(`Sheet request failed (${response.status}).`);
      const body = await response.text();
      if (body.trimStart().startsWith('<')) throw new Error('The sheet requires sign-in or is unavailable.');
      return parseSheet(format === 'json' ? parseGviz(body) : parseCSV(body), source);
    } finally { clearTimeout(timer); }
  };
  try { return await request('json'); }
  catch (error) {
    if (config.csvFallback === false) throw error;
    return request('csv');
  }
}

/** Load the scanner's public report tabs, optionally enriching from its raw buffer. */
export async function loadAuctions(config, fetcher = fetch) {
  if (!/^[A-Za-z0-9_-]+$/.test(config.sheetId || '')) throw new Error('Add a valid spreadsheet ID in config.js.');
  const sources = config.sources?.length ? config.sources : [{sheet: 'Factory Sealed Report', label: 'Factory sealed'}];
  const requests = [...sources];
  if (config.rawSheet) requests.push({sheet: config.rawSheet, label: 'All scanned auctions', raw: true});
  const results = await Promise.allSettled(requests.map(source => fetchTab(config, source, fetcher)));
  const warnings = [];
  const reports = [];
  let rawResult = null;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      if (i >= sources.length) rawResult = result.value;
      else reports.push({...result.value, source: sources[i]});
    } else if (i < sources.length) warnings.push(`${sources[i].label || sources[i].sheet}: unable to read this report.`);
  });
  if (!reports.length && !(config.useRawBuffer && rawResult)) {
    throw new Error('Cannot read the auction sheet. Set its sharing to “Anyone with the link” → Viewer, then retry. Also check the spreadsheet ID and report tab names in config.js.');
  }
  const byId = new Map();
  for (const report of reports) for (const item of report.items) byId.set(item.id, mergeItem(byId.get(item.id), item));
  if (rawResult) {
    for (const rawItem of rawResult.items) {
      const reportItem = byId.get(rawItem.id);
      if (!reportItem && !config.useRawBuffer) continue;
      byId.set(rawItem.id, {
        ...rawItem,
        // The report price belongs to its Last scan timestamp. While a scan is
        // running the buffer may already contain newer prices, so use it only
        // for missing report prices and items absent from the reports.
        price: reportItem?.price ?? rawItem.price,
        priceLabel: reportItem?.price !== null && reportItem?.price !== undefined && reportItem.price !== rawItem.price ? 'Price snapshot' : rawItem.priceLabel,
        end: reportItem?.end || rawItem.end,
        endDate: reportItem?.endDate || rawItem.endDate,
        scannedAt: reportItem?.price !== null && reportItem?.price !== undefined ? reportItem.scannedAt : null,
        collections: reportItem?.collections || rawItem.collections,
        categories: unique([...rawItem.categories, ...(reportItem?.categories || [])]),
        category: unique([...rawItem.categories, ...(reportItem?.categories || [])]).join(', ')
      });
    }
  } else if (config.rawSheet) warnings.push('Raw image links are unavailable; some auction photos may be missing.');
  if (reports.some(report => report.hasFilters) && !config.useRawBuffer) warnings.push('The spreadsheet report has filters applied. Clear them in the sheet to include every scanned auction.');
  const scanTimes = unique(reports.map(report => report.scannedAt)).sort();
  const scannedAt = scanTimes[0] || null;
  if (!scannedAt) warnings.push('The source sheet did not provide a scan timestamp.');
  else if ([...byId.values()].some(item => !item.scannedAt)) warnings.push('Some prices come from the raw scan feed without a capture timestamp. Their auction tooltips show that the time is unavailable.');
  if (scanTimes.length > 1) warnings.push('Report scan times differ. The displayed capture time is the oldest report; auction details show each available time.');
  return {
    items: [...byId.values()], scannedAt, scanTimes,
    fetchedAt: new Date().toISOString(), warnings,
    source: config.useRawBuffer && rawResult ? 'scan buffer' : 'public reports',
    sheetUrl: `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`,
    reportCount: reports.length
  };
}

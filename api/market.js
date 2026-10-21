// Intermediário de dados de mercado: esconde as chaves e partilha a cache entre todos os leitores.
const TD = 'https://api.twelvedata.com';
const AV = 'https://www.alphavantage.co/query';
// Tempo de cache (segundos) por pedido, partilhado na CDN da Vercel
const TTL = {
  search_symbol: 86400, get_quote: 120, get_time_series: 21600,
  get_dividends: 86400, get_statistics: 86400, get_company_info: 604800,
  DIVIDENDS: 86400, ETF_PROFILE: 86400
};
const SAFE = /^[A-Za-z0-9.\/\-: &]{1,40}$/;

function qs(o) {
  return Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}
async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'daily-alpha' } });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { status: 'error', message: t.slice(0, 300) }; }
}

async function twelve(tool, i) {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return { status: 'error', message: 'Falta configurar TWELVE_DATA_API_KEY.' };
  const base = { symbol: i.symbol, mic_code: i.mic_code, apikey: key };
  if (tool === 'search_symbol') {
    const j = await getJSON(`${TD}/symbol_search?${qs({ symbol: i.symbol, outputsize: Math.min(+i.outputsize || 15, 30), apikey: key })}`);
    if (j.status === 'error') return j;
    let data = Array.isArray(j.data) ? j.data : [];
    if (i.instrument_type) {
      const f = String(i.instrument_type).toLowerCase();
      data = data.filter(d => String(d.instrument_type || '').toLowerCase().includes(f === 'stock' ? 'stock' : f));
    }
    return data;
  }
  if (tool === 'get_quote') {
    const j = await getJSON(`${TD}/quote?${qs(base)}`);
    if (j.status === 'error' || j.code) return j;
    const fw = j.fifty_two_week || {};
    return [{ ...j, fifty_two_week: undefined, fifty_two_week_low: fw.low, fifty_two_week_high: fw.high }];
  }
  if (tool === 'get_time_series') {
    const j = await getJSON(`${TD}/time_series?${qs({ ...base, interval: '1day', outputsize: Math.min(+i.outputsize || 30, 5000) })}`);
    if (j.status === 'error' || j.code) return j;
    return Array.isArray(j.values) ? j.values : [];
  }
  if (tool === 'get_dividends') return getJSON(`${TD}/dividends?${qs({ ...base, range: 'full' })}`);
  if (tool === 'get_statistics') return getJSON(`${TD}/statistics?${qs(base)}`);
  if (tool === 'get_company_info') return getJSON(`${TD}/profile?${qs(base)}`);
  return { status: 'error', message: 'Pedido desconhecido.' };
}

async function alpha(tool, i) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return { Information: 'Falta configurar ALPHA_VANTAGE_API_KEY.' };
  return getJSON(`${AV}?${qs({ function: tool, symbol: i.symbol, apikey: key })}`);
}

function isError(server, out) {
  if (server === 'td') {
    try { const j = JSON.parse(out.result); return !!(j && !Array.isArray(j) && (j.status === 'error' || j.code)); } catch { return true; }
  }
  return !!(out && (out.Information || out.Note || out['Error Message'] || out.error));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'method' }); return; }
  const { server, tool } = req.query;
  let input = {};
  try { input = JSON.parse(req.query.input || '{}') || {}; } catch { input = {}; }
  if (!TTL[tool] || (server !== 'td' && server !== 'av') || !SAFE.test(String(input.symbol || ''))) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  if (input.mic_code && !/^[A-Z0-9_]{2,20}$/.test(input.mic_code)) delete input.mic_code;
  try {
    const out = server === 'td' ? { result: JSON.stringify(await twelve(tool, input)) } : await alpha(tool, input);
    const err = isError(server, out);
    const plan = err && /plan|upgrade|premium|exclusively/i.test(JSON.stringify(out));
    res.setHeader('Cache-Control', !err ? `public, s-maxage=${TTL[tool]}, stale-while-revalidate=${TTL[tool]}` : plan ? 'public, s-maxage=3600' : 'no-store');
    res.status(200).json(out);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'upstream' });
  }
}

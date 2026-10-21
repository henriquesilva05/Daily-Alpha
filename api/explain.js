// "Explica-me este ativo": chama a API da Anthropic só para utilizadores com sessão iniciada, com limite diário.
const LIMIT = +(process.env.AI_DAILY_LIMIT || 10);

const INSTRUCOES = 'És um explicador de finanças para principiantes em Portugal. Escreve SEMPRE em português de Portugal (europeu), nunca do Brasil, tratando o leitor por "tu". Usa formas europeias como "ações", "mil milhões", "facto", "equipa". Não uses termos em inglês quando há palavra portuguesa (diz "rendibilidade de dividendos", "lucro por ação", "previsões", "juro das obrigações"). Todos os números que referires têm de vir dos dados abaixo; não inventes valores. Podes usar conhecimento geral só para descrever o que a empresa ou o ativo é. Os valores de variação, volatilidade e quedas estão em fração decimal (0,12 = 12%). Não dês recomendações de compra nem de venda. Escreve quatro parágrafos curtos, cada um a começar por um título em negrito: **O que é**, **Como se tem portado**, **Riscos a ter em conta**, **O que observar**. No máximo 220 palavras, frases simples.';

async function userFromToken(token) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}
async function bumpUsage(uid) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${url}/rest/v1/rpc/bump_ai_usage`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, lim: LIMIT })
  });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) { res.status(503).json({ error: 'not_configured' }); return; }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'not_granted' }); return; }
  const user = await userFromToken(token).catch(() => null);
  if (!user || !user.id) { res.status(401).json({ error: 'not_granted' }); return; }
  let ctx = req.body && req.body.ctx;
  if (typeof req.body === 'string') { try { ctx = JSON.parse(req.body).ctx; } catch { ctx = null; } }
  const dados = JSON.stringify(ctx || {});
  if (!ctx || dados.length > 6000) { res.status(400).json({ error: 'bad_request' }); return; }
  const ok = await bumpUsage(user.id).catch(() => false);
  if (!ok) { res.status(429).json({ error: 'rate_limited' }); return; }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL, max_tokens: 700, messages: [{ role: 'user', content: INSTRUCOES + '\n\nDados (JSON):\n' + dados }] })
    });
    const j = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'upstream' }); return; }
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: 'upstream' });
  }
}

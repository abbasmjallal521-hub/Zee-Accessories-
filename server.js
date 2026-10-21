// Zee Accessories — small shop server.
// Storage: if GITHUB_TOKEN + GITHUB_REPO are set, products and photos are saved
// to the DATA_BRANCH of that repo (free and permanent). Otherwise they are kept
// in ./local-data, which on Render's free plan is wiped on every restart.

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PASS = process.env.ADMIN_PASSWORD || '';
const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || '';
const BRANCH = process.env.DATA_BRANCH || 'data';
const USE_GH = Boolean(TOKEN && REPO);
const SECRET = crypto.createHash('sha256').update('zee-admin:' + PASS).digest();
const LOCAL = path.join(__dirname, 'local-data');
const SEED = path.join(__dirname, 'seed.json');



/* ---------- GitHub storage ---------- */
async function gh(method, file, body, raw) {
  const url = `https://api.github.com/repos/${REPO}/contents/${file}` + (method === 'GET' ? `?ref=${encodeURIComponent(BRANCH)}` : '');
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
    'User-Agent': 'zee-shop',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

let state = null;
let stateSha = null;
const imgCache = new Map();

function seed() {
  return JSON.parse(fs.readFileSync(SEED, 'utf8'));
}

async function loadState() {
  if (USE_GH) {
    const r = await gh('GET', 'products.json');
    if (r.status === 404) { state = seed(); stateSha = null; return; }
    if (!r.ok) throw new Error('GitHub read failed: ' + r.status);
    const j = await r.json();
    stateSha = j.sha;
    state = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
    return;
  }
  const f = path.join(LOCAL, 'products.json');
  state = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : seed();
}

async function saveState(next) {
  const text = JSON.stringify(next, null, 1);
  if (USE_GH) {
    const put = sha => gh('PUT', 'products.json', {
      message: 'Update products',
      content: Buffer.from(text).toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    });
    let r = await put(stateSha);
    if (r.status === 409 || r.status === 422) {
      const cur = await gh('GET', 'products.json');
      const sha = cur.ok ? (await cur.json()).sha : null;
      r = await put(sha);
    }
    if (!r.ok) throw new Error('GitHub write failed: ' + r.status);
    stateSha = (await r.json()).content.sha;
  } else {
    fs.mkdirSync(LOCAL, { recursive: true });
    fs.writeFileSync(path.join(LOCAL, 'products.json'), text);
  }
  state = next;
}

async function saveImage(name, buf) {
  if (USE_GH) {
    const r = await gh('PUT', 'images/' + name, {
      message: 'Add photo ' + name,
      content: buf.toString('base64'),
      branch: BRANCH
    });
    if (!r.ok) throw new Error('GitHub image write failed: ' + r.status);
  } else {
    fs.mkdirSync(path.join(LOCAL, 'img'), { recursive: true });
    fs.writeFileSync(path.join(LOCAL, 'img', name), buf);
  }
  imgCache.set(name, buf);
}

async function readImage(name) {
  if (imgCache.has(name)) return imgCache.get(name);
  let buf = null;
  if (USE_GH) {
    const r = await gh('GET', 'images/' + name, null, true);
    if (r.ok) buf = Buffer.from(await r.arrayBuffer());
  } else {
    const f = path.join(LOCAL, 'img', name);
    if (fs.existsSync(f)) buf = fs.readFileSync(f);
  }
  if (buf) imgCache.set(name, buf);
  return buf;
}

const ready = loadState().catch(err => { console.error(err); state = seed(); });

/* ---------- admin auth ---------- */
function sign(exp) {
  return crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
}
function makeToken() {
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  return exp + '.' + sign(exp);
}
function checkToken(t) {
  const [exp, sig] = String(t || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function authed(req) {
  const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return Boolean(PASS) && checkToken(t);
}

/* ---------- validation ---------- */
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const num = v => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0; };
const ICONS = ['watch', 'wallet', 'glasses', 'bracelet', 'belt', 'cuff', 'necklace', 'earrings', 'ring', 'bag', 'scarf', 'clip'];
function clean(d) {
  const products = (Array.isArray(d.products) ? d.products : []).slice(0, 1000).map(p => ({
    id: str(p.id, 40).replace(/[^a-z0-9-]/gi, '') || crypto.randomBytes(5).toString('hex'),
    sec: p.sec === 'men' ? 'men' : 'women',
    cat: str(p.cat, 40),
    icon: ICONS.includes(p.icon) ? p.icon : 'necklace',
    name: str(p.name, 80),
    desc: str(p.desc, 160),
    price: num(p.price),
    old: num(p.old),
    tag: str(p.tag, 24),
    img: /^\/img\/[a-z0-9-]+\.jpg$/.test(p.img || '') ? p.img : ''
  })).filter(p => p.name);
  return {
    whatsapp: str(d.whatsapp, 20).replace(/[^\d]/g, ''),
    menLine: str(d.menLine, 80),
    womenLine: str(d.womenLine, 80),
    products
  };
}

/* ---------- http ---------- */
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };
const SEC_HEADERS = { 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin' };

function send(res, status, body, type, extra) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', ...SEC_HEADERS, ...(extra || {}) });
  res.end(body);
}
const json = (res, status, obj, extra) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', extra);

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too_big'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(new Error('bad_json'), { status: 400 })); } });
    req.on('error', reject);
  });
}

function serveFile(res, file, cache) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': cache });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'GET' && p === '/api/products') {
      await ready;
      return json(res, 200, state, { 'Cache-Control': 'no-store' });
    }
    if (req.method === 'GET' && p.startsWith('/img/')) {
      const name = p.slice(5);
      if (!/^[a-z0-9-]+\.jpg$/.test(name)) return send(res, 404, 'Not found');
      const buf = await readImage(name);
      if (!buf) return send(res, 404, 'Not found');
      return send(res, 200, buf, 'image/jpeg', { 'Cache-Control': 'public, max-age=31536000, immutable' });
    }
    if (req.method === 'POST' && p === '/api/login') {
      if (!PASS) return json(res, 503, { error: 'no_password' });
      const body = await readBody(req, 10000);
      const given = String(body.password || '');
      const ok = given.length === PASS.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(PASS));
      if (!ok) { await new Promise(r => setTimeout(r, 600)); return json(res, 401, { error: 'wrong' }); }
      return json(res, 200, { token: makeToken(), storage: USE_GH ? 'github' : 'local' });
    }
    if (p === '/api/check' && req.method === 'GET') {
      if (!authed(req)) return json(res, 401, { error: 'login' });
      return json(res, 200, { ok: true, storage: USE_GH ? 'github' : 'local' });
    }
    if (p === '/api/data' && req.method === 'PUT') {
      if (!authed(req)) return json(res, 401, { error: 'login' });
      const body = await readBody(req, 2 * 1024 * 1024);
      await ready;
      try { await saveState(clean(body)); return json(res, 200, { ok: true }); }
      catch (e) { console.error(e); return json(res, 502, { error: 'save_failed' }); }
    }
    if (p === '/api/upload' && req.method === 'POST') {
      if (!authed(req)) return json(res, 401, { error: 'login' });
      const body = await readBody(req, 4 * 1024 * 1024);
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
      if (!m) return json(res, 400, { error: 'bad_image' });
      const buf = Buffer.from(m[1], 'base64');
      const name = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + '.jpg';
      try { await saveImage(name, buf); return json(res, 200, { img: '/img/' + name }); }
      catch (e) { console.error(e); return json(res, 502, { error: 'upload_failed' }); }
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (p === '/' ) return serveFile(res, path.join(PUBLIC, 'index.html'), 'no-cache');
      if (p === '/admin' || p === '/admin/') return serveFile(res, path.join(PUBLIC, 'admin.html'), 'no-cache');
      const file = path.normalize(path.join(PUBLIC, p));
      if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, 'Not found');
      return serveFile(res, file, 'public, max-age=3600');
    }
    send(res, 405, 'Method not allowed');
  } catch (e) {
    if (e.status) return json(res, e.status, { error: e.message });
    console.error(e);
    json(res, 500, { error: 'server' });
  }
});

server.listen(PORT, () => console.log(`Zee running on ${PORT} (storage: ${USE_GH ? 'github ' + REPO + '@' + BRANCH : 'local'})`));

// Minimal stand-in for Supabase Auth (GoTrue) to test js/platform/auth.js without a real project or Google client.
// Usage: node tools/mock-gotrue.mjs [port]   (default 54321). Dev only; verifies PKCE (S256) like the real server.
import http from 'node:http';
import crypto from 'node:crypto';

const port = Number(process.argv[2] || 54321);
const codes = new Map(), refresh = new Map();
let n = 0, ttl = 3600;
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'tester@example.test', user_metadata: { full_name: 'Test Pilot' } };
const mint = () => { const rt = 'rt' + ++n; refresh.set(rt, true); return { access_token: 'at' + n, refresh_token: rt, expires_in: ttl, expires_at: Math.floor(Date.now() / 1000) + ttl, token_type: 'bearer', user }; };
const sha = v => crypto.createHash('sha256').update(v).digest('base64url');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'apikey, content-type, authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const json = (c, o) => res.writeHead(c, { 'Content-Type': 'application/json' }).end(JSON.stringify(o));
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const b = body ? JSON.parse(body) : {};
    if (u.pathname === '/auth/v1/authorize') {                       // stands in for Google consent: approve immediately
      if (u.searchParams.get('code_challenge_method') !== 's256' || !u.searchParams.get('code_challenge')) return json(400, { error_description: 'PKCE required' });
      const code = crypto.randomUUID(); codes.set(code, u.searchParams.get('code_challenge'));
      const to = new URL(u.searchParams.get('redirect_to')); to.searchParams.set(u.searchParams.get('deny') ? 'error_description' : 'code', u.searchParams.get('deny') ? 'access_denied' : code);
      return res.writeHead(302, { Location: to.toString() }).end();
    }
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'pkce') {
      const ch = codes.get(b.auth_code); codes.delete(b.auth_code);
      if (!ch || sha(b.code_verifier || '') !== ch) return json(400, { error_description: 'invalid flow state / verifier mismatch' });
      return json(200, mint());
    }
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
      if (!refresh.delete(b.refresh_token)) return json(400, { error_description: 'Invalid Refresh Token' });
      return json(200, mint());
    }
    if (u.pathname === '/auth/v1/logout') { refresh.clear(); return res.writeHead(204).end(); }
    if (u.pathname === '/__ttl') { ttl = Number(u.searchParams.get('s') || 3600); return json(200, { ttl }); }
    if (u.pathname === '/__revoke') { refresh.clear(); return json(200, {}); }
    json(404, { error: 'not found' });
  });
}).listen(port, () => console.log('mock gotrue on :' + port));

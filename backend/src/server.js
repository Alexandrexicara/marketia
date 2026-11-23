import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { registerExtendedRoutes } from './extended-routes.js';
import { registerMediaRoutes, ensureMediaSchema } from './media-routes.js';
import { ensurePaymentsSchema, registerPaymentRoutes } from './payment-routes.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(v => v.trim());
const pool = process.env.DATABASE_URL ? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
}) : null;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
}}));
app.use(express.json({ limit: '1mb' }));

const requireDatabase = (_req, res, next) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  next();
};
const slugify = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'empresa';
const makeToken = (user) => {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d', issuer: 'marketia' });
};
const sessionAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !JWT_SECRET) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'marketia' });
    req.userId = payload.sub;
    req.userEmail = payload.email || '';
    pool.query("SELECT status FROM users WHERE id=$1", [req.userId]).then(result => {
      if (!result.rowCount || result.rows[0].status !== 'active') return res.status(403).json({ error: 'Esta conta está bloqueada ou indisponível.' });
      next();
    }).catch(error => {
      console.error('Session status check:', error.message);
      res.status(503).json({ error: 'Não foi possível validar a conta agora.' });
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
};
const auth = (req, res, next) => sessionAuth(req, res, async () => {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail && String(req.userEmail || '').toLowerCase() === adminEmail) return next();
  if (process.env.PAYWALL_ENABLED !== 'true') return next();
  try {
    const paid = await pool.query("SELECT 1 FROM marketia_payments WHERE user_id=$1 AND status='paid' LIMIT 1", [req.userId]);
    if (!paid.rowCount) return res.status(402).json({ error: 'O acesso permanente ao MarketIA precisa ser liberado após a confirmação do pagamento.' });
    next();
  } catch (error) {
    console.error('Payment access check:', error.message);
    res.status(503).json({ error: 'Não foi possível validar o acesso financeiro agora.' });
  }
});
const safeUser = (row) => ({ id: row.id, email: row.email, displayName: row.display_name });

app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (pool) {
    try { await pool.query('SELECT 1'); database = 'connected'; }
    catch (error) { console.error('Database health check:', error.message); database = 'unavailable'; }
  }
  res.status(200).json({ ok: true, service: 'marketia-api', version: '0.3.0', database, auth: Boolean(JWT_SECRET) });
});

app.post('/api/auth/register', requireDatabase, async (req, res) => {
  const { companyName, displayName, email, password, segment } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!companyName?.trim() || !displayName?.trim() || !cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail) || String(password || '').length < 8) {
    return res.status(400).json({ error: 'Informe empresa, nome, e-mail válido e senha com pelo menos 8 caracteres.' });
  }
  if (!JWT_SECRET) return res.status(503).json({ error: 'Authentication secret not configured' });
  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query('BEGIN');
    const userResult = await client.query(
      "INSERT INTO users (email,password_hash,display_name,status) VALUES ($1,$2,$3,'active') RETURNING id,email,display_name",
      [cleanEmail, passwordHash, displayName.trim()]
    );
    const user = userResult.rows[0];
    const tenantResult = await client.query("INSERT INTO tenants (name) VALUES ($1) RETURNING id,name", [companyName.trim()]);
    const tenant = tenantResult.rows[0];
    await client.query("INSERT INTO tenant_memberships (tenant_id,user_id,role) VALUES ($1,$2,'owner')", [tenant.id, user.id]);
    let slug = slugify(companyName);
    const exists = await client.query('SELECT 1 FROM businesses WHERE slug=$1', [slug]);
    if (exists.rowCount) slug = `${slug}-${randomUUID().slice(0,8)}`;
    const businessResult = await client.query(
      "INSERT INTO businesses (tenant_id,name,slug,segment,status) VALUES ($1,$2,$3,$4,'draft') RETURNING id,name,slug,segment,status",
      [tenant.id, companyName.trim(), slug, segment?.trim() || null]
    );
    await client.query('COMMIT');
    const token = makeToken(user);
    return res.status(201).json({ token, user: safeUser(user), tenant, business: businessResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'Este e-mail já possui cadastro.' });
    console.error('Registration failed:', error.message);
    return res.status(500).json({ error: 'Não foi possível concluir o cadastro.' });
  } finally { client.release(); }
});

app.post('/api/auth/login', requireDatabase, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  if (!JWT_SECRET) return res.status(503).json({ error: 'Authentication secret not configured' });
  try {
    const result = await pool.query("SELECT id,email,password_hash,display_name,status FROM users WHERE email=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user || user.status !== 'active' || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    const tenantResult = await pool.query(
      "SELECT t.id,t.name,tm.role FROM tenants t JOIN tenant_memberships tm ON tm.tenant_id=t.id WHERE tm.user_id=$1 AND t.status='active' ORDER BY tm.created_at LIMIT 1",
      [user.id]
    );
    return res.json({ token: makeToken(user), user: safeUser(user), tenant: tenantResult.rows[0] || null });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ error: 'Não foi possível entrar.' });
  }
});

app.get('/api/me', requireDatabase, sessionAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT u.id,u.email,u.display_name,t.id AS tenant_id,t.name AS tenant_name,tm.role FROM users u LEFT JOIN tenant_memberships tm ON tm.user_id=u.id LEFT JOIN tenants t ON t.id=tm.tenant_id AND t.status='active' WHERE u.id=$1 AND u.status='active' LIMIT 1",
      [req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const row = result.rows[0];
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const isAdmin = Boolean(adminEmail && String(req.userEmail || '').toLowerCase() === adminEmail);
    const payment = await pool.query('SELECT id,method,amount_cents,currency,status,created_at,updated_at FROM marketia_payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[req.userId]);
    return res.json({ user: safeUser(row), tenant: row.tenant_id ? { id: row.tenant_id, name: row.tenant_name, role: row.role } : null, isAdmin, payment: payment.rows[0] || null, access: isAdmin || payment.rows[0]?.status === 'paid' || process.env.PAYWALL_ENABLED !== 'true' });
  } catch (error) { console.error('Profile failed:', error.message); return res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/businesses', requireDatabase, auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT b.id,b.name,b.slug,b.segment,b.description,b.website,b.public_email,b.public_phone,b.city,b.state,b.seo_title,b.seo_description,b.logo_url,b.instagram_url,b.facebook_url,b.whatsapp_url,b.keywords,b.canonical_url,b.status,b.created_at,tm.tenant_id FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id JOIN tenants t ON t.id=tm.tenant_id WHERE tm.user_id=$1 AND t.status='active' ORDER BY b.created_at DESC",
      [req.userId]
    );
    return res.json({ businesses: rows });
  } catch (error) { console.error('Businesses list failed:', error.message); return res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/businesses', requireDatabase, auth, async (req, res) => {
  const { name, segment, description, website, publicEmail, publicPhone, city, state } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Informe o nome do negócio.' });
  try {
    const membership = await pool.query("SELECT tenant_id FROM tenant_memberships WHERE user_id=$1 ORDER BY created_at LIMIT 1", [req.userId]);
    if (!membership.rows.length) return res.status(403).json({ error: 'Conta sem empresa vinculada.' });
    let slug = slugify(name);
    const exists = await pool.query('SELECT 1 FROM businesses WHERE slug=$1', [slug]);
    if (exists.rowCount) slug = `${slug}-${randomUUID().slice(0,8)}`;
    const { rows } = await pool.query(
      "INSERT INTO businesses (tenant_id,name,slug,segment,description,website,public_email,public_phone,city,state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [membership.rows[0].tenant_id,name.trim(),slug,segment || null,description || null,website || null,publicEmail || null,publicPhone || null,city || null,state || null]
    );
    return res.status(201).json({ business: rows[0] });
  } catch (error) { console.error('Business creation failed:', error.message); return res.status(500).json({ error: 'Não foi possível cadastrar o negócio.' }); }
});

app.patch('/api/businesses/:id', requireDatabase, auth, async (req, res) => {
  const allowed = ['name','segment','description','website','public_email','public_phone','city','state','seo_title','seo_description','status','logo_url','instagram_url','facebook_url','whatsapp_url','keywords','canonical_url'];
  const fields = Object.keys(req.body || {}).filter(key => allowed.includes(key));
  if (!fields.length) return res.status(400).json({ error: 'Nenhum campo válido informado.' });
  const values = fields.map(key => req.body[key]);
  const setters = fields.map((key,index) => `${key}=$${index+1}`);
  values.push(req.params.id, req.userId);
  try {
    const { rows } = await pool.query(
      `UPDATE businesses b SET ${setters.join(',')},updated_at=NOW() FROM tenant_memberships tm WHERE b.id=$${fields.length+1} AND tm.tenant_id=b.tenant_id AND tm.user_id=$${fields.length+2} RETURNING b.*`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Negócio não encontrado.' });
    return res.json({ business: rows[0] });
  } catch (error) { console.error('Business update failed:', error.message); return res.status(500).json({ error: 'Não foi possível atualizar o negócio.' }); }
});

app.get('/api/businesses/:id/offerings', requireDatabase, auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT o.* FROM offerings o JOIN tenant_memberships tm ON tm.tenant_id=o.tenant_id WHERE o.business_id=$1 AND tm.user_id=$2 ORDER BY o.created_at DESC",
      [req.params.id, req.userId]
    );
    return res.json({ offerings: rows });
  } catch (error) { console.error('Offerings list failed:', error.message); return res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/businesses/:id/offerings', requireDatabase, auth, async (req, res) => {
  const { kind, name, description, price, imageUrl } = req.body || {};
  if (!['product','service'].includes(kind) || !name?.trim()) return res.status(400).json({ error: 'Informe nome e tipo válido.' });
  try {
    const access = await pool.query(
      "SELECT b.tenant_id FROM businesses b JOIN tenant_memberships tm ON tm.tenant_id=b.tenant_id WHERE b.id=$1 AND tm.user_id=$2 LIMIT 1",
      [req.params.id, req.userId]
    );
    if (!access.rows.length) return res.status(404).json({ error: 'Negócio não encontrado.' });
    const slug = slugify(name) + '-' + randomUUID().slice(0,6);
    const { rows } = await pool.query(
      "INSERT INTO offerings (tenant_id,business_id,kind,name,slug,description,price,image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [access.rows[0].tenant_id,req.params.id,kind,name.trim(),slug,description || null,price === '' || price == null ? null : Number(price),imageUrl || null]
    );
    return res.status(201).json({ offering: rows[0] });
  } catch (error) { console.error('Offering creation failed:', error.message); return res.status(500).json({ error: 'Não foi possível cadastrar.' }); }
});

app.get('/api/leads', requireDatabase, auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT l.* FROM leads l JOIN tenant_memberships tm ON tm.tenant_id=l.tenant_id WHERE tm.user_id=$1 ORDER BY l.created_at DESC LIMIT 200",
      [req.userId]
    );
    return res.json({ leads: rows });
  } catch (error) { console.error('Leads list failed:', error.message); return res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/public/business/:slug', requireDatabase, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id,name,slug,segment,description,website,public_email,public_phone,city,state,seo_title,seo_description,logo_url,instagram_url,facebook_url,whatsapp_url,keywords,canonical_url FROM businesses WHERE slug=$1 AND status='published' LIMIT 1",
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Business not found' });
    const offerings = await pool.query("SELECT id,kind,name,description,price,currency,image_url FROM offerings WHERE business_id=$1 AND status='published' ORDER BY created_at DESC", [rows[0].id]);
    const media = await pool.query("SELECT id,media_type,file_name,mime_type,size_bytes,public_url,created_at FROM business_media WHERE business_id=$1 AND status='ready' ORDER BY created_at DESC", [rows[0].id]);
    return res.json({ business: rows[0], offerings: offerings.rows, media: media.rows });
  } catch (error) { console.error('Public business lookup failed:', error.message); return res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/public/business/:slug/leads', requireDatabase, async (req, res) => {
  const { name, email, phone, message, consent } = req.body || {};
  if (!consent) return res.status(400).json({ error: 'É necessário consentimento para enviar seus dados.' });
  if (!name?.trim() || (!email && !phone)) return res.status(400).json({ error: 'Informe seu nome e e-mail ou telefone.' });
  try {
    const business = await pool.query("SELECT id,tenant_id FROM businesses WHERE slug=$1 AND status='published' LIMIT 1", [req.params.slug]);
    if (!business.rows.length) return res.status(404).json({ error: 'Business not found' });
    await pool.query(
      "INSERT INTO leads (tenant_id,business_id,name,email,phone,message,source,consent_at) VALUES ($1,$2,$3,$4,$5,$6,'public_page',NOW())",
      [business.rows[0].tenant_id,business.rows[0].id,name.trim(),email || null,phone || null,message || null]
    );
    await pool.query("INSERT INTO page_events(tenant_id,business_id,event_type,source) VALUES($1,$2,'lead_submit','public_page')",[business.rows[0].tenant_id,business.rows[0].id]);
    return res.status(201).json({ ok: true, message: 'Contato enviado com sucesso.' });
  } catch (error) { console.error('Lead creation failed:', error.message); return res.status(500).json({ error: 'Não foi possível enviar o contato.' }); }
});

registerPaymentRoutes(app, { pool, sessionAuth, requireDatabase });
registerExtendedRoutes(app, { pool, auth, requireDatabase, slugify });
registerMediaRoutes(app, { pool, auth, requireDatabase });

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const start = async () => {
  if (pool) { await ensurePaymentsSchema(pool); await ensureMediaSchema(pool); }
  app.listen(port, () => console.log(`MarketIA API listening on port ${port}`));
};
start().catch(error => { console.error('MarketIA startup failed:', error.message); process.exit(1); });

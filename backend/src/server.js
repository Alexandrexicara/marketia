import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(v => v.trim());
const pool = process.env.DATABASE_URL ? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
}) : null;

app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
}}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (pool) {
    try { await pool.query('SELECT 1'); database = 'connected'; }
    catch { database = 'unavailable'; }
  }
  res.status(200).json({ ok: true, service: 'marketia-api', version: '0.1.0', database });
});

app.get('/api/public/business/:slug', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const { rows } = await pool.query(
      'SELECT name, slug, segment, description, website, public_email, public_phone, city, state, seo_title, seo_description FROM businesses WHERE slug = $1 AND status = $2 LIMIT 1',
      [req.params.slug, 'published']
    );
    if (!rows.length) return res.status(404).json({ error: 'Business not found' });
    return res.json({ business: rows[0] });
  } catch (error) {
    console.error('Public business lookup failed:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => console.log(`MarketIA API listening on port ${port}`));
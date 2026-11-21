import { Router } from 'express';
import { randomUUID } from 'node:crypto';

const PRICE_CENTS = 200000;
const PRICE_REAIS = 2000;
const PIX_KEY = 'santossilvac992@gmail.com';
const WHATSAPP = '5538988283318';

export async function ensurePaymentsSchema(pool) {
  if (!pool) return;
  await pool.query("CREATE TABLE IF NOT EXISTS marketia_payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, method VARCHAR(20) NOT NULL CHECK (method IN ('sumup','pix')), amount_cents INTEGER NOT NULL DEFAULT 200000 CHECK (amount_cents = 200000), currency CHAR(3) NOT NULL DEFAULT 'BRL', status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','manual_review','rejected','failed','cancelled')), checkout_reference UUID UNIQUE, sumup_checkout_id VARCHAR(120) UNIQUE, hosted_checkout_url TEXT, proof_note TEXT, approved_by UUID REFERENCES users(id) ON DELETE SET NULL, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query('CREATE INDEX IF NOT EXISTS idx_marketia_payments_user_created ON marketia_payments(user_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_marketia_payments_status_created ON marketia_payments(status, created_at DESC)');
}

async function verifySumUpCheckout(checkoutId) {
  const apiKey = process.env.SUMUP_API_KEY;
  if (!apiKey) throw new Error('SUMUP_NOT_CONFIGURED');
  const response = await fetch('https://api.sumup.com/v0.1/checkouts/' + encodeURIComponent(checkoutId), {
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('SumUp checkout verification failed:', response.status);
    throw new Error('SUMUP_VERIFY_FAILED');
  }
  return data;
}

export function registerPaymentRoutes(app, { pool, sessionAuth, requireDatabase }) {
  const router = Router();
  const requireAdmin = (req, res, next) => {
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!adminEmail || String(req.userEmail || '').toLowerCase() !== adminEmail) {
      return res.status(403).json({ error: 'Acesso restrito ao administrador da plataforma.' });
    }
    next();
  };

  router.get('/status', sessionAuth, requireDatabase, async (req, res) => {
    try {
      const result = await pool.query('SELECT id,method,amount_cents,currency,status,hosted_checkout_url,sumup_checkout_id,created_at,updated_at FROM marketia_payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.userId]);
      const payment = result.rows[0] || null;
      const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const isAdmin = Boolean(adminEmail && String(req.userEmail || '').toLowerCase() === adminEmail);
      if (payment?.method === 'sumup' && payment.sumup_checkout_id && payment.status === 'pending') {
        try {
          const checkout = await verifySumUpCheckout(payment.sumup_checkout_id);
          if (String(checkout.status || '').toUpperCase() === 'PAID') {
            const updated = await pool.query("UPDATE marketia_payments SET status='paid',updated_at=NOW() WHERE id=$1 RETURNING id,method,amount_cents,currency,status,created_at,updated_at", [payment.id]);
            return res.json({ payment: updated.rows[0], access: true, isAdmin });
          }
          const remoteStatus = String(checkout.status || '').toUpperCase();
          if (['FAILED','EXPIRED','CANCELLED'].includes(remoteStatus)) {
            const localStatus = remoteStatus.toLowerCase();
            await pool.query('UPDATE marketia_payments SET status=$1,updated_at=NOW() WHERE id=$2', [localStatus, payment.id]);
            payment.status = localStatus;
          }
        } catch (error) {
          if (error.message !== 'SUMUP_NOT_CONFIGURED') console.error('SumUp status check:', error.message);
        }
      }
      const paid = payment?.status === 'paid';
      res.json({ payment, access: paid || isAdmin, isAdmin, priceCents: PRICE_CENTS, pixKey: PIX_KEY });
    } catch (error) {
      console.error('Payment status:', error.message);
      res.status(500).json({ error: 'Não foi possível consultar o pagamento.' });
    }
  });

  router.post('/checkout', sessionAuth, requireDatabase, async (req, res) => {
    const apiKey = process.env.SUMUP_API_KEY;
    const merchantCode = process.env.SUMUP_MERCHANT_CODE;
    const appUrl = String(process.env.APP_URL || 'https://marketdigitalia.netlify.app').replace(/\/$/, '');
    if (!apiKey || !merchantCode) return res.status(503).json({ error: 'O pagamento com cartão ainda aguarda a configuração do SumUp no servidor.' });
    try {
      const pending = await pool.query("SELECT id,hosted_checkout_url FROM marketia_payments WHERE user_id=$1 AND method='sumup' AND status='pending' ORDER BY created_at DESC LIMIT 1", [req.userId]);
      if (pending.rows[0]?.hosted_checkout_url) {
        return res.json({ checkoutUrl: pending.rows[0].hosted_checkout_url, paymentId: pending.rows[0].id });
      }
      const reference = randomUUID();
      const inserted = await pool.query("INSERT INTO marketia_payments(user_id,tenant_id,method,amount_cents,status,checkout_reference) SELECT $1,tenant_id,'sumup',$2,'pending',$3 FROM tenant_memberships WHERE user_id=$1 ORDER BY created_at LIMIT 1 RETURNING id", [req.userId, PRICE_CENTS, reference]);
      if (!inserted.rowCount) return res.status(400).json({ error: 'Sua conta ainda não possui um espaço de trabalho.' });
      const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          checkout_reference: reference,
          amount: PRICE_REAIS,
          currency: 'BRL',
          merchant_code: merchantCode,
          description: 'MarketIA - acesso permanente à plataforma',
          redirect_url: appUrl + '/?payment=return',
          hosted_checkout: { enabled: true }
        }),
        signal: AbortSignal.timeout(25000)
      });
      const checkout = await response.json().catch(() => ({}));
      if (!response.ok || !checkout.hosted_checkout_url || !checkout.id) {
        console.error('SumUp checkout creation failed:', response.status);
        await pool.query("UPDATE marketia_payments SET status='failed',updated_at=NOW() WHERE id=$1", [inserted.rows[0].id]);
        return res.status(502).json({ error: 'A SumUp não conseguiu gerar o checkout agora. Tente novamente.' });
      }
      await pool.query('UPDATE marketia_payments SET sumup_checkout_id=$1,hosted_checkout_url=$2,updated_at=NOW() WHERE id=$3', [checkout.id, checkout.hosted_checkout_url, inserted.rows[0].id]);
      res.status(201).json({ checkoutUrl: checkout.hosted_checkout_url, paymentId: inserted.rows[0].id });
    } catch (error) {
      console.error('SumUp checkout:', error.message);
      res.status(502).json({ error: 'Não foi possível iniciar o pagamento com cartão.' });
    }
  });

  router.post('/pix/request', sessionAuth, requireDatabase, async (req, res) => {
    try {
      const result = await pool.query("INSERT INTO marketia_payments(user_id,tenant_id,method,amount_cents,status) SELECT $1,tenant_id,'pix',$2,'manual_review' FROM tenant_memberships WHERE user_id=$1 ORDER BY created_at LIMIT 1 RETURNING id,method,amount_cents,status,created_at", [req.userId, PRICE_CENTS]);
      if (!result.rowCount) return res.status(400).json({ error: 'Sua conta ainda não possui um espaço de trabalho.' });
      const message = encodeURIComponent('Olá! Quero pagar o acesso permanente do MarketIA via Pix. Valor: R$ 2.000,00. Chave Pix: ' + PIX_KEY + '. Vou enviar o comprovante para aprovação.');
      res.status(201).json({ payment: result.rows[0], pixKey: PIX_KEY, whatsappUrl: 'https://wa.me/' + WHATSAPP + '?text=' + message });
    } catch (error) {
      console.error('Pix request:', error.message);
      res.status(500).json({ error: 'Não foi possível registrar a solicitação Pix.' });
    }
  });

  router.get('/admin/overview', sessionAuth, requireDatabase, requireAdmin, async (_req, res) => {
    try {
      const users = await pool.query("SELECT u.id,u.email,u.display_name,u.status,u.created_at,t.id AS tenant_id,t.name AS tenant_name,COALESCE((SELECT p.status FROM marketia_payments p WHERE p.user_id=u.id ORDER BY p.created_at DESC LIMIT 1),'unpaid') AS payment_status,(SELECT p.method FROM marketia_payments p WHERE p.user_id=u.id ORDER BY p.created_at DESC LIMIT 1) AS payment_method FROM users u LEFT JOIN tenant_memberships tm ON tm.user_id=u.id LEFT JOIN tenants t ON t.id=tm.tenant_id ORDER BY u.created_at DESC LIMIT 500");
      const payments = await pool.query("SELECT p.id,p.user_id,u.email,u.display_name,p.method,p.amount_cents,p.status,p.created_at,p.updated_at,p.sumup_checkout_id,p.proof_note FROM marketia_payments p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 500");
      const totals = await pool.query("SELECT COUNT(*)::int AS total_payments,COUNT(*) FILTER (WHERE status='paid')::int AS paid_payments,COALESCE(SUM(amount_cents) FILTER (WHERE status='paid'),0)::bigint AS paid_cents FROM marketia_payments");
      res.json({ users: users.rows, payments: payments.rows, totals: totals.rows[0] });
    } catch (error) {
      console.error('Admin payment overview:', error.message);
      res.status(500).json({ error: 'Não foi possível carregar o painel financeiro.' });
    }
  });

  router.patch('/admin/payments/:id', sessionAuth, requireDatabase, requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (!['paid','rejected'].includes(status)) return res.status(400).json({ error: 'Status administrativo inválido.' });
    try {
      const result = await pool.query("UPDATE marketia_payments SET status=$1,approved_by=$2,approved_at=CASE WHEN $1='paid' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$3 AND method='pix' RETURNING id,user_id,status", [status, req.userId, req.params.id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Solicitação Pix não encontrada.' });
      res.json({ payment: result.rows[0] });
    } catch (error) {
      console.error('Admin payment update:', error.message);
      res.status(500).json({ error: 'Não foi possível atualizar o pagamento.' });
    }
  });

  router.patch('/admin/users/:id', sessionAuth, requireDatabase, requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (!['active','blocked'].includes(status)) return res.status(400).json({ error: 'Status de usuário inválido.' });
    try {
      const result = await pool.query('UPDATE users SET status=$1 WHERE id=$2 RETURNING id,email,status', [status, req.params.id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Usuário não encontrado.' });
      res.json({ user: result.rows[0] });
    } catch (error) {
      console.error('Admin user update:', error.message);
      res.status(500).json({ error: 'Não foi possível atualizar o usuário.' });
    }
  });

  app.use('/api/payments', router);
}

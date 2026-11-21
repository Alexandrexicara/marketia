import React, { useEffect, useState } from 'react';
import { CreditCard, QrCode, ShieldCheck, Copy, ExternalLink, RefreshCw, CheckCircle2, Clock3, XCircle, Users, Wallet, Lock, Unlock } from 'lucide-react';

const API = 'https://marketia-54ra.onrender.com';
const money = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const labels = { pending: 'Aguardando pagamento', paid: 'Pago', manual_review: 'Aguardando análise do comprovante', rejected: 'Comprovante recusado', failed: 'Falha no checkout', cancelled: 'Cancelado', unpaid: 'Sem pagamento' };

async function request(path, token, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

export default function PaymentCenter({ token, isAdmin = false, onAccess, onLogout }) {
  const [payment, setPayment] = useState(null);
  const [access, setAccess] = useState(false);
  const [pixUrl, setPixUrl] = useState('');
  const [pixKey, setPixKey] = useState('santossilvac992@gmail.com');
  const [adminData, setAdminData] = useState({ users: [], payments: [], totals: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setBusy(true); setError('');
    try {
      if (isAdmin) {
        const data = await request('/api/payments/admin/overview', token);
        setAdminData(data);
      } else {
        const data = await request('/api/payments/status', token);
        setPayment(data.payment || null);
        setAccess(Boolean(data.access));
        if (data.pixKey) setPixKey(data.pixKey);
        if (data.access) onAccess?.();
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => { refresh(); }, [token, isAdmin]);

  const startCard = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/payments/checkout', token, { method: 'POST', body: '{}' });
      window.location.assign(data.checkoutUrl);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const startPix = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/payments/pix/request', token, { method: 'POST', body: '{}' });
      setPayment(data.payment); setPixKey(data.pixKey); setPixUrl(data.whatsappUrl);
      window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
      setNotice('Solicitação Pix criada. Envie o comprovante pelo WhatsApp para aprovação.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const adminAction = async (path, status) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await request(path, token, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice(status === 'paid' ? 'Pagamento aprovado e acesso liberado.' : status === 'rejected' ? 'Comprovante recusado.' : 'Situação da conta atualizada.');
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const copyPix = async () => {
    try { await navigator.clipboard.writeText(pixKey); setNotice('Chave Pix copiada.'); }
    catch { setError('Não foi possível copiar automaticamente.'); }
  };

  if (isAdmin) return <section className="payment-admin">
    <div className="payment-head"><div><span className="payment-eyebrow">ADMINISTRAÇÃO</span><h2>Pagamentos e usuários</h2><p>Controle as liberações e acompanhe os recebimentos do MarketIA.</p></div><button className="payment-secondary" onClick={refresh} disabled={busy}><RefreshCw size={16}/> Atualizar</button></div>
    {error && <div className="payment-alert payment-error">{error}</div>}{notice && <div className="payment-alert payment-success">{notice}</div>}
    <div className="payment-stats">
      <article><Users/><span>Usuários cadastrados</span><b>{adminData.users.length}</b></article>
      <article><CheckCircle2/><span>Pagamentos aprovados</span><b>{adminData.totals.paid_payments || 0}</b></article>
      <article><Wallet/><span>Total recebido</span><b>{money(adminData.totals.paid_cents || 0)}</b></article>
    </div>
    <section className="payment-table-wrap"><h3>Comprovantes e pagamentos</h3>
      {adminData.payments.length ? <div className="payment-table-scroll"><table className="payment-table"><thead><tr><th>Cliente</th><th>Método</th><th>Valor</th><th>Situação</th><th>Data</th><th>Ação</th></tr></thead><tbody>{adminData.payments.map(p=><tr key={p.id}><td><b>{p.display_name || p.email}</b><small>{p.email}</small></td><td>{p.method === 'pix' ? 'Pix' : 'Cartão SumUp'}</td><td>{money(p.amount_cents)}</td><td><span className={'payment-status status-'+p.status}>{labels[p.status] || p.status}</span></td><td>{new Date(p.created_at).toLocaleString('pt-BR')}</td><td>{p.method === 'pix' && p.status === 'manual_review' ? <div className="payment-actions"><button onClick={()=>adminAction('/api/payments/admin/payments/'+p.id,'paid')} disabled={busy}>Aprovar</button><button className="reject" onClick={()=>adminAction('/api/payments/admin/payments/'+p.id,'rejected')} disabled={busy}>Recusar</button></div> : '—'}</td></tr>)}</tbody></table></div> : <p className="payment-empty">Ainda não há pagamentos registrados.</p>}
    </section>
    <section className="payment-table-wrap"><h3>Contas cadastradas</h3>
      <div className="payment-table-scroll"><table className="payment-table"><thead><tr><th>Usuário</th><th>Empresa</th><th>Pagamento</th><th>Conta</th><th>Ação</th></tr></thead><tbody>{adminData.users.map(u=><tr key={u.id}><td><b>{u.display_name || 'Usuário'}</b><small>{u.email}</small></td><td>{u.tenant_name || '—'}</td><td><span className={'payment-status status-'+u.payment_status}>{labels[u.payment_status] || u.payment_status}</span></td><td>{u.status === 'blocked' ? 'Bloqueada' : 'Ativa'}</td><td><button className="payment-user-action" onClick={()=>adminAction('/api/payments/admin/users/'+u.id,u.status === 'blocked' ? 'active' : 'blocked')} disabled={busy}>{u.status === 'blocked' ? <><Unlock size={14}/> Liberar conta</> : <><Lock size={14}/> Bloquear conta</>}</button></td></tr>)}</tbody></table></div>
    </section>
  </section>;

  if (access) return <section className="payment-unlocked"><CheckCircle2 size={42}/><h2>Acesso permanente liberado</h2><p>O pagamento foi confirmado. Sua conta MarketIA está liberada.</p><button className="payment-primary" onClick={onAccess}>Entrar no MarketIA</button></section>;

  return <main className="payment-screen">
    <section className="payment-card">
      <div className="payment-brand"><span>Market</span>IA</div>
      <span className="payment-eyebrow">ACESSO PERMANENTE</span>
      <h1>Seu MarketIA, sem mensalidade.</h1>
      <p className="payment-intro">Faça um único pagamento e tenha acesso permanente à plataforma. Benefícios adicionais futuros poderão ter cobrança separada.</p>
      <div className="payment-price">R$ 2.000,00 <small>pagamento único</small></div>
      <div className="payment-benefits"><span><ShieldCheck/> Acesso permanente após confirmação</span><span><CheckCircle2/> Sem mensalidade para a plataforma</span><span><Lock/> Pagamento validado no servidor</span></div>
      {error && <div className="payment-alert payment-error">{error}</div>}{notice && <div className="payment-alert payment-success">{notice}</div>}
      {payment && <div className="payment-current"><Clock3 size={17}/><span>{labels[payment.status] || payment.status}</span><button onClick={refresh} disabled={busy}>Verificar</button></div>}
      <button className="payment-primary" onClick={startCard} disabled={busy}><CreditCard/> Pagar com cartão pela SumUp</button>
      <button className="payment-secondary payment-pix" onClick={startPix} disabled={busy}><QrCode/> Pagar com Pix</button>
      {payment?.method === 'pix' && <div className="pix-details"><b>Chave Pix (e-mail)</b><div><span>{pixKey}</span><button onClick={copyPix}><Copy size={15}/> Copiar</button></div><p>Depois de pagar, envie o comprovante pelo WhatsApp. O acesso será liberado após a aprovação administrativa.</p>{pixUrl && <a href={pixUrl} target="_blank" rel="noreferrer">Abrir conversa do WhatsApp <ExternalLink size={14}/></a>}</div>}
      <button className="payment-refresh" onClick={refresh} disabled={busy}>{busy ? 'Verificando…' : 'Já paguei — verificar situação'}</button>
      <button className="payment-logout" onClick={onLogout}>Sair da conta</button>
      <small className="payment-security">A confirmação do cartão é consultada diretamente na SumUp. Não liberamos acesso apenas pelo retorno da página de pagamento.</small>
    </section>
  </main>;
}

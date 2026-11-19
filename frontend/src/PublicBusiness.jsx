import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, LoaderCircle, Sparkles } from 'lucide-react';

const API = 'https://marketia-54ra.onrender.com';

export default function PublicBusiness({ slug }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', consent: false });

  useEffect(() => {
    fetch(API + '/api/public/business/' + encodeURIComponent(slug))
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Página não encontrada.'); return result; })
      .then(result => { setData(result); document.title = result.business.seo_title || result.business.name; const description = document.querySelector('meta[name="description"]'); if (description) description.setAttribute('content', result.business.seo_description || result.business.description || result.business.name); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const submit = async event => {
    event.preventDefault(); setSending(true); setError('');
    try {
      const response = await fetch(API + '/api/public/business/' + encodeURIComponent(slug) + '/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível enviar.');
      setSent(true);
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  };

  if (loading) return <div className="public-loading"><LoaderCircle className="spin" size={30}/> Carregando página…</div>;
  if (!data?.business) return <div className="public-page"><div className="public-error-state"><Building2 size={32}/><h1>Esta página não está disponível</h1><p>{error || 'O negócio ainda não publicou sua página.'}</p><a href="/">Conhecer o MarketIA <ArrowUpRight size={15}/></a></div></div>;

  const business = data.business;
  return <div className="public-page">
    <header><a className="brand" href="/"><span className="brand-mark"><Sparkles size={20}/></span><span>Market<span>IA</span></span></a><span className="public-profile-label">Perfil comercial</span></header>
    <main>
      <div className="public-hero"><div className="public-eyebrow">{business.segment || 'Empresa'}</div><h1>{business.seo_title || business.name}</h1><p className="public-description">{business.description || 'Conheça nossos produtos e serviços. Entre em contato para saber mais.'}</p><div className="public-meta">{[business.city, business.state].filter(Boolean).join(' · ')}{business.public_phone ? ' · ' + business.public_phone : ''}</div>{business.website && <a className="public-website" href={business.website} target="_blank" rel="noreferrer">Visitar site <ArrowUpRight size={15}/></a>}</div>
      {data.offerings?.length > 0 && <section className="public-offerings"><h2>Produtos e serviços</h2><div className="public-offering-grid">{data.offerings.map(item => <article key={item.id}><span>{item.kind === 'product' ? 'Produto' : 'Serviço'}</span><h3>{item.name}</h3><p>{item.description}</p>{item.price != null && <strong>R$ {Number(item.price).toFixed(2).replace('.', ',')}</strong>}</article>)}</div></section>}
      <section className="public-contact"><div><h2>Fale com {business.name}</h2><p>Envie seus dados e a empresa poderá retornar seu contato.</p></div>
        {sent ? <div className="public-thanks"><Sparkles size={22}/><b>Obrigado! Sua mensagem foi enviada.</b><p>Seus dados foram encaminhados para a empresa.</p></div> : <form onSubmit={submit}>
          <label>Seu nome<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <div className="public-form-row"><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Telefone / WhatsApp<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div>
          <label>Mensagem<textarea rows="4" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></label>
          <label className="public-consent"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/> Autorizo o uso dos meus dados para retorno deste contato.</label>
          {error && <p className="public-form-error">{error}</p>}
          <button className="primary-btn" disabled={sending}>{sending ? 'Enviando…' : 'Enviar contato'}</button>
        </form>}
      </section>
    </main>
    <footer>Presença digital por <a href="/">MarketIA</a></footer>
  </div>;
}

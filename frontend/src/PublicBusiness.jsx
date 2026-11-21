import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, LoaderCircle, Sparkles, Share2, Instagram, Facebook, MessageCircle, Copy } from 'lucide-react';

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
      .then(result => {
        setData(result);
        const b=result.business;
        const title=b.seo_title||b.name;
        const descriptionText=b.seo_description||b.description||b.name;
        document.title=title;
        const setMeta=(selector,attribute,value,create)=>{let node=document.querySelector(selector);if(!node&&create){node=document.createElement('meta');if(selector.startsWith('meta[property='))node.setAttribute('property',selector.match(/\[property="([^"]+)/)?.[1]||'');else node.setAttribute('name',selector.match(/\[name="([^"]+)/)?.[1]||'');document.head.appendChild(node);}if(node)node.setAttribute(attribute,value);};
        setMeta('meta[name="description"]','content',descriptionText,true);
        setMeta('meta[name="keywords"]','content',b.keywords||'',true);
        setMeta('meta[property="og:type"]','content','website',true);
        setMeta('meta[property="og:title"]','content',title,true);
        setMeta('meta[property="og:description"]','content',descriptionText,true);
        setMeta('meta[property="og:url"]','content',window.location.href,true);
        setMeta('meta[name="twitter:card"]','content','summary',true);
        setMeta('meta[name="twitter:title"]','content',title,true);
        setMeta('meta[name="twitter:description"]','content',descriptionText,true);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!data?.business) return;
    const b = data.business;
    const canonical = b.canonical_url || window.location.href;
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = canonical;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: b.name,
      description: b.seo_description || b.description || '',
      url: canonical,
      telephone: b.public_phone || undefined,
      email: b.public_email || undefined,
      address: (b.city || b.state) ? {'@type':'PostalAddress', addressLocality:b.city || undefined, addressRegion:b.state || undefined, addressCountry:'BR'} : undefined,
      sameAs: [b.instagram_url,b.facebook_url].filter(Boolean)
    };
    let script = document.getElementById('marketia-business-schema');
    if (!script) { script=document.createElement('script'); script.id='marketia-business-schema'; script.type='application/ld+json'; document.head.appendChild(script); }
    script.textContent = JSON.stringify(schema);
    fetch(API+'/api/public/business/'+encodeURIComponent(slug)+'/events', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType:'page_view',source:document.referrer?'referral':'direct'})}).catch(()=>{});
    return () => { link?.remove(); script?.remove(); };
  }, [data,slug]);

  const pageShareData = () => { const url=window.location.href; const title=data?.business?.name||'Página da empresa'; return {url,title,text:'Conheça '+title+'. '+url}; };
  const sharePage = async () => { const payload=pageShareData(); try { if(navigator.share) await navigator.share(payload); else { await navigator.clipboard.writeText(payload.text); setError('Link copiado. Agora você pode colar onde quiser.'); } } catch(e) { if(e?.name!=='AbortError') setError('Não foi possível compartilhar automaticamente.'); } };
  const shareWhatsApp = () => { const p=pageShareData(); window.open('https://wa.me/?text='+encodeURIComponent(p.text),'_blank','noopener,noreferrer'); };
  const shareFacebook = () => { const p=pageShareData(); window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(p.url),'_blank','noopener,noreferrer'); };
  const shareInstagram = async () => { const p=pageShareData(); try { if(navigator.share) await navigator.share(p); else { await navigator.clipboard.writeText(p.text); if(data?.business?.instagram_url) window.open(data.business.instagram_url,'_blank','noopener,noreferrer'); setError('Link copiado. Cole no Instagram para publicar no perfil ou Stories.'); } } catch(e) { if(e?.name!=='AbortError') setError('Não foi possível abrir o compartilhamento do Instagram.'); } };
  const copyPageLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setError('Link da página copiado.'); } catch { setError('Não foi possível copiar o link neste navegador.'); } };

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
      <div className="public-hero"><div className="public-eyebrow">{business.segment || 'Empresa'}</div><h1>{business.seo_title || business.name}</h1><p className="public-description">{business.description || 'Conheça nossos produtos e serviços. Entre em contato para saber mais.'}</p><div className="public-meta">{[business.city, business.state].filter(Boolean).join(' · ')}{business.public_phone ? ' · ' + business.public_phone : ''}</div><div className="public-share-actions"><strong>Compartilhe esta página</strong><button type="button" className="public-website" onClick={shareWhatsApp}><MessageCircle size={16}/> WhatsApp</button><button type="button" className="public-website" onClick={shareFacebook}><Facebook size={16}/> Facebook</button><button type="button" className="public-website" onClick={shareInstagram}><Instagram size={16}/> Instagram</button><button type="button" className="public-website" onClick={copyPageLink}><Copy size={16}/> Copiar link</button><button type="button" className="public-website" onClick={sharePage}><Share2 size={15}/> Mais opções</button></div>{business.website && <a className="public-website" href={business.website} target="_blank" rel="noreferrer" onClick={()=>fetch(API+'/api/public/business/'+encodeURIComponent(slug)+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType:'click_website'})}).catch(()=>{})}>Visitar site <ArrowUpRight size={15}/></a>}{business.whatsapp_url && <a className="public-website" href={business.whatsapp_url} target="_blank" rel="noreferrer" onClick={()=>fetch(API+'/api/public/business/'+encodeURIComponent(slug)+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType:'click_whatsapp'})}).catch(()=>{})}>WhatsApp <ArrowUpRight size={15}/></a>}{business.instagram_url && <a className="public-website" href={business.instagram_url} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={15}/></a>}{business.facebook_url && <a className="public-website" href={business.facebook_url} target="_blank" rel="noreferrer">Facebook <ArrowUpRight size={15}/></a>}</div>
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

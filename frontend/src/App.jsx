import React, { useEffect, useMemo, useState } from 'react';\nimport PublicBusiness from './PublicBusiness.jsx';
import { Activity, ArrowUpRight, BarChart3, Bot, Building2, CheckCircle2, ChevronDown, CircleHelp, Globe2, LogOut, Megaphone, MessageSquareText, Plus, Search, Settings2, ShieldCheck, Sparkles, Store, Users, WandSparkles, X, LoaderCircle } from 'lucide-react';

const API = 'https://marketia-54ra.onrender.com';
const modules = [
  { icon: Store, title: 'Presença digital', desc: 'Página pública e endereço exclusivo para cada negócio.', tag: 'Fundação', color: 'violet' },
  { icon: Globe2, title: 'SEO inteligente', desc: 'Metadados, conteúdo, sitemap e dados estruturados.', tag: 'Orgânico', color: 'green' },
  { icon: WandSparkles, title: 'Conteúdo com IA', desc: 'Textos, ideias de campanhas e materiais comerciais.', tag: 'IA', color: 'blue' },
  { icon: Megaphone, title: 'Campanhas', desc: 'Planejamento e conectores para mídia paga e orgânica.', tag: 'Integrações', color: 'orange' },
  { icon: Users, title: 'CRM e leads', desc: 'Organização de contatos, oportunidades e atendimentos.', tag: 'Vendas', color: 'pink' },
  { icon: BarChart3, title: 'Métricas', desc: 'Visitas, contatos, conversões e desempenho por canal.', tag: 'Analytics', color: 'cyan' },
];

async function api(path, token, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

function Dashboard() {
  const [token, setToken] = useState(() => localStorage.getItem('marketia_token') || '');
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [leads, setLeads] = useState([]);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ companyName: '', displayName: '', email: '', password: '', segment: '' });
  const [businessForm, setBusinessForm] = useState({ name: '', segment: '', description: '', website: '', publicEmail: '', publicPhone: '', city: '', state: '' });
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState('Visão geral');

  const refresh = async (session = token) => {
    const [profile, businessData, leadData] = await Promise.all([
      api('/api/me', session), api('/api/businesses', session), api('/api/leads', session)
    ]);
    setUser(profile.user); setTenant(profile.tenant); setBusinesses(businessData.businesses || []); setLeads(leadData.leads || []);
  };

  useEffect(() => {
    if (!token) { setPageLoading(false); return; }
    refresh(token).catch(() => { localStorage.removeItem('marketia_token'); setToken(''); setUser(null); setError('Sua sessão expirou. Entre novamente.'); }).finally(() => setPageLoading(false));
  }, []);

  const submitAuth = async (event) => {
    event.preventDefault(); setLoading(true); setError(''); setNotice('');
    try {
      const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const result = await api(path, '', { method: 'POST', body: JSON.stringify(authForm) });
      localStorage.setItem('marketia_token', result.token); setToken(result.token); setUser(result.user); setTenant(result.tenant);
      await refresh(result.token); setNotice('Acesso realizado. Seu espaço já está pronto.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setPageLoading(false); }
  };

  const logout = () => { localStorage.removeItem('marketia_token'); setToken(''); setUser(null); setTenant(null); setBusinesses([]); setLeads([]); setNotice(''); setError(''); };

  const createBusiness = async (event) => {
    event.preventDefault(); setLoading(true); setError(''); setNotice('');
    try {
      await api('/api/businesses', token, { method: 'POST', body: JSON.stringify(businessForm) });
      setBusinessForm({ name: '', segment: '', description: '', website: '', publicEmail: '', publicPhone: '', city: '', state: '' });
      setShowBusinessForm(false); await refresh(); setNotice('Negócio cadastrado com sucesso.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const publishBusiness = async (business) => {
    setError(''); setNotice('');
    try { await api('/api/businesses/' + business.id, token, { method: 'PATCH', body: JSON.stringify({ status: 'published' }) }); await refresh(); setNotice('Página publicada. Link: ' + window.location.origin + '/empresa/' + business.slug); }
    catch (err) { setError(err.message); }
  };

  const currentSection = useMemo(() => activeSection, [activeSection]);

  if (pageLoading) return <div className="loading-screen"><LoaderCircle className="spin" size={30}/> Conectando ao MarketIA…</div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-mark"><Sparkles size={21}/></span><span>Market<span>IA</span><small>MARKETING UNIVERSAL</small></span></a>
      <div className="workspace"><div className="workspace-icon">{tenant?.name?.[0]?.toUpperCase() || 'M'}</div><div><b>{tenant?.name || 'Seu espaço de trabalho'}</b><small>{user ? user.email : 'Acesso à plataforma'}</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">PLATAFORMA</div>
      {[[Activity,'Visão geral'],[Building2,'Empresas'],[Globe2,'Páginas e SEO'],[Megaphone,'Divulgação'],[Users,'CRM e contatos'],[BarChart3,'Desempenho']].map(([Icon,label])=><button key={label} className={'nav-item '+(currentSection===label?'active':'')} onClick={()=>setActiveSection(label)}><Icon/> {label}</button>)}
      <div className="nav-label space-top">INTELIGÊNCIA</div>
      <button className={'nav-item '+(currentSection==='Assistente IA'?'active':'')} onClick={()=>setActiveSection('Assistente IA')}><Bot/> Assistente IA</button>
      <button className={'nav-item '+(currentSection==='Automações'?'active':'')} onClick={()=>setActiveSection('Automações')}><MessageSquareText/> Automações</button>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18}/><b>Central de ajuda</b><p>Aprenda a divulgar seu negócio com inteligência.</p></div><button className="nav-item" onClick={()=>setActiveSection('Configurações')}><Settings2/> Configurações</button>{user && <button className="nav-item" onClick={logout}><LogOut/> Sair da conta</button>}<div className="profile"><div className="avatar">{user?.displayName?.slice(0,2)?.toUpperCase() || 'CS'}</div><div><b>{user?.displayName || 'Visitante'}</b><small>{user?.email || 'Entre para começar'}</small></div></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>{currentSection}</b></div><div className="top-actions"><button className="icon-btn" onClick={()=>setActiveSection('Empresas')}><Search size={18}/></button><button className="outline-btn" onClick={()=>setNotice('Central de ajuda: cadastre sua empresa para começar a usar o MarketIA.')}><CircleHelp size={16}/> Ajuda</button><div className="avatar">{user?.displayName?.slice(0,2)?.toUpperCase() || 'CS'}</div></div></header>
      <div className="content">
        {error && <div className="alert error-alert">{error}<button onClick={()=>setError('')}><X size={16}/></button></div>}
        {notice && <div className="alert success-alert">{notice}<button onClick={()=>setNotice('')}><X size={16}/></button></div>}
        <section className="welcome-row"><div><div className="eyebrow"><span className="pulse"></span> CENTRAL DE CRESCIMENTO</div><h1>Seu marketing começa aqui.</h1><p>Organize sua presença digital, planeje campanhas e acompanhe oportunidades em um só lugar.</p></div><button className="primary-btn" onClick={()=>{setShowBusinessForm(true);setError('');}}><Plus size={17}/> Adicionar negócio</button></section>
        <section className="hero">
          <div className="hero-copy"><div className="hero-kicker"><Sparkles size={15}/> INTELIGÊNCIA PARA TODOS OS NEGÓCIOS</div><h2>Uma plataforma.<br/><em>Possibilidades ilimitadas.</em></h2><p>Do primeiro cadastro à estratégia multicanal: o MarketIA reúne as ferramentas para fortalecer sua marca e aproximar seu negócio dos clientes.</p><button className="hero-btn" onClick={()=>setActiveSection('Empresas')}>Conhecer a plataforma <ArrowUpRight size={16}/></button></div>
          <div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="orb-core"><Sparkles size={39}/></div><div className="float-chip chip-a"><Globe2 size={16}/> SEO</div><div className="float-chip chip-b"><Megaphone size={16}/> Campanhas</div><div className="float-chip chip-c"><Bot size={16}/> IA</div><div className="float-chip chip-d"><Users size={16}/> Clientes</div></div>
        </section>
        <div className="section-heading"><div><h3>{currentSection === 'Visão geral' ? 'Central de ferramentas' : currentSection}</h3><p>Uma estrutura modular que cresce junto com cada empresa.</p></div><button className="text-btn" onClick={()=>setActiveSection('Empresas')}>Ver empresas <ArrowUpRight size={15}/></button></div>
        {currentSection === 'Empresas' || currentSection === 'Visão geral' ? <section className="business-panel"><div className="business-panel-head"><div><h3>Seus negócios</h3><p>{businesses.length} empresa(s) vinculada(s) à sua conta</p></div><button className="primary-btn" onClick={()=>setShowBusinessForm(true)}><Plus size={16}/> Novo negócio</button></div>
          {businesses.length ? <div className="business-list">{businesses.map(b=><article className="business-row" key={b.id}><div className="business-symbol"><Building2 size={20}/></div><div className="business-info"><b>{b.name}</b><small>{b.segment || 'Segmento não informado'} · /{b.slug}</small></div><span className={'business-status '+(b.status==='published'?'published':'')}>{b.status==='published'?'Publicado':'Rascunho'}</span>{b.status!=='published' ? <button className="outline-btn" onClick={()=>publishBusiness(b)}>Publicar página</button> : <a className="text-btn" href={'/empresa/'+b.slug} target="_blank" rel="noreferrer">Abrir página <ArrowUpRight size={14}/></a>}</article>)}</div> : <div className="empty-state"><Building2 size={28}/><b>Nenhum negócio cadastrado ainda</b><p>Cadastre sua primeira empresa para começar a organizar a presença digital.</p><button className="primary-btn" onClick={()=>setShowBusinessForm(true)}><Plus size={16}/> Cadastrar empresa</button></div>}
        </section> : <section className="business-panel"><div className="empty-state"><Sparkles size={28}/><b>{currentSection} está na próxima etapa</b><p>A fundação do sistema já está conectada. Este módulo será ativado após a conclusão dos fluxos principais.</p></div></section>}
        <section className="module-grid">{modules.map((m) => {const Icon=m.icon; return <article className="module-card" key={m.title}><div className={'module-icon '+m.color}><Icon size={20}/></div><span className="module-tag">{m.tag}</span><h4>{m.title}</h4><p>{m.desc}</p><div className="module-foot"><span><CheckCircle2 size={14}/> {m.title==='Presença digital'?'Conectado à API':'Próxima etapa'}</span><ArrowUpRight size={16}/></div></article>})}</section>
        <section className="bottom-grid"><article className="next-card"><div className="card-icon"><ShieldCheck size={19}/></div><div><h3>Base preparada para crescer</h3><p>Contas autenticadas, dados isolados por empresa e banco PostgreSQL.</p></div><span className="status-pill">API conectada</span></article><article className="tip-card"><div className="tip-title"><Sparkles size={17}/> Indicadores</div><h3>{leads.length} leads recebidos</h3><p>Os contatos enviados pelas páginas públicas aparecerão no CRM.</p><button className="text-btn" onClick={()=>setActiveSection('CRM e contatos')}>Abrir CRM <ArrowUpRight size={15}/></button></article></section>
        <footer>MarketIA <span>•</span> Marketing Inteligente Universal <span>•</span> Versão 0.2</footer>
      </div>
    </main>
    {!token && <div className="modal-backdrop"><section className="auth-modal"><div className="modal-heading"><div className="brand-mark"><Sparkles size={21}/></div><button className="modal-close" onClick={()=>setAuthMode(authMode==='login'?'register':'login')} aria-label="Alternar cadastro"><X size={18}/></button></div><h2>{authMode==='login'?'Bem-vindo ao MarketIA':'Crie seu espaço no MarketIA'}</h2><p>{authMode==='login'?'Entre para gerenciar seus negócios.':'Cadastre sua conta e sua primeira empresa.'}</p><form onSubmit={submitAuth}>{authMode==='register' && <><label>Nome da empresa<input required value={authForm.companyName} onChange={e=>setAuthForm({...authForm,companyName:e.target.value})} placeholder="Ex.: Minha Empresa"/></label><label>Seu nome<input required value={authForm.displayName} onChange={e=>setAuthForm({...authForm,displayName:e.target.value})} placeholder="Nome completo"/></label><label>Segmento (opcional)<input value={authForm.segment} onChange={e=>setAuthForm({...authForm,segment:e.target.value})} placeholder="Ex.: Loja, serviços, saúde"/></label></>}<label>E-mail<input type="email" required value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="voce@empresa.com"/></label><label>Senha<input type="password" minLength="8" required value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="Mínimo de 8 caracteres"/></label><button className="primary-btn auth-submit" disabled={loading}>{loading?<LoaderCircle className="spin" size={17}/>:null}{authMode==='login'?'Entrar':'Criar conta'}</button></form><div className="auth-switch">{authMode==='login'?'Ainda não tem conta?':'Já possui uma conta?'} <button onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setError('');}}> {authMode==='login'?'Criar cadastro':'Fazer login'}</button></div><small className="privacy-note">Seus dados ficam vinculados ao seu espaço de trabalho.</small></section></div>}
    {showBusinessForm && <div className="modal-backdrop"><section className="auth-modal business-modal"><div className="modal-heading"><div className="brand-mark"><Building2 size={20}/></div><button className="modal-close" onClick={()=>setShowBusinessForm(false)}><X size={18}/></button></div><h2>Adicionar negócio</h2><p>Informe os dados básicos. Você poderá completar o perfil depois.</p><form onSubmit={createBusiness}><label>Nome do negócio<input required value={businessForm.name} onChange={e=>setBusinessForm({...businessForm,name:e.target.value})}/></label><label>Segmento<input value={businessForm.segment} onChange={e=>setBusinessForm({...businessForm,segment:e.target.value})}/></label><label>Descrição<textarea rows="3" value={businessForm.description} onChange={e=>setBusinessForm({...businessForm,description:e.target.value})}/></label><div className="form-two"><label>Telefone<input value={businessForm.publicPhone} onChange={e=>setBusinessForm({...businessForm,publicPhone:e.target.value})}/></label><label>E-mail público<input type="email" value={businessForm.publicEmail} onChange={e=>setBusinessForm({...businessForm,publicEmail:e.target.value})}/></label></div><div className="form-two"><label>Cidade<input value={businessForm.city} onChange={e=>setBusinessForm({...businessForm,city:e.target.value})}/></label><label>Estado<input value={businessForm.state} onChange={e=>setBusinessForm({...businessForm,state:e.target.value})}/></label></div><label>Site (opcional)<input value={businessForm.website} onChange={e=>setBusinessForm({...businessForm,website:e.target.value})} placeholder="https://"/></label><button className="primary-btn auth-submit" disabled={loading}>{loading?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>} Salvar negócio</button></form></section></div>}
  </div>;
}

export default function App() {\n  const match = window.location.pathname.match(/^\\/empresa\\/([^/]+)\\/?$/);\n  return match ? <PublicBusiness slug={decodeURIComponent(match[1])} /> : <Dashboard />;\n}

import React from 'react';
import { Activity, ArrowUpRight, BarChart3, Bot, Building2, CheckCircle2, ChevronDown, CircleHelp, Globe2, Megaphone, MessageSquareText, Plus, Search, Settings2, ShieldCheck, Sparkles, Store, Users, WandSparkles } from 'lucide-react';

const modules = [
  { icon: Store, title: 'Presença digital', desc: 'Página pública e endereço exclusivo para cada negócio.', tag: 'Fundação', color: 'violet' },
  { icon: Globe2, title: 'SEO inteligente', desc: 'Metadados, conteúdo, sitemap e dados estruturados.', tag: 'Orgânico', color: 'green' },
  { icon: WandSparkles, title: 'Conteúdo com IA', desc: 'Textos, ideias de campanhas e materiais comerciais.', tag: 'IA', color: 'blue' },
  { icon: Megaphone, title: 'Campanhas', desc: 'Planejamento e conectores para mídia paga e orgânica.', tag: 'Integrações', color: 'orange' },
  { icon: Users, title: 'CRM e leads', desc: 'Organização de contatos, oportunidades e atendimentos.', tag: 'Vendas', color: 'pink' },
  { icon: BarChart3, title: 'Métricas', desc: 'Visitas, contatos, conversões e desempenho por canal.', tag: 'Analytics', color: 'cyan' },
];

function App() {
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-mark"><Sparkles size={21}/></span><span>Market<span>IA</span><small>MARKETING UNIVERSAL</small></span></a>
      <div className="workspace"><div className="workspace-icon">M</div><div><b>Meu espaço de trabalho</b><small>Ambiente de demonstração</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">PLATAFORMA</div>
      <a className="nav-item active"><Activity/> Visão geral</a>
      <a className="nav-item"><Building2/> Empresas</a>
      <a className="nav-item"><Globe2/> Páginas e SEO</a>
      <a className="nav-item"><Megaphone/> Divulgação</a>
      <a className="nav-item"><Users/> CRM e contatos</a>
      <a className="nav-item"><BarChart3/> Desempenho</a>
      <div className="nav-label space-top">INTELIGÊNCIA</div>
      <a className="nav-item"><Bot/> Assistente IA</a>
      <a className="nav-item"><MessageSquareText/> Automações</a>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18}/><b>Central de ajuda</b><p>Aprenda a divulgar seu negócio com inteligência.</p></div><a className="nav-item"><Settings2/> Configurações</a><div className="profile"><div className="avatar">CS</div><div><b>Administrador</b><small>Conta principal</small></div><ChevronDown size={15}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>Visão geral</b></div><div className="top-actions"><button className="icon-btn"><Search size={18}/></button><button className="outline-btn"><CircleHelp size={16}/> Ajuda</button><div className="avatar">CS</div></div></header>
      <div className="content">
        <section className="welcome-row"><div><div className="eyebrow"><span className="pulse"></span> CENTRAL DE CRESCIMENTO</div><h1>Seu marketing começa aqui.</h1><p>Organize sua presença digital, planeje campanhas e acompanhe oportunidades em um só lugar.</p></div><button className="primary-btn"><Plus size={17}/> Adicionar negócio</button></section>
        <section className="hero">
          <div className="hero-copy"><div className="hero-kicker"><Sparkles size={15}/> INTELIGÊNCIA PARA TODOS OS NEGÓCIOS</div><h2>Uma plataforma.<br/><em>Possibilidades ilimitadas.</em></h2><p>Do primeiro cadastro à estratégia multicanal: o MarketIA reúne as ferramentas para fortalecer sua marca e aproximar seu negócio dos clientes.</p><button className="hero-btn">Conhecer a plataforma <ArrowUpRight size={16}/></button></div>
          <div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="orb-core"><Sparkles size={39}/></div><div className="float-chip chip-a"><Globe2 size={16}/> SEO</div><div className="float-chip chip-b"><Megaphone size={16}/> Campanhas</div><div className="float-chip chip-c"><Bot size={16}/> IA</div><div className="float-chip chip-d"><Users size={16}/> Clientes</div></div>
        </section>
        <div className="section-heading"><div><h3>Central de ferramentas</h3><p>Uma estrutura modular que cresce junto com cada empresa.</p></div><button className="text-btn">Ver todos os módulos <ArrowUpRight size={15}/></button></div>
        <section className="module-grid">{modules.map((m) => {const Icon=m.icon; return <article className="module-card" key={m.title}><div className={'module-icon '+m.color}><Icon size={20}/></div><span className="module-tag">{m.tag}</span><h4>{m.title}</h4><p>{m.desc}</p><div className="module-foot"><span><CheckCircle2 size={14}/> Planejado na plataforma</span><ArrowUpRight size={16}/></div></article>})}</section>
        <section className="bottom-grid"><article className="next-card"><div className="card-icon"><ShieldCheck size={19}/></div><div><h3>Base preparada para crescer</h3><p>Arquitetura planejada para múltiplas empresas, páginas independentes e integrações autorizadas.</p></div><span className="status-pill">Fundação inicial</span></article><article className="tip-card"><div className="tip-title"><Sparkles size={17}/> Próximo passo recomendado</div><h3>Cadastre o primeiro negócio</h3><p>Vamos validar o fluxo de cadastro, a página pública e a estrutura de SEO com um negócio real.</p><button className="text-btn">Preparar cadastro <ArrowUpRight size={15}/></button></article></section>
        <footer>MarketIA <span>•</span> Marketing Inteligente Universal <span>•</span> Versão inicial 0.1</footer>
      </div>
    </main>
  </div>;
}

export default App;
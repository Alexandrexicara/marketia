import React, { useState } from 'react';
import { Bot, Send, LoaderCircle, Sparkles, Megaphone, Image, Search, CalendarCheck } from 'lucide-react';

const API='https://marketia-54ra.onrender.com';

export default function JarvisAgent({token,business}){
  const [messages,setMessages]=useState([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const send=async(value)=>{
    const content=String(value||'').trim();
    if(!content||busy||!token)return;
    const next=[...messages,{role:'user',content}];
    setMessages(next);setDraft('');setBusy(true);setError('');
    try{
      const response=await fetch(API+'/api/assistant/jarvis/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({messages:next,business_id:business?.id||null})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Jarvis ainda não está disponível.');
      setMessages(old=>[...old,{role:'assistant',content:String(data.reply||'Não recebi uma resposta.')}]);
    }catch(e){setError(e.message||'Não foi possível conectar ao Jarvis.');}
    finally{setBusy(false);}
  };
  const prompts=['Crie uma campanha para minha empresa','Prepare um texto para divulgar meus produtos','Sugira melhorias para o SEO da minha página','Planeje uma promoção para atrair clientes'];
  return <section className="business-panel jarvis-hub">
    <div className="jarvis-hub-top"><div className="jarvis-brand-mark"><Bot size={30}/></div><div className="jarvis-hub-copy"><span className="jarvis-eyebrow">AGENTE DE MARKETING DO MARKETIA</span><h2>Jarvis</h2><p>Converse com seu agente para planejar campanhas, criar textos, preparar banners e imagens, melhorar o SEO e organizar tarefas de marketing.</p></div><span className="jarvis-status"><i/> Serviço aguardando reativação</span></div>
    <div className="jarvis-agent-context"><b>Empresa selecionada:</b> {business?.name||'Selecione uma empresa no topo do painel'}<span>O contexto e os dados usados pelo agente são isolados por empresa.</span></div>
    <div className="jarvis-prompts">{prompts.map((p,i)=><button key={p} type="button" className="outline-btn" disabled={!token||busy} onClick={()=>send(p)}>{[<Megaphone size={15}/>,<Sparkles size={15}/>,<Search size={15}/>,<CalendarCheck size={15}/>][i]} {p}</button>)}</div>
    <div className="jarvis-chat" aria-live="polite">{messages.length?messages.map((m,i)=><div key={i} className={'jarvis-message '+m.role}><b>{m.role==='user'?'Você':'Jarvis'}</b><p>{m.content}</p></div>):<div className="jarvis-empty"><Bot size={25}/><b>Seu agente de marketing</b><p>Quando o serviço Jarvis for reativado, você poderá conversar aqui e solicitar tarefas para sua empresa.</p></div>}{busy&&<div className="jarvis-message assistant"><LoaderCircle size={16}/> Jarvis está pensando…</div>}</div>
    {error&&<p className="jarvis-error">{error}</p>}
    <form className="jarvis-compose" onSubmit={e=>{e.preventDefault();send(draft);}}>
      <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={token?'Escreva o que você precisa que o Jarvis faça…':'Entre na sua conta para usar o Jarvis'} disabled={!token||busy}/>
      <button type="submit" className="primary-btn" disabled={!token||busy||!draft.trim()}>{busy?<LoaderCircle size={16}/>:<Send size={16}/>} Enviar</button>
    </form>
    <p className="jarvis-service-note">O agente está aguardando a reativação do serviço na conta Primary em 1º de dezembro de 2026. O robô de ajuda do site continua separado e disponível para dúvidas sobre o uso do MarketIA.</p>
  </section>;
}

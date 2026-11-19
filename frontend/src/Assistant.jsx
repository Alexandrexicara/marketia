import React, { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Mic, Volume2, VolumeX, LoaderCircle, MessageCircle } from 'lucide-react';
import './Assistant.css';

const API = 'https://marketia-54ra.onrender.com';
const greeting = 'Olá! Eu sou o assistente virtual do MarketIA. Posso orientar você sobre cadastro, empresas, páginas, SEO, produtos, CRM, conteúdo, campanhas e desempenho. Como posso ajudar?';

export default function MarketAssistant() {
  const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState([{role:'assistant',content:greeting}]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [speaking,setSpeaking]=useState(true);
  const [listening,setListening]=useState(false);
  const [error,setError]=useState('');
  const listRef=useRef(null);
  const recognitionRef=useRef(null);

  useEffect(()=>{ if(listRef.current) listRef.current.scrollTop=listRef.current.scrollHeight; },[messages,open]);
  useEffect(()=>()=>{ try{recognitionRef.current?.stop();window.speechSynthesis?.cancel();}catch{} },[]);

  const say=(value)=>{
    if(!speaking || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(value);
    utterance.lang='pt-BR';
    const voices=window.speechSynthesis.getVoices();
    const pt=voices.filter(v=>v.lang?.toLowerCase().startsWith('pt'));
    utterance.voice=pt.find(v=>/google|luciana|francisca|female|maria/i.test(v.name))||pt[0]||null;
    utterance.rate=1;
    window.speechSynthesis.speak(utterance);
  };

  const ask=async(value)=>{
    const question=String(value||'').trim();
    if(!question||busy)return;
    const next=[...messages,{role:'user',content:question}].slice(-12);
    setMessages(next);setText('');setError('');setBusy(true);
    try{
      const response=await fetch(API+'/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next.map(({role,content})=>({role,content}))})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Não consegui responder agora.');
      const reply=String(data.reply||'').trim();
      if(!reply)throw new Error('A resposta veio vazia. Tente novamente.');
      setMessages(old=>[...old,{role:'assistant',content:reply}].slice(-14));
      say(reply);
    }catch(e){setError(e.message||'Falha ao conectar ao assistente.');}
    finally{setBusy(false);setListening(false);}
  };

  const startVoice=()=>{
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){setError('O reconhecimento de voz não está disponível neste navegador. Você ainda pode digitar sua pergunta.');return;}
    try{
      window.speechSynthesis?.cancel();
      const recognition=new SpeechRecognition();
      recognition.lang='pt-BR';recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{setListening(true);setError('');};
      recognition.onresult=e=>{const spoken=e.results?.[0]?.[0]?.transcript||'';setListening(false);if(spoken)ask(spoken);};
      recognition.onerror=e=>{setListening(false);setError(e.error==='not-allowed'?'Permita o acesso ao microfone no navegador.':'Não consegui ouvir. Tente novamente ou digite sua pergunta.');};
      recognition.onend=()=>setListening(false);
      recognitionRef.current=recognition;recognition.start();
    }catch{setListening(false);setError('Não foi possível iniciar o microfone.');}
  };

  return <div className={'market-assistant '+(open?'is-open':'')}>
    {open&&<section className="market-assistant-panel" aria-label="Assistente MarketIA">
      <header className="market-assistant-head"><div className="market-assistant-avatar"><Bot size={22}/></div><div><strong>Assistente MarketIA</strong><small>{busy?'Pensando…':listening?'Estou ouvindo…':'Ajuda inteligente da plataforma'}</small></div><button className="market-assistant-voice" onClick={()=>{setSpeaking(v=>!v);if(speaking)window.speechSynthesis?.cancel();}} title={speaking?'Desativar voz':'Ativar voz'}>{speaking?<Volume2 size={17}/>:<VolumeX size={17}/>}</button><button className="market-assistant-close" onClick={()=>{setOpen(false);window.speechSynthesis?.cancel();recognitionRef.current?.stop();}} aria-label="Fechar"><X size={19}/></button></header>
      <div className="market-assistant-messages" ref={listRef}>{messages.map((m,i)=><div key={i} className={'market-assistant-message '+m.role}>{m.content}</div>)}{busy&&<div className="market-assistant-message assistant thinking"><LoaderCircle size={15}/> Estou preparando a resposta…</div>}</div>
      {error&&<div className="market-assistant-error">{error}</div>}
      <form className="market-assistant-compose" onSubmit={e=>{e.preventDefault();ask(text);}}>
        <button type="button" className={'market-assistant-mic '+(listening?'active':'')} onClick={startVoice} disabled={busy} title="Perguntar por voz"><Mic size={18}/></button>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Digite sua dúvida…" aria-label="Sua pergunta"/>
        <button type="submit" disabled={busy||!text.trim()} aria-label="Enviar pergunta"><Send size={17}/></button>
      </form>
      <p className="market-assistant-note">A voz utiliza os recursos disponíveis no seu aparelho. Respostas geradas por IA.</p>
    </section>}
    {!open&&<div className="market-assistant-hint"><b>Precisa de ajuda?</b><span>Converse comigo</span></div>}
    <button className={'market-assistant-robot '+(busy?'thinking':listening?'listening':'sleeping')} onClick={()=>setOpen(v=>!v)} aria-label={open?'Fechar assistente':'Abrir assistente'}>
      <span className="robot-aura"></span><span className="robot-head"><span className="robot-antenna"></span><span className="robot-eyes"><i></i><i></i></span><span className="robot-mouth"></span><span className="robot-cheek left"></span><span className="robot-cheek right"></span></span><span className="robot-body"><span></span></span><span className="robot-flame"></span>
    </button>
  </div>;
}

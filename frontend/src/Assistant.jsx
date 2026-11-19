import React, { useEffect, useRef, useState } from 'react';
import { Bot, X, Mic, Volume2, VolumeX, LoaderCircle } from 'lucide-react';
import './Assistant.css';

const API = 'https://marketia-54ra.onrender.com';
const greeting = 'Olá! Eu sou o assistente do MarketIA. Toque no microfone e fale comigo.';

export default function MarketAssistant() {
  const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState([{role:'assistant',content:greeting}]);
  const [busy,setBusy]=useState(false);
  const [speaking,setSpeaking]=useState(true);
  const [listening,setListening]=useState(false);
  const [error,setError]=useState('');
  const listRef=useRef(null);
  const recognitionRef=useRef(null);
  const openRef=useRef(false);
  const busyRef=useRef(false);
  const speakingRef=useRef(true);

  useEffect(()=>{openRef.current=open;},[open]);
  useEffect(()=>{busyRef.current=busy;},[busy]);
  useEffect(()=>{speakingRef.current=speaking;},[speaking]);
  useEffect(()=>{if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight;},[messages,open]);
  useEffect(()=>()=>{try{recognitionRef.current?.stop();window.speechSynthesis?.cancel();}catch{}},[]);

  const requestMicrophone=async()=>{
    setError('');
    if(!window.isSecureContext){
      setError('O navegador não está em uma conexão segura. Abra https://marketdigitalia.netlify.app diretamente no Chrome ou Safari.');
      return;
    }
    if(!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia!=='function'){
      setError('Este navegador interno não oferece acesso ao microfone. Abra esta página no navegador do aparelho: menu ⋮ > Abrir no Chrome.');
      return;
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      stream.getTracks().forEach(track=>track.stop());
      await new Promise(resolve=>setTimeout(resolve,350));
      const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SpeechRecognition){
        setError('O microfone foi autorizado, mas este navegador não oferece reconhecimento de fala. No Android, abra no Google Chrome; no computador, use Chrome ou Edge.');
        return;
      }
      startVoice();
    }catch(e){
      if(e.name==='NotAllowedError'||e.name==='PermissionDeniedError'){
        setError('O navegador ou o Android bloqueou o microfone. No Chrome: toque no cadeado/ícone ao lado do endereço > Permissões > Microfone > Permitir. Confira também Configurações do Android > Apps > Chrome > Permissões > Microfone.');
      }else if(e.name==='NotFoundError'||e.name==='DevicesNotFoundError'){
        setError('Não encontrei um microfone disponível ou conectado neste aparelho.');
      }else if(e.name==='NotReadableError'){
        setError('O microfone está sendo usado por outro aplicativo. Feche esse aplicativo e tente novamente.');
      }else{
        setError('Não foi possível abrir o microfone ('+(e.name||'erro')+'). Abra o MarketIA no navegador principal do aparelho e tente novamente.');
      }
    }
  };

  const startVoice=()=>{
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){setError('O reconhecimento de voz não está disponível neste navegador. Abra o MarketIA no Chrome e permita o microfone.');return;}
    if(busyRef.current)return;
    try{
      recognitionRef.current?.stop();
      const recognition=new SpeechRecognition();
      recognition.lang='pt-BR';recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{setListening(true);setError('');};
      recognition.onresult=e=>{const spoken=e.results?.[0]?.[0]?.transcript||'';setListening(false);if(spoken)ask(spoken);};
      recognition.onerror=e=>{setListening(false);if(e.error==='not-allowed')setError('Permita o acesso ao microfone nas configurações do navegador.');else if(e.error!=='no-speech'&&e.error!=='aborted')setError('Não consegui ouvir. Toque no microfone e tente novamente.');};
      recognition.onend=()=>setListening(false);
      recognitionRef.current=recognition;recognition.start();
    }catch{setListening(false);setError('Não foi possível iniciar o microfone. Toque novamente para tentar.');}
  };

  const say=(value)=>{
    if(!speakingRef.current||!('speechSynthesis'in window)){if(openRef.current)setTimeout(()=>{if(openRef.current&&!busyRef.current)startVoice();},450);return;}
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(value);
    utterance.lang='pt-BR';
    const pt=window.speechSynthesis.getVoices().filter(v=>v.lang?.toLowerCase().startsWith('pt'));
    utterance.voice=pt.find(v=>/google|luciana|francisca|female|maria/i.test(v.name))||pt[0]||null;
    utterance.rate=1;
    utterance.onend=()=>{if(openRef.current&&!busyRef.current)setTimeout(()=>{if(openRef.current&&!busyRef.current)startVoice();},350);};
    utterance.onerror=()=>{if(openRef.current&&!busyRef.current)setTimeout(()=>{if(openRef.current&&!busyRef.current)startVoice();},500);};
    window.speechSynthesis.speak(utterance);
  };

  const ask=async(value)=>{
    const question=String(value||'').trim();
    if(!question||busyRef.current)return;
    busyRef.current=true;setBusy(true);setError('');
    setMessages(old=>[...old,{role:'user',content:question}].slice(-12));
    try{
      const history=[...messages,{role:'user',content:question}].slice(-12);
      const response=await fetch(API+'/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history.map(({role,content})=>({role,content}))})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Não consegui responder agora.');
      const reply=String(data.reply||'').trim();
      if(!reply)throw new Error('A resposta veio vazia. Tente novamente.');
      setMessages(old=>[...old,{role:'assistant',content:reply}].slice(-14));
      busyRef.current=false;setBusy(false);say(reply);
    }catch(e){setError(e.message||'Falha ao conectar ao assistente.');busyRef.current=false;setBusy(false);if(openRef.current)setTimeout(()=>startVoice(),700);}
  };

  const openAssistant=()=>{
    setOpen(true);openRef.current=true;setError('');
    setError('Toque em ATIVAR MICROFONE para começar a conversa.');
  };
  const closeAssistant=()=>{
    setOpen(false);openRef.current=false;setListening(false);
    try{recognitionRef.current?.stop();window.speechSynthesis?.cancel();}catch{}
  };

  return <div className={'market-assistant '+(open?'is-open':'')}>
    {open&&<section className="market-assistant-panel" aria-label="Assistente MarketIA por voz">
      <header className="market-assistant-head"><div className="market-assistant-avatar"><Bot size={22}/></div><div className="market-assistant-heading"><strong>Assistente MarketIA</strong><small>{busy?'Pensando…':listening?'Estou ouvindo você…':'Conversa por voz'}</small></div><button className="market-assistant-voice" onClick={()=>{setSpeaking(v=>{speakingRef.current=!v;if(v)window.speechSynthesis?.cancel();return !v;});}} title={speaking?'Desativar voz':'Ativar voz'}>{speaking?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button className="market-assistant-close" onClick={closeAssistant} aria-label="Fechar"><X size={19}/></button></header>
      <div className="market-assistant-messages" ref={listRef}>{messages.map((m,i)=><div key={i} className={'market-assistant-message '+m.role}><span className="message-role">{m.role==='user'?'Você':'MarketIA'}</span>{m.content}</div>)}{busy&&<div className="market-assistant-message assistant thinking"><LoaderCircle size={16}/> Estou preparando a resposta…</div>}</div>
      {error&&<div className="market-assistant-error">{error}</div>}
      <div className="market-assistant-voice-area"><button type="button" className={'market-assistant-mic '+(listening?'active':'')} onClick={requestMicrophone} disabled={busy} aria-label="Permitir acesso ao microfone e falar"><Mic size={25}/><span>PERMITIR MICROFONE</span></button><strong>{busy?'Aguarde a resposta':listening?'Pode falar':'Toque para autorizar'}</strong><span>{listening?'Estou ouvindo sua pergunta.':'Toque no botão para autorizar o microfone e começar a falar.'}</span></div>
      <p className="market-assistant-note">Usa o microfone e a voz disponíveis no seu aparelho. Não utiliza ElevenLabs.</p>
    </section>}
    {!open&&<div className="market-assistant-hint"><b>Precisa de ajuda?</b><span>Toque para conversar por voz</span></div>}
    <button className={'market-assistant-robot '+(busy?'thinking':listening?'listening':'sleeping')} onClick={()=>open?closeAssistant():openAssistant()} aria-label={open?'Fechar assistente':'Conversar com assistente por voz'}>
      <span className="robot-aura"></span><span className="robot-head"><span className="robot-antenna"></span><span className="robot-eyes"><i></i><i></i></span><span className="robot-mouth"></span><span className="robot-cheek left"></span><span className="robot-cheek right"></span></span><span className="robot-body"><span></span></span><span className="robot-flame"></span>
    </button>
  </div>;
}

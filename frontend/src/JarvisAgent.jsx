import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, LoaderCircle, Sparkles, Megaphone, Search, CalendarCheck, Mic, MicOff, Moon, Volume2, VolumeX, AudioLines } from 'lucide-react';

const API='https://marketia-54ra.onrender.com';

export default function JarvisAgent({token,business}){
  const [messages,setMessages]=useState([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [voiceEnabled,setVoiceEnabled]=useState(false);
  const [sleeping,setSleeping]=useState(true);
  const [voiceState,setVoiceState]=useState('resting');
  const [voiceSupported,setVoiceSupported]=useState(true);
  const recognitionRef=useRef(null);
  const modeRef=useRef({sleeping:true,enabled:false});
  const busyRef=useRef(false);

  useEffect(()=>{modeRef.current={sleeping,enabled:voiceEnabled};},[sleeping,voiceEnabled]);
  useEffect(()=>{busyRef.current=busy;},[busy]);

  const speak=useCallback((text)=>{
    if(!text||!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang='pt-BR';utterance.rate=1;utterance.pitch=.92;
    utterance.onstart=()=>setVoiceState('speaking');
    utterance.onend=()=>setVoiceState(modeRef.current.sleeping?'resting':'listening');
    window.speechSynthesis.speak(utterance);
  },[]);

  const send=useCallback(async(value)=>{
    const content=String(value||'').trim();
    if(!content||busyRef.current||!token)return;
    const next=[...messages,{role:'user',content}];
    setMessages(next);setDraft('');setBusy(true);busyRef.current=true;setError('');setVoiceState('thinking');
    try{
      const response=await fetch(API+'/api/assistant/jarvis/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({messages:next,business_id:business?.id||null})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Jarvis ainda não está disponível.');
      const reply=String(data.reply||'Não recebi uma resposta.');
      setMessages(old=>[...old,{role:'assistant',content:reply}]);
      if(modeRef.current.enabled)speak(reply);
      else setVoiceState(modeRef.current.sleeping?'resting':'listening');
    }catch(e){setError(e.message||'Não foi possível conectar ao Jarvis.');setVoiceState(modeRef.current.sleeping?'resting':'listening');}
    finally{setBusy(false);busyRef.current=false;}
  },[messages,token,business?.id,speak]);

  useEffect(()=>{
    if(!voiceEnabled)return;
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){setVoiceSupported(false);setVoiceEnabled(false);return;}
    const recognition=new SpeechRecognition();
    recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=false;
    recognition.onresult=(event)=>{
      const result=event.results[event.results.length-1];
      if(!result?.isFinal)return;
      const heard=result[0].transcript.trim();
      const normalized=heard.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
      const wakeIndex=normalized.indexOf('jarvis');
      if(modeRef.current.sleeping){
        if(wakeIndex<0)return;
        const command=normalized.slice(wakeIndex+6).trim();
        if(command.startsWith('descansar')||command.startsWith('dormir')){setSleeping(true);setVoiceState('resting');return;}
        setSleeping(false);setVoiceState('listening');
        const clean=heard.replace(/jarvis/i,'').trim();
        if(clean)send(clean);
        else speak('Estou ouvindo. Pode falar.');
        return;
      }
      if(wakeIndex>=0){
        const command=normalized.slice(wakeIndex+6).trim();
        if(command.startsWith('descansar')||command.startsWith('dormir')){setSleeping(true);setVoiceState('resting');window.speechSynthesis?.cancel();speak('Certo. Vou descansar. Chame Jarvis quando precisar.');return;}
        const clean=heard.replace(/jarvis/i,'').trim();
        if(clean)send(clean);
        return;
      }
      if(!busyRef.current)send(heard);
    };
    recognition.onerror=(event)=>{if(event.error!=='no-speech'&&event.error!=='aborted')setError('O microfone apresentou um problema: '+event.error);};
    recognition.onend=()=>{if(modeRef.current.enabled){try{recognition.start();}catch{}}};
    recognitionRef.current=recognition;
    try{recognition.start();setVoiceState(modeRef.current.sleeping?'resting':'listening');}catch{setError('Não foi possível iniciar o microfone. Verifique a permissão do navegador.');}
    return()=>{recognition.onend=null;try{recognition.stop();}catch{}recognitionRef.current=null;};
  },[voiceEnabled,send,speak]);

  const toggleVoice=()=>{
    if(!voiceSupported)return;
    if(voiceEnabled){setVoiceEnabled(false);setVoiceState('resting');recognitionRef.current?.stop();window.speechSynthesis?.cancel();}
    else{setVoiceEnabled(true);setSleeping(true);setError('');}
  };
  const prompts=['Crie uma campanha para minha empresa','Prepare um texto para divulgar meus produtos','Sugira melhorias para o SEO da minha página','Planeje uma promoção para atrair clientes'];
  const stateLabel=voiceState==='speaking'?'Falando':voiceState==='thinking'?'Pensando':voiceState==='listening'?'Ouvindo':'Em espera';
  return <section className="business-panel jarvis-hub jarvis-command-center">
    <div className="jarvis-hub-top"><div className="jarvis-brand-mark"><AudioLines size={30}/></div><div className="jarvis-hub-copy"><span className="jarvis-eyebrow">AGENTE DE MARKETING DO MARKETIA</span><h2>Jarvis</h2><p>Seu assistente de marketing por texto e voz. Converse, peça campanhas, conteúdos, estratégias e orientações para sua empresa.</p></div><span className="jarvis-status"><i/> Serviço aguardando reativação</span></div>
    <div className="jarvis-orb-stage">
      <div className={'jarvis-orb '+voiceState+(voiceEnabled?' voice-enabled':'')}>
        <div className="jarvis-orb-orbit orbit-a"/><div className="jarvis-orb-orbit orbit-b"/>
        <div className="jarvis-orb-core"><div className="jarvis-orb-face"><span/><span/><span/></div></div>
        <div className="jarvis-orb-scan"/>
      </div>
      <div className="jarvis-orb-caption"><b>J.A.R.V.I.S.</b><span className={'jarvis-voice-state '+voiceState}><i/>{voiceEnabled?stateLabel:'Voz desativada'}</span><small>{voiceEnabled?(sleeping?'Diga “Jarvis” para me chamar':'Estou pronto. Pode falar comigo.'):'Ative o microfone para conversar por voz'}</small></div>
      <div className="jarvis-voice-controls">
        <button type="button" className={'jarvis-voice-btn '+(voiceEnabled?'active':'')} onClick={toggleVoice} title={voiceEnabled?'Desativar microfone':'Ativar microfone'}>{voiceEnabled?<Mic size={17}/>:<MicOff size={17}/>} {voiceEnabled?'Microfone ligado':'Ativar voz'}</button>
        <button type="button" className="jarvis-voice-btn secondary" disabled={!voiceEnabled} onClick={()=>{setSleeping(true);setVoiceState('resting');window.speechSynthesis?.cancel();speak('Certo. Vou descansar. Chame Jarvis quando precisar.');}}><Moon size={16}/> Jarvis, descansar</button>
        <button type="button" className="jarvis-voice-btn secondary" disabled={!voiceEnabled} onClick={()=>{setSleeping(false);setVoiceState('listening');speak('Estou de volta. Como posso ajudar?');}}><Volume2 size={16}/> Chamar Jarvis</button>
      </div>
      {!voiceSupported&&<p className="jarvis-error">Este navegador não oferece reconhecimento de voz. Use Chrome ou Edge e permita o acesso ao microfone.</p>}
    </div>
    <div className="jarvis-agent-context"><b>Empresa selecionada:</b> {business?.name||'Selecione uma empresa no topo do painel'}<span>O contexto e os dados usados pelo agente são isolados por empresa.</span></div>
    <div className="jarvis-prompts">{prompts.map((p,i)=><button key={p} type="button" className="outline-btn" disabled={!token||busy} onClick={()=>send(p)}>{[<Megaphone size={15}/>,<Sparkles size={15}/>,<Search size={15}/>,<CalendarCheck size={15}/>][i]} {p}</button>)}</div>
    <div className="jarvis-chat" aria-live="polite">{messages.length?messages.map((m,i)=><div key={i} className={'jarvis-message '+m.role}><b>{m.role==='user'?'Você':'Jarvis'}</b><p>{m.content}</p></div>):<div className="jarvis-empty"><AudioLines size={25}/><b>Seu agente de marketing</b><p>Peça ajuda por texto ou voz. Quando o serviço Jarvis for reativado, as solicitações serão processadas pelo agente.</p></div>}{busy&&<div className="jarvis-message assistant"><LoaderCircle size={16}/> Jarvis está pensando…</div>}</div>
    {error&&<p className="jarvis-error">{error}</p>}
    <form className="jarvis-compose" onSubmit={e=>{e.preventDefault();send(draft);}}>
      <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={token?'Escreva o que você precisa que o Jarvis faça…':'Entre na sua conta para usar o Jarvis'} disabled={!token||busy}/>
      <button type="submit" className="primary-btn" disabled={!token||busy||!draft.trim()}>{busy?<LoaderCircle size={16}/>:<Send size={16}/>} Enviar</button>
    </form>
    <p className="jarvis-service-note">O agente está aguardando a reativação do serviço na conta Primary em 1º de dezembro de 2026. O robô de ajuda do site continua separado e disponível para dúvidas sobre o uso do MarketIA.</p>
  </section>;
}

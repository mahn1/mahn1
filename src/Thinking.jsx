import React, {useEffect, useState} from 'react';
export function formatDuration(ms) {
  const seconds=Math.floor(Math.max(0,ms)/1000), minutes=Math.floor(seconds/60);
  return minutes ? `${minutes} мин ${seconds%60} с` : `${seconds} с`;
}
export default function Thinking({message}) {
  const [now,setNow]=useState(Date.now());
  const running=message.toolStatus==='running';
  useEffect(()=>{if(!running)return;const id=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(id)},[running]);
  const elapsed=running?now-(message.startedAt || now):message.durationMs || 0;
  return <div className={'thinking-line '+(running?'is-thinking':'')} title="Время ожидания ответа OpenRouter, включая сеть; не внутреннее время рассуждений модели."><span className="thinking-orb"><i/><i/><i/></span><span>{running?'Думаю':message.toolStatus==='interrupted'?'Ожидание прервано':'Думала'} · {formatDuration(elapsed)}</span></div>;
}

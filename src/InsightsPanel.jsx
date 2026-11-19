import React from 'react';
import {BarChart3, FolderOpen, Plus, HardDrive, ArrowUpRight} from 'lucide-react';

const colors=['#a4e77c','#72b968','#548c64','#a8c5a7','#677d6d','#788079'];
const fmt = n => new Intl.NumberFormat('ru-RU').format(n || 0);
export function buildUsage(usage) {
  return Object.entries(usage || {}).map(([name, data])=>({name, total:Number(data.TotalTokens ?? data.totalTokens ?? 0), prompt:Number(data.PromptTokens ?? data.promptTokens ?? 0), completion:Number(data.CompletionTokens ?? data.completionTokens ?? 0), requests:Number(data.Requests ?? data.requests ?? 0)})).filter(item=>Number.isFinite(item.total) && item.total>=0).sort((a,b)=>b.total-a.total);
}
export default function InsightsPanel({usage,storagePath,onOpenStorage,onAddStorage,busy}) {
  const models=buildUsage(usage); const total=models.reduce((sum,x)=>sum+x.total,0); const shown=models.slice(0,4);
  const other=models.slice(4).reduce((sum,x)=>sum+x.total,0); if (other>0) shown.push({name:'Другие модели',total:other});
  let cursor=0; const radius=47,circumference=2*Math.PI*radius;
  return <aside className="insights" aria-label="Статистика и хранилище">
    <div className="insights-heading"><div><span className="insight-eyebrow">ВАШЕ ПРОСТРАНСТВО</span><h2>Обзор</h2></div><span className="insight-header-icon"><BarChart3 size={16}/></span></div>
    <div className="insight-rule"/><div className="insight-title"><div><span className="insight-eyebrow">ИСПОЛЬЗОВАНИЕ</span><h3>Токены по моделям</h3></div><span className="live-indicator"><i/> LIVE</span></div>
    <div className="donut-wrap"><svg viewBox="0 0 120 120" role="img" aria-label={`Всего ${fmt(total)} токенов`}><circle cx="60" cy="60" r={radius} fill="none" stroke="#373737" strokeWidth="9"/>{total>0&&shown.map((item,i)=>{const length=item.total/total*circumference;const start=cursor;cursor+=length;return <circle key={item.name} cx="60" cy="60" r={radius} fill="none" stroke={colors[i%colors.length]} strokeWidth="9" strokeDasharray={`${length} ${circumference-length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)"/>})}</svg><div className="donut-label"><strong>{fmt(total)}</strong><span>ТОКЕНОВ</span></div></div>
    {models.length>0?<div className="model-legend">{shown.map((item,i)=><div className="legend-row" key={item.name}><i style={{background:colors[i%colors.length]}}/><span title={item.name}>{item.name}</span><strong>{fmt(item.total)}</strong></div>)}</div>:<p className="insight-empty">Статистика появится после ответа модели, если провайдер вернёт данные об использовании.</p>}
    <p className="insight-note">Только ответы с данными провайдера. Не включает прошлые запросы до обновления.</p>
    <div className="insight-rule"/><div className="insight-title"><div><span className="insight-eyebrow">ФАЙЛЫ И ИДЕИ</span><h3>Локальное хранилище</h3></div><HardDrive size={16} className="insight-muted"/></div>
    <div className="storage-box"><div className="storage-icon"><FolderOpen size={18}/></div><div><strong>Пространство Elisa</strong><p>Заметки, проекты и готовые файлы — рядом и под вашим контролем.</p></div></div>
    <div className="storage-path" title={storagePath || 'Откройте приложение Windows'}>{storagePath || 'Доступно в приложении Windows'}</div>
    <button className="storage-action" onClick={onOpenStorage}><FolderOpen size={14}/> Открыть папку <ArrowUpRight size={14}/></button><button className="storage-workspace" disabled={busy} onClick={onAddStorage}><Plus size={13}/> Добавить в рабочие области</button>
    <p className="insight-note">Файлы папки не шифруются автоматически.</p>
    <div className="insights-bottom"><span className="tiny-star">✳</span> ELISA VIORA <span>1.0</span></div>
  </aside>;
}

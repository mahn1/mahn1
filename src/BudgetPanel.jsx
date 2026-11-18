import React, {useState} from 'react';
const read=(obj,key)=>obj?.[key] ?? obj?.[key[0].toLowerCase()+key.slice(1)];
function CapForm({provider,cap,daily,onAction,busy}) {
 const [requests,setRequests]=useState(String(read(cap,'Requests')||0)),[tokens,setTokens]=useState(String(read(cap,'Tokens')||0));
 return <form className="budget-card" onSubmit={e=>{e.preventDefault();onAction({type:'set_budget',provider,requests:Number(requests),tokens:Number(tokens)})}}><strong>{provider==='nvidia'?'NVIDIA Build':'OpenRouter'}</strong><p>Локально за {read(daily,'Date')||'сегодня (UTC)'}: {read(daily,'Requests')||0} запросов · {read(daily,'Tokens')||0} токенов по данным ответов</p><label>Запросов в сутки <input type="number" min="0" max="1000000" step="1" value={requests} onChange={e=>setRequests(e.target.value)} required/></label><label>Токенов в сутки <input type="number" min="0" max="1000000000" step="1" value={tokens} onChange={e=>setTokens(e.target.value)} required/></label><button className="settings-secondary" disabled={busy}>Сохранить лимиты</button></form>;
}
export default function BudgetPanel({caps={},daily={},quota,quotaError,onAction,busy}) {
 const free=quota?.freeRequests;
 return <div><div className="settings-block"><div><h3>Лимиты и расходы</h3><p>Локальные ограничения для запросов Elisa; ноль означает отсутствие лимита.</p></div></div><div className="demo-info">Лимит токенов проверяется перед запросом и может быть превышен одним ответом. Учитываются только данные usage, которые вернули провайдеры. Это не денежный лимит и не учёт запросов из других приложений.</div>
 {['openrouter','nvidia'].map(provider=><CapForm key={provider} provider={provider} cap={caps[provider]} daily={daily[provider]} onAction={onAction} busy={busy}/>)}
 <div className="budget-quota"><strong>OpenRouter · данные аккаунта</strong><button type="button" className="settings-secondary" onClick={()=>onAction({type:'openrouter_quota'})}>Обновить квоту</button>{quotaError?<p>{quotaError}</p>:quota?<p>Расход сегодня: {quota.usageDaily ?? 'нет данных'} USD · за месяц: {quota.usageMonthly ?? 'нет данных'} USD<br/>Бесплатные запросы: {free ? `${free.remaining ?? '—'} осталось из ${free.limit ?? '—'}` : 'нет данных'}</p>:<p>Данные появятся после проверки. Для NVIDIA остаток квоты здесь неизвестен.</p>}</div>
 <p className="settings-hint">Автоматического перехода на платные модели нет. Выбранная вручную модель может быть платной; проверяйте тариф у провайдера.</p></div>;
}

import React, {useState} from 'react';

const roles = [['research','Исследование'],['implement','Реализация'],['review','Проверка'],['general','Общие задачи']];
export const initialProviderSettings = {provider:'openrouter',openRouterModel:'openrouter/free',nvidiaModel:'deepseek-ai/deepseek-v4.1-flash',openRouterConfigured:false,nvidiaConfigured:false,routes:{}};
export function normalizeRoutes(routes={}) {
  return Object.fromEntries(roles.map(([role])=>[role,{provider:routes[role]?.provider ?? routes[role]?.Provider ?? 'inherit',model:routes[role]?.model ?? routes[role]?.Model ?? ''}]));
}
export default function ProviderSettings({initial=initialProviderSettings,onSave,busy,diagnostics,diagnosing,onDiagnose}) {
  const [provider,setProvider]=useState(initial.provider || 'openrouter');
  const [openRouterModel,setOpenRouterModel]=useState(initial.openRouterModel || 'openrouter/free');
  const [nvidiaModel,setNvidiaModel]=useState(initial.nvidiaModel || 'deepseek-ai/deepseek-v4.1-flash');
  const [openRouterKey,setOpenRouterKey]=useState('');
  const [nvidiaKey,setNvidiaKey]=useState('');
  const [routes,setRoutes]=useState(()=>normalizeRoutes(initial.routes));
  const updateRole=(role,update)=>setRoutes(prev=>({...prev,[role]:{...prev[role],...update}}));
  return <form className="provider-settings" onSubmit={e=>{e.preventDefault();onSave({type:'configure_providers',provider,openRouterKey,openRouterModel,nvidiaKey,nvidiaModel,routes})}}>
    <div className="settings-block"><div><h3>Провайдеры и модели</h3><p>Выбери основную модель и при желании назначь отдельные модели агентам.</p></div></div>
    <div className="demo-info">Ключи сохраняются средствами Windows. При делегировании описание задачи отправляется выбранному провайдеру; его условия, лимиты и цены могут отличаться.</div>
    <label className="field-label" htmlFor="provider-main">Основной провайдер</label><select id="provider-main" className="settings-input" value={provider} onChange={e=>setProvider(e.target.value)}><option value="openrouter">OpenRouter</option><option value="nvidia">NVIDIA Build</option></select>
    <label className="field-label" htmlFor="or-key">Ключ OpenRouter {initial.openRouterConfigured?'· сохранён':''}</label><input id="or-key" type="password" autoComplete="off" className="settings-input" value={openRouterKey} onChange={e=>setOpenRouterKey(e.target.value)} placeholder={initial.openRouterConfigured?'Оставь пустым, чтобы сохранить ключ':'API-ключ OpenRouter'}/>
    <label className="field-label" htmlFor="or-model">Модель OpenRouter</label><input id="or-model" className="settings-input" value={openRouterModel} onChange={e=>setOpenRouterModel(e.target.value)} required/>
    <label className="field-label" htmlFor="nv-key">Ключ NVIDIA Build {initial.nvidiaConfigured?'· сохранён':''}</label><input id="nv-key" type="password" autoComplete="off" className="settings-input" value={nvidiaKey} onChange={e=>setNvidiaKey(e.target.value)} placeholder={initial.nvidiaConfigured?'Оставь пустым, чтобы сохранить ключ':'API-ключ NVIDIA Build'}/>
    <label className="field-label" htmlFor="nv-model">Модель NVIDIA Build</label><input id="nv-model" className="settings-input" value={nvidiaModel} onChange={e=>setNvidiaModel(e.target.value)} required/>
    <div className="role-route-header"><h3>Модели агентов</h3><p>Пустой ID — модель провайдера по умолчанию. Независимые агенты исследования и проверки могут работать параллельно.</p></div>
    {roles.map(([role,label])=><div className="role-route" key={role}><label htmlFor={'provider-'+role}>{label}</label><select id={'provider-'+role} className="settings-input" value={routes[role].provider} onChange={e=>updateRole(role,{provider:e.target.value})}><option value="inherit">Как основной</option><option value="openrouter">OpenRouter</option><option value="nvidia">NVIDIA Build</option></select><input className="settings-input" aria-label={'Модель: '+label} value={routes[role].model} onChange={e=>updateRole(role,{model:e.target.value})} placeholder="Модель по умолчанию"/></div>)}
    <p className="settings-hint">Для инструментов и картинок нужна поддержка модели. NVIDIA в Elisa пока принимает текст и изображения, но не PDF или бинарные вложения. При смене провайдера история текущего чата отправляется новому провайдеру.</p>
    <p className="settings-hint">Проверка использует сохранённые настройки основной модели, выполняет до трёх запросов и может расходовать квоту или деньги. Сначала примените изменения.</p>
    <button type="button" className="settings-secondary" disabled={busy} onClick={onDiagnose}>{diagnosing?'Проверяю…':'Проверить сохранённую модель'}</button>{diagnostics&&<pre className="github-status">{diagnostics}</pre>}
    <button className="done-button" disabled={busy}>Применить</button>
  </form>;
}

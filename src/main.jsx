import React, {useState, useRef, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {PanelLeftClose, PanelLeftOpen, SquarePen, Search, MessageSquare, ChevronRight, MoreHorizontal, ArrowUp, SlidersHorizontal, Code2, Lightbulb, PenLine, BookOpen, Sparkles, ArrowUpRight, X, Globe2, Clock3, Menu, Square, ShieldAlert, TerminalSquare, FolderPlus, Trash2, FolderClosed} from 'lucide-react';
import './styles.css';
import logo from '../assets/elisa-logo.svg';

const prompts = [
  {icon: Code2, label: 'Написать код', text: 'Помоги написать код для моего проекта'},
  {icon: PenLine, label: 'Создать текст', text: 'Помоги мне написать текст'},
  {icon: Lightbulb, label: 'Придумать идеи', text: 'Помоги придумать идеи для нового проекта'},
  {icon: BookOpen, label: 'Разобраться в теме', text: 'Объясни мне сложную тему простыми словами'},
];
const desktop = Boolean(window.chrome?.webview);
function Mark({small=false}) {return <span className={'mark '+(small?'mark-small':'')} aria-hidden="true"><img src={logo} alt=""/></span>}
function App() {
  const [sidebar, setSidebar] = useState(true);
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState('openrouter/free');
  const [modelInput, setModelInput] = useState('openrouter/free');
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [modal, setModal] = useState(null);
  const [settingsTab, setSettingsTab] = useState('workspaces');
  const [paths, setPaths] = useState([]);
  const [unrestricted, setUnrestricted] = useState(false);
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState('');
  const textarea = useRef(null);
  const endRef = useRef(null);
  useEffect(()=>{ const handleKey = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setActive(null); setDraft(''); } }; window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, []);
  useEffect(()=>{ if(!toast)return; const timer=setTimeout(()=>setToast(''),5000);return ()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{
    if (!desktop) return;
    const receive = ({data}) => {
      if (data.type === 'configured') {setConfigured(true);setModel(data.model);setApiKey('');setModal(null);setToast('Настройки применены. Ключ хранится только до закрытия Elisa.');}
      if (data.type === 'workspace_settings') {setPaths(data.paths);setUnrestricted(data.unrestricted);}
      if (data.type === 'path_added') setToast('Папка Elisa добавлена в PATH. Перезапустите терминал.');
      if (data.type === 'status') setStatus(data.text);
      if (['answer','step','tool_result'].includes(data.type)) {
        setMessages(prev=>({...prev,[data.conversationId]:[...(prev[data.conversationId]||[]),{role:data.type,text:data.text,command:data.command}]}));
        if (data.type === 'answer') {setBusy(false);setStatus('');}
      }
      if (data.type === 'error') {
        if (data.conversationId) {setMessages(prev=>({...prev,[data.conversationId]:[...(prev[data.conversationId]||[]),{role:'error',text:data.text}]}));setBusy(false);setStatus('');}
        else setToast(data.text);
      }
    };
    window.chrome.webview.addEventListener('message',receive);
    window.chrome.webview.postMessage({type:'get_settings'});
    return ()=>window.chrome.webview.removeEventListener('message',receive);
  },[]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,status,active]);
  const newChat = () => {setActive(null);setDraft('')};
  const openChat = (id) => {setActive(id);setModal(null);setDraft('')};
  const submit = () => {
    const value=draft.trim(); if(!value||busy)return;
    if (!desktop) {setToast('Агент работает только в Windows-приложении Elisa.exe.');return;}
    if (!configured) {setSettingsTab('provider');setModal('settings');setToast('Сначала настройте OpenRouter.');return;}
    let id=active;
    if(!id){id=crypto.randomUUID();setChats(prev=>[{id,title:value.length>36?value.slice(0,36)+'…':value,preview:value},...prev]);setActive(id);}
    setMessages(prev=>({...prev,[id]:[...(prev[id]||[]),{role:'user',text:value}]}));
    setDraft('');setBusy(true);setStatus('Отправляю запрос в OpenRouter…');
    window.chrome.webview.postMessage({type:'send',conversationId:id,text:value});
  };
  const configure = () => {
    if (!desktop) {setToast('Настройка доступна в Windows-приложении Elisa.exe.');return;}
    if ((!configured && !apiKey.trim()) || !modelInput.trim()) {setToast('Укажите ключ и ID модели.');return;}
    window.chrome.webview.postMessage({type:'configure',key:apiKey,model:modelInput});
  };
  const desktopAction = (message) => { if (!desktop) {setToast('Доступно в Windows-приложении Elisa.exe.');return;} window.chrome.webview.postMessage(message); };
  const current = chats.find(c=>c.id===active);
  const filtered = chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()));
  return <div className="app-shell">
    {sidebar && <aside className="sidebar">
      <div className="brand-row"><button className="brand" onClick={newChat}><Mark small/><span>elisa</span><span className="brand-dot">.</span></button><button className="icon-button sidebar-toggle" title="Свернуть панель" onClick={()=>setSidebar(false)}><PanelLeftClose size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><SquarePen size={17}/><span>Новый чат</span><span className="shortcut">Ctrl K</span></button>
      <nav className="navigation"><button onClick={()=>{setModal('search');setSearch('')}}><Search size={17}/><span>Поиск</span></button><button className="nav-selected" onClick={newChat}><MessageSquare size={17}/><span>Чаты</span></button></nav>
      <div className="side-divider"/><div className="history"><div className="side-heading">НЕДАВНИЕ <MoreHorizontal size={17}/></div><div className="history-group">{chats.length?<div className="history-label">В этой сессии</div>:<div className="history-label">Здесь появятся ваши чаты</div>}{chats.map(chat=><button className={'history-item '+(active===chat.id?'history-active':'')} key={chat.id} onClick={()=>openChat(chat.id)}>{chat.title}</button>)}</div></div>
      <div className="sidebar-bottom"><div className="upgrade"><div className="upgrade-icon"><ShieldAlert size={15}/></div><div><strong>{unrestricted?'Полный доступ к Windows':'Рабочие области'}</strong><span>{unrestricted?'Без ограничений папками':`${paths.length} папок · без подтверждений`}</span></div><button title="Настройки" onClick={()=>setModal('settings')}><ArrowUpRight size={15}/></button></div><button className="profile" onClick={()=>setModal('settings')}><span className="avatar">В</span><span className="profile-text"><strong>Ваше пространство</strong><small>Настройки OpenRouter</small></span><MoreHorizontal size={18}/></button></div>
    </aside>}
    <main className="main">
      <header className="topbar"><div className="top-left">{!sidebar&&<button className="icon-button" onClick={()=>setSidebar(true)} title="Открыть панель"><PanelLeftOpen size={19}/></button>}<span>{active?'Чат':'Личное пространство'}</span>{active&&<><ChevronRight size={14}/><strong>{current?.title}</strong></>}</div><div className="top-right"><span className="connection"><span className={"connection-dot "+(configured?"connected":"")}/> {configured?'OpenRouter настроен':'Не подключено'}</span><button className="icon-button mobile-menu" onClick={()=>setSidebar(!sidebar)} title="Меню"><Menu size={19}/></button><button className="icon-button top-settings" title="Настройки" onClick={()=>setModal('settings')}><SlidersHorizontal size={17}/></button></div></header>
      {active ? <section className="conversation"><div className="conversation-inner"><div className="conversation-title"><span className="tiny-star">✳</span><span>Личное пространство</span></div><h2>{current?.title}</h2>{(messages[active]||[]).map((message,i)=>message.role==='user'?<div className="message user-message" key={i}>{message.text}</div>:message.role==='tool_result'?<details className="tool-result" key={i}><summary><TerminalSquare size={16}/> Результат действия</summary>{message.command&&<><strong>Команда</strong><pre>{message.command}</pre></>}<strong>Результат</strong><pre>{message.text}</pre></details>:<div className={'assistant-message '+(message.role==='error'?'error-message':'')} key={i}><Mark small/><div><strong>{message.role==='error'?'Ошибка':'Elisa'}</strong><p>{message.text}</p></div></div>)}{busy&&status&&<div className="agent-status"><span className="connection-dot"/>{status}</div>}<div ref={endRef}/></div><div className="conversation-composer"><Composer {...{draft,setDraft,submit,model,textarea,busy}} settings={()=>setModal('settings')} cancel={()=>window.chrome.webview.postMessage({type:'cancel'})}/><div className="disclaimer">{unrestricted?'Полный доступ к Windows включён. Действия выполняются без подтверждений.':'Файловые действия выполняются без подтверждений в рабочих областях.'}</div></div></section> : <section className="home-view">
        <div className="welcome"><div className="welcome-icon"><img src={logo} alt="Логотип Elisa"/></div><div className="greeting-overline">ВАШЕ ПРОСТРАНСТВО ДЛЯ ИДЕЙ</div><h1>Чем займёмся сегодня<span>?</span></h1><p>Большие идеи начинаются с простого вопроса.</p></div>
        <Composer {...{draft,setDraft,submit,model,textarea,busy}} settings={()=>setModal('settings')} cancel={()=>window.chrome.webview.postMessage({type:'cancel'})}/>
        <div className="prompt-list">{prompts.map(({icon:Icon,label,text})=><button key={label} onClick={()=>{setDraft(text);textarea.current?.focus()}}><Icon size={15}/>{label}<ArrowUpRight size={13} className="prompt-arrow"/></button>)}</div>
        <div className="recent"><div className="recent-header"><div><div className="section-eyebrow">ПРОДОЛЖИТЬ С ТОГО ЖЕ МЕСТА</div><h2>Недавние чаты</h2></div><button onClick={()=>setModal('search')}>Все чаты <ChevronRight size={15}/></button></div>{chats.length?<div className="recent-grid">{chats.slice(0,3).map(chat=><button className="recent-card" key={chat.id} onClick={()=>openChat(chat.id)}><div className="card-icon"><Clock3 size={17}/></div><strong>{chat.title}</strong><p>{chat.preview}</p><span>В этой сессии <ArrowUpRight size={14}/></span></button>)}</div>:<div className="empty-history">Начните новый диалог — он появится здесь.</div>}</div>
        <div className="home-footer"><span>Создано для вашего потока мыслей <span className="footer-star">✳</span></span><span>Работает с OpenRouter <span className="footer-dot">●</span></span></div>
      </section>}
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={()=>setModal(null)}><div className={'modal '+(modal==='search'?'search-modal':'')} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="section-eyebrow">{modal==='search'?'ВАШИ ДИАЛОГИ':'ВАШЕ ПРОСТРАНСТВО'}</span><h2>{modal==='search'?'Поиск по чатам':'Настройки'}</h2></div><button className="icon-button" onClick={()=>setModal(null)} aria-label="Закрыть"><X size={19}/></button></div>{modal==='search'?<><label className="search-field"><Search size={18}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Найти чат..."/></label><div className="search-results">{filtered.length?filtered.map(c=><button key={c.id} onClick={()=>openChat(c.id)}><MessageSquare size={16}/><span>{c.title}<small>В этой сессии</small></span><ChevronRight size={16}/></button>):<p>Чаты не найдены</p>}</div></>:<div className="settings-content">
      <div className="settings-tabs"><button className={settingsTab==='workspaces'?'selected':''} onClick={()=>setSettingsTab('workspaces')}>Рабочие области</button><button className={settingsTab==='provider'?'selected':''} onClick={()=>setSettingsTab('provider')}>OpenRouter</button><button className={settingsTab==='system'?'selected':''} onClick={()=>setSettingsTab('system')}>Система</button></div>
      {settingsTab==='workspaces'?<>
        <div className="settings-block"><div className="settings-icon"><FolderClosed size={19}/></div><div><h3>Папки для работы</h3><p>Файлы в выбранных папках доступны агенту автоматически.</p></div></div>
        <div className="workspace-list">{paths.length?paths.map(path=><div className="workspace-row" key={path}><FolderClosed size={16}/><span title={path}>{path}</span><button disabled={busy} title="Удалить" onClick={()=>desktopAction({type:'remove_workspace',path})}><Trash2 size={16}/></button></div>):<div className="workspace-empty">Рабочие области пока не добавлены</div>}</div>
        <button className="settings-secondary" disabled={busy} onClick={()=>desktopAction({type:'add_workspace'})}><FolderPlus size={16}/> Добавить папку</button>
        <div className="workspace-toggle"><div><strong>Полный доступ к Windows</strong><p>Включает PowerShell без ограничений выбранными папками.</p></div><label className="switch"><input aria-label="Полный доступ к Windows" type="checkbox" checked={unrestricted} disabled={busy} onChange={e=>desktopAction({type:'set_unrestricted',enabled:e.target.checked})}/><span/></label></div>
        <div className={'access-warning '+(unrestricted?'danger':'')}><ShieldAlert size={17}/><span>{unrestricted?'Включён полный доступ: агент может изменять и удалять любые доступные файлы, запускать программы и обращаться в сеть без подтверждений.':'Без подтверждений агент может читать и перезаписывать файлы в выбранных папках. Это ограничение путей, а не песочница Windows.'}</span></div>
      </>:settingsTab==='provider'?<>
        <div className="settings-block"><div className="settings-icon"><Globe2 size={19}/></div><div><h3>Подключение OpenRouter</h3><p>Модель должна поддерживать вызов инструментов.</p></div></div>
        <div className="demo-info"><ShieldAlert size={17}/><span>Ключ хранится в памяти до закрытия приложения. Сообщения и результаты действий передаются в OpenRouter.</span></div>
        <label className="field-label" htmlFor="apiKey">API-ключ OpenRouter</label><input id="apiKey" className="settings-input" type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={configured?'Оставьте пустым, чтобы сохранить текущий':'sk-or-v1-…'}/><label className="field-label" htmlFor="model">ID модели OpenRouter</label><input id="model" className="settings-input" value={modelInput} onChange={e=>setModelInput(e.target.value)} placeholder="openrouter/free"/><p className="settings-hint">Укажите точный ID модели. Доступность и тарифы зависят от OpenRouter.</p><button className="done-button" onClick={configure} disabled={busy}>Применить</button>
      </>:<><div className="settings-block"><div className="settings-icon"><TerminalSquare size={19}/></div><div><h3>Команда в терминале</h3><p>Добавьте папку Elisa в пользовательский PATH.</p></div></div><p className="settings-system-description">После добавления перезапустите терминал и вводите <code>Elisa</code>. Если переместите приложение, добавьте его в PATH заново. Это не влияет на права агента.</p><button className="settings-secondary" disabled={busy} onClick={()=>desktopAction({type:'add_to_path'})}>Добавить Elisa в PATH</button></>}
    </div>}</div></div>}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
function Composer({draft,setDraft,submit,model,textarea,busy,settings,cancel}){return <div className="composer"><textarea ref={textarea} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}} placeholder="Спросите о чём угодно..." rows="2"/><div className="composer-bottom"><div className="composer-tools"><button className="tool-button" title="Настройки" onClick={settings}><SlidersHorizontal size={17}/></button><span className="access-label">Без подтверждений</span></div><div className="composer-actions"><button className="model-button" title="Изменить модель" onClick={settings}><span className="model-spark">✳</span> {model}</button>{busy?<button className="send-button" aria-label="Остановить" title="Остановить" onClick={cancel}><Square size={15}/></button>:<button className="send-button" aria-label="Отправить" onClick={submit}><ArrowUp size={19}/></button>}</div></div></div>}

createRoot(document.getElementById('root')).render(<App/>);

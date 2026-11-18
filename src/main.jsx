import React, {useState, useRef, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {PanelLeftClose, PanelLeftOpen, SquarePen, Search, MessageSquare, ChevronRight, MoreHorizontal, ArrowUp, SlidersHorizontal, Code2, Lightbulb, PenLine, BookOpen, Sparkles, ArrowUpRight, X, Globe2, Clock3, Menu, Square, ShieldAlert, TerminalSquare, FolderPlus, Trash2, FolderClosed, Paperclip, FileText, BarChart3} from 'lucide-react';
import './styles.css';
import logo from '../assets/elisa-logo.svg';
import Markdown from './Markdown.jsx';
import {updateToolMessages} from './chatEvents.js';
import ToolActivity from './ToolActivity.jsx';
import InsightsPanel from './InsightsPanel.jsx';
import Thinking from './Thinking.jsx';
import ChatImages from './ChatImages.jsx';

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
  const [usage,setUsage] = useState({});
  const [storagePath,setStoragePath] = useState('');
  const [panelOpen,setPanelOpen] = useState(()=>window.innerWidth >= 1150);
  const [contextMenu,setContextMenu] = useState(null);
  const [renameTarget,setRenameTarget] = useState(null);
  const [renameText,setRenameText] = useState('');
  const [githubStatus,setGithubStatus] = useState('Проверьте подключение после входа.');
  const [busyChat,setBusyChat] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const textarea = useRef(null);
  const endRef = useRef(null);
  useEffect(()=>{ const handleKey = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setActive(null); setDraft(''); setAttachments([]); } }; window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, []);
  useEffect(()=>{const close=e=>{if(e.key==='Escape')setContextMenu(null)};window.addEventListener('keydown',close);return ()=>window.removeEventListener('keydown',close)},[]);
  useEffect(()=>{ if(!toast)return; const timer=setTimeout(()=>setToast(''),5000);return ()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{
    if (!desktop) return;
    const receive = ({data}) => {
      if (data.type === 'configured') {setConfigured(true);setModel(data.model);setApiKey('');setModal(null);setToast('Настройки сохранены и защищены средствами Windows.');}
      if (data.type === 'state_loaded') {
        setConfigured(data.configured); setModel(data.model); setModelInput(data.model); setUsage(data.usage || {});
        setChats(data.chats.map(({messages,...chat})=>chat));
        setMessages(Object.fromEntries(data.chats.map(chat=>[chat.id,chat.messages])));
      }
      if (data.type === 'persistence_warning') setToast(data.text);
      if (data.type === 'usage_updated') setUsage(data.usage || {});
      if (data.type === 'storage_ready') setStoragePath(data.path);
      if (data.type === 'github_status') setGithubStatus(data.text);
      if (data.type === 'github_login_started') setToast('Завершите вход в открывшемся терминале и браузере, затем проверьте подключение.');
      if (data.type === 'assistant_image') setMessages(prev=>({...prev,[data.conversationId]:[...(prev[data.conversationId]||[]),{role:'assistant_image',images:[data.image]}]}));
      if (data.type === 'storage_added') setToast('Хранилище добавлено в рабочие области.');
      if (data.type === 'file_revealed') setToast('Потенциально исполняемый файл показан в Проводнике, без запуска.');
      if (data.type === 'chat_renamed') {setChats(prev=>prev.map(chat=>chat.id===data.id?{...chat,title:data.title}:chat));setRenameTarget(null);}
      if (data.type === 'chat_deleted') {setChats(prev=>prev.filter(chat=>chat.id!==data.id));setMessages(prev=>{const copy={...prev};delete copy[data.id];return copy});setActive(prev=>prev===data.id?null:prev);setToast('Чат удалён.');}
      if (data.type === 'thinking_start') {setStatus('');setMessages(prev=>({...prev,[data.conversationId]:[...(prev[data.conversationId]||[]),{role:'thinking_start',toolId:data.toolId,toolStatus:'running',startedAt:Date.now()}]}));}
      if (data.type === 'thinking_finish') setMessages(prev=>({...prev,[data.conversationId]:(prev[data.conversationId]||[]).map(item=>item.toolId===data.toolId?{...item,durationMs:data.durationMs,toolStatus:data.toolStatus}:item)}));
      if (data.type === 'workspace_settings') {setPaths(data.paths);setUnrestricted(data.unrestricted);}
      if (data.type === 'copied') setToast('Скопировано.');
      if (data.type === 'path_added') setToast('Папка Elisa добавлена в PATH. Перезапустите терминал.');
      if (data.type === 'status') setStatus(data.text);
      if (data.type === 'tool_start' || data.type === 'tool_finish') setMessages(prev=>({...prev,[data.conversationId]:updateToolMessages(prev[data.conversationId]||[],data)}));
      if (['answer','step','tool_result'].includes(data.type)) {
        setMessages(prev=>({...prev,[data.conversationId]:[...(prev[data.conversationId]||[]),{role:data.type,text:data.text,command:data.command}]}));
        if (data.type === 'answer') {setBusy(false);setBusyChat(null);setStatus('');}
      }
      if (data.type === 'error') {
        if (data.conversationId) {setMessages(prev=>({...prev,[data.conversationId]:[...(prev[data.conversationId]||[]),{role:'error',text:data.text}]}));setBusy(false);setBusyChat(null);setStatus('');}
        else setToast(data.text);
      }
    };
    window.chrome.webview.addEventListener('message',receive);
    window.chrome.webview.postMessage({type:'get_settings'});
    return ()=>window.chrome.webview.removeEventListener('message',receive);
  },[]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,status,active]);
  const newChat = () => {setActive(null);setDraft('');setAttachments([]);setContextMenu(null)};
  const openChat = (id) => {setActive(id);setModal(null);setDraft('');setAttachments([])};
  const addFiles = (files) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    if (incoming.some(file => file.size > 8*1024*1024)) {setToast('Максимум 8 МБ на файл.');return;}
    setAttachments(current=>{
      if (current.length + incoming.length > 8 || [...current,...incoming].reduce((n,f)=>n+f.size,0) > 12*1024*1024) {setToast('Максимум 8 файлов и 12 МБ на сообщение.');return current;}
      return [...current,...incoming];
    });
  };
  const readFile = file => new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror=()=>reject(new Error('Не удалось прочитать файл: '+file.name));
    reader.onload=()=>resolve({name:file.name,type:file.type || 'application/octet-stream',data:String(reader.result).split(',',2)[1]});
    reader.readAsDataURL(file);
  });
  const submit = async () => {
    const value=draft.trim(); if((!value && !attachments.length)||busy)return;
    if (!desktop) {setToast('Агент работает только в Windows-приложении Elisa.exe.');return;}
    if (!configured) {setSettingsTab('provider');setModal('settings');setToast('Сначала настройте OpenRouter.');return;}
    if (value.length > 50000) {setToast('Сообщение слишком длинное — вставьте его как .txt.');return;}
    setBusy(true); setStatus('Подготавливаю вложения…');
    try {
      const prepared = await Promise.all(attachments.map(readFile));
      const names = prepared.map(file=>file.name);
      const preview = value || names.join(', ');
      let id=active;
      if(!id){id=crypto.randomUUID();setChats(prev=>[{id,title:preview.length>36?preview.slice(0,36)+'…':preview,preview},...prev]);setActive(id);}
      setMessages(prev=>({...prev,[id]:[...(prev[id]||[]),{role:'user',text:value,attachments:names,images:prepared.filter(f=>/^image\/(png|jpeg|gif|webp)$/i.test(f.type)).map(f=>({name:f.name,dataUrl:`data:${f.type};base64,${f.data}`}))}]}));
      setBusyChat(id);
      setDraft('');setAttachments([]);setStatus('Отправляю запрос в OpenRouter…');
      window.chrome.webview.postMessage({type:'send',conversationId:id,text:value,attachments:prepared});
    } catch(error) {setBusy(false);setStatus('');setToast(error.message || 'Не удалось прочитать вложение.');}
  };
  const handlePaste = (event) => {
    const files = Array.from(event.clipboardData?.items || []).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
    if (files.length) {event.preventDefault();addFiles(files);return;}
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text.length >= 4000) {event.preventDefault();addFiles([new File([text],`вставка-${Date.now()}.txt`,{type:'text/plain'})]);setToast('Большой текст добавлен как .txt.');}
  };
  const handleDrop = event => {event.preventDefault();setDragging(false);addFiles(event.dataTransfer.files);};
  const configure = () => {
    if (!desktop) {setToast('Настройка доступна в Windows-приложении Elisa.exe.');return;}
    if ((!configured && !apiKey.trim()) || !modelInput.trim()) {setToast('Укажите ключ и ID модели.');return;}
    window.chrome.webview.postMessage({type:'configure',key:apiKey,model:modelInput});
  };
  const desktopAction = (message) => { if (!desktop) {setToast('Доступно в Windows-приложении Elisa.exe.');return;} window.chrome.webview.postMessage(message); };
  const copyText = async text => {
    if (desktop) {window.chrome.webview.postMessage({type:'copy_text',text});return;}
    try {await navigator.clipboard.writeText(text);setToast('Скопировано.');} catch {setToast('Не удалось скопировать текст.');}
  };
  const openFile = path => desktopAction({type:'open_file',path});
  const showChatMenu = (event,chat) => {event.preventDefault();event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();const x=Number.isFinite(event.clientX)?event.clientX:rect.left;const y=Number.isFinite(event.clientY)?event.clientY:rect.bottom;setContextMenu({id:chat.id,title:chat.title,x:Math.max(0,Math.min(x,window.innerWidth-190)),y:Math.max(0,Math.min(y,window.innerHeight-115))});};
  const openLink = (event,href) => {
    if (href && (/^file:\/\/\//i.test(href) || (!/^[a-z][a-z0-9+.-]*:/i.test(href) && /\.[a-z0-9]{1,8}$/i.test(href)))) {event.preventDefault();try {openFile(/^file:/i.test(href)?href:decodeURIComponent(href));} catch {setToast('Недопустимый путь к файлу.');}return;}
    if (!href || !/^https?:\/\//i.test(href)) {event.preventDefault();return;}
    if (desktop) {event.preventDefault();window.chrome.webview.postMessage({type:'open_link',url:href});}
  };
  const current = chats.find(c=>c.id===active);
  const filtered = chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()));
  return <div className={'app-shell '+(dragging?'dragging':'')} onDragOver={event=>{if (event.dataTransfer.types.includes('Files')) {event.preventDefault();setDragging(true);}}} onDragLeave={event=>{if (!event.currentTarget.contains(event.relatedTarget))setDragging(false)}} onDrop={handleDrop}>
    {sidebar && <aside className="sidebar">
      <div className="brand-row"><button className="brand" onClick={newChat}><Mark small/><span>elisa</span><span className="brand-dot">.</span><span className="brand-version">VIORA 1.0</span></button><button className="icon-button sidebar-toggle" title="Свернуть панель" onClick={()=>setSidebar(false)}><PanelLeftClose size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><SquarePen size={17}/><span>Новый чат</span><span className="shortcut">Ctrl K</span></button>
      <nav className="navigation"><button onClick={()=>{setModal('search');setSearch('')}}><Search size={17}/><span>Поиск</span></button><button className="nav-selected" onClick={newChat}><MessageSquare size={17}/><span>Чаты</span></button></nav>
      <div className="side-divider"/><div className="history"><div className="side-heading">НЕДАВНИЕ <MoreHorizontal size={17}/></div><div className="history-group">{chats.length?<div className="history-label">Сохранённые</div>:<div className="history-label">Здесь появятся ваши чаты</div>}{chats.map(chat=><button className={'history-item '+(active===chat.id?'history-active':'')} key={chat.id} onContextMenu={event=>showChatMenu(event,chat)} onKeyDown={event=>{if(event.key==='F10'&&event.shiftKey)showChatMenu(event,chat)}} onClick={()=>openChat(chat.id)}>{chat.title}</button>)}</div></div>
      <div className="sidebar-bottom"><div className="upgrade"><div className="upgrade-icon"><ShieldAlert size={15}/></div><div><strong>{unrestricted?'Полный доступ к Windows':'Рабочие области'}</strong><span>{unrestricted?'Без ограничений папками':`${paths.length} папок · без подтверждений`}</span></div><button title="Настройки" onClick={()=>setModal('settings')}><ArrowUpRight size={15}/></button></div><button className="profile" onClick={()=>setModal('settings')}><span className="avatar">В</span><span className="profile-text"><strong>Ваше пространство</strong><small>Настройки OpenRouter</small></span><MoreHorizontal size={18}/></button></div>
    </aside>}
    <main className="main">
      <header className="topbar"><div className="top-left">{!sidebar&&<button className="icon-button" onClick={()=>setSidebar(true)} title="Открыть панель"><PanelLeftOpen size={19}/></button>}<span>{active?'Чат':'Личное пространство'}</span>{active&&<><ChevronRight size={14}/><strong>{current?.title}</strong></>}</div><div className="top-right"><span className="connection"><span className={"connection-dot "+(configured?"connected":"")}/> {configured?'OpenRouter настроен':'Не подключено'}</span><button className="icon-button mobile-menu" onClick={()=>setSidebar(!sidebar)} title="Меню"><Menu size={19}/></button><button className="icon-button" title="Обзор и статистика" onClick={()=>setPanelOpen(open=>!open)}><BarChart3 size={17}/></button><button className="icon-button top-settings" title="Настройки" onClick={()=>setModal('settings')}><SlidersHorizontal size={17}/></button></div></header>
      <div className="dashboard-body"><div className="chat-area">{active ? <section className="conversation"><div className="conversation-inner"><div className="conversation-title"><span className="tiny-star">✳</span><span>Личное пространство</span></div><h2>{current?.title}</h2>{(messages[active]||[]).map((message,i)=>message.role==='thinking_start'?<Thinking key={message.toolId||i} message={message}/>:message.role==='user'?<div className="message user-message" key={i}>{message.text}<ChatImages images={message.images}/>{message.attachments?.length>0&&<div className="message-files">{message.attachments.map((name,j)=><span key={j}><Paperclip size={13}/>{name}</span>)}</div>}</div>:message.role==='assistant_image'?<div className="assistant-message" key={i}><Mark small/><div className="assistant-content"><strong>Elisa</strong><ChatImages images={message.images}/></div></div>:(message.role==='tool_result'||message.role==='tool_start')?<ToolActivity key={message.toolId||i} message={message} onCopy={copyText}/>:<div className={'assistant-message '+(message.role==='error'?'error-message':'')} key={i}><Mark small/><div className="assistant-content"><strong>{message.role==='error'?'Ошибка':'Elisa'}</strong><Markdown text={message.text} onCopy={copyText} onOpen={openLink} onFile={openFile}/></div></div>)}{busy&&active===busyChat&&status&&<div className="agent-status"><span className="activity-spinner"/>{status}</div>}<div ref={endRef}/></div><div className="conversation-composer"><Composer {...{draft,setDraft,submit,model,textarea,busy,attachments,setAttachments,addFiles,handlePaste,dragging}} settings={()=>setModal('settings')} cancel={()=>window.chrome.webview.postMessage({type:'cancel'})}/><div className="disclaimer">{unrestricted?'Полный доступ к Windows включён. Действия выполняются без подтверждений.':'Файловые действия выполняются без подтверждений в рабочих областях.'}</div></div></section> : <section className="home-view">
        <div className="welcome"><div className="welcome-icon"><img src={logo} alt="Логотип Elisa"/></div><div className="greeting-overline">ELISA VIORA 1.0 · ВАШЕ ПРОСТРАНСТВО ДЛЯ ИДЕЙ</div><h1>Чем займёмся сегодня<span>?</span></h1><p>Большие идеи начинаются с простого вопроса.</p></div>
        <Composer {...{draft,setDraft,submit,model,textarea,busy,attachments,setAttachments,addFiles,handlePaste,dragging}} settings={()=>setModal('settings')} cancel={()=>window.chrome.webview.postMessage({type:'cancel'})}/>
        <div className="prompt-list">{prompts.map(({icon:Icon,label,text})=><button key={label} onClick={()=>{setDraft(text);textarea.current?.focus()}}><Icon size={15}/>{label}<ArrowUpRight size={13} className="prompt-arrow"/></button>)}</div>
        <div className="recent"><div className="recent-header"><div><div className="section-eyebrow">ПРОДОЛЖИТЬ С ТОГО ЖЕ МЕСТА</div><h2>Недавние чаты</h2></div><button onClick={()=>setModal('search')}>Все чаты <ChevronRight size={15}/></button></div>{chats.length?<div className="recent-grid">{chats.slice(0,3).map(chat=><button className="recent-card" key={chat.id} onContextMenu={event=>showChatMenu(event,chat)} onClick={()=>openChat(chat.id)}><div className="card-icon"><Clock3 size={17}/></div><strong>{chat.title}</strong><p>{chat.preview}</p><span>Сохранённые <ArrowUpRight size={14}/></span></button>)}</div>:<div className="empty-history">Начните новый диалог — он появится здесь.</div>}</div>
        <div className="home-footer"><span>Создано для вашего потока мыслей <span className="footer-star">✳</span></span><span>Работает с OpenRouter <span className="footer-dot">●</span></span></div>
      </section>}</div>{panelOpen&&<InsightsPanel usage={usage} storagePath={storagePath} busy={busy} onOpenStorage={()=>desktopAction({type:'open_storage'})} onAddStorage={()=>desktopAction({type:'add_storage_workspace'})}/>}</div>
    </main>
    {contextMenu&&<><div className="context-dismiss" onClick={()=>setContextMenu(null)} onContextMenu={e=>{e.preventDefault();setContextMenu(null)}}/><div className="chat-context" style={{left:contextMenu.x,top:contextMenu.y}}><button disabled={busy} onClick={()=>{setRenameTarget(contextMenu.id);setRenameText(contextMenu.title);setContextMenu(null)}}><PenLine size={15}/> Переименовать</button><button disabled={busy} className="delete-chat" onClick={()=>{desktopAction({type:'delete_chat',id:contextMenu.id});setContextMenu(null)}}><Trash2 size={15}/> Удалить чат</button>{busy&&<span>Дождитесь завершения запроса</span>}</div></>}
    {renameTarget&&<div className="modal-backdrop" onMouseDown={()=>setRenameTarget(null)}><form className="modal rename-modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();if(renameText.trim())desktopAction({type:'rename_chat',id:renameTarget,title:renameText.trim()})}}><div className="modal-head"><div><span className="section-eyebrow">ВАШИ ДИАЛОГИ</span><h2>Переименовать чат</h2></div><button type="button" className="icon-button" onClick={()=>setRenameTarget(null)}><X size={18}/></button></div><label className="field-label" htmlFor="chat-title">Название</label><input id="chat-title" className="settings-input" value={renameText} maxLength={120} autoFocus onChange={e=>setRenameText(e.target.value)}/><button className="done-button" disabled={!renameText.trim()||busy}>Сохранить</button></form></div>}
    {modal && <div className="modal-backdrop" onMouseDown={()=>setModal(null)}><div className={'modal '+(modal==='search'?'search-modal':'')} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="section-eyebrow">{modal==='search'?'ВАШИ ДИАЛОГИ':'ВАШЕ ПРОСТРАНСТВО'}</span><h2>{modal==='search'?'Поиск по чатам':'Настройки'}</h2></div><button className="icon-button" onClick={()=>setModal(null)} aria-label="Закрыть"><X size={19}/></button></div>{modal==='search'?<><label className="search-field"><Search size={18}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Найти чат..."/></label><div className="search-results">{filtered.length?filtered.map(c=><button key={c.id} onClick={()=>openChat(c.id)}><MessageSquare size={16}/><span>{c.title}<small>Сохранённые</small></span><ChevronRight size={16}/></button>):<p>Чаты не найдены</p>}</div></>:<div className="settings-content">
      <div className="settings-tabs"><button className={settingsTab==='workspaces'?'selected':''} onClick={()=>setSettingsTab('workspaces')}>Рабочие области</button><button className={settingsTab==='provider'?'selected':''} onClick={()=>setSettingsTab('provider')}>OpenRouter</button><button className={settingsTab==='github'?'selected':''} onClick={()=>setSettingsTab('github')}>GitHub</button><button className={settingsTab==='system'?'selected':''} onClick={()=>setSettingsTab('system')}>Система</button></div>
      {settingsTab==='workspaces'?<>
        <div className="settings-block"><div className="settings-icon"><FolderClosed size={19}/></div><div><h3>Папки для работы</h3><p>Файлы в выбранных папках доступны агенту автоматически.</p></div></div>
        <div className="workspace-list">{paths.length?paths.map(path=><div className="workspace-row" key={path}><FolderClosed size={16}/><span title={path}>{path}</span><button disabled={busy} title="Удалить" onClick={()=>desktopAction({type:'remove_workspace',path})}><Trash2 size={16}/></button></div>):<div className="workspace-empty">Рабочие области пока не добавлены</div>}</div>
        <button className="settings-secondary" disabled={busy} onClick={()=>desktopAction({type:'add_workspace'})}><FolderPlus size={16}/> Добавить папку</button>
        <div className="workspace-toggle"><div><strong>Полный доступ к Windows</strong><p>Включает PowerShell без ограничений выбранными папками.</p></div><label className="switch"><input aria-label="Полный доступ к Windows" type="checkbox" checked={unrestricted} disabled={busy} onChange={e=>desktopAction({type:'set_unrestricted',enabled:e.target.checked})}/><span/></label></div>
        <div className={'access-warning '+(unrestricted?'danger':'')}><ShieldAlert size={17}/><span>{unrestricted?'Включён полный доступ: агент может изменять и удалять любые доступные файлы, запускать программы и обращаться в сеть без подтверждений.':'Без подтверждений агент может читать и перезаписывать файлы в выбранных папках. Это ограничение путей, а не песочница Windows.'}</span></div>
      </>:settingsTab==='provider'?<>
        <div className="settings-block"><div className="settings-icon"><Globe2 size={19}/></div><div><h3>Подключение OpenRouter</h3><p>Модель должна поддерживать вызов инструментов.</p></div></div>
        <div className="demo-info"><ShieldAlert size={17}/><span>Ключ и история зашифрованы Windows для текущего пользователя. Сообщения и вложения отправляются в OpenRouter.</span></div>
        <label className="field-label" htmlFor="apiKey">API-ключ OpenRouter</label><input id="apiKey" className="settings-input" type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={configured?'Оставьте пустым, чтобы сохранить текущий':'sk-or-v1-…'}/><label className="field-label" htmlFor="model">ID модели OpenRouter</label><input id="model" className="settings-input" value={modelInput} onChange={e=>setModelInput(e.target.value)} placeholder="openrouter/free"/><p className="settings-hint">Укажите точный ID модели. Доступность и тарифы зависят от OpenRouter.</p><button className="done-button" onClick={configure} disabled={busy}>Применить</button>
      </>:settingsTab==='github'?<>
        <div className="settings-block"><div className="settings-icon"><Code2 size={19}/></div><div><h3>GitHub CLI</h3><p>Elisa использует учётную запись, в которую вы вошли через gh.</p></div></div>
        <div className="access-warning danger"><ShieldAlert size={17}/><span>Агенты могут работать с приватными репозиториями, удалять и менять данные без подтверждений в пределах выданных GitHub прав. gh может читать и изменять локальные файлы вне рабочих областей. Результаты команд отправляются модели.</span></div>
        <p className="settings-system-description">Установите GitHub CLI (gh), перезапустите Elisa и выполните вход в открывшемся терминале и браузере. Разрешения определяются учётной записью и настройками организаций. Токен в чат вводить не нужно.</p>
        <button className="settings-secondary" onClick={()=>desktopAction({type:'github_login'})}>Войти в GitHub</button><button className="settings-secondary" onClick={()=>{setGithubStatus('Проверяю…');desktopAction({type:'github_status'})}}>Проверить подключение</button><pre className="github-status">{githubStatus}</pre>
      </>:<><div className="settings-block"><div className="settings-icon"><TerminalSquare size={19}/></div><div><h3>Команда в терминале</h3><p>Добавьте папку Elisa в пользовательский PATH.</p></div></div><p className="settings-system-description">После добавления перезапустите терминал и вводите <code>Elisa</code>. Если переместите приложение, добавьте его в PATH заново. Это не влияет на права агента.</p><button className="settings-secondary" disabled={busy} onClick={()=>desktopAction({type:'add_to_path'})}>Добавить Elisa в PATH</button></>}
    </div>}</div></div>}
    {dragging&&<div className="drop-overlay"><Paperclip size={28}/><strong>Отпустите файлы, чтобы прикрепить</strong><span>До 8 файлов · до 12 МБ всего</span></div>}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
function AttachmentChip({file,onRemove}) {
  const [preview,setPreview]=useState('');
  useEffect(()=>{if(!file.type.startsWith('image/'))return;const url=URL.createObjectURL(file);setPreview(url);return ()=>URL.revokeObjectURL(url)},[file]);
  return <div className="attachment-chip">{preview?<img src={preview} alt=""/>:<FileText size={16}/>}<span title={file.name}>{file.name}<small>{Math.max(1,Math.ceil(file.size/1024))} КБ</small></span><button title="Убрать файл" onClick={onRemove}><X size={14}/></button></div>;
}
function Composer({draft,setDraft,submit,model,textarea,busy,settings,cancel,attachments,setAttachments,addFiles,handlePaste}){
  const fileInput=useRef(null);
  return <div className="composer"><textarea ref={textarea} value={draft} onChange={e=>setDraft(e.target.value)} onPaste={handlePaste} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}} placeholder="Спросите о чём угодно или перетащите файлы..." rows="2"/>
  {attachments.length>0&&<div className="attachment-list" title="Изображения требуют модель с поддержкой изображений; другие форматы зависят от модели">{attachments.map((file,i)=><AttachmentChip key={i} file={file} onRemove={()=>setAttachments(current=>current.filter((_,index)=>index!==i))}/>)}</div>}
  <input ref={fileInput} type="file" multiple hidden onChange={e=>{addFiles(e.target.files);e.target.value=''}}/><div className="composer-bottom"><div className="composer-tools"><button className="tool-button" title="Прикрепить файлы" onClick={()=>fileInput.current?.click()}><Paperclip size={18}/></button><button className="tool-button" title="Настройки" onClick={settings}><SlidersHorizontal size={17}/></button><span className="access-label">До 8 файлов · 12 МБ</span></div><div className="composer-actions"><button className="model-button" title="Изменить модель" onClick={settings}><span className="model-spark">✳</span> {model}</button>{busy?<button className="send-button" aria-label="Остановить" title="Остановить" onClick={cancel}><Square size={15}/></button>:<button className="send-button" aria-label="Отправить" onClick={submit}><ArrowUp size={19}/></button>}</div></div></div>
}

createRoot(document.getElementById('root')).render(<App/>);

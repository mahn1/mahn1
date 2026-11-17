import React, {useState, useRef, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import { PanelLeftClose, PanelLeftOpen, SquarePen, Search, MessageSquare, FolderClosed, ChevronDown, ChevronRight, MoreHorizontal, ArrowUp, Plus, SlidersHorizontal, Code2, Lightbulb, PenLine, BookOpen, Sparkles, ArrowUpRight, X, Check, Paperclip, Globe2, LayoutGrid, Clock3, Settings2, Menu } from 'lucide-react';
import './styles.css';
import logo from '../assets/elisa-logo.svg';

const originalChats = [
  {id: 1, title: 'Идеи для нового проекта', group: 'Сегодня', preview: 'Давай подумаем над концепцией и первыми шагами.'},
  {id: 2, title: 'Помоги разобраться с Python', group: 'Сегодня', preview: 'Как сделать код понятнее и эффективнее?'},
  {id: 3, title: 'План на следующую неделю', group: 'Вчера', preview: 'Составим план, в котором найдётся место для важного.'},
  {id: 4, title: 'Тексты для моего сайта', group: 'Вчера', preview: 'Несколько идей для текста главной страницы.'},
  {id: 5, title: 'Как работает API', group: 'Предыдущие 7 дней', preview: 'Объясни простыми словами с примерами.'},
];
const models = ['Автовыбор', 'Google: Gemma', 'NVIDIA: Nemotron', 'Baidu: ERNIE', 'Своя модель'];
const prompts = [
  {icon: Code2, label: 'Написать код', text: 'Помоги написать код для моего проекта'},
  {icon: PenLine, label: 'Создать текст', text: 'Помоги мне написать текст'},
  {icon: Lightbulb, label: 'Придумать идеи', text: 'Помоги придумать идеи для нового проекта'},
  {icon: BookOpen, label: 'Разобраться в теме', text: 'Объясни мне сложную тему простыми словами'},
];
function Mark({small=false}) {return <span className={'mark '+(small?'mark-small':'')} aria-hidden="true"><img src={logo} alt=""/></span>}
function App() {
  const [sidebar, setSidebar] = useState(true);
  const [chats, setChats] = useState(originalChats);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState('Автовыбор');
  const [modelOpen, setModelOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('home');
  const [messages, setMessages] = useState({});
  const [toast, setToast] = useState('');
  const textarea = useRef(null);
  useEffect(()=>{ const handleKey = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setActive(null); setView('home'); setDraft(''); textarea.current?.focus(); } }; window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, []);
  useEffect(()=>{ if(!toast)return; const timer=setTimeout(()=>setToast(''),2800);return ()=>clearTimeout(timer)},[toast]);
  const newChat = () => {setActive(null);setView('home');setDraft('');setModelOpen(false)};
  const openChat = (id) => {setActive(id);setView('home');setModal(null);setDraft('')};
  const submit = () => {
    const value=draft.trim(); if(!value)return;
    let id=active;
    if(!id){ id=Date.now(); setChats(prev=>[{id,title:value.length>32?value.slice(0,32)+'…':value,group:'Сегодня',preview:value},...prev]); setActive(id); }
    setMessages(prev=>({...prev,[id]:[...(prev[id]||[]),{role:'user',text:value}]}));
    setDraft(''); setView('home'); setModelOpen(false);
  };
  const usePrompt = (text) => {setDraft(text);textarea.current?.focus()};
  const current = chats.find(c=>c.id===active);
  const filtered = chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()));
  const fakeNotice = () => setToast('Это демонстрация интерфейса. Подключение появится позже.');
  return <div className="app-shell">
    {sidebar && <aside className="sidebar">
      <div className="brand-row"><button className="brand" onClick={newChat}><Mark small/><span>elisa</span><span className="brand-dot">.</span></button><button className="icon-button sidebar-toggle" title="Свернуть панель" onClick={()=>setSidebar(false)}><PanelLeftClose size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><SquarePen size={17}/><span>Новый чат</span><span className="shortcut">Ctrl K</span></button>
      <nav className="navigation">
        <button onClick={()=>{setModal('search');setSearch('')}}><Search size={17}/><span>Поиск</span></button>
        <button className={view==='home'?'nav-selected':''} onClick={()=>{setView('home');setActive(null)}}><MessageSquare size={17}/><span>Чаты</span></button>
        <button className={view==='projects'?'nav-selected':''} onClick={()=>{setView('projects');setActive(null)}}><FolderClosed size={17}/><span>Проекты</span><span className="nav-plus">+</span></button>
      </nav>
      <div className="side-divider"/>
      <div className="history"><div className="side-heading">НЕДАВНИЕ <MoreHorizontal size={17}/></div>
        {['Сегодня','Вчера','Предыдущие 7 дней'].map(group=> <div className="history-group" key={group}><div className="history-label">{group}</div>{chats.filter(c=>c.group===group).map(chat=><button className={'history-item '+(active===chat.id?'history-active':'')} key={chat.id} onClick={()=>openChat(chat.id)}>{chat.title}</button>)}</div>)}
      </div>
      <div className="sidebar-bottom"><div className="upgrade"><div className="upgrade-icon"><Sparkles size={15}/></div><div><strong>Больше возможностей</strong><span>Настройте своё пространство</span></div><button title="Настройки" onClick={()=>setModal('settings')}><ArrowUpRight size={15}/></button></div>
        <button className="profile" onClick={()=>setModal('settings')}><span className="avatar">В</span><span className="profile-text"><strong>Ваше пространство</strong><small>Личный аккаунт</small></span><MoreHorizontal size={18}/></button>
      </div>
    </aside>}
    <main className="main">
      <header className="topbar"><div className="top-left">{!sidebar&&<button className="icon-button" onClick={()=>setSidebar(true)} title="Открыть панель"><PanelLeftOpen size={19}/></button>}<span>{view==='projects'?'Проекты':active?'Чат':'Личное пространство'}</span>{active&&<><ChevronRight size={14}/><strong>{current?.title}</strong></>}</div><div className="top-right"><span className="connection"><span className="connection-dot"/> Интерфейс демо</span><button className="icon-button mobile-menu" onClick={()=>setSidebar(!sidebar)} title="Меню"><Menu size={19}/></button><button className="icon-button top-settings" title="Настройки" onClick={()=>setModal('settings')}><SlidersHorizontal size={17}/></button></div></header>
      {view==='projects' ? <section className="projects-view"><div className="section-eyebrow"><LayoutGrid size={15}/> ВАШЕ ПРОСТРАНСТВО</div><h1>Проекты</h1><p>Все ваши идеи и задачи в одном месте.</p><div className="empty-project"><div className="project-symbol"><FolderClosed size={25}/></div><h2>Место для больших идей</h2><p>Собирайте связанные чаты в проектах, чтобы к ним было легко вернуться.</p><button onClick={fakeNotice}><Plus size={16}/> Создать проект</button></div></section> : active ? <section className="conversation"><div className="conversation-inner"><div className="conversation-title"><span className="tiny-star">✳</span><span>Личное пространство</span></div><h2>{current?.title}</h2>{!(messages[active]?.length) && <><div className="message user-message">{current?.preview}</div><div className="assistant-message"><Mark small/><div><strong>Elisa</strong><p>Это пример диалога. Интерфейс готов для подключения модели через OpenRouter.</p></div></div></>}{messages[active]?.map((message,i)=><React.Fragment key={i}><div className="message user-message">{message.text}</div><div className="assistant-message"><Mark small/><div><strong>Elisa</strong><p>Сообщение добавлено в демо-чат. Чтобы получать ответы, нужно подключить OpenRouter.</p></div></div></React.Fragment>)}</div><div className="conversation-composer"><Composer draft={draft} setDraft={setDraft} submit={submit} model={model} setModel={setModel} modelOpen={modelOpen} setModelOpen={setModelOpen} textarea={textarea} fakeNotice={fakeNotice}/><div className="disclaimer">Elisa может допускать ошибки. Проверяйте важную информацию.</div></div></section> : <section className="home-view">
        <div className="welcome"><div className="welcome-icon"><img src={logo} alt="Логотип Elisa"/></div><div className="greeting-overline">ВАШЕ ПРОСТРАНСТВО ДЛЯ ИДЕЙ</div><h1>Чем займёмся сегодня<span>?</span></h1><p>Большие идеи начинаются с простого вопроса.</p></div>
        <Composer draft={draft} setDraft={setDraft} submit={submit} model={model} setModel={setModel} modelOpen={modelOpen} setModelOpen={setModelOpen} textarea={textarea} fakeNotice={fakeNotice}/>
        <div className="prompt-list">{prompts.map(({icon:Icon,label,text})=><button key={label} onClick={()=>usePrompt(text)}><Icon size={15}/>{label}<ArrowUpRight size={13} className="prompt-arrow"/></button>)}</div>
        <div className="recent"><div className="recent-header"><div><div className="section-eyebrow">ПРОДОЛЖИТЬ С ТОГО ЖЕ МЕСТА</div><h2>Недавние чаты</h2></div><button onClick={()=>setModal('search')}>Все чаты <ChevronRight size={15}/></button></div><div className="recent-grid">{chats.slice(0,3).map((chat,i)=><button className="recent-card" key={chat.id} onClick={()=>openChat(chat.id)}><div className={'card-icon card-icon-'+i}>{i===0?<Lightbulb size={17}/>:i===1?<Code2 size={17}/>:<Clock3 size={17}/>}</div><strong>{chat.title}</strong><p>{chat.preview}</p><span>{chat.group} <ArrowUpRight size={14}/></span></button>)}</div></div>
        <div className="home-footer"><span>Создано для вашего потока мыслей <span className="footer-star">✳</span></span><span>Работает с OpenRouter <span className="footer-dot">●</span></span></div>
      </section>}
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={()=>setModal(null)}><div className={'modal '+(modal==='search'?'search-modal':'')} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="section-eyebrow">{modal==='search'?'ВАШИ ДИАЛОГИ':'ВАШЕ ПРОСТРАНСТВО'}</span><h2>{modal==='search'?'Поиск по чатам':'Настройки'}</h2></div><button className="icon-button" onClick={()=>setModal(null)} aria-label="Закрыть"><X size={19}/></button></div>{modal==='search'?<><label className="search-field"><Search size={18}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Найти чат..."/></label><div className="search-results">{filtered.length?filtered.map(c=><button key={c.id} onClick={()=>openChat(c.id)}><MessageSquare size={16}/><span>{c.title}<small>{c.group}</small></span><ChevronRight size={16}/></button>):<p>Ничего не найдено</p>}</div></>:<div className="settings-content"><div className="settings-block"><div className="settings-icon"><Globe2 size={19}/></div><div><h3>Подключение OpenRouter</h3><p>Здесь будет настройка провайдера и выбор модели.</p></div></div><div className="demo-info"><Sparkles size={17}/><span>Это только интерфейс: API пока не подключён, ключи не сохраняются и запросы не отправляются.</span></div><label className="field-label">Провайдер</label><div className="provider-field">OpenRouter <span>Скоро</span></div><label className="field-label">Модель по умолчанию</label><select value={model} onChange={e=>setModel(e.target.value)}>{models.map(m=><option key={m}>{m}</option>)}</select><button className="done-button" onClick={()=>setModal(null)}>Готово</button></div>}</div></div>}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
function Composer({draft,setDraft,submit,model,setModel,modelOpen,setModelOpen,textarea,fakeNotice}){return <div className="composer"><textarea ref={textarea} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}} placeholder="Спросите о чём угодно..." rows="2"/><div className="composer-bottom"><div className="composer-tools"><button className="tool-button" title="Прикрепить файл" onClick={fakeNotice}><Plus size={20}/></button><span className="tool-divider"/><button className="tool-button" title="Дополнительные настройки" onClick={fakeNotice}><SlidersHorizontal size={17}/></button></div><div className="composer-actions"><div className="model-wrap"><button className="model-button" onClick={()=>setModelOpen(!modelOpen)}><span className="model-spark">✳</span> {model} <ChevronDown size={14}/></button>{modelOpen&&<div className="model-menu"><div className="model-menu-title">ВЫБЕРИТЕ МОДЕЛЬ</div>{models.map(m=><button key={m} onClick={()=>{setModel(m);setModelOpen(false)}}><span>{m}</span>{m===model&&<Check size={15}/>}</button>)}<div className="model-menu-note">Демо · список для примера</div></div>}</div><button className="send-button" aria-label="Отправить" onClick={submit}><ArrowUp size={19}/></button></div></div></div>}

createRoot(document.getElementById('root')).render(<App/>);

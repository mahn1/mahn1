import React, {useState} from 'react';
import {TerminalSquare, ChevronDown, CheckCircle2, CircleAlert, Copy} from 'lucide-react';

const titles = {run_powershell:'PowerShell', list_workspaces:'Рабочие области', list_files:'Список файлов', read_file:'Чтение файла', write_file:'Запись файла', create_directory:'Создание папки'};
const comments = {list_workspaces:'Проверяю доступные рабочие области', list_files:'Просматриваю файлы и папки', read_file:'Читаю содержимое файла', write_file:'Записываю изменения в файл', create_directory:'Создаю папку'};
function fallbackComment(message) {
  const command = (message.command || '').toLowerCase();
  if (command.includes('get-childitem') || command.includes('get-location')) return 'Просматриваю расположение и содержимое';
  if (command.includes('get-item')) return 'Проверяю сведения о файле';
  if (command.includes('get-content')) return 'Читаю содержимое файла';
  if (command.includes('remove-item')) return 'Удаляю указанные элементы';
  if (command.includes('set-content')) return 'Изменяю содержимое файла';
  return comments[message.toolName] || (message.toolName === 'run_powershell' ? 'Выполняю команду PowerShell' : 'Выполняю запрос к инструменту');
}

export default function ToolActivity({message,onCopy}) {
  const [expanded,setExpanded] = useState(false);
  const state = message.toolStatus || 'done';
  const label = state==='running'?'Выполняется':state==='error'?'Ошибка':state==='interrupted'?'Остановлено':'Завершено';
  return <section className="activity-card"><button className="activity-header" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>
    <span className="activity-icon"><TerminalSquare size={16}/></span><span className="activity-title">{titles[message.toolName] || message.toolName || 'Инструмент'}<small>{message.toolComment || fallbackComment(message)}</small></span>
    <span className={'activity-status status-'+state}>{state==='running'?<span className="activity-spinner"/>:state==='done'?<CheckCircle2 size={13}/>:<CircleAlert size={13}/>} {label}</span><ChevronDown size={16} className={expanded?'activity-chevron open':'activity-chevron'}/>
  </button>{expanded&&<div className="activity-body">{message.command&&<><div className="activity-label"><span>{message.toolName==='run_powershell'?'КОМАНДА':'ПАРАМЕТРЫ'}</span><button onClick={()=>onCopy(message.command)} aria-label="Копировать команду"><Copy size={13}/> Копировать</button></div><pre>{message.command}</pre></>}
    {state==='running'?<div className="activity-pending">Ожидание результата…</div>:<><div className="activity-label"><span>РЕЗУЛЬТАТ</span>{message.text&&<button onClick={()=>onCopy(message.text)} aria-label="Копировать результат"><Copy size={13}/> Копировать</button>}</div><pre className="activity-output">{message.text || 'Нет вывода.'}</pre></>}
  </div>}</section>;
}

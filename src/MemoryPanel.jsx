import React, {useState} from 'react';
export default function MemoryPanel({memories=[],onAction,busy}) {
  const [draft,setDraft]=useState('');
  return <div className="memory-panel"><div className="settings-block"><div><h3>Память Elisa</h3><p>Короткие заметки доступны агентам в новых запросах.</p></div></div><div className="demo-info">Заметки хранятся локально с шифрованием и отправляются выбранным провайдерам. Не добавляйте пароли и секреты. Агенту предложено запоминать только по вашей просьбе.</div>
    <form onSubmit={e=>{e.preventDefault();if(draft.trim()){onAction({type:'memory_add',text:draft.trim()});setDraft('')}}}><label className="field-label" htmlFor="memory-draft">Новая заметка</label><input className="settings-input" id="memory-draft" value={draft} maxLength={500} onChange={e=>setDraft(e.target.value)}/><button className="settings-secondary" disabled={busy||!draft.trim()}>Добавить</button></form>
    <div className="workspace-list">{memories.length?memories.map(item=><div className="workspace-row memory-row" key={item.Id ?? item.id}><span>{item.Text ?? item.text}</span><button disabled={busy} aria-label="Удалить заметку" onClick={()=>onAction({type:'memory_remove',id:item.Id ?? item.id})}>✕</button></div>):<p className="settings-hint">Пока нет сохранённых заметок.</p>}</div></div>;
}

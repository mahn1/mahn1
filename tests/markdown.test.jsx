import React from 'react';
import {describe, it, expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Markdown from '../src/Markdown.jsx';
import ToolActivity from '../src/ToolActivity.jsx';
import {updateToolMessages} from '../src/chatEvents.js';

const render = text => renderToStaticMarkup(<Markdown text={text} onCopy={()=>{}} onOpen={()=>{}}/>);
describe('formatted responses',()=>{
  it('renders bold text, lists, tables and code blocks',()=>{
    const html=render('**Off.bat**\n\n1. Первое\n2. Второе\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```');
    expect(html).toContain('<strong>Off.bat</strong>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<table>');
    expect(html).toContain('Копировать');
    expect(html).toContain('language-js');
  });
  it('does not render raw HTML or automatically load remote images',()=>{
    const html=render('<script>alert(1)</script>\n\n![secret](https://example.com/track.png)');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('https://example.com/track.png');
    expect(html).toContain('Изображение: secret');
  });
});
describe('live activity',()=>{
  it('starts collapsed and shows a concise comment instead of a generic label',()=>{
    const html=renderToStaticMarkup(<ToolActivity message={{toolName:'run_powershell',toolStatus:'done',toolComment:'Проверяю размер voice.mp3',command:'Get-Item voice.mp3',text:'68012'}} onCopy={()=>{}}/>);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Проверяю размер voice.mp3');
    expect(html).not.toContain('Действие агента');
    expect(html).not.toContain('68012');
  });
  it('describes legacy commands without a stored comment',()=>{
    const html=renderToStaticMarkup(<ToolActivity message={{toolName:'run_powershell',command:'Get-Item voice.mp3'}} onCopy={()=>{}}/>);
    expect(html).toContain('Проверяю сведения о файле');
  });
  it('shows each command immediately and updates only its matching result',()=>{
    let list=updateToolMessages([], {type:'tool_start',toolId:'1',toolName:'run_powershell',toolComment:'Просматриваю папку',command:'Get-ChildItem'});
    list=updateToolMessages(list,{type:'tool_start',toolId:'2',toolName:'read_file',command:'file.txt'});
    expect(list[0].toolStatus).toBe('running');
    list=updateToolMessages(list,{type:'tool_finish',toolId:'1',text:'done',toolStatus:'done'});
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({command:'Get-ChildItem',toolComment:'Просматриваю папку',text:'done',toolStatus:'done'});
    expect(list[1].toolStatus).toBe('running');
  });
});

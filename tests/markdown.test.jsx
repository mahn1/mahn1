import React from 'react';
import {describe, it, expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Markdown from '../src/Markdown.jsx';
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
  it('shows each command immediately and updates only its matching result',()=>{
    let list=updateToolMessages([], {type:'tool_start',toolId:'1',toolName:'run_powershell',command:'Get-ChildItem'});
    list=updateToolMessages(list,{type:'tool_start',toolId:'2',toolName:'read_file',command:'file.txt'});
    expect(list[0].toolStatus).toBe('running');
    list=updateToolMessages(list,{type:'tool_finish',toolId:'1',text:'done',toolStatus:'done'});
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({command:'Get-ChildItem',text:'done',toolStatus:'done'});
    expect(list[1].toolStatus).toBe('running');
  });
});

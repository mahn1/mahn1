import React from 'react';
import {describe, it, expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Markdown from '../src/Markdown.jsx';
import ToolActivity from '../src/ToolActivity.jsx';
import {updateToolMessages} from '../src/chatEvents.js';
import {buildUsage} from '../src/InsightsPanel.jsx';
import {formatDuration} from '../src/Thinking.jsx';
import ChatImages, {safeImageSource} from '../src/ChatImages.jsx';
import ProviderSettings, {normalizeRoutes} from '../src/ProviderSettings.jsx';
import MemoryPanel from '../src/MemoryPanel.jsx';
import BudgetPanel from '../src/BudgetPanel.jsx';

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
  it('offers file opening for inline filenames but not fenced code',()=>{
    const html=render('Файл: `котик.txt` и `котик.svg`\n\n```txt\nкотик.txt\n```');
    expect((html.match(/class="file-reference"/g)||[]).length).toBe(2);
    expect(html).toContain('Открыть файл');
    expect(render('[файл](file:///C:/Users/User/Desktop/file.txt)')).toContain('file:///C:/Users/User/Desktop/file.txt');
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

describe('dashboard',()=>{
  it('uses returned model usage rather than demo values',()=>{
    expect(buildUsage({})).toEqual([]);
    const usage=buildUsage({'vendor/a':{TotalTokens:32,PromptTokens:20,CompletionTokens:12,Requests:1},'vendor/b':{TotalTokens:50}});
    expect(usage.map(x=>x.name)).toEqual(['vendor/b','vendor/a']);
    expect(usage[1]).toMatchObject({total:32,prompt:20,completion:12});
  });
  it('formats durations under and over one minute',()=>{
    expect(formatDuration(31000)).toBe('31 с');
    expect(formatDuration(91000)).toBe('1 мин 31 с');
  });
});

describe('chat image previews',()=>{
  it('renders persisted and live raster images without fetching remote or SVG data',()=>{
    const png='data:image/png;base64,aGVsbG8=';
    const html=renderToStaticMarkup(<ChatImages images={[{Name:'кот.png',DataUrl:png},{name:'remote',dataUrl:'https://example.org/image.png'},{name:'bad',dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}]}/>);
    expect(html).toContain('кот.png'); expect(html).toContain(png); expect(html).not.toContain('example.org'); expect(html).not.toContain('svg');
    expect(safeImageSource('javascript:alert(1)')).toBe('');
  });
});

describe('provider configuration',()=>{
  it('supports separate models for agent roles and never exposes stored keys',()=>{
    const routes=normalizeRoutes({research:{Provider:'nvidia',Model:'deepseek-ai/model'}});
    expect(routes.research).toEqual({provider:'nvidia',model:'deepseek-ai/model'});
    expect(routes.review.provider).toBe('inherit');
    const html=renderToStaticMarkup(<ProviderSettings initial={{provider:'openrouter',openRouterModel:'openrouter/free',nvidiaModel:'deepseek-ai/deepseek-v4.1-flash',openRouterConfigured:true,nvidiaConfigured:true,routes:{}}} onSave={()=>{}}/>);
    expect(html).toContain('NVIDIA Build'); expect(html).toContain('Модели агентов'); expect(html).toContain('сохранён');
    expect(html).not.toContain('nvapi-');
  });
});

describe('memory and budgets',()=>{
  it('shows saved memories and accurate quota data without inventing values',()=>{
    const memory=renderToStaticMarkup(<MemoryPanel memories={[{Id:'a',Text:'Пиши на русском'}]} onAction={()=>{}}/>);
    expect(memory).toContain('Пиши на русском'); expect(memory).toContain('Удалить заметку');
    const empty=renderToStaticMarkup(<BudgetPanel onAction={()=>{}}/>);
    expect(empty).toContain('Для NVIDIA остаток квоты здесь неизвестен');
    const html=renderToStaticMarkup(<BudgetPanel caps={{openrouter:{Requests:12,Tokens:100}}} daily={{openrouter:{Date:'2026-11-17',Requests:2,Tokens:24}}} quota={{usageDaily:0.12,freeRequests:{remaining:8,limit:50}}} onAction={()=>{}}/>);
    expect(html).toContain('8 осталось из 50'); expect(html).toContain('0.12'); expect(html).toContain('2026-11-17');
  });
});

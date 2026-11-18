import React, {createContext, useContext} from 'react';
import ReactMarkdown, {defaultUrlTransform} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {Copy, FileText} from 'lucide-react';

const InCodeBlock = createContext(false);
const filenamePattern = /^(?:[a-z]:[\\/])?[^<>|?*\r\n]+\.(?:txt|md|csv|json|xml|log|pdf|png|jpe?g|gif|webp|bmp|svg|mp3|wav|flac|ogg|mp4|webm|docx|xlsx|pptx|py|js|ts|cs|html|bat|cmd|ps1|exe|zip)$/i;
import 'highlight.js/styles/github-dark.css';

function textContent(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  return node?.props?.children ? textContent(node.props.children) : '';
}

function CodeBlock({children, onCopy}) {
  const element = React.Children.toArray(children)[0];
  const language = element?.props?.className?.match(/language-([^\s]+)/)?.[1] || 'код';
  const code = textContent(element).replace(/\n$/, '');
  return <div className="code-block"><div className="code-head"><span>{language}</span><button type="button" onClick={()=>onCopy(code)} aria-label="Копировать код"><Copy size={14}/> Копировать</button></div><pre>{children}</pre></div>;
}

function InlineCode({children,className,onFile}) {
  const inside = useContext(InCodeBlock); const content = textContent(children).trim();
  if (!inside && filenamePattern.test(content)) return <button className="file-reference" type="button" title="Открыть файл" onClick={()=>onFile(content)}><FileText size={12}/>{children}</button>;
  return <code className={className}>{children}</code>;
}
export default function Markdown({text, onCopy, onOpen, onFile=()=>{}}) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}
    urlTransform={url=>url.toLowerCase().startsWith('file:///') ? url : defaultUrlTransform(url)}
    components={{
      pre: ({children}) => <InCodeBlock.Provider value={true}><CodeBlock onCopy={onCopy}>{children}</CodeBlock></InCodeBlock.Provider>,
      code: ({children,className}) => <InlineCode className={className} onFile={onFile}>{children}</InlineCode>,
      table: ({children}) => <div className="markdown-table"><table>{children}</table></div>,
      a: ({href,children}) => <a href={href} target="_blank" rel="noopener noreferrer" onClick={e=>onOpen(e,href)}>{children}</a>,
      // Model output is untrusted: do not automatically fetch remote images or enable raw HTML.
      img: ({alt}) => <span className="markdown-image">[Изображение: {alt || 'без описания'}]</span>,
    }}
  >{text || ''}</ReactMarkdown></div>;
}

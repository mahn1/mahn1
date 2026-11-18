import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {Copy} from 'lucide-react';
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

export default function Markdown({text, onCopy, onOpen}) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}
    components={{
      pre: ({children}) => <CodeBlock onCopy={onCopy}>{children}</CodeBlock>,
      table: ({children}) => <div className="markdown-table"><table>{children}</table></div>,
      a: ({href,children}) => <a href={href} target="_blank" rel="noopener noreferrer" onClick={e=>onOpen(e,href)}>{children}</a>,
      // Model output is untrusted: do not automatically fetch remote images or enable raw HTML.
      img: ({alt}) => <span className="markdown-image">[Изображение: {alt || 'без описания'}]</span>,
    }}
  >{text || ''}</ReactMarkdown></div>;
}

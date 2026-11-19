import React from 'react';

// Never load arbitrary remote URLs or SVG supplied by model output.
export function safeImageSource(src) {
  return typeof src === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(src) ? src : '';
}
export default function ChatImages({images=[]}) {
  const valid=images.map(image=>({name:image.name ?? image.Name ?? 'Изображение',src:safeImageSource(image.dataUrl ?? image.DataUrl)})).filter(image=>image.src);
  if(!valid.length)return null;
  return <div className="chat-images">{valid.map((image,i)=><figure key={i}><img src={image.src} alt={image.name} loading="lazy"/><figcaption>{image.name}</figcaption></figure>)}</div>;
}

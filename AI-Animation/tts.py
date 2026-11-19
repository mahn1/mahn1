#!/usr/bin/env python3
"""Unofficial FreeTTS.ru client. Voice numbers follow the current API response."""
import argparse
import asyncio
import json
from pathlib import Path
import urllib.parse
import urllib.request

API = 'https://api.freetts.ru'


def voices(lang='rus'):
    request = urllib.request.Request(f'{API}/voices?{urllib.parse.urlencode({"lang": lang})}', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if not isinstance(result, list):
        raise RuntimeError(f'Не удалось получить голоса: {result}')
    return result


def resolve_voice(value, items):
    if str(value).isdigit():
        index = int(value) - 1
        if not 0 <= index < len(items):
            raise ValueError('Номер голоса вне списка')
        return items[index]['id']
    matches = [v['id'] for v in items if value.casefold() in (v['id'].casefold(), v['name'].casefold())]
    if len(matches) != 1:
        raise ValueError(f'Голос не найден: {value}')
    return matches[0]


async def synthesize(voice_id, text, output):
    try:
        import websockets
    except ImportError as exc:
        raise RuntimeError('Установите зависимости: pip install -r requirements.txt') from exc
    if not text.strip():
        raise ValueError('Текст пуст')
    chunks = []
    async with websockets.connect('wss://api.freetts.ru/generate', open_timeout=30, max_size=None) as ws:
        await ws.send(json.dumps({'action': 'start', 'text': text + '\u200c', 'voiceId': voice_id}, ensure_ascii=False))
        while True:
            message = await asyncio.wait_for(ws.recv(), timeout=120)
            if isinstance(message, bytes):
                chunks.append(message)
                continue
            data = json.loads(message)
            if data.get('status') == 'error':
                raise RuntimeError(data.get('message', 'Ошибка сервиса'))
            if data.get('status') == 'ready':
                break
    if not chunks:
        raise RuntimeError('Сервис не прислал аудио')
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b''.join(chunks))
    return path


def tts(voice, text, output_path='output.mp3', lang='rus'):
    return asyncio.run(synthesize(resolve_voice(str(voice), voices(lang)), text, output_path))


def main():
    parser = argparse.ArgumentParser(description='Неофициальный клиент freetts.ru')
    parser.add_argument('--list', action='store_true', help='Показать пронумерованные голоса')
    parser.add_argument('--lang', default='rus')
    parser.add_argument('--voice', default='Егор Тихонов', help='Номер, имя или ID голоса')
    parser.add_argument('--text')
    parser.add_argument('--output', default='output.mp3')
    args = parser.parse_args()
    items = voices(args.lang)
    if args.list:
        for i, voice in enumerate(items, 1):
            print(f'{i:3}. {voice["name"]} ({voice["id"]})')
        return
    if not args.text:
        parser.error('укажите --text или --list')
    path = asyncio.run(synthesize(resolve_voice(args.voice, items), args.text, args.output))
    print(path)


if __name__ == '__main__':
    main()

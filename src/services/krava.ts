const KRAVA_BASE_URL = process.env.KRAVA_BASE_URL ?? 'https://krava.io';

export async function* streamKravaChat(
  userToken: string,
  message: string,
  opts: { chatId?: string; system?: string }
): AsyncGenerator<{ chatId?: string; text?: string }> {
  const response = await fetch(`${KRAVA_BASE_URL}/api/platform/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, chatId: opts.chatId, system: opts.system }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Krava ${response.status}: ${errText}`);
  }
  if (!response.body) throw new Error('Krava response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break outer;
      try {
        yield JSON.parse(data) as { chatId?: string; text?: string };
      } catch { console.warn('[krava] malformed SSE chunk:', data); }
    }
  }
}

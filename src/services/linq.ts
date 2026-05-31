const LINQ_API_BASE = 'https://api.linqapp.com/api/partner/v3';

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/^#+\s+/gm, '')            // headings
    .replace(/^[-*]\s+/gm, '')          // list bullets
    .replace(/_(.+?)_/g, '$1')          // underscore italic
    .trim();
}

export async function sendLinqMessage(
  linqChatId: string,
  toPhone: string,
  text: string
): Promise<void> {
  const token = process.env.LINQ_API_TOKEN;
  const fromPhone = process.env.LINQ_PHONE_NUMBER;
  if (!token || !fromPhone) throw new Error('LINQ_API_TOKEN and LINQ_PHONE_NUMBER required');

  const body = {
    from: fromPhone,
    to: [toPhone],
    message: {
      parts: [{ type: 'text', value: text }],
    },
  };

  const res = await fetch(`${LINQ_API_BASE}/chats`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Linq send failed ${res.status}: ${errText}`);
  }
}

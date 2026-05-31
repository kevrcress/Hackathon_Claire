import express from 'express';
import crypto from 'crypto';
import { LoadedPatientData } from '../../services/loader';
import { buildSystemPrompt } from '../../services/prompt';
import { streamKravaChat } from '../../services/krava';
import { sendLinqMessage, stripMarkdown } from '../../services/linq';

type KravaPlatform = { users: { getOrCreate(id: string): Promise<{ userToken: string; userId: string }> } };

interface MemberEntry { index: number; patientId: string; displayName: string }

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes
const linqKravaSessions = new Map<string, string>(); // phone → Krava chatId
const linqMemberSessions = new Map<string, string>(); // phone → patientId

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return raw;
}

function buildPhoneIndex(patients: Map<string, LoadedPatientData>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [patientId, data] of patients) {
    if (data.member.phone) index.set(normalizePhone(data.member.phone), patientId);
  }
  return index;
}

function buildMemberList(patients: Map<string, LoadedPatientData>): MemberEntry[] {
  return Array.from(patients.values())
    .sort((a, b) => a.member.displayName.localeCompare(b.member.displayName))
    .map((data, i) => ({ index: i + 1, patientId: data.patientId, displayName: data.member.displayName }));
}

function formatWelcomeMessage(members: MemberEntry[]): string {
  const lines = ['Welcome! Choose a member to assist:'];
  for (const m of members) lines.push(`${m.index} - ${m.displayName}`);
  lines.push('');
  lines.push(`Reply member:1 through member:${members.length} to begin.`);
  return lines.join('\n');
}

function verifySignature(
  rawBody: Buffer,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(nowSeconds - ts) > REPLAY_WINDOW_SECONDS) return false;

  const payload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export function createLinqRouter(
  patients: Map<string, LoadedPatientData>,
  platform: KravaPlatform
): express.Router {
  const router = express.Router();
  const phoneIndex = buildPhoneIndex(patients);
  const memberList = buildMemberList(patients);

  router.post('/', async (req, res) => {
    const rawBody = req.body as Buffer;
    const timestamp = req.headers['x-webhook-timestamp'] as string ?? '';
    const signature = req.headers['x-webhook-signature'] as string ?? '';
    const secret = process.env.LINQ_WEBHOOK_SECRET ?? '';

    if (!verifySignature(rawBody, timestamp, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    res.sendStatus(200);

    (async () => {
      try {
        const body = JSON.parse(rawBody.toString('utf8'));
        const eventType: string = body.type ?? body.event ?? '';
        if (eventType !== 'message.received') return;

        const part = body.data?.parts?.[0];
        if (!part || part.type !== 'text') return;

        const phoneNumber: string = body.data?.sender_handle?.handle ?? '';
        const messageText: string = part.value ?? '';
        const linqChatId: string = body.data?.chat?.id ?? '';

        if (!phoneNumber || !messageText) return;

        // Handle member selection command
        const memberMatch = messageText.match(/^member:\s*(\d+)\s*$/i);
        if (memberMatch) {
          const idx = parseInt(memberMatch[1], 10);
          const entry = memberList.find(m => m.index === idx);
          if (!entry) {
            await sendLinqMessage(linqChatId, phoneNumber, `I don't recognize that number.\n\n${formatWelcomeMessage(memberList)}`);
            return;
          }
          linqMemberSessions.set(phoneNumber, entry.patientId);
          linqKravaSessions.delete(phoneNumber);
          const data = patients.get(entry.patientId)!;
          await sendLinqMessage(linqChatId, phoneNumber, `Got it! I'm here to help with ${data.member.displayName}'s Medicare Advantage plan. What would you like to know?`);
          return;
        }

        // Resolve patient: explicit selection > phone index
        const patientId = linqMemberSessions.get(phoneNumber) ?? phoneIndex.get(phoneNumber);
        if (!patientId) {
          await sendLinqMessage(linqChatId, phoneNumber, formatWelcomeMessage(memberList));
          return;
        }

        const patientData = patients.get(patientId)!;
        const { userToken } = await platform.users.getOrCreate(phoneNumber);
        const existingChatId = linqKravaSessions.get(phoneNumber);
        const systemPrompt = buildSystemPrompt(patientData);

        let responseText = '';
        let newChatId = existingChatId;

        for await (const chunk of streamKravaChat(userToken, messageText, { chatId: existingChatId, system: systemPrompt })) {
          if (chunk.chatId && !newChatId) newChatId = chunk.chatId;
          if (chunk.text) responseText += chunk.text;
        }

        if (newChatId) linqKravaSessions.set(phoneNumber, newChatId);

        await sendLinqMessage(linqChatId, phoneNumber, stripMarkdown(responseText));
      } catch (err) {
        console.error('[linq] async processing error:', err);
      }
    })();
  });

  return router;
}

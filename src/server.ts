import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createKravaPlatformClient } from '@kravalabs/api-client';
import { loadAllPatients, getPatientList } from './services/loader';
import { calculateAccumulators } from './services/accumulator';
import { buildSystemPrompt, DEMO_PLAN } from './services/prompt';
import { getConversation, saveConversation, getActiveSessions } from './services/conversation';
import { streamKravaChat } from './services/krava';
import { createLinqRouter } from './routes/webhooks/linq';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000');
const KRAVA_BASE_URL = process.env.KRAVA_BASE_URL ?? 'https://krava.io';

const platform = createKravaPlatformClient({
  baseUrl: KRAVA_BASE_URL,
  appKey: process.env.KRAVA_APP_KEY!,
});

const chatIds = new Map<string, string>(); // sessionId -> chatId

interface SseClient { write(data: string): boolean }

app.use(express.static(path.join(__dirname, '../public')));

const testDataDir = path.join(__dirname, '../test-data');
const patients = loadAllPatients(testDataDir);

// Calculate accumulators for each patient
for (const [, data] of patients) {
  data.accumulators = calculateAccumulators(
    data.claims,
    DEMO_PLAN.defaultBenefits.individualDeductible,
    DEMO_PLAN.defaultBenefits.individualOopMax,
    String(DEMO_PLAN.defaultBenefits.planYear)
  );
}

console.log(`[claire] Loaded ${patients.size} patients: ${Array.from(patients.keys()).join(', ')}`);

app.use('/webhooks/linq', express.raw({ type: 'application/json' }), createLinqRouter(patients, platform));
app.use(express.json());

const sseClients = new Set<SseClient>();

function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const client = res as unknown as SseClient;
  sseClients.add(client);

  // Send immediate snapshot
  res.write(`event: sessions_updated\ndata: ${JSON.stringify({ sessions: getActiveSessions() })}\n\n`);

  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.delete(client);
  });
});

app.get('/api/patients', (_, res) => {
  res.json(getPatientList(patients));
});

app.get('/api/patient/:patientId', (req, res) => {
  const data = patients.get(req.params.patientId);
  if (!data) return res.status(404).json({ error: 'Patient not found' });

  const acc = data.accumulators;
  return res.json({
    patientId: data.patientId,
    displayName: data.member.displayName,
    memberId: data.member.memberId,
    dateOfBirth: data.member.dateOfBirth,
    phone: data.member.phone,
    address: data.member.address,
    planName: DEMO_PLAN.planName,
    planYear: String(DEMO_PLAN.defaultBenefits.planYear),
    coverage: data.coverage,
    accumulators: {
      deductiblePaid: acc.deductiblePaid / 100,
      deductibleTotal: acc.deductibleTotal / 100,
      oopPaid: acc.oopPaid / 100,
      oopTotal: acc.oopTotal / 100,
      planYear: acc.planYear,
      eobCount: acc.eobCount,
    },
    recentClaims: data.claims.slice(0, 8).map(c => ({
      serviceDate: c.serviceDate,
      providerName: c.providerName,
      claimType: c.claimType,
      status: c.status,
      isDenied: c.isDenied,
      billedAmount: c.billedAmount / 100,
      planPaid: c.planPaid / 100,
      memberOwes: c.memberOwes / 100,
    })),
    medications: data.medications.slice(0, 10),
  });
});

app.get('/api/sessions', (_, res) => {
  res.json({ sessions: getActiveSessions() });
});

app.post('/chat', async (req, res) => {
  const { message, patientId } = req.body as { message: string; patientId: string };

  if (!message?.trim() || !patientId?.trim()) {
    return res.status(400).json({ error: 'message and patientId required' });
  }

  const patientData = patients.get(patientId);
  if (!patientData) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  try {
    broadcast('message_received', { patientId, message, timestamp: new Date().toISOString() });
    broadcast('claire_typing', { patientId });

    const { userToken, userId } = await platform.users.getOrCreate(patientId) as { userToken: string; userId: string };
    const kravaUserId = userId ?? patientId;

    const existing = getConversation(patientId);
    const currentChatId = existing?.chatId;
    const isFirstMessage = !existing;

    const systemPrompt = buildSystemPrompt(patientData);

    let responseText = '';
    let newChatId = currentChatId;

    try {
      for await (const chunk of streamKravaChat(userToken, message, { chatId: currentChatId, system: systemPrompt })) {
        if (chunk.chatId) newChatId = chunk.chatId;
        if (chunk.text) responseText += chunk.text;
      }
    } catch (streamErr) {
      console.error('[chat] stream error:', streamErr);
      responseText = "I'm sorry, I'm having trouble right now. Please try again in a moment.";
      broadcast('claire_error', { patientId, reason: 'Stream failed' });
    }

    saveConversation(patientId, {
      patientId,
      kravaUserId,
      chatId: newChatId,
      messageCount: (existing?.messageCount ?? 0) + 1,
      lastMessageAt: new Date().toISOString(),
      lastMessage: message,
      lastResponse: responseText,
    });

    if (isFirstMessage) {
      broadcast('session_started', { patientId, displayName: patientData.member.displayName });
      broadcast('sessions_updated', { sessions: getActiveSessions() });
    }

    broadcast('claire_response', { patientId, response: responseText, timestamp: new Date().toISOString() });

    return res.json({ response: responseText, chatId: newChatId });
  } catch (err) {
    console.error('[chat] error:', err);
    return res.status(500).json({ error: 'Failed to get response. Please try again.' });
  }
});

app.get('/test', (_, res) => res.sendFile(path.join(__dirname, '../public/test.html')));
app.get('/minMemberChat', (_, res) => res.sendFile(path.join(__dirname, '../public/memberchat.html')));
app.get('/minMemberChat/:patientId', (_, res) => res.sendFile(path.join(__dirname, '../public/memberchat-session.html')));
app.get('/minDashboard', (_, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/dashboard', (_, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));

app.listen(PORT, () => {
  console.log(`[claire] http://localhost:${PORT}/test`);
});

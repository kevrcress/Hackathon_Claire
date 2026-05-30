export interface ConversationState {
  patientId: string;
  kravaUserId: string;
  chatId?: string;
  messageCount: number;
  lastMessageAt: string;  // ISO timestamp
  lastMessage: string;
  lastResponse: string;
}

const conversations = new Map<string, ConversationState>();

export function getConversation(patientId: string): ConversationState | undefined {
  return conversations.get(patientId);
}

export function saveConversation(patientId: string, state: ConversationState): void {
  conversations.set(patientId, state);
}

export function getActiveSessions(): ConversationState[] {
  return Array.from(conversations.values())
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

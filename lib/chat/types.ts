import type { Message as ApiMessage } from '@/lib/api/openapi-types';

/** One direct message as the chat UI sees it. Ownership is ALWAYS `sender === me`, never a role guess. */
export interface ChatMsg {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  created_at: string;
  is_edited?: boolean;
  sender_name?: string;
  recipient_name?: string;
  /** Only set on messages that exist in this browser but not on the server yet. */
  local?: 'sending' | 'failed';
}

export const MAX_LEN = 4000;

export function fromApi(m: ApiMessage): ChatMsg {
  return {
    id: String(m.id),
    sender: m.sender,
    recipient: m.recipient,
    content: m.content,
    created_at: m.created_at,
    is_edited: m.is_edited,
    sender_name: m.sender_name,
    recipient_name: m.recipient_name,
  };
}

function asMsg(v: unknown): ChatMsg | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = o.id;
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  if (typeof o.sender !== 'string' || typeof o.recipient !== 'string' || typeof o.content !== 'string') return null;
  return {
    id: String(id),
    sender: o.sender,
    recipient: o.recipient,
    content: o.content,
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
    is_edited: typeof o.is_edited === 'boolean' ? o.is_edited : undefined,
    sender_name: typeof o.sender_name === 'string' ? o.sender_name : undefined,
    recipient_name: typeof o.recipient_name === 'string' ? o.recipient_name : undefined,
  };
}

/**
 * The WS event shape is not in the OpenAPI spec, so this accepts the message itself or one wrapped
 * under `message` / `data` / `payload` (up to two levels). Returns null when nothing looks like a
 * message; the store then falls back to refetching instead of guessing.
 */
export function parseSocketEvent(raw: unknown): ChatMsg | null {
  const keys = ['message', 'data', 'payload'];
  const walk = (v: unknown, depth: number): ChatMsg | null => {
    const direct = asMsg(v);
    if (direct) return direct;
    if (depth === 0 || !v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    for (const k of keys) {
      const hit = walk(o[k], depth - 1);
      if (hit) return hit;
    }
    return null;
  };
  return walk(raw, 2);
}

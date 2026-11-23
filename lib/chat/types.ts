/** One direct message as the chat UI sees it. Ownership is ALWAYS `sender === me`, never a role guess. */
export interface ChatMsg {
  id: string;
  sender: string;
  recipient: string;
  /** The order this message belongs to. null = the general stream between two users. */
  order: string | null;
  content: string;
  created_at: string;
  is_read: boolean;
  is_system: boolean;
  is_edited?: boolean;
  sender_name?: string;
  recipient_name?: string;
  /** Only set on messages that exist in this browser but not on the server yet. */
  local?: 'sending' | 'failed';
}

export const MAX_LEN = 4000;

/** Which chat a message lives in. One per order, plus one general stream per other person. */
export const streamKey = (order: string | null | undefined, other: string | null | undefined): string =>
  order ? `order:${order}` : `user:${other ?? ''}`;

/** Message shape as the REST API / WebSocket sends it. */
export interface ApiMsg {
  id: string | number;
  sender: string;
  recipient: string;
  order?: string | null;
  content: string;
  created_at?: string;
  is_read?: boolean;
  is_system_generated?: boolean;
  is_edited?: boolean;
  sender_name?: string;
  recipient_name?: string;
}

export function fromApi(m: ApiMsg): ChatMsg {
  return {
    id: String(m.id),
    sender: m.sender,
    recipient: m.recipient,
    order: m.order ?? null,
    content: m.content,
    created_at: m.created_at ?? new Date().toISOString(),
    is_read: Boolean(m.is_read),
    is_system: Boolean(m.is_system_generated),
    is_edited: m.is_edited,
    sender_name: m.sender_name,
    recipient_name: m.recipient_name,
  };
}

const isMsg = (v: unknown): v is ApiMsg => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    (typeof o.id === 'string' || typeof o.id === 'number') &&
    typeof o.sender === 'string' &&
    typeof o.recipient === 'string' &&
    typeof o.content === 'string'
  );
};

/**
 * Frames the backend socket (ws/chat/) sends, from social.consumers.ChatConsumer:
 *   {type:'new_message'|'edited_message', data:<Message>}
 *   {type:'deleted_message', data:{id, order}}
 *   {type:'read_receipt', user_id, order, bulk}
 *   {type:'pong'}
 */
export type SocketFrame =
  | { kind: 'message'; edited: boolean; msg: ChatMsg }
  | { kind: 'deleted'; id: string; order: string | null }
  | { kind: 'read'; by: string; order: string | null }
  | { kind: 'ignore' };

/** null = a frame we do not recognise; the store refetches instead of guessing. */
export function parseFrame(raw: unknown): SocketFrame | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  switch (o.type) {
    case 'new_message':
    case 'edited_message':
      return isMsg(o.data) ? { kind: 'message', edited: o.type === 'edited_message', msg: fromApi(o.data) } : null;
    case 'deleted_message': {
      const d = o.data as { id?: unknown; order?: unknown } | undefined;
      return d && d.id != null ? { kind: 'deleted', id: String(d.id), order: typeof d.order === 'string' ? d.order : null } : null;
    }
    case 'read_receipt':
      return typeof o.user_id === 'string' ? { kind: 'read', by: o.user_id, order: typeof o.order === 'string' ? o.order : null } : null;
    case 'pong':
      return { kind: 'ignore' };
    default:
      return null;
  }
}

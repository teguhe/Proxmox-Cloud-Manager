import { randomBytes } from 'node:crypto';
import type { UserRole, VmType } from 'shared';

export interface WsTicketPayload {
  userId: string;
  userEmail: string;
  userRole: UserRole;
  nodeId: string;
  vmType: VmType;
  vmid: number;
  expiresAt: number;
}

const TICKET_TTL_MS = 30_000;
const tickets = new Map<string, WsTicketPayload>();

export function issueWsTicket(
  payload: Omit<WsTicketPayload, 'expiresAt'>
): string {
  const token = randomBytes(32).toString('hex');
  tickets.set(token, {
    ...payload,
    expiresAt: Date.now() + TICKET_TTL_MS,
  });
  return token;
}

export function consumeWsTicket(
  token: string,
  nodeId: string,
  vmType: VmType,
  vmid: number
): WsTicketPayload | null {
  const entry = tickets.get(token);
  if (!entry) return null;

  tickets.delete(token);

  if (Date.now() > entry.expiresAt) return null;
  if (entry.nodeId !== nodeId || entry.vmType !== vmType || entry.vmid !== vmid) {
    return null;
  }

  return entry;
}

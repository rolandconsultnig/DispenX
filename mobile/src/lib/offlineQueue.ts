import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Method } from 'axios';
import api from './api';

const OFFLINE_QUEUE_KEY = 'cfms_mobile_offline_queue_v1';

type QueueMethod = 'post' | 'put' | 'patch' | 'delete';

type QueuedRequest = {
  id: string;
  method: QueueMethod;
  url: string;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  idempotencyKey: string;
  createdAt: string;
  retryCount: number;
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isOfflineError(error: any): boolean {
  if (error?.response) return false;
  const code = String(error?.code || '').toUpperCase();
  const msg = String(error?.message || '').toLowerCase();
  if (code.includes('NETWORK') || code.includes('ECONN') || code.includes('ETIMEDOUT')) return true;
  return msg.includes('network error') || msg.includes('timeout');
}

async function loadQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedRequest[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueuedRequestCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

export async function enqueueMutation(input: {
  method: QueueMethod;
  url: string;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}): Promise<QueuedRequest> {
  const queue = await loadQueue();
  const queued: QueuedRequest = {
    id: makeId('q'),
    method: input.method,
    url: input.url,
    data: input.data,
    headers: input.headers,
    idempotencyKey: input.idempotencyKey || makeId('idem'),
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  queue.push(queued);
  await saveQueue(queue);
  return queued;
}

export async function processOfflineQueue(): Promise<void> {
  const queue = await loadQueue();
  if (!queue.length) return;

  const remaining: QueuedRequest[] = [];
  for (const item of queue) {
    try {
      await api.request({
        method: item.method as Method,
        url: item.url,
        data: item.data,
        headers: {
          ...(item.headers || {}),
          'X-Idempotency-Key': item.idempotencyKey,
          'X-Offline-Replay': '1',
        },
      });
    } catch (err: any) {
      if (isOfflineError(err) || !err?.response) {
        remaining.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }

  await saveQueue(remaining);
}

export async function sendOrQueueMutation(input: {
  method: QueueMethod;
  url: string;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<{ queued: boolean }> {
  const idempotencyKey = makeId('idem');
  try {
    await api.request({
      method: input.method as Method,
      url: input.url,
      data: input.data,
      headers: {
        ...(input.headers || {}),
        'X-Idempotency-Key': idempotencyKey,
      },
    });
    return { queued: false };
  } catch (err: any) {
    if (!isOfflineError(err)) {
      throw err;
    }

    await enqueueMutation({
      method: input.method,
      url: input.url,
      data: input.data,
      headers: input.headers,
      idempotencyKey,
    });
    return { queued: true };
  }
}

import {
  dequeue, markFailed,
  markNoteSynced,
  peekQueue,
  queueSize,
  removeLocalNote,
  removePendingSet,
} from '@/lib/local-db';
import { supabase } from '@/lib/supabase';
import NetInfo from '@react-native-community/netinfo';

type Listener = (state: { pending: number; syncing: boolean }) => void;

let listeners: Listener[] = [];
let syncing = false;
let online = true;

export function subscribeSync(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

async function notify() {
  const pending = await queueSize();
  listeners.forEach((l) => l({ pending, syncing }));
}

export function isOnline(): boolean {
  return online;
}

// Bir kuyruk ogesini isle. true donerse kuyruktan silinir.
async function processItem(item: { id: number; op: string; payload: string }): Promise<boolean> {
  const payload = JSON.parse(item.payload);

  if (item.op === 'insert_set_log') {
    const { local_id, ...row } = payload;

    // Ayni kayit iki kez gonderilirse: (session, exercise, set_index) essiz
    // indeksi ikinciyi reddeder. Bunu basari sayiyoruz - kayit zaten orada.
    const { error } = await supabase.from('set_logs').insert(row);

    if (error) {
      const duplicate = error.code === '23505';
      if (!duplicate) throw error;
    }

    await removePendingSet(local_id);
    return true;
  }

  if (item.op === 'delete_set_log') {
    const { error } = await supabase.from('set_logs').delete().eq('id', payload.id);
    if (error) throw error;
    return true;
  }

  if (item.op === 'upsert_note') {
    // id client tarafinda uretiliyor, upsert idempotent.
    const { error } = await supabase.from('notes').upsert(payload);
    if (error) throw error;
    await markNoteSynced(payload.id);
    return true;
  }

  if (item.op === 'delete_note') {
    const { error } = await supabase.from('notes').delete().eq('id', payload.id);
    if (error) throw error;
    await removeLocalNote(payload.id);
    return true;
  }

  // Bilinmeyen islem - kuyrukta tikanmasin
  return true;
}

export async function flushQueue(): Promise<void> {
  if (syncing || !online) return;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return; // oturum yoksa gonderme

  syncing = true;
  await notify();

  try {
    let items = await peekQueue(20);

    while (items.length > 0) {
      for (const item of items) {
        try {
          const done = await processItem(item);
          if (done) await dequeue(item.id);
        } catch (e: any) {
          await markFailed(item.id, e?.message ?? 'unknown');

          // 5 denemeden sonra pes et - kuyrugu tikamasin
          if ((item as any).attempts >= 4) {
            await dequeue(item.id);
          }
          // Bir oge basarisizsa turu bitir, sonra tekrar dene
          syncing = false;
          await notify();
          return;
        }
      }
      items = await peekQueue(20);
    }
  } finally {
    syncing = false;
    await notify();
  }
}

export function startSyncEngine(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const wasOffline = !online;
    online = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (online && wasOffline) {
      flushQueue().catch(() => {});
    }
    notify().catch(() => {});
  });

  // Uygulama acilisinda ve periyodik olarak dene
  flushQueue().catch(() => {});
  const timer = setInterval(() => {
    flushQueue().catch(() => {});
  }, 30_000);

  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}
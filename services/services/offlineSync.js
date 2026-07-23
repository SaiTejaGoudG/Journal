const QUEUE_KEY = "sb_pending_ops";
const CACHE_KEY = "sb_notes_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const isOnline = () => navigator.onLine;

export function queueOperation(op) {
  const queue = getPendingQueue();
  queue.push({ ...op, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getPendingQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearPendingQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function cacheNotes(notes) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ notes, cachedAt: Date.now() }));
}

export function getCachedNotes() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!data || Date.now() - data.cachedAt > CACHE_TTL) return null;
    return data.notes;
  } catch {
    return null;
  }
}

export async function syncPendingOps(apiInstance) {
  const queue = getPendingQueue();
  if (!queue.length) return 0;
  let synced = 0;
  const failed = [];
  for (const op of queue) {
    try {
      if (op.type === "create") await apiInstance.post("/notes", op.payload);
      else if (op.type === "update") await apiInstance.put(`/notes/${op.id}`, op.payload);
      synced++;
    } catch {
      failed.push(op);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
  return synced;
}

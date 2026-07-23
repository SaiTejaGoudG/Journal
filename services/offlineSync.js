// Offline sync is not supported in the Next.js / Vercel deployment.
// These are no-op stubs to keep existing component imports from breaking.
export const syncPendingOps = async () => {};
export const getPendingQueue = () => [];
export const cacheNotes = async () => {};
export const getCachedNotes = () => [];
export const queueOperation = async () => {};
export const isOnline = () => true; // always report online in Next.js

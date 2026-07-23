"use client";
import { useState } from "react";

/**
 * WebSocket real-time sync is not available in the Next.js / Vercel serverless
 * deployment. This hook is a no-op shim so existing components compile without
 * changes. All note mutations already refetch via the normal API calls.
 */
export default function useWebSocket() {
  const [lastEvent] = useState(null);
  const [connected] = useState(false);
  return { lastEvent, connected };
}

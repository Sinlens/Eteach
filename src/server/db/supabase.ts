import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { RpcCall } from "./rpc";

/**
 * Server-only Supabase access.
 *
 * This module must never reach the browser: it holds the service role key,
 * which bypasses row level security by design. Every table has RLS enabled with
 * no policies, so the service role is currently the only way in — that is the
 * whole point of routing through the server (§24).
 */
let client: SupabaseClient | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not set. The data backend is configured as "supabase" — set it as a ` +
        `server secret, or set VITE_DATA_BACKEND to "mock" to run without a database.`,
    );
  }

  return value;
}

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}

export async function callRpc<T>(call: RpcCall): Promise<T> {
  const { data, error } = await supabase().rpc(call.fn, call.args);

  if (error) {
    throw new Error(`rpc "${call.fn}" failed: ${error.message}`);
  }

  return data as T;
}

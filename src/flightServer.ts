/**
 * WebTransport flight server. Browsers open one session each.
 * Poses are datagrams; membership and weapons use the reliable stream.
 * Every pose, burst and launch is admitted before it is relayed.
 */

import { createRelayAdmission } from "@0sfs/anti-cheat/relayAdmission";
import { createServerRelay, type ServerRelay } from "@0sfs/multiplayer/serverRelay";
import { bridgeFlightSession, type TransportSession } from "./webTransportBridge";

export interface FlightServerOptions {
  port?: number;
  host?: string;
  cert: string;
  key: string;
  secret?: string;
  origins?: readonly string[] | null;
}

interface Http3ServerLike {
  setRequestCallback(callback: (request: { header: Record<string, string> }) => { status: number; path: string }): void;
  sessionStream(path: string): Promise<ReadableStream<TransportSession>>;
  startServer(): void;
  ready: Promise<void>;
  destroy(): void;
}

export async function startFlightServer(options: FlightServerOptions): Promise<{ url: string; close(): void }> {
  const loaded = await import("@fails-components/webtransport") as { Http3Server: new (init: Record<string, unknown>) => Http3ServerLike };
  const port = options.port ?? 4433;
  const host = options.host ?? "0.0.0.0";
  const relay = createServerRelay({ admission: createRelayAdmission });
  const server = new loaded.Http3Server({
    port, host, cert: options.cert, privKey: options.key,
    secret: options.secret ?? crypto.randomUUID().replace(/-/g, ""),
    defaultDatagramsReadableMode: "bytes",
  });
  const origins = options.origins ?? null;
  server.setRequestCallback(({ header }) => {
    const path = (header[":path"] ?? "").split("?")[0];
    if (path !== "/flight") return { status: 404, path };
    if (origins && !origins.includes(header.origin ?? "")) return { status: 403, path };
    return { status: 200, path };
  });
  const sessions = await server.sessionStream("/flight");
  const reader = sessions.getReader();
  server.startServer();
  await server.ready;
  void acceptSessions(reader, relay, () => server.destroy());
  const advertised = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return { url: `https://${advertised}:${port}/flight`, close() { relay.close(); server.destroy(); } };
}

async function acceptSessions(reader: ReadableStreamDefaultReader<TransportSession>, relay: ServerRelay, onStop: () => void) {
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) return;
      void next.value.ready.then(() => bridgeFlightSession(next.value, relay)).catch(() => next.value.close());
    }
  } catch { onStop(); }
}

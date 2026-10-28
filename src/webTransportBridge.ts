/**
 * Adapts one WebTransport session onto the flight relay.
 * The browser opens the reliable stream; datagrams carry poses.
 */

import { createReliableDecoder, decodeDatagram, encodeDatagram, encodeReliableFrame } from "@0sfs/multiplayer/serverFrames";
import type { RelaySocket, ServerRelay } from "@0sfs/multiplayer/serverRelay";

export interface ByteDuplex {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

export interface TransportSession {
  ready: Promise<void>;
  closed: Promise<unknown>;
  incomingBidirectionalStreams: ReadableStream<ByteDuplex>;
  datagrams: {
    readable: ReadableStream<Uint8Array>;
    writable?: WritableStream<Uint8Array>;
    createWritable?: () => WritableStream<Uint8Array>;
  };
  close(): void;
}

export async function bridgeFlightSession(session: TransportSession, relay: ServerRelay): Promise<void> {
  await session.ready;
  const incoming = session.incomingBidirectionalStreams.getReader();
  const first = await incoming.read();
  const stream = first.value;
  if (!stream) { session.close(); return; }
  const datagramWritable = session.datagrams.writable ?? session.datagrams.createWritable?.();
  if (!datagramWritable) { session.close(); return; }
  let reliableHandler: ((encoded: string) => void) | null = null;
  let datagramHandler: ((encoded: string) => void) | null = null;
  let closeHandler: ((reason: string) => void) | null = null;
  let closed = false;
  const writer = stream.writable.getWriter();
  const datagramWriter = datagramWritable.getWriter();
  let reliableChain = Promise.resolve();
  let datagramPending = false;
  let latest: Uint8Array | null = null;
  const fail = (reason: string) => {
    if (closed) return;
    closed = true;
    closeHandler?.(reason);
    session.close();
  };
  const socket: RelaySocket = {
    sendReliable(encoded) {
      if (closed) return false;
      const bytes = encodeReliableFrame(encoded);
      reliableChain = reliableChain.then(() => writer.write(bytes)).then(() => undefined, () => fail("closed"));
      return true;
    },
    sendDatagram(encoded) {
      if (closed) return false;
      const bytes = encodeDatagram(encoded);
      if (!bytes) return false;
      latest = bytes;
      if (!datagramPending) { datagramPending = true; void flush(); }
      return true;
    },
    close(reason = "closed") {
      if (closed) return;
      closed = true;
      void reliableChain.finally(() => { session.close(); closeHandler?.(reason); });
    },
    onReliable(handler) { reliableHandler = handler; },
    onDatagram(handler) { datagramHandler = handler; },
    onClose(handler) { closeHandler = handler; },
  };
  async function flush() {
    while (latest && !closed) {
      const bytes = latest;
      latest = null;
      try { await datagramWriter.write(bytes); } catch { fail("closed"); return; }
    }
    datagramPending = false;
    if (latest && !closed) { datagramPending = true; void flush(); }
  }
  relay.accept(socket);
  const decode = createReliableDecoder(line => reliableHandler?.(line), () => fail("invalid"));
  void session.closed.then(() => fail("closed"), () => fail("closed"));
  void pump(stream.readable, decode, () => fail("closed"));
  void pump(session.datagrams.readable, chunk => { const text = decodeDatagram(chunk); if (text) datagramHandler?.(text); }, () => fail("closed"));
}

async function pump(readable: ReadableStream<Uint8Array>, onChunk: (chunk: Uint8Array) => void, onError: () => void) {
  const reader = readable.getReader();
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) { onError(); return; }
      onChunk(result.value);
    }
  } catch { onError(); }
}

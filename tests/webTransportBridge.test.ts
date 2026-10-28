import { describe, expect, it } from "vitest";
import { encodeMessage, parseMessage } from "@0sfs/multiplayer/protocol";
import { encodeReliableFrame } from "@0sfs/multiplayer/serverFrames";
import { createServerRelay } from "@0sfs/multiplayer/serverRelay";
import { bridgeFlightSession, type ByteDuplex, type TransportSession } from "../src/webTransportBridge";

function channel() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const readable = new ReadableStream<Uint8Array>({ start(next) { controller = next; } });
  const writable = new WritableStream<Uint8Array>({ write(chunk) { controller.enqueue(new Uint8Array(chunk)); } });
  return { readable, writable };
}
function once<T>(value: T): ReadableStream<T> {
  return new ReadableStream({ start(controller) { controller.enqueue(value); } });
}

describe("webtransport bridge", () => {
  it("turns a reliable stream into a flight the relay can admit", async () => {
    const up = channel();
    const down = channel();
    const datagrams = channel();
    const stream: ByteDuplex = { readable: up.readable, writable: down.writable };
    const session: TransportSession = {
      ready: Promise.resolve(), closed: new Promise(() => {}),
      incomingBidirectionalStreams: once(stream),
      datagrams: { readable: datagrams.readable, writable: channel().writable },
      close() {},
    };
    const relay = createServerRelay({ now: () => 1_000 });
    const bridged = bridgeFlightSession(session, relay);
    const writer = up.writable.getWriter();
    const settings = { damageImplementation: "health-v1" as const, settingsEditors: "host" as const };
    await writer.write(encodeReliableFrame(encodeMessage({ type: "open-flight", v: 2, pilotId: "host", aircraftId: "f-35b", damageImplementations: ["health-v1"], settings })!));
    const reader = down.readable.getReader();
    const first = await reader.read();
    const text = new TextDecoder().decode(first.value);
    expect(parseMessage(text.trim())?.type).toBe("welcome");
    relay.close();
    await bridged;
  });
});

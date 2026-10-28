/** Present so the flight server typechecks before the optional package is installed. */
declare module "@fails-components/webtransport" {
  export class Http3Server {
    constructor(init: Record<string, unknown>);
    setRequestCallback(callback: (request: { header: Record<string, string> }) => { status: number; path: string }): void;
    sessionStream(path: string): Promise<ReadableStream<unknown>>;
    startServer(): void;
    ready: Promise<void>;
    destroy(): void;
  }
}

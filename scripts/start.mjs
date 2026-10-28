/**
 * Flight server.
 *
 *   cd ~/gh/0sfs/multiplayer-server && npm start
 *
 * Prints an https URL and a certificate hash. Paste both into the flight's
 * Multiplayer tab, then Host on server. The invitation carries the hash, so
 * guests do not type it again. The generated certificate lasts 13 days and is
 * only for this machine. A public server should set OSFS_FLIGHT_CERT and
 * OSFS_FLIGHT_KEY to a normal trusted certificate and leave the hash empty.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const multiplayerSrc = path.resolve(root, "../multiplayer/src");
const antiCheatSrc = path.resolve(root, "../anti-cheat/src");
if (!existsSync(path.join(multiplayerSrc, "serverRelay.ts")) || !existsSync(path.join(antiCheatSrc, "relayAdmission.ts"))) {
  console.error("Place current checkouts of multiplayer and anti-cheat beside this repository.");
  console.error("The server needs ../multiplayer/src/serverRelay.ts and ../anti-cheat/src/relayAdmission.ts.");
  console.error("git clone https://github.com/0SFS/multiplayer.git");
  console.error("git clone https://github.com/0SFS/anti-cheat.git");
  process.exit(1);
}
ensureTransport();

const directory = path.join(root, "build", "flight-server");
const certFromEnv = process.env.OSFS_FLIGHT_CERT;
const keyFromEnv = process.env.OSFS_FLIGHT_KEY;
if (Boolean(certFromEnv) !== Boolean(keyFromEnv)) {
  console.error("Set both OSFS_FLIGHT_CERT and OSFS_FLIGHT_KEY, or neither.");
  process.exit(1);
}
const certPath = certFromEnv ? path.resolve(certFromEnv) : path.join(directory, "cert.pem");
const keyPath = keyFromEnv ? path.resolve(keyFromEnv) : path.join(directory, "key.pem");
let generatedFor = [];
if (!certFromEnv || !keyFromEnv) {
  mkdirSync(directory, { recursive: true });
  if (!existsSync(certPath) || !stillValid(readFileSync(certPath, "utf8"))) {
    generatedFor = lanAddresses();
    const names = ["IP:127.0.0.1", "DNS:localhost", ...generatedFor.map(address => `IP:${address}`)];
    const generated = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes",
      "-keyout", keyPath, "-out", certPath, "-days", "13", "-subj", "/CN=127.0.0.1",
      "-addext", `subjectAltName=${names.join(",")}`], { stdio: "inherit" });
    if (generated.status !== 0) process.exit(generated.status ?? 1);
  }
}
const cert = readFileSync(certPath, "utf8");
const hash = createHash("sha256").update(new X509Certificate(cert).raw).digest("base64url");
const port = Number(process.env.OSFS_FLIGHT_PORT ?? 4433);
const host = process.env.OSFS_FLIGHT_HOST ?? "0.0.0.0";

const vite = await createServer({
  root, configFile: false, logLevel: "error", appType: "custom",
  server: { middlewareMode: true },
  ssr: { external: ["@fails-components/webtransport", "@fails-components/webtransport-transport-http3-quiche"] },
  resolve: {
    conditions: ["source", "import", "module", "default"],
    alias: [
      { find: /^@0sfs\/multiplayer\/(.*)$/, replacement: `${multiplayerSrc}/$1.ts` },
      { find: /^@0sfs\/anti-cheat\/(.*)$/, replacement: `${antiCheatSrc}/$1.ts` },
    ],
  },
});
try {
  const server = await vite.ssrLoadModule(pathToFileURL(path.join(root, "src", "flightServer.ts")).href);
  const origins = process.env.OSFS_FLIGHT_ORIGINS?.split(",").map(item => item.trim()).filter(Boolean) ?? null;
  const flight = await server.startFlightServer({
    port, host, cert, key: readFileSync(keyPath, "utf8"),
    secret: randomBytes(32).toString("hex"), origins,
  });
  console.log(`Flight server: ${flight.url}`);
  for (const address of generatedFor) console.log(`Also on this certificate: https://${address}:${port}/flight`);
  console.log(`Certificate hash: ${hash}`);
  console.log("Paste the address and hash into Multiplayer, then Host on server.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("@fails-components/webtransport") || message.includes("http3-quiche")) {
    console.error("The WebTransport packages are not ready. From this directory, run: npm install");
    process.exit(1);
  }
  throw error;
}

function stillValid(pem) {
  try { return new Date(new X509Certificate(pem).validTo).getTime() > Date.now() + 86_400_000; }
  catch { return false; }
}

function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.internal || entry.family !== "IPv4") continue;
      addresses.push(entry.address);
    }
  }
  return addresses;
}

function ensureTransport() {
  const packageJson = path.join(root, "node_modules/@fails-components/webtransport-transport-http3-quiche/package.json");
  if (!existsSync(packageJson)) {
    console.error("The WebTransport packages are not installed. From this directory, run: npm install");
    process.exit(1);
  }
  const transport = path.dirname(packageJson);
  const binary = path.join(transport, "build/Release/webtransport.node");
  if (existsSync(binary)) return;
  const localBin = [
    path.join(root, "node_modules/.bin"),
    path.join(transport, "node_modules/.bin"),
  ].join(path.delimiter);
  const installed = spawnSync("prebuild-install", ["-r", "napi", "-t", "6"], {
    cwd: transport, stdio: "inherit",
    env: { ...process.env, PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ""}` },
  });
  if (!existsSync(binary)) {
    console.error("The QUIC binary is not installed. From this directory, run: PATH=node_modules/.bin:$PATH node node_modules/@fails-components/webtransport-transport-http3-quiche/build.js install");
    process.exit(installed.status || 1);
  }
}

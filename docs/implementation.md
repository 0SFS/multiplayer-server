# Multiplayer server implementation

Status: **local flight server; physical-device acceptance pending**
Date: 2026-10-27

## What this repository owns

The process a machine runs to host a flight. `startFlightServer` accepts one WebTransport session per pilot on `/flight`. `bridgeFlightSession` turns that session's reliable stream and datagrams into the relay socket. The relay itself is `@0sfs/multiplayer`. Admission is `@0sfs/anti-cheat`'s `createRelayAdmission`, one watcher per flight. This repository does not decide whether a pose is legal, and it does not draw aircraft.

`npm start` generates a 13-day certificate for local use, or reads `OSFS_FLIGHT_CERT` and `OSFS_FLIGHT_KEY`. The printed hash is the SHA-256 of the certificate, base64url, which the browser passes as `serverCertificateHashes`. Certificates and the QUIC secret stay in the ignored `build/` directory.

## What stays in the libraries

`@0sfs/multiplayer` owns the messages, membership, invitation secret, settings authority, and fan-out. `@0sfs/anti-cheat` owns the pose, burst and launch checks. The browser session in the fly app connects to the address this process prints. Serverless two-pilot flights do not use this process.

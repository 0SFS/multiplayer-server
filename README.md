# Multiplayer server

The process that hosts a 0SFS flight. Each pilot opens one WebTransport session. Poses arrive as datagrams. Membership, settings and weapons use the reliable stream. The server admits a pose with `@0sfs/anti-cheat` before it relays it.

The messages and the relay live in [@0sfs/multiplayer](https://github.com/0SFS/multiplayer). The admission rules live in [@0sfs/anti-cheat](https://github.com/0SFS/anti-cheat). This repository is the program you run. The implementation spec is [docs/implementation.md](docs/implementation.md).

## Run

Clone this repository beside those two libraries:

```sh
git clone https://github.com/0SFS/multiplayer.git
git clone https://github.com/0SFS/anti-cheat.git
git clone https://github.com/0SFS/multiplayer-server.git
cd multiplayer-server
npm install
npm start
```

`npm start` prints an https address and a certificate hash. In the flight, open **Multiplayer**, paste both, and press **Host on server**. Share the invitation. Guests do not type the hash again. The invitation lasts two minutes or until the flight reaches 16 pilots.

The generated certificate lasts 13 days, names `127.0.0.1`, `localhost`, and this machine's local IPv4 addresses, and is stored in `build/flight-server`. Delete that directory to mint a new one. Another device uses one of the printed local addresses. A public server should set `OSFS_FLIGHT_CERT` and `OSFS_FLIGHT_KEY` to a trusted certificate and leave the hash empty in the flight.

`OSFS_FLIGHT_PORT` changes the port (default `4433`). `OSFS_FLIGHT_HOST` changes the bind address (default `0.0.0.0`). `OSFS_FLIGHT_ORIGINS` is a comma-separated list of allowed browser origins; unset allows any origin.

## Community

- [Code of conduct](https://github.com/0SFS/.github/blob/main/CODE_OF_CONDUCT.md)
- [Contributing](https://github.com/0SFS/.github/blob/main/CONTRIBUTING.md)
- [License](LICENSE)
- [Security](https://github.com/0SFS/.github/blob/main/SECURITY.md)

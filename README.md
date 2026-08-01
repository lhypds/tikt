
tikt
====

A minimal web app for logging body events. Each press saves the record name, timestamp, and an intensity from 1–10.


Running locally
---------------

Requires Node.js 22 or later (the server uses Node's built-in SQLite).

```bash
npm install
npm run dev
```

Default address: `http://localhost:3001`

The server binds `0.0.0.0`, so other devices on the same network can open it too — the startup log prints the network URL (e.g. `http://192.168.x.x:3001`).

Production build:

```bash
npm run build
npm start
```

Data is stored in `db.sqlite` at the project root. The `users` and `knots` tables are created automatically on first startup.


Intensity input
---------------

- iOS / pressure-capable styluses: touch pressure is read first when available.
- Android, mice, and devices without pressure data: intensity increases by one level every 400ms while held.
- A light tap always starts at intensity 1; the maximum is 10.

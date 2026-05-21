# Summer School Experimental Economics Lab

Multi-device classroom web app for a Summer School session on experimental economics.

Participants join from their own laptop, tablet, or phone, make decisions in several games, and the instructor can view live aggregate results.

## Games included

- Dictator Game
- Ultimatum Game
- Public Goods Game
- Trust Game
- Instructor results dashboard
- CSV export

## Run locally

Install Node.js 18 or newer, then run:

```bash
npm start
```

Open:

```text
http://localhost:3000/
```

Instructor dashboard:

```text
http://localhost:3000/admin.html
```

## Use in class

For everyone to join from their own device, the app must run on a server that all devices can reach.

Options:

- Deploy it online, for example on Render, Railway, Fly.io, or a university server.
- Run it on the classroom Wi-Fi from one computer and share that computer's local network address.

The app stores decisions in:

```text
data/decisions.json
```

If you deploy online, use a persistent disk or database so the results survive server restarts.

GitHub Pages alone is not enough for this version, because GitHub Pages cannot save participant decisions.

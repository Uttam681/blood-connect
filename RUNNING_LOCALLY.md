# Running BloodConnect Locally (VS Code)

This guide walks you through running the full BloodConnect app (MongoDB +
Express backend + React frontend) on your laptop using VS Code.

---

## 1. Prerequisites

Install these once:

| Tool | Check version | Install |
|------|----------------|---------|
| Node.js (v18+) | `node -v` | https://nodejs.org |
| npm (comes with Node) | `npm -v` | — |
| MongoDB Community Edition | `mongod --version` | https://www.mongodb.com/try/download/community |
| VS Code | — | https://code.visualstudio.com |

Recommended VS Code extensions:
- **MongoDB for VS Code** (browse your local database)
- **ESLint**
- **Tailwind CSS IntelliSense**

---

## 2. Open the project in VS Code

```bash
cd ~/Desktop/BloodConnect
code .
```

The project has two halves:
```
BloodConnect/
├── server/   # Express API (port 5000)
└── client/   # React frontend (port 5173)
```

---

## 3. Start MongoDB

If installed via Homebrew (macOS):

```bash
brew services start mongodb-community
```

Verify it's running:

```bash
mongosh --quiet --eval "db.runCommand({ ping: 1 })"
```
You should see `{ ok: 1 }`.

> Alternative: skip local MongoDB entirely and use a free
> [MongoDB Atlas](https://www.mongodb.com/atlas) cluster — just put its
> connection string in `MONGO_URI` in step 4.

---

## 4. Configure the backend

Open a terminal in VS Code (**Terminal → New Terminal**) and create
`server/.env` (this file is gitignored, so it won't already exist):

```bash
cd server
cat > .env << 'EOF'
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/bloodconnect
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:5173
EOF
```

---

## 5. Install dependencies

Open **two terminals** in VS Code (use the `+` icon in the terminal panel,
or **Terminal → Split Terminal**):

**Terminal 1 — backend**
```bash
cd server
npm install
```

**Terminal 2 — frontend**
```bash
cd client
npm install
```

---

## 6. Run both servers

**Terminal 1 — backend** (runs on http://localhost:5000)
```bash
npm run dev
```
You should see `Server running on port 5000` and `MongoDB connected`.

**Terminal 2 — frontend** (runs on http://localhost:5173)
```bash
npm run dev
```
Vite will print a local URL — open it:
```
http://localhost:5173
```

The frontend's dev server proxies all `/api/*` requests to
`http://localhost:5000` (configured in `client/vite.config.js`), so no
extra CORS setup is needed.

---

## 7. Use the app

1. Go to **http://localhost:5173/register**
2. Register as a **Donor** (with blood group, hospital/blood bank address)
   or a **Patient** (age, gender, city).
3. Log in and explore:
   - **Donors**: toggle availability, view nearby blood requests, accept/decline.
   - **Patients**: raise a blood request, view matched donors, view on map.
   - **Find Donors**: search by blood group/location, list or map view.

---

## 8. Stopping everything

- Stop each dev server with `Ctrl + C` in its terminal.
- Stop MongoDB (if started via Homebrew):
  ```bash
  brew services stop mongodb-community
  ```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `MongoServerError: connect ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running — see step 3. |
| `EADDRINUSE: address already in use :::5000` (or `:5173`) | Another process is using the port. Find & kill it: `lsof -i :5000` then `kill <PID>`. |
| `Email already registered` on register | That email already exists in your local DB — use a different email or drop the `users` collection: `mongosh bloodconnect --eval "db.users.deleteMany({})"`. |
| Geocoding errors / "Location not found" | The address is too vague — include a city name (e.g. "Apollo Hospital, Hyderabad"). |
| Changes to `.env` not picked up | Restart the backend dev server (`Ctrl+C` then `npm run dev`). |

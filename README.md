# Habit Grove

Habit Grove is a MERN habit tracker with JWT authentication, check-ins, streaks,
analytics, and optional Gemini-powered coaching.

## Prerequisites

- Node.js 20 or later and npm
- MongoDB running locally, or a MongoDB Atlas connection string
- A Google Gemini API key to use the AI features (optional)

## Configure the server

In a terminal, from the project root:

```powershell
cd server
Copy-Item .env.example .env
npm install
```

Edit `server/.env` and set `MONGODB_URI` and a private `JWT_SECRET`. Generate a
random secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The example MongoDB URI uses a local database at
`mongodb://127.0.0.1:27017/habit-tracker`. Replace it with your Atlas URI if
using MongoDB Atlas. Set `GEMINI_API_KEY` to enable AI features; leave it blank
to run without AI. Keep `.env` files private and never commit secrets.

Start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:5000` by default. Check
`http://localhost:5000/api/health` to verify it is running.

## Configure and run the client

Open a second terminal from the project root:

```powershell
cd client
Copy-Item .env.example .env
npm install
npm run dev
```

The Vite development server prints the local URL when ready (typically
`http://localhost:5173`). The client defaults to the API at
`http://localhost:5000/api`; set `VITE_API_URL` in `client/.env` to override it.

## Tests and production build

Run the server tests:

```powershell
cd server
npm test
```

Build the client:

```powershell
cd client
npm run build
```

To run the server without the development watcher, use `npm start` from
`server`. To preview a production client build, run `npm run preview` from
`client` after building.

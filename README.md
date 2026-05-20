# 💬 GuessME

**GuessME** is a real-time anonymous review platform for groups. Anyone can create an account, set up a room, share a unique link with their group, and watch anonymous messages roll in — live.

## How It Works

1. **Sign Up** — Create your free account at the homepage
2. **Create a Room** — Give it a name (e.g. "Office Roast 2024")
3. **Share the Link** — Each room gets a unique public URL (e.g. `zerocost.academy/r/a3f2b1c4`)
4. **Start a Round** — Type in the name of the person to review
5. **Watch Live** — Anonymous messages appear on your dashboard in real time

No login required for participants — just open the link and write.

## Tech Stack

- **Backend:** Node.js, Express, Socket.io
- **Database:** SQLite (persistent via Docker volume)
- **Auth:** bcrypt password hashing + express-session
- **Frontend:** Vanilla HTML/CSS/JS

## Features

- 🔐 Secure account system (email + password)
- 🏠 Multiple rooms per account
- ⚡ Real-time live message updates via WebSockets
- 🔒 100% anonymous for participants — no login required
- 📱 Fully responsive on mobile and desktop

## Project Structure

```
├── server.js          # Main Express + Socket.io server
├── db.js              # SQLite database setup
├── package.json       # Dependencies
├── Dockerfile         # Docker image config
├── docker-compose.yml # Container orchestration
├── public/
│   ├── index.html     # Landing / Auth page
│   ├── dashboard.html # Admin dashboard
│   ├── room.html      # Public anonymous message page
│   ├── style.css      # Shared styles
│   ├── auth.js        # Login / Register logic
│   ├── dashboard.js   # Dashboard logic
│   └── room.js        # Public room logic
└── data/              # SQLite database files (auto-created, gitignored)
```

---

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full server setup instructions.

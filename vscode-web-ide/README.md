# VS Code Web IDE

A fully functional browser-based code editor that looks and works exactly like VS Code, powered by **Monaco Editor** (the same editor engine used in VS Code).

## ✨ Features

- 🎨 **VS Code Dark+ Theme** — exact colors, fonts, and styling
- 🗂️ **File Explorer** — create, rename, delete files and folders
- 📑 **Multi-Tab Editing** — open multiple files with unsaved indicators
- ✏️ **Monaco Editor** — same engine as VS Code with full syntax highlighting
- ▶️ **Code Execution** — run JavaScript, Python, and Shell scripts
- 💻 **Terminal Panel** — real interactive shell via WebSocket
- ⌨️ **Command Palette** — Ctrl+Shift+P to access all commands
- 📊 **Status Bar** — language, line/column, git branch, save state
- 🔍 **Search Panel** — search files by name
- 🔌 **Extensions Panel** — marketplace UI (visual demo)

## 🚀 Quick Start

```bash
# 1. Start backend
cd backend
npm install
npm start

# 2. Start frontend (new terminal)
cd frontend
npm install
npm run dev

# 3. Open in browser
http://localhost:5173
```

## ☁️ Deployment

### Frontend (Vercel / Netlify)
```bash
# In frontend/.env.production, set:
VITE_API_URL=https://your-backend.railway.app

# Build
npm run build
# Deploy the /dist folder
```

### Backend (Railway / Render / Fly.io)
```bash
# Set environment variables:
PORT=3001
WORKSPACE_DIR=/app/workspace
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

## 🌐 Hosting Options

| Service | Type | Free Tier |
|---------|------|-----------|
| **Vercel** | Frontend | ✅ Yes |
| **Netlify** | Frontend | ✅ Yes |
| **Railway** | Backend | ✅ $5 credit |
| **Render** | Backend | ✅ Yes (sleeps) |
| **Fly.io** | Backend | ✅ Yes |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+S` | Save File |
| `F5` | Run File |
| `Ctrl+W` | Close Tab |
| `Ctrl+\`` | Toggle Terminal |

## 📁 Project Structure

```
vscode-web-ide/
├── backend/          ← Node.js + Express API
│   ├── server.js
│   ├── routes/
│   │   ├── files.js    ← File CRUD API
│   │   └── execute.js  ← Code sandbox
│   └── workspace/    ← Your files live here
└── frontend/         ← Vite + React
    └── src/
        ├── App.jsx
        └── components/
            ├── ActivityBar.jsx
            ├── Sidebar.jsx
            ├── TabBar.jsx
            ├── Editor.jsx        ← Monaco Editor
            ├── Terminal.jsx
            ├── StatusBar.jsx
            └── CommandPalette.jsx
```

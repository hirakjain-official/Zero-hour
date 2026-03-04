const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const execPromise = util.promisify(exec);

class SessionManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> { port, lastActive, containerName, workspaceDir }
        this.basePort = 32000;

        // Start the cleanup interval (every 5 minutes)
        setInterval(() => this.cleanupIdleSessions(), 5 * 60 * 1000);
    }

    // Generate a unique session ID
    generateSessionId() {
        return crypto.randomBytes(16).toString('hex');
    }

    // Get the next available port for preview routing
    getNextAvailablePort() {
        let port = this.basePort + 1;
        const usedPorts = Array.from(this.sessions.values()).map(s => s.port);
        while (usedPorts.includes(port)) {
            port++;
        }
        return port;
    }

    // Initialize a new session
    async createSession(requestedSessionId = null) {
        let sessionId = requestedSessionId;

        if (sessionId && this.sessions.has(sessionId)) {
            // Reattach to existing session
            const session = this.sessions.get(sessionId);
            session.lastActive = Date.now();
            return { sessionId, isNew: false, ...session };
        }

        // Create new session
        sessionId = sessionId || this.generateSessionId();
        const port = this.getNextAvailablePort();
        const containerName = `ide-workspace-${sessionId.slice(0, 8)}`;

        // Create user's workspace directory
        const baseWorkspaceDir = process.env.WORKSPACE_DIR || path.join(__dirname, '../../workspaces');
        const userWorkspaceDir = path.join(baseWorkspaceDir, sessionId);

        if (!fs.existsSync(userWorkspaceDir)) {
            fs.mkdirSync(userWorkspaceDir, { recursive: true });
            fs.mkdirSync(path.join(userWorkspaceDir, 'templates'), { recursive: true });

            // ── README: Challenge description ──
            fs.writeFileSync(path.join(userWorkspaceDir, 'README.md'), `# 🐛 Challenge: Fix the Login Bug

## What this app does
A simple Flask login API + HTML frontend. Users can enter a username and password, hit **Login**, and receive a JWT-style success token.

## The problem
The login **always returns 401 Unauthorized**, even with correct credentials (\`admin\` / \`secret123\`).

## Your mission
Find and fix the bug in \`app.py\` so that valid credentials succeed.

## How to run
\`\`\`bash
pip install flask flask-cors
python app.py
\`\`\`
Then open: http://localhost:3000

**Hint:** Start by reading the \`/login\` route carefully. 👀
`);

            // ── app.py: Flask backend with DELIBERATE BUG ──
            // BUG: Inside the for-loop, `user` is a dict like {"username":..., "password":...}
            // The code compares `username == user` (dict vs string) — always False.
            // Fix: change to `user['username'] == username` and extract username from data first.
            fs.writeFileSync(path.join(userWorkspaceDir, 'app.py'), `from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hardcoded users (in-memory for this demo)
USERS = [
    {"username": "admin", "password": "secret123"},
    {"username": "alice", "password": "wonderland"},
]


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Missing username or password"}), 400

    password = data['password']

    for user in USERS:
        if username == user:  # BUG: 'username' is not defined; should be user['username'] == data['username']
            if user['password'] == password:
                return jsonify({"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.success"}), 200

    return jsonify({"error": "Invalid credentials"}), 401


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
`);

            // ── templates/index.html: Simple login UI ──
            fs.writeFileSync(path.join(userWorkspaceDir, 'templates', 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Login — Flask Challenge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f0f1a;
      font-family: 'Segoe UI', sans-serif;
      color: #e0e0e0;
    }
    .card {
      background: #1a1a2e;
      border: 1px solid #2d2d50;
      border-radius: 12px;
      padding: 40px;
      width: 360px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    h1 { font-size: 22px; margin-bottom: 8px; color: #a78bfa; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 28px; }
    label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; margin-top: 16px; }
    input {
      width: 100%; padding: 10px 14px;
      background: #0f0f1a; border: 1px solid #333;
      border-radius: 8px; color: #e0e0e0; font-size: 14px;
    }
    input:focus { outline: none; border-color: #a78bfa; }
    button {
      width: 100%; margin-top: 24px; padding: 12px;
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      border: none; border-radius: 8px; color: white;
      font-size: 15px; font-weight: 600; cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.85; }
    #result {
      margin-top: 16px; padding: 10px 14px;
      border-radius: 8px; font-size: 13px;
      display: none;
    }
    #result.success { background: #14290a; color: #4ade80; border: 1px solid #166534; }
    #result.error   { background: #290a0a; color: #f87171; border: 1px solid #7f1d1d; }
    .hint { margin-top: 20px; font-size: 11px; color: #555; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔐 Flask Login</h1>
    <p class="subtitle">Challenge: Fix the bug so you can log in!</p>

    <label>Username</label>
    <input id="username" type="text" placeholder="admin" />

    <label>Password</label>
    <input id="password" type="password" placeholder="secret123" />

    <button onclick="doLogin()">Login</button>
    <div id="result"></div>

    <p class="hint">Credentials: <code>admin</code> / <code>secret123</code></p>
  </div>

  <script>
    async function doLogin() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();
      const result = document.getElementById('result');

      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        result.style.display = 'block';
        if (res.ok) {
          result.className = 'success';
          result.textContent = '✅ Login successful! Token: ' + data.token;
        } else {
          result.className = 'error';
          result.textContent = '❌ ' + (data.error || 'Login failed');
        }
      } catch (e) {
        result.style.display = 'block';
        result.className = 'error';
        result.textContent = '⚠️ Could not connect to server. Is Flask running?';
      }
    }

    // Allow Enter key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
  </script>
</body>
</html>
`);
        }

        const sessionData = {
            sessionId,
            port,
            containerName,
            workspaceDir: userWorkspaceDir,
            lastActive: Date.now()
        };

        this.sessions.set(sessionId, sessionData);

        // Spin up the Docker container
        try {
            // Stop/remove if a container with this name somehow exists
            await execPromise(`docker rm -f ${containerName}`).catch(() => { });

            // Run lightweight Alpine container
            // -p external_port:3000 -> Maps EC2 32001 to container's 3000
            const cmd = `docker run -d --name ${containerName} \\
                -v "${userWorkspaceDir}":/home/developer/workspace \\
                -p ${port}:3000 \\
                --user developer \\
                --memory="1024m" \\
                vscode-workspace`;

            await execPromise(cmd);
            console.log(`[SessionManager] Created session ${sessionId} (Port: ${port})`);

            return { isNew: true, ...sessionData };
        } catch (e) {
            console.error(`[SessionManager] Failed to create container for ${sessionId}:`, e);
            this.sessions.delete(sessionId);
            throw e;
        }
    }

    // Ping session to keep it alive
    touchSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            session.lastActive = Date.now();
            return true;
        }
        return false;
    }

    // Get session details
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    // Destroy a session and its container
    async destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        console.log(`[SessionManager] Destroying session ${sessionId}...`);

        try {
            await execPromise(`docker rm -f ${session.containerName}`);
        } catch (e) {
            console.error(`[SessionManager] Docker rm failed for ${session.containerName}:`, e);
        }

        this.sessions.delete(sessionId);
        console.log(`[SessionManager] Session ${sessionId} destroyed.`);
    }

    // Cleanup idle sessions (> 30 mins)
    async cleanupIdleSessions() {
        const MAX_IDLE_TIME = 30 * 60 * 1000; // 30 mins
        const now = Date.now();

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActive > MAX_IDLE_TIME) {
                console.log(`[SessionManager] Session ${sessionId} timed out (idle).`);
                await this.destroySession(sessionId);
            }
        }
    }
}

// Export a singleton instance
const sessionManager = new SessionManager();
module.exports = sessionManager;

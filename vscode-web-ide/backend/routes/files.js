const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const BASE_WORKSPACES = process.env.WORKSPACE_DIR || path.join(__dirname, '../../workspaces');

// Ensure a default workspace exists when there is no session (local dev without Docker)
function ensureDefaultWorkspace() {
    const defaultDir = path.join(BASE_WORKSPACES, 'default');
    const templatesDir = path.join(defaultDir, 'templates');
    if (!fs.existsSync(path.join(defaultDir, 'app.py'))) {
        fs.mkdirSync(templatesDir, { recursive: true });

        fs.writeFileSync(path.join(defaultDir, 'README.md'), `# 🐛 Challenge: Fix the Login Bug\n\nOpen \`app.py\` and fix the bug in the \`/login\` route so that valid credentials succeed.\n\nCredentials: \`admin\` / \`secret123\`\n\n**Run with:** \`python app.py\`\n`);

        fs.writeFileSync(path.join(defaultDir, 'app.py'), `from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

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

        fs.writeFileSync(path.join(templatesDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><title>Login — Flask Challenge</title>
  <style>
    body { min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#0f0f1a; font-family:'Segoe UI',sans-serif; color:#e0e0e0; }
    .card { background:#1a1a2e; border:1px solid #2d2d50; border-radius:12px;
            padding:40px; width:360px; box-shadow:0 8px 32px rgba(0,0,0,.5); }
    h1 { font-size:22px; color:#a78bfa; margin-bottom:8px; }
    label { display:block; font-size:12px; color:#888; margin-top:16px; margin-bottom:4px; }
    input { width:100%; padding:10px 14px; background:#0f0f1a; border:1px solid #333;
            border-radius:8px; color:#e0e0e0; font-size:14px; }
    button { width:100%; margin-top:24px; padding:12px;
             background:linear-gradient(135deg,#7c3aed,#a78bfa);
             border:none; border-radius:8px; color:#fff; font-size:15px; font-weight:600; cursor:pointer; }
    #result { margin-top:16px; padding:10px 14px; border-radius:8px; font-size:13px; display:none; }
    .success { background:#14290a; color:#4ade80; border:1px solid #166534; }
    .error   { background:#290a0a; color:#f87171; border:1px solid #7f1d1d; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔐 Flask Login</h1>
    <p style="font-size:13px;color:#666;">Challenge: Fix the bug so login works!</p>
    <label>Username</label><input id="u" type="text" placeholder="admin" />
    <label>Password</label><input id="p" type="password" placeholder="secret123" />
    <button onclick="go()">Login</button>
    <div id="result"></div>
  </div>
  <script>
    async function go() {
      const r = document.getElementById('result');
      try {
        const res = await fetch('/login', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({username: u.value.trim(), password: p.value.trim()})
        });
        const d = await res.json();
        r.style.display='block';
        r.className = res.ok ? 'success' : 'error';
        r.textContent = res.ok ? '✅ ' + d.token : '❌ ' + (d.error || 'Failed');
      } catch(e) { r.style.display='block'; r.className='error'; r.textContent='⚠️ Server unreachable'; }
    }
    document.onkeydown = e => e.key==='Enter' && go();
  </script>
</body>
</html>
`);
    }
    return defaultDir;
}

// Resolve the root directory for the current user's session
function getWorkspaceRoot(req) {
    if (req.session && req.session.workspaceDir) {
        return req.session.workspaceDir;
    }
    // Fallback: use the default workspace (seeded with the Flask challenge)
    return ensureDefaultWorkspace();
}

// Ensure path is within user's workspace (security)
function safePath(req, filePath) {
    const root = getWorkspaceRoot(req);
    const resolved = path.resolve(root, filePath.replace(/^\//, ''));
    if (!resolved.startsWith(path.resolve(root))) {
        throw new Error('Path traversal detected');
    }
    return resolved;
}

// Build directory tree recursively
function buildTree(dirPath, relativePath = '') {
    const name = path.basename(dirPath);
    const stats = fs.statSync(dirPath);

    if (!stats.isDirectory()) {
        return {
            type: 'file',
            name,
            path: relativePath || name,
            size: stats.size,
            modified: stats.mtime
        };
    }

    let children = [];
    try {
        const items = fs.readdirSync(dirPath);
        children = items
            .filter(item => !item.startsWith('.') && item !== 'node_modules')
            .map(item => buildTree(
                path.join(dirPath, item),
                relativePath ? `${relativePath}/${item}` : item
            ))
            .sort((a, b) => {
                // Folders first, then files
                if (a.type === 'directory' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
            });
    } catch (e) { /* ignore permission errors */ }

    return {
        type: 'directory',
        name,
        path: relativePath || '.',
        children
    };
}

// GET /api/files/tree - returns directory tree
router.get('/tree', (req, res) => {
    try {
        const root = getWorkspaceRoot(req);
        if (!fs.existsSync(root)) {
            fs.mkdirSync(root, { recursive: true });
        }
        const tree = buildTree(root);
        res.json(tree);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/files/read?path=... - read file content
router.get('/read', (req, res) => {
    try {
        const filePath = safePath(req, req.query.path || '');
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content, path: req.query.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/files/save - write file content
router.post('/save', (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        const targetPath = safePath(req, filePath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/files/create - create file or directory
router.post('/create', (req, res) => {
    try {
        const { path: filePath, type } = req.body; // type: 'file' | 'directory'
        const absPath = safePath(req, filePath);

        if (type === 'directory') {
            fs.mkdirSync(absPath, { recursive: true });
        } else {
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            if (!fs.existsSync(absPath)) {
                fs.writeFileSync(absPath, '', 'utf8');
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/files/delete - delete file or directory
router.delete('/delete', (req, res) => {
    try {
        const targetPath = safePath(req, req.query.path || '');
        const stats = fs.statSync(targetPath);

        if (stats.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(targetPath);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/files/rename - rename/move file
router.post('/rename', (req, res) => {
    try {
        const { oldPath, newPath } = req.body;
        const currPath = safePath(req, oldPath);
        const targetPath = safePath(req, newPath);
        fs.renameSync(currPath, targetPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/files/search - Recursive file search
router.get('/search', (req, res) => {
    const query = (req.query.q || '').toLowerCase();
    if (!query || query.length < 2) {
        return res.json({ results: [] });
    }

    const results = [];
    const MAX_RESULTS = 30;
    const TEXT_EXTS = new Set([
        '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.scss',
        '.json', '.md', '.txt', '.sh', '.bash', '.yaml', '.yml', '.xml',
        '.sql', '.env', '.gitignore', '.rs', '.go', '.java', '.cpp', '.c',
        '.cs', '.rb', '.php', '.swift'
    ]);

    try {
        const root = getWorkspaceRoot(req);

        // Helper to recursively search files
        const searchFiles = (dirPath, relativePath = '') => {
            if (results.length >= MAX_RESULTS) return;
            try {
                const items = fs.readdirSync(dirPath);
                for (const item of items) {
                    if (results.length >= MAX_RESULTS) break;
                    if (item.startsWith('.') || item === 'node_modules') continue;

                    const fullPath = path.join(dirPath, item);
                    const relPath = relativePath ? `${relativePath}/${item}` : item;
                    const stats = fs.statSync(fullPath);

                    if (stats.isDirectory()) {
                        searchFiles(fullPath, relPath);
                    } else if (stats.isFile()) {
                        const ext = path.extname(item).toLowerCase();
                        if (!TEXT_EXTS.has(ext)) continue;
                        if (stats.size > 500000) continue; // skip large files

                        try {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            const lines = content.split('\n');
                            for (let i = 0; i < lines.length && results.length < MAX_RESULTS; i++) {
                                if (lines[i].toLowerCase().includes(query)) {
                                    results.push({
                                        path: relPath,
                                        name: item,
                                        line: i + 1,
                                        matchText: lines[i].trim().substring(0, 120)
                                    });
                                }
                            }
                        } catch (e) { /* skip unreadable files */ }
                    }
                }
            } catch (e) { /* skip unreadable dirs */ }
        };

        searchFiles(root);
        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

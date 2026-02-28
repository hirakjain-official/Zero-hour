const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');

const filesRouter = require('./routes/files');
const executeRouter = require('./routes/execute');
const aiRouter = require('./routes/ai');
const sessionRouter = require('./routes/session');
const sessionManager = require('./services/SessionManager');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const server = http.createServer(app);

// WebSocket server for terminal
const wss = new WebSocket.Server({ server, path: '/terminal' });

// CORS - allow frontend origin (supports hosting via env vars)
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
            callback(null, true);
        } else {
            callback(null, true); // allow all in dev; tighten in prod
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Dynamic App Preview Proxy Server
// Automatically routes /preview/session-abc/ to the mapped port
app.use('/preview/:sessionId', (req, res, next) => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) return res.status(404).send('Session expired or not found.');

    // Create or reuse proxy
    const proxy = createProxyMiddleware({
        target: `http://127.0.0.1:${session.port}`,
        changeOrigin: true,
        ws: true,
        pathRewrite: { [`^/preview/${req.params.sessionId}`]: '' },
        logLevel: 'error'
    });

    return proxy(req, res, next);
});

// API routes
app.use('/api/session', sessionRouter);
app.use('/api/files', filesRouter);
app.use('/api/execute', executeRouter);
app.use('/api/ai', aiRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket terminal handler
wss.on('connection', (ws) => {
    // Expected connection url: wss://domain.com/terminal?sessionId=abc
    const url = new URL(ws._socket.url || req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    const session = sessionManager.getSession(sessionId);
    if (!session) {
        ws.send(JSON.stringify({ type: 'output', data: '\r\n❌ Session expired or invalid. Please refresh.\r\n' }));
        return ws.close();
    }

    sessionManager.touchSession(sessionId);

    // DOCKER SANDBOX: Instead of raw powershell/bash, exec into the user's specific container!
    const proc = spawn('docker', ['exec', '-it', session.containerName, 'bash'], {
        env: { ...process.env, TERM: 'xterm-256color' }
    });

    proc.stdout.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        }
    });

    proc.stderr.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        }
    });

    proc.on('exit', (code) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'exit', code }));
        }
    });

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            if (msg.type === 'input') {
                proc.stdin.write(msg.data);
            }
        } catch (e) {
            // raw input
            proc.stdin.write(message);
        }
    });

    ws.on('close', () => {
        console.log('[Terminal] Client disconnected');
        proc.kill();
    });

    ws.on('error', (err) => {
        console.error('[Terminal] WebSocket error:', err);
        proc.kill();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ VS Code Web IDE Backend running on port ${PORT}`);
    console.log(`   Workspace: ${process.env.WORKSPACE_DIR || path.join(__dirname, 'workspace')}`);
});

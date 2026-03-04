const express = require('express');
const sessionManager = require('../services/SessionManager');

const router = express.Router();

// Middleware to extract sessionId from headers and touch session if valid
router.use((req, res, next) => {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    if (sessionId) {
        req.sessionId = sessionId;
        if (sessionManager.touchSession(sessionId)) {
            req.session = sessionManager.getSession(sessionId);
        }
    }
    next();
});

// GET /api/session/init
// Assigns a session ID and spins up container (falls back to local disk if Docker unavailable)
router.post('/init', async (req, res) => {
    try {
        const { sessionId } = req.body;
        // Create or reattach to session
        const session = await sessionManager.createSession(sessionId);
        res.json({ success: true, session });
    } catch (e) {
        console.warn('Session Docker init failed — falling back to local-disk session:', e.message);
        // Return a partial session so the frontend can still load the default workspace
        const fallbackId = req.body.sessionId || require('crypto').randomBytes(16).toString('hex');
        res.json({
            success: true,
            session: {
                sessionId: fallbackId,
                isNew: true,
                workspaceDir: null, // files.js will use the default workspace
                port: null,
                containerName: null
            }
        });
    }
});

// POST /api/session/ping
// Keep-alive endpoint called every 5 mins by frontend
router.post('/ping', (req, res) => {
    if (req.session) {
        res.json({ success: true, timeRemaining: 30 }); // 30 mins
    } else {
        res.status(404).json({ error: 'Session expired or not found' });
    }
});

module.exports = router;

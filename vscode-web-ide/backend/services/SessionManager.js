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

            // Generate a simple welcome file
            fs.writeFileSync(path.join(userWorkspaceDir, 'welcome.js'),
                `// Welcome to your sandboxed workspace!
// This code is running inside a dedicated Docker container.

console.log('Hello from Docker Container ${containerName}!');

// Try running a mini Express server:
/*
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Server is running!'));
app.listen(3000, () => console.log('Listening on Preview port'));
*/
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

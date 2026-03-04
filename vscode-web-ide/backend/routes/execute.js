const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const WORKSPACE_ROOT = process.env.WORKSPACE_DIR || path.join(__dirname, '..', 'workspace');
const EXECUTION_TIMEOUT = 15000; // 15 seconds

function getWorkspaceRoot(req) {
    if (req.session && req.session.workspaceDir) {
        return req.session.workspaceDir;
    }
    return WORKSPACE_ROOT;
}

// Language runners
const RUNNERS = {
    javascript: { cmd: 'node', ext: '.js' },
    typescript: { cmd: 'npx', args: ['ts-node'], ext: '.ts' },
    python: { cmd: 'python3', ext: '.py' },
    bash: { cmd: 'bash', ext: '.sh' },
    sh: { cmd: 'bash', ext: '.sh' },
};

function detectLanguage(filename, language) {
    if (language && RUNNERS[language]) return language;
    const ext = path.extname(filename || '').toLowerCase();
    const extMap = {
        '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
        '.ts': 'typescript',
        '.py': 'python',
        '.sh': 'bash', '.bash': 'bash',
    };
    return extMap[ext] || 'javascript';
}

// POST /api/execute
router.post('/', async (req, res) => {
    const { code, language, filename, filePath } = req.body;

    const lang = detectLanguage(filename || filePath, language);
    const runner = RUNNERS[lang];

    if (!runner) {
        return res.json({ stdout: '', stderr: `Language '${lang}' is not supported yet.`, exitCode: 1, language: lang });
    }

    if (!req.session || !req.session.containerName) {
        return res.json({
            stdout: '',
            stderr: 'Session expired or backend restarted. Please simply refresh the IDE page to reconnect to your Sandbox!',
            exitCode: 1,
            language: lang
        });
    }

    // Write code to temp file if code is provided inline
    const root = getWorkspaceRoot(req);
    let execPath = filePath ? path.resolve(root, filePath.replace(/^\//, '')) : null;
    let tempFile = null;

    if (!execPath || !fs.existsSync(execPath)) {
        // Create temp file inside the user workspace so container can see it
        tempFile = path.join(root, `temp-exec-${Date.now()}${runner.ext}`);
        fs.writeFileSync(tempFile, code || '', 'utf8');
        execPath = tempFile;
    }

    // Convert host absolute path to container-relative path
    const containerRelativePath = path.relative(root, execPath).replace(/\\/g, '/');

    // Docker command arguments
    const containerName = req.session ? req.session.containerName : 'ide-workspace-1';

    // We use `docker exec -i -w /home/developer/workspace <container> <cmd> <relative_path>`
    const dockerArgs = [
        'exec', '-i',
        '-w', '/home/developer/workspace',
        containerName,
        runner.cmd,
        ...(runner.args || []),
        containerRelativePath
    ];
    let cmd = 'docker';

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const proc = spawn(cmd, dockerArgs, {
            cwd: root,
            env: { ...process.env },
            timeout: EXECUTION_TIMEOUT
        });

        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGKILL');
        }, EXECUTION_TIMEOUT);

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (exitCode) => {
            clearTimeout(timer);
            if (tempFile) {
                try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
            }

            if (timedOut) {
                stderr += '\n[Execution timed out after 15 seconds]';
            }

            res.json({ stdout, stderr, exitCode: timedOut ? -1 : exitCode, language: lang });
            resolve();
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            if (tempFile) {
                try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
            }

            // Try python3 fallback inside container
            if (err.code === 'ENOENT' && lang === 'python') {
                const fallbackArgs = ['exec', '-i', '-w', '/home/developer/workspace', containerName, 'python3', containerRelativePath];
                const proc2 = spawn('docker', fallbackArgs, { cwd: root, env: { ...process.env } });
                let out2 = '', err2 = '';
                proc2.stdout.on('data', d => { out2 += d.toString(); });
                proc2.stderr.on('data', d => { err2 += d.toString(); });
                proc2.on('close', (code) => {
                    res.json({ stdout: out2, stderr: err2, exitCode: code, language: lang });
                    resolve();
                });
                proc2.on('error', (e2) => {
                    res.json({ stdout: '', stderr: `Could not find Python. Install Python and ensure it's in PATH.\n${e2.message}`, exitCode: 1, language: lang });
                    resolve();
                });
            } else {
                res.json({ stdout: '', stderr: `Error starting ${cmd}: ${err.message}`, exitCode: 1, language: lang });
                resolve();
            }
        });
    });
});

module.exports = router;

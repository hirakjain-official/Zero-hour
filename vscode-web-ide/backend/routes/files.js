const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Resolve the root directory for the current user's session
function getWorkspaceRoot(req) {
    if (req.session && req.session.workspaceDir) {
        return req.session.workspaceDir;
    }
    // Fallback for missing sessions
    return process.env.WORKSPACE_DIR || path.join(__dirname, '..', 'workspace');
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

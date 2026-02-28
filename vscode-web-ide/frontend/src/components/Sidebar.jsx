import React, { useState, useRef, useEffect } from 'react';
import {
    FilePlus, FolderPlus, RefreshCw, ChevronRight,
    File, Folder, FolderOpen, Search, GitBranch, Puzzle, Edit3
} from 'lucide-react';

function getFileIcon(name, type) {
    if (type === 'directory') return null;
    const ext = name.split('.').pop()?.toLowerCase();
    const icons = {
        js: '📜', jsx: '⚛️', ts: '💙', tsx: '⚛️',
        py: '🐍', html: '🌐', css: '🎨', scss: '🎨',
        json: '📋', md: '📝', txt: '📄',
        sh: '⚙️', bash: '⚙️', env: '🔑', gitignore: '🚫',
        png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🎨',
        mp4: '🎬', mp3: '🎵', zip: '📦', pdf: '📕'
    };
    return icons[ext] || '📄';
}

function getExtClass(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    return `ext-${ext}`;
}

function TreeNode({ node, depth = 0, activeFilePath, onOpenFile, onRefresh, showNotification, API, onContextMenu }) {
    const [open, setOpen] = useState(depth === 0);
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    if (!node) return null;

    const isDir = node.type === 'directory';
    const indent = depth * 12;
    const isActive = activeFilePath === node.path;

    const handleRename = async () => {
        if (!editName.trim() || editName === node.name) {
            setEditing(false);
            return;
        }
        const newPath = node.path.replace(/[^/\\]*$/, editName.trim());
        try {
            await fetch(`${API}/api/files/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath: node.path, newPath })
            });
            onRefresh();
            showNotification(`Renamed to ${editName}`, 'success');
        } catch (e) {
            showNotification('Rename failed', 'error');
        }
        setEditing(false);
    };

    const startRename = () => {
        setEditName(node.name);
        setEditing(true);
    };

    return (
        <>
            <div
                className={`tree-item ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: `${indent + 4}px` }}
                onClick={() => {
                    if (isDir) setOpen(o => !o);
                    else onOpenFile(node.path);
                }}
                onDoubleClick={() => {
                    if (!isDir) startRename();
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onContextMenu(e, node, startRename);
                }}
            >
                <div className="tree-item-indent" style={{ width: '4px' }} />

                {isDir ? (
                    <div className={`tree-item-arrow ${open ? 'open' : ''}`}>›</div>
                ) : (
                    <div style={{ width: '16px' }} />
                )}

                <div className="tree-item-icon">
                    {isDir
                        ? (open ? <FolderOpen size={15} color="#dcb67a" /> : <Folder size={15} color="#dcb67a" />)
                        : <span style={{ fontSize: '13px' }}>{getFileIcon(node.name, node.type)}</span>
                    }
                </div>

                {editing ? (
                    <input
                        ref={inputRef}
                        className="tree-item-name editing"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleRename();
                            if (e.key === 'Escape') setEditing(false);
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span className={`tree-item-name ${!isDir ? getExtClass(node.name) : ''}`}>
                        {node.name}
                    </span>
                )}
            </div>

            {isDir && open && node.children && node.children.map(child => (
                <TreeNode
                    key={child.path}
                    node={child}
                    depth={depth + 1}
                    activeFilePath={activeFilePath}
                    onOpenFile={onOpenFile}
                    onRefresh={onRefresh}
                    showNotification={showNotification}
                    API={API}
                    onContextMenu={onContextMenu}
                />
            ))}
        </>
    );
}

function SearchPanel({ fileTree, onOpenFile, API }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchMode, setSearchMode] = useState('filename'); // 'filename' | 'content'
    const debounceRef = useRef(null);

    const searchFiles = (q) => {
        setQuery(q);
        if (!q.trim()) { setResults([]); return; }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            if (searchMode === 'content') {
                // Content search via backend
                setLoading(true);
                try {
                    const res = await fetch(`${API}/api/files/search?q=${encodeURIComponent(q)}`);
                    const data = await res.json();
                    setResults(data.results || []);
                } catch (e) {
                    setResults([]);
                }
                setLoading(false);
            } else {
                // Filename search (local)
                if (!fileTree) { setResults([]); return; }
                const found = [];
                function walk(node) {
                    if (node.type === 'file' && node.name.toLowerCase().includes(q.toLowerCase())) {
                        found.push({ ...node, matchType: 'filename' });
                    }
                    if (node.children) node.children.forEach(walk);
                }
                walk(fileTree);
                setResults(found.slice(0, 20));
            }
        }, 200);
    };

    return (
        <div className="search-panel">
            <div className="search-mode-toggle">
                <button
                    className={`search-mode-btn ${searchMode === 'filename' ? 'active' : ''}`}
                    onClick={() => { setSearchMode('filename'); setResults([]); setQuery(''); }}
                >
                    Filename
                </button>
                <button
                    className={`search-mode-btn ${searchMode === 'content' ? 'active' : ''}`}
                    onClick={() => { setSearchMode('content'); setResults([]); setQuery(''); }}
                >
                    Content
                </button>
            </div>
            <div className="search-input-wrap">
                <input
                    className="search-field"
                    placeholder={searchMode === 'content' ? 'Search in files...' : 'Search files...'}
                    value={query}
                    onChange={e => searchFiles(e.target.value)}
                />
            </div>
            {loading && (
                <div style={{ color: '#888', fontSize: '12px', padding: '8px' }}>Searching...</div>
            )}
            {results.map((r, i) => (
                <div key={r.path + (r.line || i)} className="search-result" onClick={() => onOpenFile(r.path)}>
                    <span className="search-result-file">{r.name || r.path.split('/').pop()}</span>
                    {r.line && <span className="search-result-line">:{r.line}</span>}
                    <span style={{ fontSize: '11px', color: '#666', display: 'block', marginTop: '2px' }}>
                        {r.matchText || r.path}
                    </span>
                </div>
            ))}
            {query && !loading && results.length === 0 && (
                <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>No results found</div>
            )}
        </div>
    );
}

function GitPanel() {
    return (
        <div className="git-panel">
            <div className="git-section-title">Source Control</div>
            <div style={{ color: '#888', fontSize: '12px', padding: '8px 0' }}>
                Git integration available when hosted with a git-enabled workspace.
            </div>
            <div className="git-section-title" style={{ marginTop: '12px' }}>Changes</div>
            {['welcome.js', 'welcome.py'].map(f => (
                <div key={f} className="git-file">
                    <span className="git-file-status M">M</span>
                    <span className="git-file-name">{f}</span>
                </div>
            ))}
            <input className="git-commit-input" placeholder="Message (Ctrl+Enter to commit)" style={{ marginTop: '12px' }} />
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '4px' }}>
                ✓ Commit
            </button>
        </div>
    );
}

function ExtensionsPanel() {
    const exts = [
        { icon: '🐍', name: 'Python', desc: 'IntelliSense, linting, debugging for Python', author: 'Microsoft', installs: '120M' },
        { icon: '🌐', name: 'ESLint', desc: 'Integrates ESLint JavaScript into VS Code', author: 'Microsoft', installs: '89M' },
        { icon: '⚛️', name: 'Prettier', desc: 'Code formatter using prettier', author: 'Prettier', installs: '45M' },
        { icon: '🎨', name: 'Tailwind CSS', desc: 'Tailwind CSS IntelliSense for VS Code', author: 'Tailwind Labs', installs: '20M' },
        { icon: '🔵', name: 'GitLens', desc: 'Supercharge Git within VS Code', author: 'GitKraken', installs: '30M' },
        { icon: '🤖', name: 'GitHub Copilot', desc: 'Your AI pair programmer', author: 'GitHub', installs: '15M' },
    ];
    return (
        <div className="ext-panel">
            <input className="ext-search" placeholder="Search Extensions in Marketplace" />
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recommended
            </div>
            {exts.map(e => (
                <div key={e.name} className="ext-card">
                    <div className="ext-icon" style={{ background: '#2d2d2d' }}>{e.icon}</div>
                    <div className="ext-info">
                        <div className="ext-name">{e.name}</div>
                        <div className="ext-desc">{e.desc}</div>
                        <div className="ext-meta">{e.author} · {e.installs} installs</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function RunPanel({ fileTree, onOpenFile }) {
    return (
        <div style={{ padding: '10px' }}>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '12px' }}>
                Open a file and click ▶ Run or press F5 to execute it.
            </div>
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Supported Languages
            </div>
            {[['JavaScript/Node.js', '🟡'], ['Python', '🐍'], ['Bash/Shell', '⚙️']].map(([lang, icon]) => (
                <div key={lang} style={{ padding: '6px 8px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#ccc' }}>
                    <span>{icon}</span><span>{lang}</span>
                </div>
            ))}
        </div>
    );
}

export default function Sidebar({ activePanel, fileTree, activeFilePath, onOpenFile, onRefreshTree, showNotification, API, width }) {
    const [contextMenu, setContextMenu] = useState(null);
    const [dialog, setDialog] = useState(null);

    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    if (!activePanel) return null;

    const handleContextMenu = (e, node, startRename) => {
        setContextMenu({ x: e.clientX, y: e.clientY, node, startRename });
    };

    const handleNewFile = async (parentPath = '') => {
        setDialog({
            title: 'New File',
            placeholder: 'filename.js',
            onSubmit: async (name) => {
                const path = parentPath ? `${parentPath}/${name}` : name;
                try {
                    await fetch(`${API}/api/files/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path, type: 'file' })
                    });
                    onRefreshTree();
                    showNotification(`Created ${name}`, 'success');
                    setTimeout(() => onOpenFile(path), 500);
                } catch { showNotification('Create failed', 'error'); }
            }
        });
    };

    const handleNewFolder = async (parentPath = '') => {
        setDialog({
            title: 'New Folder',
            placeholder: 'folder-name',
            onSubmit: async (name) => {
                const path = parentPath ? `${parentPath}/${name}` : name;
                try {
                    await fetch(`${API}/api/files/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path, type: 'directory' })
                    });
                    onRefreshTree();
                    showNotification(`Created folder ${name}`, 'success');
                } catch { showNotification('Create failed', 'error'); }
            }
        });
    };

    const handleDelete = async (node) => {
        if (!confirm(`Delete "${node.name}"?`)) return;
        try {
            await fetch(`${API}/api/files/delete?path=${encodeURIComponent(node.path)}`, { method: 'DELETE' });
            onRefreshTree();
            showNotification(`Deleted ${node.name}`, 'success');
        } catch { showNotification('Delete failed', 'error'); }
    };

    const panelTitles = {
        explorer: 'EXPLORER',
        search: 'SEARCH',
        git: 'SOURCE CONTROL',
        extensions: 'EXTENSIONS',
        run: 'RUN AND DEBUG',
    };

    return (
        <div className="sidebar" style={{ width: width || 260 }}>
            <div className="sidebar-header">
                <span>{panelTitles[activePanel] || 'EXPLORER'}</span>
                {activePanel === 'explorer' && (
                    <div className="sidebar-header-actions">
                        <button className="icon-btn" title="New File" onClick={() => handleNewFile()}>
                            <FilePlus size={15} />
                        </button>
                        <button className="icon-btn" title="New Folder" onClick={() => handleNewFolder()}>
                            <FolderPlus size={15} />
                        </button>
                        <button className="icon-btn" title="Refresh" onClick={onRefreshTree}>
                            <RefreshCw size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div className="sidebar-tree">
                {activePanel === 'explorer' && (
                    <>
                        {fileTree ? (
                            fileTree.children?.map(node => (
                                <TreeNode
                                    key={node.path}
                                    node={node}
                                    depth={0}
                                    activeFilePath={activeFilePath}
                                    onOpenFile={onOpenFile}
                                    onRefresh={onRefreshTree}
                                    showNotification={showNotification}
                                    API={API}
                                    onContextMenu={handleContextMenu}
                                />
                            ))
                        ) : (
                            <div style={{ padding: '20px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
                                Loading workspace...
                            </div>
                        )}
                    </>
                )}
                {activePanel === 'search' && <SearchPanel fileTree={fileTree} onOpenFile={onOpenFile} API={API} />}
                {activePanel === 'git' && <GitPanel />}
                {activePanel === 'extensions' && <ExtensionsPanel />}
                {activePanel === 'run' && <RunPanel fileTree={fileTree} onOpenFile={onOpenFile} />}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={e => e.stopPropagation()}
                >
                    {contextMenu.node.type === 'directory' && (
                        <>
                            <div className="context-item" onClick={() => { handleNewFile(contextMenu.node.path); setContextMenu(null); }}>
                                <FilePlus size={13} /> New File
                            </div>
                            <div className="context-item" onClick={() => { handleNewFolder(contextMenu.node.path); setContextMenu(null); }}>
                                <FolderPlus size={13} /> New Folder
                            </div>
                            <div className="context-separator" />
                        </>
                    )}
                    <div className="context-item" onClick={() => {
                        contextMenu.startRename?.();
                        setContextMenu(null);
                    }}>
                        <Edit3 size={13} /> Rename
                    </div>
                    <div className="context-item" onClick={() => {
                        navigator.clipboard?.writeText(contextMenu.node.path);
                        showNotification('Path copied!', 'info');
                        setContextMenu(null);
                    }}>
                        📋 Copy Path
                    </div>
                    <div className="context-separator" />
                    <div className="context-item danger" onClick={() => { handleDelete(contextMenu.node); setContextMenu(null); }}>
                        🗑️ Delete
                    </div>
                </div>
            )}

            {/* Dialog */}
            {dialog && (
                <DialogBox
                    title={dialog.title}
                    placeholder={dialog.placeholder}
                    onSubmit={(name) => { dialog.onSubmit(name); setDialog(null); }}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}

function DialogBox({ title, placeholder, onSubmit, onClose }) {
    const [value, setValue] = useState('');
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    return (
        <div className="dialog-overlay" onClick={onClose}>
            <div className="dialog" onClick={e => e.stopPropagation()}>
                <h3>{title}</h3>
                <input
                    ref={inputRef}
                    className="dialog-input"
                    placeholder={placeholder}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && value.trim()) onSubmit(value.trim());
                        if (e.key === 'Escape') onClose();
                    }}
                />
                <div className="dialog-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => value.trim() && onSubmit(value.trim())}>
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}

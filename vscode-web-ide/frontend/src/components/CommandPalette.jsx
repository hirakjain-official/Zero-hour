import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function CommandPalette({ commands, tabs, onOpenFile, onClose }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const isFileSearch = query.startsWith('>') ? false : true;

    // Compute results
    const q = query.replace(/^>?\s*/, '').toLowerCase();
    let results = [];

    if (!query.startsWith('>')) {
        // File search mode
        results = tabs
            .filter(t => t.name.toLowerCase().includes(q) || t.path.toLowerCase().includes(q))
            .map(t => ({
                label: t.name,
                detail: t.path,
                action: () => { /* tab already open */ onClose(); }
            }));
        if (results.length === 0 && !q) {
            results = tabs.map(t => ({
                label: t.name,
                detail: t.path,
                action: () => onClose()
            }));
        }
    } else {
        // Command mode
        results = commands
            .filter(c => c.label.toLowerCase().includes(q))
            .map(c => ({
                label: c.label,
                detail: c.keybind || '',
                action: () => { c.action(); onClose(); }
            }));
    }

    if (results.length === 0 && q) {
        results = [{ label: `No results for "${q}"`, detail: '', action: onClose }];
    }

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelected(s => Math.min(s + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelected(s => Math.max(s - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            results[selected]?.action();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    useEffect(() => { setSelected(0); }, [query]);

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette" onClick={e => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    className="command-palette-input"
                    placeholder={isFileSearch ? 'Search files by name...' : '> Type a command'}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKey}
                />
                <div className="command-palette-list">
                    {results.map((r, i) => (
                        <div
                            key={i}
                            className={`command-item ${i === selected ? 'selected' : ''}`}
                            onClick={r.action}
                            onMouseEnter={() => setSelected(i)}
                        >
                            <Search size={14} style={{ color: '#888', flexShrink: 0 }} />
                            <span className="command-item-label">{r.label}</span>
                            {r.detail && <span className="command-item-keybind">{r.detail}</span>}
                        </div>
                    ))}
                </div>
                <div style={{ padding: '6px 16px', fontSize: '11px', color: '#888', borderTop: '1px solid #333', display: 'flex', gap: '16px' }}>
                    <span>↵ to select</span>
                    <span>↑↓ to navigate</span>
                    <span>Esc to dismiss</span>
                    <span>Type {'>'} for commands</span>
                </div>
            </div>
        </div>
    );
}

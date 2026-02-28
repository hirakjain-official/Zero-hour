import React, { useRef, useEffect, useState } from 'react';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';

export default function Terminal({ height, output, activeTab, onTabChange, onClose, onClearOutput, onResize, API }) {
    const outputRef = useRef(null);
    const wsRef = useRef(null);
    const [wsInput, setWsInput] = useState('');
    const [wsOutput, setWsOutput] = useState([
        { type: 'info', text: `$ VS Code Web IDE Shell — connected to ${API.replace('http', 'ws')}/terminal` },
        { type: 'stdout', text: 'Type commands below and press Enter...' },
    ]);
    const [wsConnected, setWsConnected] = useState(false);
    const wsOutputRef = useRef(null);
    const inputRef = useRef(null);

    // Command history
    const [cmdHistory, setCmdHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Auto-scroll output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    useEffect(() => {
        if (wsOutputRef.current) {
            wsOutputRef.current.scrollTop = wsOutputRef.current.scrollHeight;
        }
    }, [wsOutput]);

    // Connect WebSocket terminal
    useEffect(() => {
        if (activeTab !== 'terminal') return;
        const sessionId = localStorage.getItem('ide_session_id') || '';
        const wsUrl = API.replace('http://', 'ws://').replace('https://', 'wss://') + '/terminal?sessionId=' + sessionId;
        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setWsConnected(true);
                setWsOutput(prev => [...prev, { type: 'success', text: '✅ Shell connected' }]);
            };

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === 'output') {
                        const lines = msg.data.split('\n');
                        lines.forEach(line => {
                            if (line.trim() || line === '') {
                                setWsOutput(prev => [...prev, { type: 'stdout', text: line }]);
                            }
                        });
                    }
                } catch {
                    setWsOutput(prev => [...prev, { type: 'stdout', text: e.data }]);
                }
            };

            ws.onerror = () => {
                setWsOutput(prev => [...prev, { type: 'error', text: '⚠️ Terminal backend not available. Start backend server.' }]);
            };

            ws.onclose = () => {
                setWsConnected(false);
                setWsOutput(prev => [...prev, { type: 'info', text: '[Shell disconnected]' }]);
            };
        } catch (e) {
            setWsOutput(prev => [...prev, { type: 'stderr', text: 'WebSocket error: ' + e.message }]);
        }

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [activeTab]);

    // Focus input when switching to terminal tab
    useEffect(() => {
        if (activeTab === 'terminal') {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [activeTab]);

    const sendInput = (e) => {
        e.preventDefault();
        if (!wsInput.trim()) return;

        // Add to history
        setCmdHistory(prev => [...prev, wsInput]);
        setHistoryIndex(-1);

        setWsOutput(prev => [...prev, { type: 'info', text: `❯ ${wsInput}` }]);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: wsInput + '\n' }));
        } else {
            setWsOutput(prev => [...prev, { type: 'error', text: 'Not connected. Start the backend server first.' }]);
        }
        setWsInput('');
    };

    const handleInputKeyDown = (e) => {
        // Command history navigation
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length === 0) return;
            const newIndex = historyIndex === -1 ? cmdHistory.length - 1 : Math.max(0, historyIndex - 1);
            setHistoryIndex(newIndex);
            setWsInput(cmdHistory[newIndex]);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex === -1) return;
            const newIndex = historyIndex + 1;
            if (newIndex >= cmdHistory.length) {
                setHistoryIndex(-1);
                setWsInput('');
            } else {
                setHistoryIndex(newIndex);
                setWsInput(cmdHistory[newIndex]);
            }
        }
        // Clear shortcut
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            setWsOutput([{ type: 'info', text: '$ Terminal cleared' }]);
        }
    };

    const getLineColor = (type) => {
        switch (type) {
            case 'stderr': return '#f48771';
            case 'success': return '#89d185';
            case 'error': return '#f48771';
            case 'info': return '#4fc3f7';
            default: return '#cccccc';
        }
    };

    return (
        <div className="panel" style={{ height }}>
            {/* Resize handle */}
            <div className="panel-resize-handle" onMouseDown={onResize} />

            {/* Panel tabs */}
            <div className="panel-tabs">
                {[
                    { id: 'output', label: 'Output' },
                    { id: 'terminal', label: 'Terminal' },
                    { id: 'problems', label: 'Problems' },
                    { id: 'debug', label: 'Debug Console' },
                ].map(t => (
                    <div
                        key={t.id}
                        className={`panel-tab ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => onTabChange(t.id)}
                    >
                        {t.label}
                    </div>
                ))}
                <div className="panel-actions">
                    <button className="icon-btn" onClick={onClearOutput} title="Clear">
                        <Trash2 size={13} />
                    </button>
                    <button className="icon-btn" onClick={onClose} title="Close Panel">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Output tab */}
            {activeTab === 'output' && (
                <div className="panel-content">
                    <div className="terminal-output" ref={outputRef}>
                        {output.map((line, i) => (
                            <div key={i} style={{ color: getLineColor(line.type), lineHeight: '1.5', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                {line.text}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Terminal tab */}
            {activeTab === 'terminal' && (
                <div className="panel-content">
                    <div className="terminal-output" ref={wsOutputRef}>
                        {wsOutput.map((line, i) => (
                            <div key={i} style={{ color: getLineColor(line.type), lineHeight: '1.5', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                                {line.text}
                            </div>
                        ))}
                    </div>
                    <form className="terminal-prompt" onSubmit={sendInput}>
                        <span className="terminal-prompt-symbol">
                            {wsConnected ? '❯' : '○'}
                        </span>
                        <input
                            ref={inputRef}
                            className="terminal-input"
                            value={wsInput}
                            onChange={e => setWsInput(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            placeholder={wsConnected ? 'Enter command...' : 'Backend not connected'}
                            spellCheck={false}
                            autoComplete="off"
                        />
                    </form>
                </div>
            )}

            {/* Problems tab */}
            {activeTab === 'problems' && (
                <div className="panel-content">
                    <div className="terminal-output">
                        <div style={{ color: '#89d185', padding: '8px 0' }}>✅ No problems detected.</div>
                    </div>
                </div>
            )}

            {/* Debug Console tab */}
            {activeTab === 'debug' && (
                <div className="panel-content">
                    <div className="terminal-output">
                        <div style={{ color: '#888' }}>Debug console ready. Press F5 to start debugging.</div>
                    </div>
                </div>
            )}
        </div>
    );
}

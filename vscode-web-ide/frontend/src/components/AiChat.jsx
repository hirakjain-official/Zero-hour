import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, RotateCcw, Copy, X } from 'lucide-react';

const AVATARS = [
    { emoji: '🧑‍💻', name: 'Dev Bot' },
    { emoji: '🤖', name: 'AI Assistant' },
    { emoji: '👨‍🏫', name: 'Senior Engineer' },
];

const STARTERS = [
    'Explain this code',
    'Help me debug',
    'How do I optimize this?',
    'What does this error mean?',
    'Review my code',
];

function renderMessage(text) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
        if (part.startsWith('```')) {
            const code = part.replace(/```\w*\n?/, '').replace(/```$/, '');
            return (
                <pre key={i} className="ai-code-block">
                    <code>{code.trim()}</code>
                </pre>
            );
        }
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
        return (
            <span key={i}>
                {boldParts.map((bp, j) => {
                    if (bp.startsWith('**') && bp.endsWith('**')) {
                        return <strong key={j} style={{ color: '#e2e2e2' }}>{bp.slice(2, -2)}</strong>;
                    }
                    const codeParts = bp.split(/(`[^`]+`)/g);
                    return codeParts.map((cp, k) => {
                        if (cp.startsWith('`') && cp.endsWith('`')) {
                            return (
                                <code key={k} className="ai-inline-code">
                                    {cp.slice(1, -1)}
                                </code>
                            );
                        }
                        return <span key={k} style={{ whiteSpace: 'pre-wrap' }}>{cp}</span>;
                    });
                })}
            </span>
        );
    });
}

export default function AiChat({ API, currentTab, tabs, fileTree, terminalOutput, visible, onToggle, width }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: "Hey! 👋 I'm your AI coding assistant. Open a file and ask me anything about it — debugging, explanations, optimizations, you name it!",
            ts: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [avatar] = useState(AVATARS[2]);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const send = async (msg) => {
        const text = (msg || input).trim();
        if (!text || loading) return;
        setInput('');

        const userMsg = { role: 'user', text, ts: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // Add an empty assistant message to stream into
        const assistantId = Date.now();
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '', ts: Date.now() }]);

        try {
            const history = messages
                .filter(m => m.text && m.text.trim().length > 0)
                .slice(-6)
                .map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: m.text
                }));

            // Send the sessionId to ensure sandbox integration context
            const sessionId = localStorage.getItem('ide_session_id') || '';

            const openTabsContext = (tabs || []).map(t => t.path).join(', ');
            const terminalContext = (terminalOutput || []).slice(-50).map(t => t.text).join('\n');
            const fileTreeContext = JSON.stringify(fileTree || {}, null, 2).slice(0, 1500); // cap length

            const res = await fetch(`${API}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId
                },
                body: JSON.stringify({
                    message: text,
                    code: currentTab?.content?.slice(0, 3000),
                    language: currentTab?.name?.split('.').pop(),
                    fileTree: fileTreeContext,
                    openTabs: openTabsContext,
                    terminalOutput: terminalContext,
                    history
                })
            });

            if (!res.ok) throw new Error('Network response was not ok');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\\n\\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;

                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.text) {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantId ? { ...m, text: m.text + parsed.text } : m
                                ));
                            }
                        } catch (e) { /* ignore incomplete json chunks */ }
                    }
                }
            }
        } catch (e) {
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? { ...m, text: `⚠️ Connection to AI backend failed. Error: ${e.message}` }
                    : m
            ));
        }
        setLoading(false);
    };

    const clear = () => {
        setMessages([{
            role: 'assistant',
            text: "Chat cleared! Ask me anything about your code.",
            ts: Date.now()
        }]);
    };

    if (!visible) return null;

    return (
        <div className="ai-panel" style={{ width: width || 300 }}>
            {/* Header */}
            <div className="panel-header-bar">
                <Sparkles size={14} color="#c678dd" />
                <span className="panel-header-title" style={{ flex: 1 }}>AI ASSISTANT</span>
                <button className="icon-btn-sm" onClick={clear} title="Clear chat">
                    <RotateCcw size={13} />
                </button>
                <button className="icon-btn-sm" onClick={onToggle} title="Hide AI panel">
                    <X size={14} />
                </button>
            </div>

            {/* Avatar */}
            <div className="ai-avatar-section">
                <div className="ai-avatar">
                    {avatar.emoji}
                </div>
                <div style={{ fontSize: '12px', color: '#e2e2e2', fontWeight: 600 }}>{avatar.name}</div>
                <div className="ai-status">
                    <span className="ai-status-dot" />
                    Online
                </div>
            </div>

            {/* Quick starters */}
            {messages.length <= 1 && (
                <div className="ai-starters">
                    {STARTERS.map(s => (
                        <button
                            key={s}
                            onClick={() => send(s)}
                            className="ai-starter-btn"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Messages */}
            <div className="ai-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`ai-msg-wrap ${msg.role}`}>
                        <div className={`ai-msg ${msg.role}`}>
                            {renderMessage(msg.text)}
                        </div>
                        <span className="ai-msg-time">
                            {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}

                {loading && (
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div className="ai-typing-indicator">
                            {[0, 1, 2].map(n => (
                                <div key={n} className="ai-typing-dot" style={{ animationDelay: `${n * 0.2}s` }} />
                            ))}
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="ai-input-area">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    placeholder="Ask about your code..."
                    rows={1}
                    className="ai-textarea"
                    onFocus={e => { e.target.style.borderColor = '#c678dd'; }}
                    onBlur={e => { e.target.style.borderColor = '#555'; }}
                    onInput={e => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                    }}
                />
                <button
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    className={`ai-send-btn ${loading || !input.trim() ? 'disabled' : ''}`}
                >
                    {loading ? <Loader2 size={15} className="ai-spin" /> : <Send size={15} />}
                </button>
            </div>

            <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-spin { animation: spin 0.8s linear infinite; }
      `}</style>
        </div>
    );
}

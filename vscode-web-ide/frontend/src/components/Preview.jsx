import React, { useState, useRef } from 'react';
import { RefreshCw, ExternalLink, Smartphone, Monitor, Tablet, ChevronDown, ZoomIn, ZoomOut, X } from 'lucide-react';

const DEVICES = {
    phone: { w: 375, h: 812, label: 'iPhone', icon: Smartphone },
    tablet: { w: 768, h: 1024, label: 'iPad', icon: Tablet },
    desktop: { w: '100%', h: '100%', label: 'Desktop', icon: Monitor },
};

export default function Preview({ previewUrl, visible, onToggle, width }) {
    const [device, setDevice] = useState('phone');
    const [url, setUrl] = useState(() => {
        const sessionId = localStorage.getItem('ide_session_id');
        return sessionId ? `/preview/${sessionId}/` : (previewUrl || 'http://localhost:3000');
    });
    const [inputUrl, setInputUrl] = useState(url);
    const [zoom, setZoom] = useState(0.65);
    const [key, setKey] = useState(0);
    const iframeRef = useRef(null);

    const refresh = () => setKey(k => k + 1);

    const dev = DEVICES[device];
    const isPhone = device === 'phone';
    const isTablet = device === 'tablet';
    const hasFrame = isPhone || isTablet;

    if (!visible) return null;

    return (
        <div className="preview-panel" style={{ width: width || 340 }}>
            {/* Header */}
            <div className="panel-header-bar">
                <span className="panel-header-title">PREVIEW</span>

                {/* Device toggles */}
                <div style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                    {Object.entries(DEVICES).map(([key, d]) => {
                        const Icon = d.icon;
                        return (
                            <button
                                key={key}
                                onClick={() => setDevice(key)}
                                title={d.label}
                                className={`device-btn ${device === key ? 'active' : ''}`}
                            >
                                <Icon size={13} />
                            </button>
                        );
                    })}
                </div>

                <div style={{ flex: 1 }} />

                {/* Zoom */}
                <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="icon-btn-sm" title="Zoom out">
                    <ZoomOut size={13} />
                </button>
                <span style={{ fontSize: '10px', color: '#666', minWidth: '28px', textAlign: 'center' }}>
                    {Math.round(zoom * 100)}%
                </span>
                <button onClick={() => setZoom(z => Math.min(1.2, z + 0.1))} className="icon-btn-sm" title="Zoom in">
                    <ZoomIn size={13} />
                </button>

                <button onClick={refresh} className="icon-btn-sm" title="Refresh">
                    <RefreshCw size={13} />
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="icon-btn-sm" title="Open in new tab">
                    <ExternalLink size={13} />
                </a>
                <button onClick={onToggle} className="icon-btn-sm" title="Hide preview">
                    <X size={14} />
                </button>
            </div>

            {/* URL Bar */}
            <div className="preview-url-bar">
                <div className="preview-url-input-wrap">
                    <span style={{ fontSize: '10px' }}>🔒</span>
                    <input
                        value={inputUrl}
                        onChange={e => setInputUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { setUrl(inputUrl); refresh(); } }}
                        className="preview-url-input"
                    />
                </div>
            </div>

            {/* Preview area */}
            <div className="preview-content">
                {hasFrame ? (
                    /* Phone/Tablet frame */
                    <div style={{
                        width: `${dev.w * zoom}px`,
                        height: `${dev.h * zoom}px`,
                        flexShrink: 0,
                        position: 'relative',
                        borderRadius: isPhone ? `${30 * zoom}px` : `${16 * zoom}px`,
                        background: '#111',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 0 2px #333, 0 0 0 4px #222',
                        overflow: 'hidden',
                        border: `${3 * zoom}px solid #2a2a2a`
                    }}>
                        {/* Status bar notch (phone) */}
                        {isPhone && (
                            <div style={{
                                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                                width: `${120 * zoom}px`, height: `${26 * zoom}px`,
                                background: '#111', borderRadius: `0 0 ${16 * zoom}px ${16 * zoom}px`,
                                zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <div style={{ width: `${50 * zoom}px`, height: `${12 * zoom}px`, background: '#000', borderRadius: '999px' }} />
                            </div>
                        )}

                        {/* Home bar (phone) */}
                        {isPhone && (
                            <div style={{
                                position: 'absolute', bottom: `${8 * zoom}px`, left: '50%',
                                transform: 'translateX(-50%)',
                                width: `${100 * zoom}px`, height: `${4 * zoom}px`,
                                background: '#333', borderRadius: '999px', zIndex: 10
                            }} />
                        )}

                        {/* Iframe */}
                        <iframe
                            key={key}
                            ref={iframeRef}
                            src={url}
                            title="App Preview"
                            style={{
                                width: `${dev.w}px`,
                                height: `${dev.h}px`,
                                border: 'none',
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                                pointerEvents: 'auto',
                            }}
                            allow="same-origin"
                        />
                    </div>
                ) : (
                    /* Desktop full view */
                    <div style={{
                        width: '100%', height: '100%', borderRadius: '4px', overflow: 'hidden',
                        border: '1px solid #333',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{
                            height: '28px', background: '#2d2d2d', display: 'flex', alignItems: 'center',
                            padding: '0 10px', gap: '6px', borderBottom: '1px solid #1a1a1a'
                        }}>
                            {['#ff5f57', '#febc2e', '#28c840'].map(c => (
                                <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
                            ))}
                            <div style={{
                                flex: 1, background: '#3a3a3a', borderRadius: '3px',
                                height: '16px', margin: '0 8px', display: 'flex', alignItems: 'center',
                                padding: '0 8px'
                            }}>
                                <span style={{ fontSize: '10px', color: '#888' }}>{url}</span>
                            </div>
                        </div>
                        <iframe
                            key={key + 'd'}
                            src={url}
                            title="App Preview Desktop"
                            style={{ width: '100%', height: 'calc(100% - 28px)', border: 'none' }}
                            allow="same-origin"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

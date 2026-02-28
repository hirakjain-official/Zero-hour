import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

function getFileIcon(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    const icons = {
        js: '📜', jsx: '⚛️', ts: '💙', tsx: '⚛️',
        py: '🐍', html: '🌐', css: '🎨', scss: '🎨',
        json: '📋', md: '📝', txt: '📄', sh: '⚙️',
    };
    return icons[ext] || '📄';
}

export default function TabBar({ tabs, activeTab, onSelect, onClose, onReorder }) {
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dragRef = useRef(null);

    const handleDragStart = (e, index) => {
        setDragIndex(index);
        dragRef.current = index;
        e.dataTransfer.effectAllowed = 'move';
        // Make drag ghost semi-transparent
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDrop = (e, toIndex) => {
        e.preventDefault();
        const fromIndex = dragRef.current;
        if (fromIndex !== null && fromIndex !== toIndex && onReorder) {
            onReorder(fromIndex, toIndex);
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div className="tab-bar">
            {tabs.map((tab, index) => (
                <div
                    key={tab.id}
                    className={`tab ${activeTab === tab.id ? 'active' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                    onClick={() => onSelect(tab.id)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                >
                    <span style={{ fontSize: '13px', flexShrink: 0 }}>{getFileIcon(tab.name)}</span>
                    <span className="tab-name" title={tab.path}>
                        {tab.name}
                    </span>
                    {tab.modified && <span className="tab-dot" title="Unsaved changes" />}
                    <button
                        className="tab-close"
                        onClick={e => { e.stopPropagation(); onClose(tab.id); }}
                        title={tab.modified ? "Close (unsaved changes)" : "Close"}
                    >
                        <X size={13} />
                    </button>
                </div>
            ))}
        </div>
    );
}

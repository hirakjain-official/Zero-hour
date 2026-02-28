import React from 'react';
import {
    Files, Search, GitBranch, Puzzle, Play,
    Settings, User, Bell
} from 'lucide-react';

const items = [
    { id: 'explorer', icon: Files, label: 'Explorer (Ctrl+Shift+E)' },
    { id: 'search', icon: Search, label: 'Search (Ctrl+Shift+F)' },
    { id: 'git', icon: GitBranch, label: 'Source Control (Ctrl+Shift+G)' },
    { id: 'extensions', icon: Puzzle, label: 'Extensions (Ctrl+Shift+X)' },
    { id: 'run', icon: Play, label: 'Run and Debug (Ctrl+Shift+D)' },
];

export default function ActivityBar({ activePanel, setActivePanel }) {
    return (
        <div className="activity-bar">
            {items.map(({ id, icon: Icon, label }) => (
                <div
                    key={id}
                    className={`activity-item ${activePanel === id ? 'active' : ''}`}
                    onClick={() => setActivePanel(activePanel === id ? null : id)}
                >
                    <Icon size={24} strokeWidth={1.5} />
                    <span className="activity-tooltip">{label}</span>
                </div>
            ))}
            <div className="activity-bottom">
                <div className="activity-item">
                    <Bell size={22} strokeWidth={1.5} />
                    <span className="activity-tooltip">Notifications</span>
                </div>
                <div className="activity-item">
                    <Settings size={22} strokeWidth={1.5} />
                    <span className="activity-tooltip">Settings</span>
                </div>
                <div className="activity-item">
                    <User size={22} strokeWidth={1.5} />
                    <span className="activity-tooltip">Account</span>
                </div>
            </div>
        </div>
    );
}

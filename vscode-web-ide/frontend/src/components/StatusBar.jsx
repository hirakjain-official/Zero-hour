import React from 'react';
import { GitBranch, AlertCircle, CheckCircle, Bell } from 'lucide-react';

const LANG_LABELS = {
    javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
    css: 'CSS', scss: 'SCSS', html: 'HTML', json: 'JSON',
    markdown: 'Markdown', shell: 'Shell Script', plaintext: 'Plain Text',
    yaml: 'YAML', xml: 'XML', sql: 'SQL', rust: 'Rust', go: 'Go',
    java: 'Java', cpp: 'C++', c: 'C', csharp: 'C#', ruby: 'Ruby',
};

export default function StatusBar({ language, line, col, modified, fileName, showPanel, onTogglePanel }) {
    const langLabel = LANG_LABELS[language] || language || 'Plain Text';

    return (
        <div className="status-bar">
            {/* Left items */}
            <div className="status-item" title="Source Control">
                <GitBranch size={13} />
                <span>main</span>
            </div>

            <div className="status-item" title="Errors and Warnings">
                <AlertCircle size={13} />
                <span>0</span>
                <CheckCircle size={13} style={{ marginLeft: '4px' }} />
                <span>0</span>
            </div>

            {/* Right items */}
            <div className="status-right">
                {fileName && (
                    <div className="status-item" title={modified ? 'Unsaved changes' : 'Saved'}>
                        {modified ? '● Modified' : '✓ Saved'}
                    </div>
                )}

                <div className="status-item" title="Go to Line/Column" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
                    Ln {line}, Col {col}
                </div>

                <div className="status-item" title="Select Indentation">
                    Spaces: 2
                </div>

                <div className="status-item" title="Select Encoding">
                    UTF-8
                </div>

                <div className="status-item" title="Select End of Line Sequence">
                    CRLF
                </div>

                <div className="status-item" title="Select Language Mode" style={{ minWidth: '80px' }}>
                    {langLabel}
                </div>

                <div className="status-item" onClick={onTogglePanel} title="Toggle Terminal Panel" style={{ cursor: 'pointer' }}>
                    <Bell size={12} />
                </div>
            </div>
        </div>
    );
}

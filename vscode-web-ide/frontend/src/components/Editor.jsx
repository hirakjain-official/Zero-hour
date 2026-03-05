import React, { useRef, useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { Play, WrapText, Map } from 'lucide-react';

const EXT_LANGUAGE = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    jsx: 'javascript', tsx: 'typescript', ts: 'typescript',
    py: 'python', css: 'css', scss: 'scss', sass: 'scss',
    html: 'html', htm: 'html', json: 'json', jsonc: 'json',
    md: 'markdown', sh: 'shell', bash: 'shell', yaml: 'yaml',
    yml: 'yaml', xml: 'xml', sql: 'sql', rs: 'rust',
    go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    cs: 'csharp', rb: 'ruby', php: 'php', swift: 'swift',
};

function getLanguage(filename) {
    const ext = filename?.split('.').pop()?.toLowerCase();
    return EXT_LANGUAGE[ext] || 'plaintext';
}

const RUNNABLE = new Set(['js', 'jsx', 'mjs', 'cjs', 'py', 'sh', 'bash', 'ts']);

function isRunnable(filename) {
    const ext = filename?.split('.').pop()?.toLowerCase();
    return RUNNABLE.has(ext);
}

export default function Editor({ tab, onContentChange, onSave, onRun, isRunning, onCursorChange, onLanguageChange, editorRef: externalEditorRef, agentAnnotation }) {
    const internalEditorRef = useRef(null);
    const decorationsRef = useRef([]);
    const [minimap, setMinimap] = useState(true);
    const [wordWrap, setWordWrap] = useState('off');

    const handleEditorDidMount = (editor, monaco) => {
        internalEditorRef.current = editor;
        // Expose editor to parent for menu actions
        if (externalEditorRef) externalEditorRef.current = editor;

        // Register save keybinding
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (tab) onSave(tab.id, editor.getValue());
        });

        // Register run keybinding (F5)
        editor.addCommand(monaco.KeyCode.F5, () => {
            onRun();
        });

        // Cursor position tracking
        editor.onDidChangeCursorPosition((e) => {
            onCursorChange({ line: e.position.lineNumber, col: e.position.column });
        });

        // Define custom VS Code Dark+ theme
        monaco.editor.defineTheme('vscode-dark-plus', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'number', foreground: 'B5CEA8' },
                { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                { token: 'variable', foreground: '9CDCFE' },
                { token: 'type', foreground: '4EC9B0' },
                { token: 'function', foreground: 'DCDCAA' },
                { token: 'class', foreground: '4EC9B0' },
                { token: 'constant', foreground: '4FC1FF' },
            ],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.foreground': '#d4d4d4',
                'editorLineNumber.foreground': '#858585',
                'editorLineNumber.activeForeground': '#c6c6c6',
                'editor.selectionBackground': '#264f78',
                'editor.inactiveSelectionBackground': '#3a3d41',
                'editorIndentGuide.background': '#404040',
                'editorIndentGuide.activeBackground': '#707070',
                'editor.lineHighlightBackground': '#2a2d2e',
                'editorCursor.foreground': '#aeafad',
                'editor.wordHighlightBackground': '#575757b8',
                'editorBracketMatch.background': '#0064001a',
                'editorBracketMatch.border': '#888888',
                'scrollbar.shadow': '#000000',
                'scrollbarSlider.background': '#42424266',
                'scrollbarSlider.hoverBackground': '#555555',
                'scrollbarSlider.activeBackground': '#6a6a6a',
            }
        });
        monaco.editor.setTheme('vscode-dark-plus');
    };

    useEffect(() => {
        if (tab) {
            onLanguageChange(getLanguage(tab.name));
        }
    }, [tab?.name]);

    // Update editor options when minimap/wordwrap toggles
    useEffect(() => {
        if (internalEditorRef.current) {
            internalEditorRef.current.updateOptions({
                minimap: { enabled: minimap, scale: 1, renderCharacters: false },
                wordWrap: wordWrap,
            });
        }
    }, [minimap, wordWrap]);

    // Agent inline annotations via Monaco deltaDecorations
    useEffect(() => {
        const editor = internalEditorRef.current;
        if (!editor) return;

        if (!agentAnnotation) {
            // Clear decorations
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
            return;
        }

        const COLORS = { praise: '#4caf50', scold: '#ff9800', redirect: '#f44336', nudge: '#c678dd' };
        const color = COLORS[agentAnnotation.action] || '#888';
        const line = Math.max(1, agentAnnotation.line || 1);

        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
            {
                range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
                options: {
                    isWholeLine: true,
                    className: `agent-line-${agentAnnotation.action}`,
                    glyphMarginClassName: `agent-glyph-${agentAnnotation.action}`,
                    after: {
                        content: `  🤖 ${agentAnnotation.message}`,
                        inlineClassName: `agent-inline-hint`,
                    }
                }
            }
        ]);

        // Scroll to the annotation line softly
        editor.revealLineInCenterIfOutsideViewport(line);
    }, [agentAnnotation]);

    if (!tab) {
        return (
            <div className="editor-empty">
                <div className="editor-empty-logo">⬡</div>
                <h2>VS Code Web IDE</h2>
                <p>Open a file from the Explorer to start editing.</p>
                <div className="editor-shortcuts">
                    <div className="shortcut-row"><kbd>Ctrl+Shift+P</kbd><span>Command Palette</span></div>
                    <div className="shortcut-row"><kbd>Ctrl+B</kbd><span>Toggle Sidebar</span></div>
                    <div className="shortcut-row"><kbd>Ctrl+`</kbd><span>Toggle Terminal</span></div>
                    <div className="shortcut-row"><kbd>Ctrl+S</kbd><span>Save File</span></div>
                    <div className="shortcut-row"><kbd>F5</kbd><span>Run File</span></div>
                    <div className="shortcut-row"><kbd>Ctrl+W</kbd><span>Close Tab</span></div>
                </div>
            </div>
        );
    }

    const lang = getLanguage(tab.name);
    const canRun = isRunnable(tab.name);

    return (
        <div className="monaco-wrapper">
            {/* Editor toolbar */}
            <div className="editor-toolbar">
                {canRun && (
                    <button
                        className="run-button"
                        onClick={onRun}
                        disabled={isRunning}
                        title="Run file (F5)"
                    >
                        {isRunning ? (
                            <><span className="spinner" /> Running...</>
                        ) : (
                            <><Play size={13} fill="white" /> Run</>
                        )}
                    </button>
                )}
                <button
                    className="run-button"
                    style={{ marginLeft: '10px', backgroundColor: '#673ab7' }}
                    onClick={() => {
                        console.log('User manually fired AI Agent');
                        // Dispatch a custom window event that App.jsx listens to
                        window.dispatchEvent(new CustomEvent('force-ai-eval'));
                    }}
                    title="Force AI Evaluation"
                >
                    Trigger Agent
                </button>
                <div style={{ flex: 1 }} />
                <button
                    className={`editor-toggle-btn ${wordWrap === 'on' ? 'active' : ''}`}
                    onClick={() => setWordWrap(w => w === 'on' ? 'off' : 'on')}
                    title="Toggle Word Wrap"
                >
                    <WrapText size={14} />
                </button>
                <button
                    className={`editor-toggle-btn ${minimap ? 'active' : ''}`}
                    onClick={() => setMinimap(m => !m)}
                    title="Toggle Minimap"
                >
                    <Map size={14} />
                </button>
            </div>
            <MonacoEditor
                height="100%"
                language={lang}
                value={tab.content}
                theme="vscode-dark-plus"
                onChange={(value) => onContentChange(tab.id, value || '')}
                onMount={handleEditorDidMount}
                options={{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                    fontLigatures: true,
                    lineHeight: 22,
                    minimap: { enabled: minimap, scale: 1, renderCharacters: false },
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    tabSize: 2,
                    insertSpaces: true,
                    wordWrap: wordWrap,
                    automaticLayout: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    formatOnPaste: true,
                    formatOnType: false,
                    linkedEditing: true,
                    bracketPairColorization: { enabled: true },
                    guides: {
                        bracketPairs: true,
                        indentation: true,
                    },
                    suggest: { showStatusBar: true },
                    suggestSelection: 'first',
                    quickSuggestions: { other: true, comments: true, strings: false },
                    padding: { top: 12, bottom: 12 },
                    glyphMargin: true,
                    renderLineHighlight: 'all',
                    selectionHighlight: true,
                    occurrencesHighlight: true,
                    codeLens: true,
                    folding: true,
                    foldingStrategy: 'auto',
                    showFoldingControls: 'mouseover',
                    stickyScroll: { enabled: true },
                }}
            />
        </div>
    );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ── MenuBar Component ── */
function MenuBar({ menus, onClose }) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="titlebar-menubar" ref={menuRef}>
      {menus.map((menu) => (
        <div key={menu.label} className="titlebar-menu-wrapper">
          <div
            className={`titlebar-menu-item ${openMenu === menu.label ? 'open' : ''}`}
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => { if (openMenu) setOpenMenu(menu.label); }}
          >
            {menu.label}
          </div>
          {openMenu === menu.label && (
            <div className="menu-dropdown">
              {menu.items.map((item, i) => {
                if (item.separator) {
                  return <div key={`sep-${i}`} className="menu-separator" />;
                }
                return (
                  <div
                    key={item.label}
                    className={`menu-item ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => {
                      if (item.disabled) return;
                      item.action?.();
                      setOpenMenu(null);
                    }}
                  >
                    <span className="menu-item-label">{item.label}</span>
                    {item.keybind && <span className="menu-item-keybind">{item.keybind}</span>}
                    {item.checked !== undefined && (
                      <span className="menu-item-check">{item.checked ? '✓' : ''}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── AiAgentPopup Component ── */
function AiAgentPopup({ popup, onClose }) {
  if (!popup) return null;
  const colors = {
    praise: '#4caf50',
    scold: '#ff9800',
    redirect: '#f44336'
  };
  const title = {
    praise: 'Agent: Good Job!',
    scold: 'Agent: Minor Issue',
    redirect: 'Agent: STOP!'
  };

  return (
    <div className="ai-agent-popup" style={{ borderColor: colors[popup.action] || '#888' }}>
      <button className="ai-agent-close" onClick={onClose}>×</button>
      <div className="ai-agent-header" style={{ color: colors[popup.action] || '#888' }}>
        {title[popup.action] || 'Agent'}
      </div>
      <div className="ai-agent-body">{popup.message}</div>
    </div>
  );
}

import ActivityBar from './components/ActivityBar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import Editor from './components/Editor';
import Terminal from './components/Terminal';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import Preview from './components/Preview';
import AiChat from './components/AiChat';
import { Smartphone, Sparkles, PanelLeft, PanelBottom, ChevronRight, ChevronLeft } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function useNotification() {
  const [notification, setNotification] = useState(null);
  const show = (msg, type = 'info') => {
    setNotification({ msg, type, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  };
  return [notification, show];
}

export default function App() {
  const [activePanel, setActivePanel] = useState('explorer');
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [fileTree, setFileTree] = useState(null);

  // Session State
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('ide_session_id') || '');
  const [sessionReady, setSessionReady] = useState(false);

  // Panel visibility (all collapsible)
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showAI, setShowAI] = useState(true);

  // Resizable panel widths
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [previewWidth, setPreviewWidth] = useState(360);
  const [aiWidth, setAiWidth] = useState(320);

  const [aiPopup, setAiPopup] = useState(null);
  const lastEvalCodeRef = useRef('');
  const evalTimerRef = useRef(null);

  const [activeTerminalTab, setActiveTerminalTab] = useState('output');
  const [terminalOutput, setTerminalOutput] = useState([
    { type: 'info', text: '✅  VS Code Web IDE is ready! Click ▶ Run to execute files.' },
    { type: 'info', text: `📁  Workspace: ${API}/api/files` },
    { type: 'info', text: '──────────────────────────────────────────────────────────' },
  ]);
  const [showPalette, setShowPalette] = useState(false);
  const [notification, showNotification] = useNotification();
  const [panelHeight, setPanelHeight] = useState(220);
  const [isRunning, setIsRunning] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [currentLang, setCurrentLang] = useState('plaintext');

  // Track if currently dragging a resize handle
  const [isResizing, setIsResizing] = useState(false);

  // Editor ref for undo/redo/find
  const editorRef = useRef(null);

  // Derived state — must be before hooks that use it to avoid TDZ
  const activeTabData = tabs.find(t => t.id === activeTab);

  const loadTree = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API}/api/files/tree`, {
        headers: { 'x-session-id': sessionId }
      });
      const data = await res.json();
      setFileTree(data);
    } catch (e) {
      console.error('Failed to load file tree', e);
    }
  }, [sessionId]);

  // Handle Session Lifecycle
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch(`${API}/api/session/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (data.session) {
          setSessionId(data.session.sessionId);
          localStorage.setItem('ide_session_id', data.session.sessionId);
          setSessionReady(true);
        }
      } catch (e) {
        showNotification('Failed to initialize session sandbox', 'error');
      }
    };
    initSession();

    const pingInterval = setInterval(async () => {
      if (!sessionId) return;
      try {
        await fetch(`${API}/api/session/ping`, {
          method: 'POST',
          headers: { 'x-session-id': sessionId }
        });
      } catch (e) { /* silent */ }
    }, 5 * 60 * 1000);

    return () => clearInterval(pingInterval);
  }, []); // Run once on mount

  // --- Background AI Evaluator Loop ---
  const triggerEvaluator = useCallback(async () => {
    if (!activeTabData?.content || !sessionId) return;
    console.log('🤖 AI Agent Executing Evaluation...');
    try {
      lastEvalCodeRef.current = activeTabData.content;
      const fileTreeContext = JSON.stringify(fileTree || {}, null, 2).slice(0, 1500);
      const openTabsContext = tabs.map(t => t.path).join(', ');
      const terminalContext = terminalOutput.slice(-50).map(t => t.text).join('\n');

      const res = await fetch(`${API}/api/ai/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeTabData.content.slice(0, 3000),
          language: activeTabData.name?.split('.').pop(),
          fileTree: fileTreeContext,
          openTabs: openTabsContext,
          terminalOutput: terminalContext
        })
      });
      const data = await res.json();
      console.log('🤖 AI Agent Result:', data);

      if (data.action && data.action !== 'ignore') {
        setAiPopup({ action: data.action, message: data.message });
        setTimeout(() => setAiPopup(null), data.action === 'praise' ? 4000 : 7000);
      }
    } catch (e) {
      console.error('AI Agent Background Error:', e);
    }
  }, [activeTabData, sessionId, fileTree, tabs, terminalOutput, setAiPopup, API]);

  useEffect(() => {
    // Only trigger if code actually changed since last eval (ignore minor whitespace, but keep fast reaction)
    if (!activeTabData?.content || activeTabData.content === lastEvalCodeRef.current) return;

    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
    evalTimerRef.current = setTimeout(triggerEvaluator, 2500); // 2.5s debounce

    return () => clearTimeout(evalTimerRef.current);
  }, [activeTabData?.content, triggerEvaluator]);

  // Hook for forced manual button evaluation
  useEffect(() => {
    const handleForceEval = () => triggerEvaluator();
    window.addEventListener('force-ai-eval', handleForceEval);
    return () => window.removeEventListener('force-ai-eval', handleForceEval);
  }, [triggerEvaluator]);

  useEffect(() => {
    if (sessionReady) loadTree();
  }, [sessionReady, loadTree]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault(); setShowPalette(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault(); setShowPalette(true);
      }
      if (e.key === 'Escape') setShowPalette(false);
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault(); setShowTerminal(p => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault(); setShowSidebar(p => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTab) closeTab(activeTab);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeTab]);

  const openFile = async (filePath) => {
    const existing = tabs.find(t => t.path === filePath);
    if (existing) { setActiveTab(existing.id); return; }
    try {
      const res = await fetch(`${API}/api/files/read?path=${encodeURIComponent(filePath)}`, {
        headers: { 'x-session-id': sessionId }
      });
      const data = await res.json();
      const tab = {
        id: Date.now().toString(),
        path: filePath,
        name: filePath.split('/').pop() || filePath.split('\\').pop() || filePath,
        content: data.content,
        savedContent: data.content,
        modified: false
      };
      setTabs(prev => [...prev, tab]);
      setActiveTab(tab.id);
    } catch (e) {
      showNotification('Failed to open file: ' + e.message, 'error');
    }
  };

  const saveFile = async (tabId, content) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    try {
      await fetch(`${API}/api/files/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ path: tab.path, content })
      });
      setTabs(prev => prev.map(t =>
        t.id === tabId ? { ...t, content, savedContent: content, modified: false } : t
      ));
      showNotification(`Saved ${tab.name}`, 'success');
    } catch (e) {
      showNotification('Save failed: ' + e.message, 'error');
    }
  };

  const closeTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.modified) {
      if (!confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return;
    }
    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs.length > 0 ? newTabs[Math.min(idx, newTabs.length - 1)].id : null);
    }
  };

  const updateTabContent = (tabId, content) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, content, modified: content !== t.savedContent } : t
    ));
  };

  const reorderTabs = (fromIndex, toIndex) => {
    setTabs(prev => {
      const newTabs = [...prev];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return newTabs;
    });
  };

  const runCode = async () => {
    const tab = tabs.find(t => t.id === activeTab);
    if (!tab) return;
    setIsRunning(true);
    setShowTerminal(true);
    setActiveTerminalTab('output');
    setTerminalOutput(prev => [
      ...prev,
      { type: 'info', text: `\n▶  Running: ${tab.name}` },
      { type: 'info', text: '──────────────────────────────────' }
    ]);

    try {
      const res = await fetch(`${API}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ filePath: tab.path, code: tab.content, filename: tab.name })
      });
      const data = await res.json();
      if (data.stdout) data.stdout.split('\n').filter(Boolean).forEach(line =>
        setTerminalOutput(prev => [...prev, { type: 'stdout', text: line }])
      );
      if (data.stderr) data.stderr.split('\n').filter(Boolean).forEach(line =>
        setTerminalOutput(prev => [...prev, { type: 'stderr', text: line }])
      );
      setTerminalOutput(prev => [...prev, {
        type: data.exitCode === 0 ? 'success' : 'error',
        text: `\n[Process exited with code ${data.exitCode}]`
      }]);
    } catch (e) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: 'Failed to execute: ' + e.message }]);
    }
    setIsRunning(false);
  };

  // ── Panel resizing ──

  // Vertical panel (terminal) resize
  const startTerminalResize = (e) => {
    const startY = e.clientY;
    const startH = panelHeight;
    setIsResizing(true);
    const onMove = (ev) => setPanelHeight(Math.max(80, Math.min(600, startH + (startY - ev.clientY))));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsResizing(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Horizontal resize helper
  const startHorizontalResize = (e, setter, direction, min, max, defaultWidth) => {
    e.preventDefault();
    const startX = e.clientX;
    let currentVal;
    setter(prev => { currentVal = prev; return prev; });
    setIsResizing(true);

    const onMove = (ev) => {
      const diff = ev.clientX - startX;
      const newVal = direction === 'left'
        ? currentVal + diff
        : currentVal - diff;
      setter(Math.max(min, Math.min(max, newVal)));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const saveAll = () => {
    tabs.filter(t => t.modified).forEach(t => saveFile(t.id, t.content));
  };

  const closeAllTabs = () => {
    const unsaved = tabs.filter(t => t.modified);
    if (unsaved.length > 0) {
      if (!confirm(`Close all tabs? ${unsaved.length} unsaved file(s) will be lost.`)) return;
    }
    setTabs([]);
    setActiveTab(null);
  };

  const createNewFile = async () => {
    const name = prompt('Enter filename:', 'untitled.js');
    if (!name) return;
    try {
      await fetch(`${API}/api/files/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ path: name, type: 'file' })
      });
      loadTree();
      setTimeout(() => openFile(name), 500);
      showNotification(`Created ${name}`, 'success');
    } catch (e) {
      showNotification('Failed to create file', 'error');
    }
  };

  const createNewFolder = async () => {
    const name = prompt('Enter folder name:', 'new-folder');
    if (!name) return;
    try {
      await fetch(`${API}/api/files/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ path: name, type: 'directory' })
      });
      loadTree();
      showNotification(`Created folder ${name}`, 'success');
    } catch (e) {
      showNotification('Failed to create folder', 'error');
    }
  };

  // ── Menu definitions ──
  const menuDefs = [
    {
      label: 'File',
      items: [
        { label: 'New File', keybind: 'Ctrl+N', action: createNewFile },
        { label: 'New Folder', action: createNewFolder },
        { separator: true },
        { label: 'Open File...', keybind: 'Ctrl+O', action: () => { setActivePanel('explorer'); setShowSidebar(true); } },
        { separator: true },
        { label: 'Save', keybind: 'Ctrl+S', action: () => activeTabData && saveFile(activeTab, activeTabData.content), disabled: !activeTabData },
        { label: 'Save All', keybind: 'Ctrl+Shift+S', action: saveAll },
        { separator: true },
        { label: 'Close Editor', keybind: 'Ctrl+W', action: () => activeTab && closeTab(activeTab), disabled: !activeTab },
        { label: 'Close All Editors', action: closeAllTabs, disabled: tabs.length === 0 },
        { separator: true },
        { label: 'Preferences: Settings', action: () => showNotification('Settings coming soon', 'info') },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', keybind: 'Ctrl+Z', action: () => editorRef.current?.trigger('menu', 'undo', null) },
        { label: 'Redo', keybind: 'Ctrl+Shift+Z', action: () => editorRef.current?.trigger('menu', 'redo', null) },
        { separator: true },
        { label: 'Cut', keybind: 'Ctrl+X', action: () => editorRef.current?.trigger('menu', 'editor.action.clipboardCutAction', null) },
        { label: 'Copy', keybind: 'Ctrl+C', action: () => editorRef.current?.trigger('menu', 'editor.action.clipboardCopyAction', null) },
        { label: 'Paste', keybind: 'Ctrl+V', action: () => editorRef.current?.focus() },
        { separator: true },
        { label: 'Find', keybind: 'Ctrl+F', action: () => editorRef.current?.trigger('menu', 'actions.find', null) },
        { label: 'Replace', keybind: 'Ctrl+H', action: () => editorRef.current?.trigger('menu', 'editor.action.startFindReplaceAction', null) },
        { separator: true },
        { label: 'Select All', keybind: 'Ctrl+A', action: () => editorRef.current?.trigger('menu', 'editor.action.selectAll', null) },
      ]
    },
    {
      label: 'Selection',
      items: [
        { label: 'Select All', keybind: 'Ctrl+A', action: () => editorRef.current?.trigger('menu', 'editor.action.selectAll', null) },
        { label: 'Expand Selection', keybind: 'Shift+Alt+→', action: () => editorRef.current?.trigger('menu', 'editor.action.smartSelect.expand', null) },
        { label: 'Shrink Selection', keybind: 'Shift+Alt+←', action: () => editorRef.current?.trigger('menu', 'editor.action.smartSelect.shrink', null) },
        { separator: true },
        { label: 'Copy Line Up', keybind: 'Shift+Alt+↑', action: () => editorRef.current?.trigger('menu', 'editor.action.copyLinesUpAction', null) },
        { label: 'Copy Line Down', keybind: 'Shift+Alt+↓', action: () => editorRef.current?.trigger('menu', 'editor.action.copyLinesDownAction', null) },
        { label: 'Move Line Up', keybind: 'Alt+↑', action: () => editorRef.current?.trigger('menu', 'editor.action.moveLinesUpAction', null) },
        { label: 'Move Line Down', keybind: 'Alt+↓', action: () => editorRef.current?.trigger('menu', 'editor.action.moveLinesDownAction', null) },
        { separator: true },
        { label: 'Add Cursor Above', keybind: 'Ctrl+Alt+↑', action: () => editorRef.current?.trigger('menu', 'editor.action.insertCursorAbove', null) },
        { label: 'Add Cursor Below', keybind: 'Ctrl+Alt+↓', action: () => editorRef.current?.trigger('menu', 'editor.action.insertCursorBelow', null) },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Command Palette...', keybind: 'Ctrl+Shift+P', action: () => setShowPalette(true) },
        { separator: true },
        { label: 'Explorer', keybind: 'Ctrl+Shift+E', action: () => { setActivePanel('explorer'); setShowSidebar(true); } },
        { label: 'Search', keybind: 'Ctrl+Shift+F', action: () => { setActivePanel('search'); setShowSidebar(true); } },
        { label: 'Source Control', keybind: 'Ctrl+Shift+G', action: () => { setActivePanel('git'); setShowSidebar(true); } },
        { label: 'Extensions', keybind: 'Ctrl+Shift+X', action: () => { setActivePanel('extensions'); setShowSidebar(true); } },
        { label: 'Run and Debug', action: () => { setActivePanel('run'); setShowSidebar(true); } },
        { separator: true },
        { label: 'Toggle Sidebar', keybind: 'Ctrl+B', action: () => setShowSidebar(p => !p), checked: showSidebar },
        { label: 'Toggle Terminal', keybind: 'Ctrl+`', action: () => setShowTerminal(p => !p), checked: showTerminal },
        { label: 'Toggle Preview', action: () => setShowPreview(p => !p), checked: showPreview },
        { label: 'Toggle AI Assistant', action: () => setShowAI(p => !p), checked: showAI },
        { separator: true },
        { label: 'Reset Panel Sizes', action: () => { setSidebarWidth(260); setPreviewWidth(360); setAiWidth(320); setPanelHeight(220); } },
      ]
    },
    {
      label: 'Go',
      items: [
        { label: 'Go to File...', keybind: 'Ctrl+P', action: () => setShowPalette(true) },
        {
          label: 'Go to Line...', keybind: 'Ctrl+G', action: () => {
            const line = prompt('Go to Line:');
            if (line && editorRef.current) {
              const lineNum = parseInt(line, 10);
              if (!isNaN(lineNum)) {
                editorRef.current.revealLineInCenter(lineNum);
                editorRef.current.setPosition({ lineNumber: lineNum, column: 1 });
                editorRef.current.focus();
              }
            }
          }
        },
        { label: 'Go to Symbol...', keybind: 'Ctrl+Shift+O', action: () => editorRef.current?.trigger('menu', 'editor.action.quickOutline', null) },
        { separator: true },
        { label: 'Go to Definition', keybind: 'F12', action: () => editorRef.current?.trigger('menu', 'editor.action.revealDefinition', null) },
        { label: 'Go to References', keybind: 'Shift+F12', action: () => editorRef.current?.trigger('menu', 'editor.action.goToReferences', null) },
        { separator: true },
        {
          label: 'Next Editor', keybind: 'Ctrl+Tab', action: () => {
            if (tabs.length < 2) return;
            const idx = tabs.findIndex(t => t.id === activeTab);
            setActiveTab(tabs[(idx + 1) % tabs.length].id);
          }
        },
        {
          label: 'Previous Editor', keybind: 'Ctrl+Shift+Tab', action: () => {
            if (tabs.length < 2) return;
            const idx = tabs.findIndex(t => t.id === activeTab);
            setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length].id);
          }
        },
      ]
    },
    {
      label: 'Run',
      items: [
        { label: 'Run File', keybind: 'F5', action: runCode, disabled: !activeTabData },
        { label: 'Run Without Debugging', keybind: 'Ctrl+F5', action: runCode, disabled: !activeTabData },
        { separator: true },
        { label: 'Stop', keybind: 'Shift+F5', action: () => showNotification('No running process to stop', 'info'), disabled: !isRunning },
        { separator: true },
        { label: 'Toggle Breakpoint', keybind: 'F9', action: () => showNotification('Breakpoints coming soon', 'info') },
        { label: 'Clear Output', action: () => setTerminalOutput([]) },
      ]
    },
    {
      label: 'Terminal',
      items: [
        { label: 'New Terminal', keybind: 'Ctrl+`', action: () => { setShowTerminal(true); setActiveTerminalTab('terminal'); } },
        { separator: true },
        { label: 'Show Output', action: () => { setShowTerminal(true); setActiveTerminalTab('output'); } },
        { label: 'Show Terminal', action: () => { setShowTerminal(true); setActiveTerminalTab('terminal'); } },
        { label: 'Show Problems', action: () => { setShowTerminal(true); setActiveTerminalTab('problems'); } },
        { label: 'Show Debug Console', action: () => { setShowTerminal(true); setActiveTerminalTab('debug'); } },
        { separator: true },
        { label: 'Clear Terminal', action: () => setTerminalOutput([]) },
        { label: 'Toggle Terminal', keybind: 'Ctrl+`', action: () => setShowTerminal(p => !p), checked: showTerminal },
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', keybind: 'Ctrl+K Ctrl+S', action: () => showNotification('Check welcome screen for keyboard shortcuts', 'info') },
        { separator: true },
        { label: 'Documentation', action: () => window.open('https://code.visualstudio.com/docs', '_blank') },
        { label: 'Release Notes', action: () => showNotification('VS Code Web IDE v1.0.0', 'info') },
        { separator: true },
        { label: 'About', action: () => showNotification('VS Code Web IDE — Built with React + Monaco Editor', 'info') },
      ]
    },
  ];

  const paletteCommands = [
    { label: 'View: Toggle Terminal', keybind: 'Ctrl+`', action: () => setShowTerminal(p => !p) },
    { label: 'View: Toggle Sidebar', keybind: 'Ctrl+B', action: () => setShowSidebar(p => !p) },
    { label: 'View: Toggle Preview', keybind: '', action: () => setShowPreview(p => !p) },
    { label: 'View: Toggle AI Assistant', keybind: '', action: () => setShowAI(p => !p) },
    { label: 'File: Save', keybind: 'Ctrl+S', action: () => activeTabData && saveFile(activeTab, activeTabData.content) },
    { label: 'File: Close Editor', keybind: 'Ctrl+W', action: () => activeTab && closeTab(activeTab) },
    { label: 'Run: Execute File', keybind: 'F5', action: runCode },
    { label: 'View: Explorer', action: () => { setActivePanel('explorer'); setShowSidebar(true); } },
    { label: 'View: Search', action: () => { setActivePanel('search'); setShowSidebar(true); } },
    { label: 'View: Reset Panel Sizes', action: () => { setSidebarWidth(260); setPreviewWidth(360); setAiWidth(320); setPanelHeight(220); } },
  ];

  return (
    <div className={`ide-layout ${isResizing ? 'is-resizing' : ''}`}>
      {/* ── Title Bar ── */}
      <div className="titlebar">
        <div className="titlebar-dots">
          <div className="titlebar-dot red" />
          <div className="titlebar-dot yellow" />
          <div className="titlebar-dot green" />
        </div>
        <MenuBar menus={menuDefs} />
        <div className="titlebar-title">
          {activeTabData
            ? `${activeTabData.name}${activeTabData.modified ? ' ●' : ''} — VS Code Web IDE`
            : 'VS Code Web IDE'}
        </div>

        {/* Quick panel toggles in title bar */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center', paddingRight: '8px' }}>
          <button
            onClick={() => setShowSidebar(p => !p)}
            title="Toggle Sidebar (Ctrl+B)"
            className={`titlebar-toggle ${showSidebar ? 'active' : ''}`}>
            <PanelLeft size={13} />
          </button>
          <button
            onClick={() => setShowTerminal(p => !p)}
            title="Toggle Terminal (Ctrl+`)"
            className={`titlebar-toggle ${showTerminal ? 'active' : ''}`}>
            <PanelBottom size={13} />
          </button>
          <div className="titlebar-divider" />
          <button
            onClick={() => setShowPreview(p => !p)}
            title="Toggle Preview"
            className={`titlebar-toggle preview ${showPreview ? 'active' : ''}`}>
            <Smartphone size={13} />
            <span>Preview</span>
          </button>
          <button
            onClick={() => setShowAI(p => !p)}
            title="Toggle AI Assistant"
            className={`titlebar-toggle ai ${showAI ? 'active' : ''}`}>
            <Sparkles size={13} />
            <span>AI</span>
          </button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="ide-body">
        {/* Activity Bar */}
        <ActivityBar activePanel={activePanel} setActivePanel={(p) => {
          if (p === activePanel && showSidebar) {
            setShowSidebar(false);
          } else {
            setActivePanel(p);
            setShowSidebar(true);
          }
        }} />

        {/* Sidebar (collapsible + resizable) */}
        {showSidebar && (
          <>
            <Sidebar
              activePanel={activePanel}
              fileTree={fileTree}
              activeFilePath={activeTabData?.path}
              onOpenFile={openFile}
              onRefreshTree={loadTree}
              showNotification={showNotification}
              API={API}
              width={sidebarWidth}
            />
            {/* Sidebar resize handle */}
            <div
              className="resize-handle-v"
              onMouseDown={(e) => startHorizontalResize(e, setSidebarWidth, 'left', 160, 480, 260)}
              onDoubleClick={() => setSidebarWidth(260)}
              title="Drag to resize sidebar, double-click to reset"
            />
          </>
        )}

        {/* Sidebar collapsed indicator */}
        {!showSidebar && (
          <div
            onClick={() => setShowSidebar(true)}
            className="sidebar-collapsed-indicator"
            title="Show Sidebar"
          />
        )}

        {/* ── Center: Editor + Terminal ── */}
        <div className="editor-area">
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onSelect={setActiveTab}
            onClose={closeTab}
            onReorder={reorderTabs}
          />

          {activeTabData && (
            <div className="breadcrumb">
              <span>workspace</span>
              {activeTabData.path.split('/').map((seg, i, arr) => (
                <React.Fragment key={i}>
                  <span className="breadcrumb-sep">›</span>
                  <span style={{ color: i === arr.length - 1 ? '#ccc' : '#888' }}>{seg}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          <Editor
            tab={activeTabData}
            onContentChange={updateTabContent}
            onSave={saveFile}
            onRun={runCode}
            isRunning={isRunning}
            onCursorChange={setCursorPos}
            onLanguageChange={setCurrentLang}
            editorRef={editorRef}
          />

          {showTerminal && (
            <Terminal
              height={panelHeight}
              output={terminalOutput}
              activeTab={activeTerminalTab}
              onTabChange={setActiveTerminalTab}
              onClose={() => setShowTerminal(false)}
              onClearOutput={() => setTerminalOutput([])}
              onResize={startTerminalResize}
              API={API}
            />
          )}
        </div>

        {/* ── Right: Preview + AI Chat with resize handles ── */}
        {showPreview && (
          <>
            <div
              className="resize-handle-v"
              onMouseDown={(e) => startHorizontalResize(e, setPreviewWidth, 'right', 240, 600, 360)}
              onDoubleClick={() => setPreviewWidth(360)}
              title="Drag to resize preview, double-click to reset"
            />
            <Preview
              previewUrl="http://localhost:5173"
              visible={true}
              onToggle={() => setShowPreview(false)}
              width={previewWidth}
            />
          </>
        )}

        {showAI && (
          <>
            <div
              className="resize-handle-v"
              onMouseDown={(e) => startHorizontalResize(e, setAiWidth, 'right', 220, 500, 320)}
              onDoubleClick={() => setAiWidth(320)}
              title="Drag to resize AI panel, double-click to reset"
            />
            <AiChat
              API={API}
              currentTab={activeTabData}
              tabs={tabs}
              fileTree={fileTree}
              terminalOutput={terminalOutput}
              visible={true}
              onToggle={() => setShowAI(false)}
              width={aiWidth}
            />
          </>
        )}
      </div>

      <AiAgentPopup popup={aiPopup} onClose={() => setAiPopup(null)} />

      {/* ── Status Bar ── */}
      <StatusBar
        language={currentLang}
        line={cursorPos.line}
        col={cursorPos.col}
        modified={activeTabData?.modified}
        fileName={activeTabData?.name}
        showPanel={showTerminal}
        onTogglePanel={() => setShowTerminal(p => !p)}
      />

      {/* Command Palette */}
      {showPalette && (
        <CommandPalette
          commands={paletteCommands}
          tabs={tabs}
          onOpenFile={openFile}
          onClose={() => setShowPalette(false)}
        />
      )}

      {/* Notification toast */}
      {notification && (
        <div className={`notification ${notification.type}`} key={notification.id}>
          {notification.type === 'success' && '✅'}
          {notification.type === 'error' && '❌'}
          {notification.type === 'info' && 'ℹ️'}
          {notification.msg}
        </div>
      )}
    </div>
  );
}

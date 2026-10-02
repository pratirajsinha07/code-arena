import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useNavigate, useParams } from 'react-router-dom';
import RetroTitle from './components/RetroTitle';
import PageTransition from './components/PageTransition';

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

function Dashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState('viewer');
  const [username, setUsername] = useState('Guest');
  const [userId, setUserId] = useState('');
  
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  
  const usernameRef = useRef(username);
  useEffect(() => { usernameRef.current = username; }, [username]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [jobId, setJobId] = useState(null);
  const jobIdRef = useRef(null);
  
  const [customInput, setCustomInput] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const expectedOutputRef = useRef('');
  useEffect(() => { expectedOutputRef.current = expectedOutput; }, [expectedOutput]);
  
  const [testResult, setTestResult] = useState(null);
  
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const editorRef = useRef(null);
  const termRef = useRef(null);
  const termInstance = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const ydocRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef(null);
  
  const bottomVerticalPanelRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    let decodedUsername = 'Guest';
    let decodedRole = 'viewer';
    let decodedUserId = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      decodedUsername = payload.username;
      decodedRole = payload.role || 'viewer';
      decodedUserId = payload.userId;
      setUsername(decodedUsername);
      setRole(decodedRole);
      setUserId(decodedUserId);
    } catch(e) {
      navigate('/login');
      return;
    }

    // Fetch room details to check if host
    fetch(`http://localhost:3001/api/rooms/${roomId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.room && data.room.hostId === decodedUserId) {
        setIsHost(true);
        setRole('editor'); // Host is always an editor
      }
    });

    const term = new Terminal({ theme: { background: '#1e1e1e' } });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    termInstance.current = term;

    let ws;
    let reconnectTimer;
    
    const connectWebSocket = () => {
      ws = new WebSocket(`ws://localhost:3001/rooms/${roomId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.channel === 'execution-stream') {
          const { chunk } = data.message;
          if (chunk.includes('{"stream":true')) return;
          term.write(chunk.replace(/\n/g, '\r\n'));
        } else if (data.channel === 'execution-results') {
          term.write('\r\n\x1b[32m--- Execution Finished ---\x1b[0m\r\n');
          setIsRunning(false);
          if (expectedOutputRef.current) {
            const rawActual = data.message.stdout || '';
            const stripAnsi = rawActual.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
            const actual = stripAnsi.replace(/\r/g, '').trim();
            const expected = expectedOutputRef.current.replace(/\r/g, '').trim();
            if (actual === expected) {
              setTestResult('AC');
            } else {
              setTestResult('WA');
              console.log('Test Failed. Actual:', JSON.stringify(actual), 'Expected:', JSON.stringify(expected));
            }
          }
        } else if (data.channel === `room-events:${roomId}`) {
          if (data.message.type === 'role-change' && data.message.targetUser === decodedUsername) {
            setRole(data.message.newRole);
          }
        }
      };

      ws.onclose = () => {
        console.warn('WebSocket disconnected. Reconnecting in 2s...');
        reconnectTimer = setTimeout(connectWebSocket, 2000);
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };
    
    connectWebSocket();

    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current) fitAddonRef.current.fit();
    });
    if (termRef.current) observer.observe(termRef.current);

    const inputListener = term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && jobIdRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'input', jobId: jobIdRef.current, data }));
      }
    });

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider('ws://localhost:3001/telemetry', `code-arena-room-${roomId}`, ydoc);
    providerRef.current = provider;
    
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().values());
      const users = states.map(state => state.user).filter(Boolean);
      
      const uniqueUsers = [];
      const seen = new Set();
      for (const u of users) {
        if (!seen.has(u.name)) {
          seen.add(u.name);
          uniqueUsers.push(u);
        }
      }
      setParticipants(uniqueUsers);
    });

    return () => {
      inputListener.dispose();
      observer.disconnect();
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      term.dispose();
      if (providerRef.current) providerRef.current.disconnect();
    };
  }, [navigate]);

  const updateDecorations = (ytext, model, m) => {
    if (!m || !model) return;
    const delta = ytext.toDelta();
    let index = 0;
    const newDecorations = [];

    delta.forEach(op => {
      const length = op.insert.length;
      if (op.attributes && op.attributes.authorId) {
        const startPos = model.getPositionAt(index);
        const endPos = model.getPositionAt(index + length);
        newDecorations.push({
          range: new m.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          options: {
            className: `author-highlight`,
            hoverMessage: { value: `Written by ${op.attributes.authorId}` }
          }
        });
      }
      index += length;
    });

    if (decorationsRef.current) {
      decorationsRef.current.set(newDecorations);
    } else if (editorRef.current) {
      decorationsRef.current = editorRef.current.createDecorationsCollection(newDecorations);
    }
  };

  const handleEditorDidMount = (editor, m) => {
    editorRef.current = editor;
    monacoRef.current = m;

    if (ydocRef.current && providerRef.current) {
      const type = ydocRef.current.getText('monaco');
      bindingRef.current = new MonacoBinding(type, editor.getModel(), new Set([editor]), providerRef.current.awareness);
      
      type.observe((event, tr) => {
        // Automatically format newly inserted text with the local user's name
        if (tr.local && tr.origin !== 'author-format') {
          let currIndex = 0;
          ydocRef.current.transact(() => {
            event.changes.delta.forEach(op => {
              if (op.retain) currIndex += op.retain;
              if (op.insert) {
                const len = op.insert.length || 1;
                type.format(currIndex, len, { authorId: usernameRef.current });
                currIndex += len;
              }
            });
          }, 'author-format');
        }
        
        updateDecorations(type, editor.getModel(), m);
      });
    }
  };

  // Sync role to awareness when it changes
  useEffect(() => {
    if (providerRef.current && username) {
      providerRef.current.awareness.setLocalStateField('user', { 
        name: username, 
        role: role,
        color: stringToColor(username),
        isHost: isHost
      });
    }
  }, [role, username, isHost]);

  const runCode = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setTestResult(null);
    bottomVerticalPanelRef.current?.expand();

    const code = editorRef.current.getValue();
    termInstance.current.clear();
    termInstance.current.write('\x1b[33mSubmitting job...\x1b[0m\r\n');
    
    try {
      const res = await fetch('http://localhost:3001/api/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code, roomId, stdin: customInput })
      });
      const data = await res.json();
      setJobId(data.jobId);
      jobIdRef.current = data.jobId;
    } catch (e) {
      termInstance.current.write(`\r\n\x1b[31mError: ${e.message}\x1b[0m\r\n`);
      setIsRunning(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    try {
      const res = await fetch('http://localhost:3001/api/users/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ password: deletePassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete account');
      }
      localStorage.removeItem('token');
      navigate('/login');
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  return (
    <PageTransition>
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', background: '#1e1e1e', color: 'white', overflow: 'hidden' }}>
      <style>{`
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        #root { width: 100%; height: 100%; display: flex; flex-direction: column; }
        * { box-sizing: border-box; }
        .author-highlight { border-bottom: 2px solid rgba(255, 255, 0, 0.6); background-color: rgba(255, 255, 0, 0.1); }
        .resize-handle-v { height: 4px; background: #333; cursor: row-resize; transition: background 0.2s; }
        .resize-handle-v:hover, .resize-handle-v:active { background: #007acc; }
        .close-btn { background: transparent; border: none; color: #ccc; cursor: pointer; font-size: 16px; padding: 0 4px; border-radius: 4px; }
        .close-btn:hover { background: #333; color: #fff; }
      `}</style>

      <div style={{ height: '45px', padding: '0 1rem', background: '#252526', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', flexShrink: 0 }}>
        <div style={{ transform: 'translateY(-2px)' }}>
          <RetroTitle size="compact" />
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Room link copied to clipboard!');
            }}
            style={{ padding: '6px 14px', background: '#007acc', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
            Share Link
          </button>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowParticipants(!showParticipants)}
              style={{ padding: '6px 14px', background: '#333', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
              Users ({participants.length})
            </button>
            {showParticipants && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#252526', border: '1px solid #333', borderRadius: '4px', padding: '1rem', width: '250px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#fff' }}>Participants</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {participants.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <span style={{ color: p.color }}>{p.name} {p.name === username ? '(You)' : ''} {p.isHost ? '(Host)' : ''}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#aaa', fontSize: '10px' }}>{p.role?.toUpperCase()}</span>
                        {isHost && p.name !== username && (
                          <button
                            onClick={() => {
                              const newRole = p.role === 'viewer' ? 'editor' : 'viewer';
                              if (wsRef.current?.readyState === WebSocket.OPEN) {
                                wsRef.current.send(JSON.stringify({ type: 'role-change', targetUser: p.name, newRole }));
                              }
                            }}
                            style={{ padding: '2px 6px', fontSize: '10px', cursor: 'pointer', background: '#444', border: 'none', color: '#fff', borderRadius: '2px' }}
                          >
                            Make {p.role === 'viewer' ? 'Editor' : 'Viewer'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span style={{ fontSize: '0.85rem', color: '#ccc' }}>Role: {role.toUpperCase()} | User: {username}</span>
          {role === 'editor' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={runCode} 
                disabled={isRunning}
                style={{ 
                  padding: '6px 14px', 
                  background: isRunning ? '#d68a00' : '#007acc', 
                  color: 'white', 
                  border: 'none', 
                  cursor: isRunning ? 'wait' : 'pointer', 
                  borderRadius: '4px', 
                  fontSize: '13px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}>
                {isRunning ? '⏳ Running...' : '▶ Run Code'}
              </button>
              {isRunning && (
                <button
                  onClick={async () => {
                    if (!jobIdRef.current) return;
                    try {
                      await fetch('http://localhost:3001/api/execute/stop', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ jobId: jobIdRef.current, roomId })
                      });
                    } catch (e) {
                      console.error('Failed to stop code', e);
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    background: '#e51400',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.2s'
                  }}>
                  ⏹ Stop Code
                </button>
              )}
            </div>
          )}
          <button 
            onClick={() => setShowDeleteModal(true)}
            style={{ padding: '6px 14px', background: '#d32f2f', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
            Delete Account
          </button>
          <button 
            onClick={handleLogout}
            style={{ padding: '6px 14px', background: '#e51400', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
            Logout
          </button>
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Group orientation="vertical">
          <Panel defaultSize={100} minSize={20}>
             <Editor
                height="100%"
                defaultLanguage="cpp"
                theme="vs-dark"
                onMount={handleEditorDidMount}
                options={{ readOnly: role !== 'editor', minimap: { enabled: false } }}
             />
          </Panel>

          <Separator className="resize-handle-v" style={{ display: isTerminalOpen ? 'block' : 'none' }} />

          <Panel
            ref={bottomVerticalPanelRef}
            collapsible={true}
            collapsedSize={0}
            defaultSize={35}
            minSize={15}
            onResize={(size) => setIsTerminalOpen(size > 0)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e' }}>
              <div style={{ height: '30px', padding: '0 12px', background: '#252526', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #333', borderBottom: '1px solid #333', fontSize: '12px', flexShrink: 0 }}>
                <span style={{ color: '#fff', cursor: 'default' }}>INPUT / TERMINAL</span>
                <button onClick={() => bottomVerticalPanelRef.current?.collapse()} className="close-btn" title="Close Panel">×</button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Group orientation="horizontal">
                  <Panel defaultSize={30} minSize={15}>
                    <div style={{ height: '100%', padding: '0.5rem', display: 'flex', flexDirection: 'column', borderRight: '1px solid #333' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#ccc', fontWeight: 'bold' }}>TEST CASES</span>
                        {testResult === 'AC' && <span style={{ padding: '2px 6px', background: '#4caf50', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>Accepted (AC)</span>}
                        {testResult === 'WA' && <span style={{ padding: '2px 6px', background: '#f44336', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>Wrong Answer (WA)</span>}
                      </div>
                      
                      <span style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Input:</span>
                      <textarea 
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        style={{ flex: 1, background: '#1e1e1e', color: '#fff', border: '1px solid #444', padding: '8px', fontFamily: 'monospace', resize: 'none', borderRadius: '4px', outline: 'none', marginBottom: '8px' }}
                        placeholder="e.g. 5\n1 2 3 4 5"
                      />

                      <span style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Expected Output:</span>
                      <textarea 
                        value={expectedOutput}
                        onChange={e => setExpectedOutput(e.target.value)}
                        style={{ flex: 1, background: '#1e1e1e', color: '#fff', border: '1px solid #444', padding: '8px', fontFamily: 'monospace', resize: 'none', borderRadius: '4px', outline: 'none' }}
                        placeholder="e.g. 15"
                      />
                    </div>
                  </Panel>
                  <Separator style={{ width: '4px', background: '#333', cursor: 'col-resize' }} />
                  <Panel defaultSize={70} minSize={20}>
                    <div style={{ flex: 1, padding: '0.5rem', overflow: 'hidden', height: '100%' }}>
                      <div ref={termRef} style={{ width: '100%', height: '100%' }} />
                    </div>
                  </Panel>
                </Group>
              </div>
            </div>
          </Panel>
        </Group>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#252526', padding: '2rem', borderRadius: '8px', width: '320px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>Delete Account</h3>
            <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '1.5rem' }}>Do you want to delete your account? This action cannot be undone.</p>
            
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <input 
                type={showDeletePassword ? "text" : "password"}
                placeholder="Confirm Password" 
                value={deletePassword} 
                onChange={e => setDeletePassword(e.target.value)} 
                style={{ width: '100%', padding: '0.8rem', paddingRight: '2.5rem', borderRadius: '4px', border: '1px solid #444', background: '#2d2d2d', color: 'white' }}
              />
              <button 
                type="button" 
                onClick={() => setShowDeletePassword(!showDeletePassword)}
                style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                {showDeletePassword ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {deleteError && <div style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'left' }}>{deleteError}</div>}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
              <button 
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
                style={{ flex: 1, padding: '0.8rem', cursor: 'pointer', background: '#444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                style={{ flex: 1, padding: '0.8rem', cursor: 'pointer', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageTransition>
  );
}

export default Dashboard;

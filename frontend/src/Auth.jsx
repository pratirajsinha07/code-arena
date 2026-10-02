import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RetroTitle from './components/RetroTitle';
import PageTransition from './components/PageTransition';

function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    
    try {
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Authentication failed');
      }
      
      localStorage.setItem('token', data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PageTransition>
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#1e1e1e', color: 'white', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`body, html { margin: 0; padding: 0; width: 100%; height: 100%; } * { box-sizing: border-box; }`}</style>
      <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center', background: '#252526', padding: '2.5rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
        <div style={{ marginBottom: '2rem' }}>
          <RetroTitle size="large" />
        </div>
        
        <h2 style={{ marginBottom: '1.5rem', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>
          {isLogin ? 'Login to continue' : 'Sign up to play'}
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #444', background: '#2d2d2d', color: 'white' }}
          />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type={showPassword ? "text" : "password"}
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '0.8rem', paddingRight: '2.5rem', borderRadius: '4px', border: '1px solid #444', background: '#2d2d2d', color: 'white' }}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {!isLogin && (
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)}
              style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #444', background: '#2d2d2d', color: 'white' }}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          )}

          {error && <div style={{ color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'left', marginTop: '-0.5rem' }}>{error}</div>}

          <button type="submit" style={{ padding: '0.8rem', cursor: 'pointer', background: '#007acc', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', marginTop: '0.5rem' }}>
            {isLogin ? 'Login to Code Arena' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#ccc' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            style={{ background: 'none', border: 'none', color: '#007acc', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

export default Auth;

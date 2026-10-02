import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RetroTitle from './components/RetroTitle';
import PageTransition from './components/PageTransition';

function Lobby() {
  const navigate = useNavigate();
  const [roomIdToJoin, setRoomIdToJoin] = useState('');

  const createRoom = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        navigate(`/room/${data.room.roomId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomIdToJoin.trim()) {
      navigate(`/room/${roomIdToJoin.trim()}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <PageTransition>
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#1e1e1e', color: 'white', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center', background: '#252526', padding: '2.5rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          <div style={{ marginBottom: '2rem' }}>
            <RetroTitle size="large" />
          </div>
          
          <h3 style={{ color: '#fff', marginBottom: '2rem' }}>Lobby</h3>
          
          <button 
            onClick={createRoom}
            style={{ width: '100%', padding: '1rem', background: '#007acc', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginBottom: '2rem' }}>
            Create New Room
          </button>

          <div style={{ borderTop: '1px solid #444', margin: '2rem 0' }}></div>

          <form onSubmit={joinRoom} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              placeholder="Room ID" 
              value={roomIdToJoin} 
              onChange={e => setRoomIdToJoin(e.target.value)}
              style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: '1px solid #444', background: '#2d2d2d', color: 'white' }}
            />
            <button 
              type="submit"
              style={{ padding: '0.8rem 1.2rem', background: '#444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              Join
            </button>
          </form>

          <button 
            onClick={handleLogout}
            style={{ width: '100%', padding: '0.8rem', background: '#e51400', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '2rem' }}>
            Logout
          </button>
        </div>
      </div>
    </PageTransition>
  );
}

export default Lobby;

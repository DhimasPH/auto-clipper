import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [status, setStatus] = useState('Checking backend...');

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/health')
      .then(res => setStatus('Backend Status: ' + res.data.status))
      .catch(err => setStatus('Backend Error: ' + err.message));
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Auto Clipper MVP</h1>
      <p style={{ fontSize: '1.25rem' }}>{status}</p>
    </div>
  );
}
export default App;

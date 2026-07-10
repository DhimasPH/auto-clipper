import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [manualStart, setManualStart] = useState('00:00:00');
  const [manualEnd, setManualEnd] = useState('00:00:15');
  
  const [status, setStatus] = useState<'IDLE' | 'DOWNLOADING' | 'TRANSCRIBING' | 'CROPPING' | 'DONE' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [clips, setClips] = useState<string[]>([]);
  const [highlightsList, setHighlightsList] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API_URL}/health`)
      .then(() => setBackendStatus('Connected'))
      .catch(() => setBackendStatus('Disconnected'));
  }, []);

  const handleGenerate = async () => {
    if (!url) return setErrorMsg("Please enter a YouTube URL.");
    if (mode === 'ai' && !apiKey) return setErrorMsg("Please enter an OpenAI API Key for AI mode.");
    
    setErrorMsg('');
    setClips([]);
    setHighlightsList([]);
    
    try {
      // 1. Download
      setStatus('DOWNLOADING');
      const dlRes = await axios.post(`${API_URL}/download`, { url });
      if (dlRes.data.status === 'error') throw new Error(dlRes.data.message);
      const videoPath = dlRes.data.file_path;

      let targetStartTime = manualStart;
      let targetEndTime = manualEnd;

      // 2. Transcribe & Highlight (Only if AI Mode)
      if (mode === 'ai') {
        setStatus('TRANSCRIBING');
        const aiRes = await axios.post(`${API_URL}/process-ai`, { 
          file_path: videoPath, 
          api_key: apiKey 
        });
        if (aiRes.data.status === 'error') throw new Error(aiRes.data.message);
        
        const highlights = aiRes.data.highlights;
        setHighlightsList(highlights);
        
        if (!highlights || highlights.length === 0) {
          throw new Error("No highlights could be detected.");
        }
        
        targetStartTime = highlights[0].start_time;
        targetEndTime = highlights[0].end_time;
      } else {
        // Manual mode mock highlight info
        setHighlightsList([{ description: "Manual Custom Clip" }]);
      }

      // 3. Crop
      setStatus('CROPPING');
      const cropRes = await axios.post(`${API_URL}/crop`, {
        file_path: videoPath,
        start_time: targetStartTime,
        end_time: targetEndTime
      });
      
      if (cropRes.data.status === 'error') throw new Error(cropRes.data.message);
      
      // Store the cropped video path
      setClips([cropRes.data.file_path]);
      setStatus('DONE');

    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      setErrorMsg(err.response?.data?.message || err.message || "An unknown error occurred.");
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, background: 'linear-gradient(90deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Auto Clipper ⚡️
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>Turn long videos into viral shorts instantly.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '99px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: backendStatus === 'Connected' ? '#10b981' : '#ef4444' }} />
          Backend: {backendStatus}
        </div>
      </header>

      {/* Main Panel */}
      <main className="glass-panel animate-slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '12px' }}>
          <button 
            onClick={() => setMode('ai')}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: mode === 'ai' ? 'var(--accent)' : 'transparent', color: mode === 'ai' ? 'white' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            ✨ AI Auto Clip
          </button>
          <button 
            onClick={() => setMode('manual')}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: mode === 'manual' ? 'var(--accent)' : 'transparent', color: mode === 'manual' ? 'white' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            ✂️ Manual Clip
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>YouTube Video URL</label>
          <input 
            type="text" 
            placeholder="https://www.youtube.com/watch?v=..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {mode === 'ai' ? (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>OpenAI API Key (For Transcription & Highlights)</label>
            <input 
              type="password" 
              placeholder="sk-..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        ) : (
          <div className="animate-slide-up" style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Start Time</label>
              <input 
                type="text" 
                placeholder="00:00:00" 
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>End Time</label>
              <input 
                type="text" 
                placeholder="00:00:15" 
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <button 
          onClick={handleGenerate}
          disabled={status !== 'IDLE' && status !== 'DONE' && status !== 'ERROR'}
          style={{
            marginTop: '1rem',
            padding: '1rem',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--accent)',
            color: 'white',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: (status !== 'IDLE' && status !== 'DONE' && status !== 'ERROR') ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: (status !== 'IDLE' && status !== 'DONE' && status !== 'ERROR') ? 0.7 : 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.75rem',
            animation: status === 'IDLE' ? 'pulse-glow 2s infinite' : 'none'
          }}
        >
          {(status !== 'IDLE' && status !== 'DONE' && status !== 'ERROR') ? (
            <><div className="spinner" /> {status === 'DOWNLOADING' ? 'Downloading Video...' : status === 'TRANSCRIBING' ? 'AI is Analyzing...' : 'Cropping Video...'}</>
          ) : mode === 'ai' ? '✨ Generate Viral Clips' : '✂️ Crop Manual Clip'}
        </button>
      </main>

      {/* Results Section */}
      {status === 'DONE' && clips.length > 0 && (
        <section className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Generated Clip</h2>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
              <div style={{ aspectRatio: '9/16', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Clip Ready</p>
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{mode === 'ai' ? 'Clip 1' : 'Manual Clip'}</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {highlightsList[0]?.description || "Video berhasil dicrop ke format vertikal."}
                </p>
                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                  Saved to: {clips[0]}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

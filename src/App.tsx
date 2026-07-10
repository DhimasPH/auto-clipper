import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [manualStart, setManualStart] = useState('00:00:00');
  const [manualEnd, setManualEnd] = useState('00:00:15');
  
  const [status, setStatus] = useState<'IDLE' | 'DOWNLOADING' | 'TRANSCRIBING' | 'CROPPING' | 'DONE' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState('');
  const [clips, setClips] = useState<{ path: string; description: string }[]>([]);

  const MAX_CLIPS = 3; // Demo: generate up to 3 shorts per video.
  const videoSrc = (p: string) => `${API_URL}/video?path=${encodeURIComponent(p)}`;

  useEffect(() => {
    axios.get(`${API_URL}/health`)
      .then(() => setBackendStatus('Connected'))
      .catch(() => setBackendStatus('Disconnected'));
  }, []);

  const handleGenerate = async () => {
    if (!url) return setErrorMsg("Please enter a YouTube URL.");
    if (mode === 'ai' && !apiKey) return setErrorMsg("Please enter an OpenAI API Key for AI mode.");
    
    setErrorMsg('');
    setProgress('');
    setClips([]);

    try {
      // 1. Download
      setStatus('DOWNLOADING');
      const dlRes = await axios.post(`${API_URL}/download`, { url });
      if (dlRes.data.status === 'error') throw new Error(dlRes.data.message);
      const videoPath = dlRes.data.file_path;

      // 2. Build the list of segments to crop.
      let segments: { start_time: string; end_time: string; description: string }[] = [];
      let subtitlePath: string | null = null;

      if (mode === 'ai') {
        setStatus('TRANSCRIBING');
        const aiRes = await axios.post(`${API_URL}/process-ai`, {
          file_path: videoPath,
          api_key: apiKey,
          provider,
        });
        if (aiRes.data.status === 'error') throw new Error(aiRes.data.message);

        const highlights = aiRes.data.highlights;
        subtitlePath = aiRes.data.subtitle_path || null;

        if (!highlights || highlights.length === 0) {
          throw new Error("No highlights could be detected.");
        }

        segments = highlights.slice(0, MAX_CLIPS).map((h: any, i: number) => ({
          start_time: h.start_time,
          end_time: h.end_time,
          description: h.description || `Highlight ${i + 1}`,
        }));
      } else {
        segments = [{ start_time: manualStart, end_time: manualEnd, description: "Manual custom clip" }];
      }

      // 3. Crop every segment into its own vertical clip.
      setStatus('CROPPING');
      const generated: { path: string; description: string }[] = [];
      for (let i = 0; i < segments.length; i++) {
        setProgress(`Rendering clip ${i + 1} of ${segments.length}`);
        const seg = segments[i];
        const cropRes = await axios.post(`${API_URL}/crop`, {
          file_path: videoPath,
          start_time: seg.start_time,
          end_time: seg.end_time,
          subtitle_path: subtitlePath,
        });
        if (cropRes.data.status === 'error') throw new Error(cropRes.data.message);
        generated.push({ path: cropRes.data.file_path, description: seg.description });
        setClips([...generated]);
      }

      setProgress('');
      setStatus('DONE');

    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      setProgress('');
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
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>AI Provider</label>
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini')}
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none' }}
              >
                <option value="openai" style={{ background: '#1e1e2e' }}>OpenAI (GPT-4o + Whisper)</option>
                <option value="gemini" style={{ background: '#1e1e2e' }}>Google Gemini (2.5 Flash)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {provider === 'openai' ? 'OpenAI API Key (For Transcription & Highlights)' : 'Gemini API Key'}
              </label>
              <input 
                type="password" 
                placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
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
            <><div className="spinner" /> {status === 'DOWNLOADING' ? 'Downloading video...' : status === 'TRANSCRIBING' ? 'AI is analyzing the audio...' : (progress || 'Rendering clips...')}</>
          ) : mode === 'ai' ? '✨ Generate Viral Clips' : '✂️ Crop Manual Clip'}
        </button>
      </main>

      {/* Results Section */}
      {clips.length > 0 && (
        <section className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
            {status === 'DONE' ? `Generated ${clips.length} clip${clips.length > 1 ? 's' : ''}` : 'Generating clips...'}
          </h2>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {clips.map((clip, i) => (
              <div key={clip.path} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '280px' }}>
                <div style={{ aspectRatio: '9/16', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', overflow: 'hidden' }}>
                  <video
                    src={videoSrc(clip.path)}
                    controls
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                  />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{mode === 'ai' ? `Clip ${i + 1}` : 'Manual clip'}</h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {clip.description}
                  </p>
                  <a
                    href={videoSrc(clip.path)}
                    download
                    style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    ⬇ Download MP4
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

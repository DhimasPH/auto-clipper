import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../App";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRerender: (jobId: string, aspectRatio: string, captionStyle: string, burnSubs: boolean) => void;
  onRerunAI: (jobId: string, extraPrompt: string) => void;
}

export default function HistoryModal({ isOpen, onClose, onRerender, onRerunAI }: HistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeRerenderId, setActiveRerenderId] = useState<string | null>(null);
  const [localAspectRatio, setLocalAspectRatio] = useState("9:16");
  const [localCaptionStyle, setLocalCaptionStyle] = useState("standard");
  const [localBurnSubs, setLocalBurnSubs] = useState(true);

  const [activeAiId, setActiveAiId] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/history`);
      setHistory(res.data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteHistory = async (jobId: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus history ini? Semua file klip dan metadata terkait akan ikut terhapus permanen dari memori lokal.")) {
      try {
        await axios.delete(`${API_URL}/history/${jobId}`);
        fetchHistory();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        className="glass-panel animate-slide-up"
        style={{
          width: "90%",
          maxWidth: "600px",
          maxHeight: "80vh",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          position: "relative",
          overflowY: "auto",
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.2rem',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>🕒 History</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}><div className="spinner" /></div>
        ) : history.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>Belum ada riwayat klip.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {history.map((job) => (
              <div key={job.id} style={{
                background: "var(--bg-secondary)",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <a href={job.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                    {job.url}
                  </a>
                  <button onClick={() => deleteHistory(job.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}>🗑️</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  <span>{new Date(job.created_at).toLocaleString()}</span>
                  <span>{job.status}</span>
                </div>
                {job.result_clips && job.result_clips.length > 0 && (
                  <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", padding: "0.5rem 0" }}>
                    {job.result_clips.map((clip: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", gap: "0.25rem" }}>
                        <a href={`${API_URL}/video?path=${encodeURIComponent(clip.path)}`} download style={{
                          padding: "0.25rem 0.5rem",
                          background: "var(--accent)",
                          color: "#fff",
                          textDecoration: "none",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          whiteSpace: "nowrap"
                        }}>
                          Download
                        </a>
                        <button
                          onClick={() => {
                            if (window.electronAPI) {
                              window.electronAPI.openFolder(clip.path);
                            }
                          }}
                          title="Buka Folder"
                          style={{
                            padding: "0.25rem 0.5rem",
                            background: "var(--button-hover)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            cursor: "pointer"
                          }}
                        >
                          📁
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pop-up Mini Re-render */}
                {activeRerenderId === job.id && (
                  <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>Opsi Re-render</h4>
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Aspect Ratio</label>
                        <select value={localAspectRatio} onChange={(e) => setLocalAspectRatio(e.target.value)} style={{ padding: "0.4rem", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                          <option value="9:16">9:16 (TikTok/Reels)</option>
                          <option value="4:5">4:5 (IG Portrait)</option>
                          <option value="1:1">1:1 (Square)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Masukan Subtitle</label>
                        <select value={localBurnSubs ? "yes" : "no"} onChange={(e) => setLocalBurnSubs(e.target.value === "yes")} style={{ padding: "0.4rem", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                          <option value="yes">Ya (Bakar)</option>
                          <option value="no">Tidak</option>
                        </select>
                      </div>
                      {localBurnSubs && (
                        <div>
                          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>Gaya Subtitle</label>
                          <select value={localCaptionStyle} onChange={(e) => setLocalCaptionStyle(e.target.value)} style={{ padding: "0.4rem", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                            <option value="standard">Standard</option>
                            <option value="karaoke">Karaoke (Word-by-word)</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { onRerender(job.id, localAspectRatio, localCaptionStyle, localBurnSubs); setActiveRerenderId(null); }} style={{ padding: "0.4rem 0.75rem", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Mulai Re-render</button>
                      <button onClick={() => setActiveRerenderId(null)} style={{ padding: "0.4rem 0.75rem", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>Batal</button>
                    </div>
                  </div>
                )}

                {/* Pop-up Mini AI Koreksi */}
                {activeAiId === job.id && (
                  <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>✨ AI Koreksi</h4>
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Masukkan instruksi khusus untuk mengulang seleksi AI dari awal klip.</p>
                    <textarea 
                      value={extraPrompt} 
                      onChange={(e) => setExtraPrompt(e.target.value)} 
                      placeholder="Contoh: Fokus cari momen lucu soal coding saja"
                      style={{ width: "100%", height: "60px", padding: "0.5rem", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--border)", marginBottom: "0.5rem", fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => { onRerunAI(job.id, extraPrompt); setActiveAiId(null); setExtraPrompt(""); }} style={{ padding: "0.4rem 0.75rem", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Jalankan AI</button>
                      <button onClick={() => setActiveAiId(null)} style={{ padding: "0.4rem 0.75rem", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}>Batal</button>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {job.result_clips && job.result_clips.length > 0 && (
                    <button
                      onClick={() => setActiveRerenderId(activeRerenderId === job.id ? null : job.id)}
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      🔄 Re-render
                    </button>
                  )}
                  {job.metadata && job.metadata.transcript && (
                    <button
                      onClick={() => setActiveAiId(activeAiId === job.id ? null : job.id)}
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: "var(--button-hover)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--accent)",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      ✨ AI Koreksi
                    </button>
                  )}
                  <button
                    onClick={() => deleteHistory(job.id)}
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: "transparent",
                      color: "#ef4444",
                      border: "1px solid #ef4444",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

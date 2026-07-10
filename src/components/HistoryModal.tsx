import React, { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API_URL } from "../App";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    try {
      await axios.delete(`${API_URL}/history/${jobId}`);
      fetchHistory();
    } catch (e) {
      console.error(e);
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
                      <a key={idx} href={`${API_URL}/video?path=${encodeURIComponent(clip.path)}`} download style={{
                        padding: "0.25rem 0.5rem",
                        background: "var(--accent)",
                        color: "#fff",
                        textDecoration: "none",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        whiteSpace: "nowrap"
                      }}>
                        ⬇️ {clip.description.substring(0, 15)}...
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

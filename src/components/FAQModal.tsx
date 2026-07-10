import React from 'react';

export default function FAQModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
      animation: 'slide-up 0.3s ease-out'
    }}>
      <div className="glass-panel" style={{
        backgroundColor: 'rgba(30, 30, 46, 0.95)',
        padding: '2rem',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        position: 'relative',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary, #a1a1aa)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary, #a1a1aa)'}
        >
          ✕
        </button>
        
        <h2 style={{ marginTop: 0, fontSize: '1.5rem', background: 'linear-gradient(90deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Panduan Auto Clipper
        </h2>
        
        <div style={{ color: 'var(--text-secondary, #a1a1aa)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          <p style={{ marginTop: 0 }}>Cara mudah mengubah video panjang menjadi klip viral vertikal:</p>
          
          <ol style={{ paddingLeft: '1.2rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'white' }}>Masukkan URL YouTube:</strong> Mendukung URL standar, `youtu.be`, dan YouTube Shorts.
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'white' }}>Pilih AI Provider:</strong> Gunakan <strong>OpenAI</strong> (sangat akurat) atau <strong>Gemini</strong> (cepat).
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'white' }}>Masukkan API Key:</strong> Kunci ini disimpan dengan aman di komputer Anda sendiri (Local Storage).
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'white' }}>Generate:</strong> Klik tombol generate, dan AI akan mendeteksi momen paling menarik (highlight) secara otomatis!
            </li>
          </ol>

          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            borderLeft: '4px solid #ef4444',
            borderRadius: '4px'
          }}>
            <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.2rem' }}>⚠️ Catatan Penting</strong>
            Pastikan API Key yang Anda gunakan memiliki saldo/kuota aktif agar AI tidak error saat mendeteksi momen.
          </div>
        </div>
      </div>
    </div>
  );
}

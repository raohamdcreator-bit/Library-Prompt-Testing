// src/components/VideoUploader.jsx
// Drop-zone + progress UI for video uploads.
// Designed to slot into AddResultModal as the "Video" output type.

import { useState, useRef, useCallback } from 'react';
import { Upload, Video, X, CheckCircle, AlertCircle,
         Loader2, Play, FileVideo } from 'lucide-react';
import useVideoUpload, { ACCEPTED_VIDEO_TYPES } from '../hooks/useVideoUpload.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ progress, stage }) {
  const isProcessing = stage === 'processing';

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        height: '6px',
        background: 'rgba(255,255,255,.08)',
        borderRadius: '3px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Processing uses an animated indeterminate bar */}
        {isProcessing ? (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'vup-shimmer 1.5s ease-in-out infinite',
          }} />
        ) : (
          <div style={{
            height: '100%',
            width:  `${progress}%`,
            background: 'var(--primary)',
            borderRadius: '3px',
            transition: 'width .3s ease',
          }} />
        )}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '.35rem',
        fontSize: '.68rem',
        color: 'var(--muted-foreground)',
      }}>
        <span>{isProcessing ? 'Processing on Cloudflare…' : `${progress}%`}</span>
        {!isProcessing && <span>{progress < 100 ? 'Uploading' : 'Complete'}</span>}
      </div>
    </div>
  );
}

function DropZone({ onFileSelect, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragging
          ? 'var(--primary)'
          : 'rgba(139,92,246,.25)'}`,
        borderRadius: '12px',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: isDragging
          ? 'rgba(139,92,246,.06)'
          : 'rgba(139,92,246,.02)',
        transition: 'all .15s ease',
        opacity: disabled ? .5 : 1,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES.join(',')}
        onChange={handleInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px',
        background: 'rgba(139,92,246,.1)',
        border: '1px solid rgba(139,92,246,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1rem',
      }}>
        <FileVideo size={22} color="rgba(139,92,246,.7)" />
      </div>

      <p style={{
        fontSize: '.875rem', fontWeight: 600,
        color: 'var(--foreground)', marginBottom: '.375rem',
      }}>
        {isDragging ? 'Drop video here' : 'Click or drag video here'}
      </p>
      <p style={{ fontSize: '.72rem', color: 'var(--muted-foreground)' }}>
        MP4, WebM, MOV, AVI · Free plan: 25 MB max
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoUploader({
  teamId,
  promptId,
  onSuccess,
  onCancel,
  disabled = false,
  onUploadStart,
  onUploadEnd,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title,        setTitle]        = useState('');

  const {
  stage, progress, error, videoData,
  isActive, stageLabel,
  startUpload, cancelUpload, reset,
} = useVideoUpload({ teamId, promptId, onSuccess });

useEffect(() => {
  if (stage === 'done') onUploadEnd?.();
}, [stage]);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    // Pre-fill title from filename (strip extension)
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setTitle('');
    reset();
  };

 const handleUpload = () => {
  if (!selectedFile) return;
  onUploadStart?.();
  startUpload(selectedFile, title);
};

  const handleCancel = () => {
  cancelUpload();
  onUploadEnd?.();
  onCancel?.();
};

  // ── Done state ─────────────────────────────────────────────────────────────
  if (stage === 'done' && videoData) {
    return (
      <div style={{
        padding: '1.5rem', borderRadius: '12px',
        border: '1px solid rgba(74,222,128,.25)',
        background: 'rgba(74,222,128,.05)',
        textAlign: 'center',
      }}>
        <CheckCircle
          size={36} color="#4ade80"
          style={{ margin: '0 auto .75rem', display: 'block' }}
        />
        <p style={{
          fontSize: '.9rem', fontWeight: 700,
          color: 'var(--foreground)', marginBottom: '.25rem',
        }}>
          Video uploaded successfully!
        </p>
        <p style={{ fontSize: '.75rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
          {videoData.title}
          {videoData.durationSeconds
            ? ` · ${formatDuration(videoData.durationSeconds)}`
            : ''}
        </p>
        {videoData.thumbnailUrl && (
          <img
            src={videoData.thumbnailUrl}
            alt="Video thumbnail"
            style={{
              width: '100%', maxHeight: '160px',
              objectFit: 'contain', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,.08)',
            }}
          />
        )}
      </div>
    );
  }

  // ── Active upload state ────────────────────────────────────────────────────
  if (isActive) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* File info row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '.625rem',
          padding: '.625rem .75rem', borderRadius: '8px',
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.07)',
        }}>
          <Video size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '.8rem', fontWeight: 600,
              color: 'var(--foreground)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedFile?.name}
            </p>
            <p style={{ fontSize: '.68rem', color: 'var(--muted-foreground)', marginTop: '.1rem' }}>
              {formatBytes(selectedFile?.size || 0)}
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.375rem',
            fontSize: '.72rem', color: 'var(--muted-foreground)',
          }}>
            <Loader2 size={13} style={{ animation: 'vup-spin .8s linear infinite' }} />
            {stageLabel}
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar progress={progress} stage={stage} />

        {/* Cancel button */}
        <button
          onClick={handleCancel}
          style={{
            padding: '.5rem',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,.1)',
            background: 'transparent',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            fontSize: '.78rem',
            transition: 'all .15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--foreground)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--muted-foreground)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)';
          }}
        >
          Cancel upload
        </button>
      </div>
    );
  }

  // ── Idle / error state ─────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes vup-spin    { to { transform: rotate(360deg) } }
        @keyframes vup-shimmer {
          0%   { background-position: 200% center }
          100% { background-position: -200% center }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>

        {/* Drop zone — hidden when file selected */}
        {!selectedFile && (
          <DropZone onFileSelect={handleFileSelect} disabled={disabled} />
        )}

        {/* Selected file preview */}
        {selectedFile && stage !== 'done' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.625rem',
            padding: '.625rem .75rem', borderRadius: '8px',
            background: 'rgba(139,92,246,.06)',
            border: '1px solid rgba(139,92,246,.2)',
          }}>
            <Video size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '.8rem', fontWeight: 600, color: 'var(--foreground)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {selectedFile.name}
              </p>
              <p style={{ fontSize: '.68rem', color: 'var(--muted-foreground)', marginTop: '.1rem' }}>
                {formatBytes(selectedFile.size)}
                {' · '}
                {selectedFile.type.split('/')[1].toUpperCase()}
              </p>
            </div>
            <button
              onClick={handleRemoveFile}
              style={{
                width: '24px', height: '24px', borderRadius: '6px',
                background: 'rgba(239,68,68,.1)',
                border: '1px solid rgba(239,68,68,.2)',
                color: '#f87171', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Title input — shown when file is selected */}
        {selectedFile && (
          <div>
            <label style={{
              display: 'block', fontSize: '.65rem', fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase',
              color: 'var(--muted-foreground)', marginBottom: '.4rem',
            }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Give this video a name…"
              maxLength={200}
              style={{
                width: '100%', padding: '.55rem .7rem',
                borderRadius: '8px', fontSize: '.82rem',
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.08)',
                color: 'var(--foreground)', outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit',
                transition: 'border-color .14s',
              }}
              onFocus={e  => { e.target.style.borderColor = 'rgba(139,92,246,.4)'; }}
              onBlur={e   => { e.target.style.borderColor = 'rgba(255,255,255,.08)'; }}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '.5rem',
            padding: '.625rem .75rem', borderRadius: '8px',
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.2)',
          }}>
            <AlertCircle
              size={14} color="#f87171"
              style={{ flexShrink: 0, marginTop: '.1rem' }}
            />
            <p style={{ fontSize: '.78rem', color: '#f87171', margin: 0, lineHeight: 1.5 }}>
              {error}
            </p>
          </div>
        )}

        {/* Upload button */}
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={disabled || !selectedFile}
            style={{
              width: '100%', padding: '.7rem',
              borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '.82rem', fontWeight: 700,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '.45rem',
              background: 'var(--primary)', color: '#fff',
              opacity: (disabled || !selectedFile) ? .45 : 1,
              transition: 'all .14s',
            }}
            onMouseEnter={e => {
              if (!disabled) e.currentTarget.style.opacity = '.85';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Upload size={14} />
            Upload Video
          </button>
        )}

        {/* Plan info note */}
        <p style={{
          fontSize: '.65rem', color: 'var(--muted-foreground)',
          textAlign: 'center', opacity: .7, margin: 0,
        }}>
          Free plan: 2 videos · 25 MB per file · 50 MB total storage
        </p>
      </div>
    </>
  );
}

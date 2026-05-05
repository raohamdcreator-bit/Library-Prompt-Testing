// src/hooks/useVideoUpload.js
// Encapsulates the full 3-step upload state machine:
//   idle → validating → requesting → uploading → processing → done
//                                                            ↘ error

import { useState, useRef, useCallback } from 'react';
import { requestUploadUrl, uploadToCloudflare, waitForVideoReady } from '../lib/videoApi.js';

// Accepted video MIME types
export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime',
  'video/x-msvideo', 'video/mpeg', 'video/ogg',
];

// Human-readable labels for each upload stage
export const STAGE_LABELS = {
  idle:        '',
  validating:  'Checking file…',
  requesting:  'Preparing upload…',
  uploading:   'Uploading to Cloudflare…',
  processing:  'Processing video…',
  done:        'Video ready!',
  error:       '',
};

export default function useVideoUpload({ teamId, promptId, onSuccess }) {
  const [stage,    setStage]    = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error,    setError]    = useState(null);
  const [videoData,setVideoData]= useState(null);

  // Abort controller — lets user cancel mid-upload
  const abortRef = useRef(null);

  /**
   * Validate file before hitting the network.
   * Returns error string or null.
   */
  const validateFile = useCallback((file) => {
    if (!file) return 'Please select a video file';

    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      return `Unsupported format. Accepted: MP4, WebM, MOV, AVI`;
    }

    // 1 GB absolute frontend guard — server enforces plan-specific limits
    if (file.size > 1_073_741_824) {
      return 'File exceeds 1 GB maximum size';
    }

    if (file.size === 0) {
      return 'File appears to be empty';
    }

    return null;
  }, []);

  /**
   * Main upload orchestrator.
   * Runs the full pipeline and updates stage/progress state at each step.
   */
  const startUpload = useCallback(async (file, title) => {
    // Clear any previous state
    setError(null);
    setProgress(0);
    setVideoData(null);

    // ── Step 1: Client-side validation ──────────────────────────────────────
    setStage('validating');
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setStage('error');
      return;
    }

    // Create abort controller for this upload session
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    try {
      // ── Step 2: Request upload URL from your API ─────────────────────────
      setStage('requesting');
      const { videoId, uploadUrl } = await requestUploadUrl({
        file,
        teamId,
        promptId,
        title: title || file.name,
      });

      if (signal.aborted) return;

      // ── Step 3: Upload directly to Cloudflare ────────────────────────────
      setStage('uploading');
      await uploadToCloudflare({
        uploadUrl,
        file,
        signal,
        onProgress: (pct) => setProgress(pct),
      });

      if (signal.aborted) return;

      // ── Step 4: Wait for Cloudflare to process the video ─────────────────
      setStage('processing');
      setProgress(0); // Reset progress bar for processing phase

      const readyData = await waitForVideoReady(
        videoId,
        (status) => {
          // Map CF status to a processing percentage estimate
          const processingPct = {
            uploading:  10,
            processing: 50,
            ready:      100,
          };
          setProgress(processingPct[status] || 0);
        }
      );

      if (signal.aborted) return;

      // ── Step 5: Done ─────────────────────────────────────────────────────
      setStage('done');
      setProgress(100);
      setVideoData(readyData);
      onSuccess?.(readyData);

    } catch (err) {
      if (err.message === 'Upload cancelled') {
        setStage('idle');
        setProgress(0);
        return;
      }
      console.error('Upload pipeline error:', err);
      setError(err.message || 'Upload failed. Please try again.');
      setStage('error');
    }
  }, [teamId, promptId, validateFile, onSuccess]);

  /**
   * Cancel an in-progress upload.
   */
  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setProgress(0);
    setError(null);
  }, []);

  /**
   * Reset to idle state (e.g. "Try again" after error).
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setProgress(0);
    setError(null);
    setVideoData(null);
  }, []);

  const isActive = !['idle', 'done', 'error'].includes(stage);

  return {
    stage,
    progress,
    error,
    videoData,
    isActive,
    stageLabel: STAGE_LABELS[stage] || '',
    startUpload,
    cancelUpload,
    reset,
  };
}

import { useState, useRef, useCallback } from 'react';
import { uploadVideo } from '../lib/videoStorage.js';

export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

export const STAGE_LABELS = {
  idle:       '',
  validating: 'Checking file…',
  uploading:  'Uploading…',
  done:       'Upload complete!',
  error:      '',
};

export default function useVideoUpload({ teamId, promptId, onSuccess, onError }) {
  const [stage,     setStage]     = useState('idle');
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState(null);
  const [videoData, setVideoData] = useState(null);
  const cancelledRef = useRef(false);

  const startUpload = useCallback(async (file, title, userId) => {
  cancelledRef.current = false;
  setError(null);
  setProgress(0);
  setVideoData(null);

  // ── Step 1: Validate locally first (no network needed) ───────────────────
  setStage('validating');

  if (!file) {
    const msg = 'No file selected';
    setError(msg); setStage('error'); onError?.(msg); return;
  }
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    const msg = 'Only MP4 and MOV files are accepted.';
    setError(msg); setStage('error'); onError?.(msg); return;
  }
  if (file.size === 0) {
    const msg = 'File appears to be empty.';
    setError(msg); setStage('error'); onError?.(msg); return;
  }
  if (!userId) {
    const msg = 'You must be signed in to upload videos.';
    setError(msg); setStage('error'); onError?.(msg); return;
  }

  // ── Step 2: Pre-flight check — verify plan limits server-side ────────────
  setStage('requesting');
  try {
    await checkUploadAllowed({ file, teamId });
  } catch (err) {
    setError(err.message);
    setStage('error');
    onError?.(err.message);
    return;
  }

  if (cancelledRef.current) return;

  // ── Step 3: Upload to Firebase Storage ───────────────────────────────────
  setStage('uploading');
  try {
    const result = await uploadVideo({
      file, userId, teamId, promptId, title,
      onProgress: pct => {
        if (!cancelledRef.current) setProgress(pct);
      },
    });

    if (cancelledRef.current) return;

    setStage('done');
    setProgress(100);
    setVideoData(result);
    onSuccess?.(result);

  } catch (err) {
    if (cancelledRef.current) return;
    setError(err.message);
    setStage('error');
    onError?.(err.message);
  }
}, [teamId, promptId, onSuccess, onError]);

  const cancelUpload = useCallback(() => {
    cancelledRef.current = true;
    setStage('idle');
    setProgress(0);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setStage('idle');
    setProgress(0);
    setError(null);
    setVideoData(null);
  }, []);

  return {
    stage,
    progress,
    error,
    videoData,
    isActive:   stage === 'uploading',
    stageLabel: STAGE_LABELS[stage] || '',
    startUpload,
    cancelUpload,
    reset,
  };
}

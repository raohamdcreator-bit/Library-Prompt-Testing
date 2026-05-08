import { auth } from './firebase.js';

async function getIdToken() {
  const user = await new Promise((resolve, reject) => {
    const unsub = auth.onAuthStateChanged(
      u => { unsub(); resolve(u); },
      err => { unsub(); reject(err); }
    );
  });
  if (!user) throw new Error('You must be signed in to upload videos');
  return user.getIdToken(false);
}

// Pre-flight check — verifies plan limits before starting upload
export async function checkUploadAllowed({ file, teamId }) {
  const token = await getIdToken();

  const res = await fetch('/api/video/request-upload', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName:      file.name,
      fileSizeBytes: file.size,
      mimeType:      file.type,
      teamId,
    }),
  });

  let data;
  try { data = await res.json(); }
  catch { throw new Error(`Server error (HTTP ${res.status})`); }

  if (!res.ok || !data.success) {
    throw new Error(data.error || `Upload not allowed (${res.status})`);
  }

  return data;
}

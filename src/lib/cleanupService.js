import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function cleanupExpiredInvites() {
  const invitesRef = collection(db, 'team-invites');
  const q = query(invitesRef, where('status', '==', 'pending'));
  
  const snapshot = await getDocs(q);
  const now = Timestamp.now();
  
  const updates = [];
  
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
      updates.push(
        updateDoc(doc(db, 'team-invites', docSnap.id), {
          status: 'expired',
          expiredAt: Timestamp.now(),
        })
      );
    }
  });
  
  await Promise.all(updates);
  return { cleaned: updates.length };
}

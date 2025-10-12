// src/lib/user.js
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function createUserDoc(user) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  await setDoc(ref, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    lastSeen: serverTimestamp()
  }, { merge: true });
}

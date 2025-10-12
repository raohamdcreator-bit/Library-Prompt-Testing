import { setDoc, doc, serverTimestamp, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { nanoid } from "nanoid";

export async function createInvite(teamId, inviterUid) {
  const token = nanoid(20);
  await setDoc(doc(db, "teamInvites", token), {
    teamId,
    inviterUid,
    role: "member",
    used: false,
    createdAt: serverTimestamp()
  });
  return token;
}

export async function acceptInvite(token, user) {
  const inviteRef = doc(db, "teamInvites", token);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error("Invalid invite");
  const data = snap.data();

  if (data.used) throw new Error("Invite already used");

  // add user to team
  const teamRef = doc(db, "teams", data.teamId);
  await updateDoc(teamRef, { [`members.${user.uid}`]: data.role });

  await updateDoc(inviteRef, { used: true, usedBy: user.uid, usedAt: serverTimestamp() });

  return data.teamId;
}

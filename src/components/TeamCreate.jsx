import { useState } from "react";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function TeamCreate({ onCreated }) {
  const [name, setName] = useState("");
  const { user } = useAuth();

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;

    // create team
    const teamRef = await addDoc(collection(db, "teams"), {
      name,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      members: { [user.uid]: "owner" },
    });

    if (onCreated) onCreated(teamRef.id);
    setName("");
  }

  return (
    <form onSubmit={handleCreate} className="p-2 border rounded">
      <input
        type="text"
        placeholder="Team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-1 mr-2"
      />
      <button
        type="submit"
        className="bg-blue-500 text-white px-3 py-1 rounded"
      >
        Create Team
      </button>
    </form>
  );
}

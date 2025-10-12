// src/components/TeamSelector.jsx
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export default function TeamSelector({ activeTeam, onSelect }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "teams"),
      where(`members.${user.uid}`, "!=", null)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeams(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (!user) return <p className="p-2">Login to see teams</p>;
  if (loading) return <p className="p-2">Loading teams...</p>;

  return (
    <div className="space-y-2">
      {teams.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            onSelect(t.id);
            localStorage.setItem("activeTeam", t.id); // 🔑 save selected team
          }}
          className={`block px-3 py-2 border rounded w-full text-left ${
            activeTeam === t.id ? "bg-blue-100" : ""
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

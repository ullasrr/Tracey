"use client";

import { useAuth } from "@/lib/useAuth";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-4">
      {user ? (
        <p>Logged in as UID: {user.uid}</p>
      ) : (
        <p>Not logged in</p>
      )}
    </div>
  );
}

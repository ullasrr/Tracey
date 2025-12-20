"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { createUserIfNotExists } from "@/lib/createUser";
import { createTestItem } from "@/lib/createItem";

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) createUserIfNotExists(user);
  }, [user]);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <p>{user ? "User stored in Firestore" : "Not logged in"}</p>

      {user && (
        <button
          onClick={() => createTestItem(user.uid)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white"
        >
          Create Test Item
        </button>
      )}
    </div>
  );
}

"use client";

import { useAuth } from "@/lib/useAuth";
import FoundItemForm from "@/components/FoundItemForm";

export default function FoundPage() {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Please log in</p>;

  return <FoundItemForm uid={user.uid} />;
}

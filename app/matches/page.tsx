"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Match {
  id: string;
  lostItemId: string;
  foundItemId: string;
  lostItemUserId: string;
  foundItemUserId: string;
  lostItemCategory: string;
  lostItemDescription: string;
  foundItemDescription: string;
  similarityScore: number;
  status: "pending" | "claimed" | "dismissed";
  notificationSent: boolean;
  emailSent: boolean;
  createdAt: Timestamp;
  viewedAt: Timestamp | null;
}

export default function MatchesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for matches
    const matchesQuery = query(
      collection(db, "matches"),
      where("lostItemUserId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      matchesQuery,
      (snapshot) => {
        const matchesData = snapshot.docs.map((doc) => {
          return {
            id: doc.id,
            ...doc.data(),
          };
        }) as Match[];

        // Sort by newest first
        matchesData.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setMatches(matchesData);
        setLoadingMatches(false);

        // Mark unviewed matches as viewed
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.viewedAt) {
            updateDoc(doc(db, "matches", docSnap.id), {
              viewedAt: Timestamp.now(),
            }).catch(err => console.error("[Matches] Error marking viewed:", err));
          }
        });
      },
      (error) => {
        console.error("[Matches] Snapshot error:", error);
        setLoadingMatches(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleClaim = async (matchId: string) => {
    try {
      await updateDoc(doc(db, "matches", matchId), {
        status: "claimed",
      });
      alert("Match claimed! You can now coordinate with the finder.");
    } catch (error) {
      console.error("Error claiming match:", error);
      alert("Failed to claim match. Please try again.");
    }
  };

  const handleDismiss = async (matchId: string) => {
    try {
      await updateDoc(doc(db, "matches", matchId), {
        status: "dismissed",
      });
    } catch (error) {
      console.error("Error dismissing match:", error);
      alert("Failed to dismiss match. Please try again.");
    }
  };

  if (loading || loadingMatches) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🎯 Your Matches
          </h1>
          <p className="text-gray-600">
            AI-powered matches for your lost items
          </p>
        </div>

        {/* Matches List */}
        {matches.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              No matches yet
            </h2>
            <p className="text-gray-600 mb-6">
              When someone reports finding an item that matches yours, it will appear here.
            </p>
            <button
              onClick={() => router.push("/search")}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
            >
              Report Lost Item
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className={`bg-white rounded-lg shadow-md p-6 transition-all ${
                  match.status === "dismissed" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Match Badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full font-bold text-lg">
                        {(match.similarityScore * 100).toFixed(0)}% Match
                      </div>
                      {match.status === "claimed" && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                          ✓ Claimed
                        </span>
                      )}
                      {match.status === "dismissed" && (
                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                          Dismissed
                        </span>
                      )}
                      {!match.viewedAt && (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>

                    {/* Item Details */}
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        {match.lostItemCategory || "Item"}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <p className="text-sm font-semibold text-purple-800 mb-1">
                            Your Description:
                          </p>
                          <p className="text-sm text-gray-700">
                            {match.lostItemDescription || "No description"}
                          </p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm font-semibold text-blue-800 mb-1">
                            Found Item:
                          </p>
                          <p className="text-sm text-gray-700">
                            {match.foundItemDescription || "No description"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <p className="text-sm text-gray-500">
                      Matched {match.createdAt?.toDate().toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {match.status === "pending" && (
                  <div className="flex gap-3 mt-4 pt-4 border-t">
                    <button
                      onClick={() => handleClaim(match.id)}
                      className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                      ✓ This is My Item
                    </button>
                    <button
                      onClick={() => handleDismiss(match.id)}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                      Not My Item
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

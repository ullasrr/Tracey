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

    // Real-time listener for matches - get matches where user is EITHER owner OR finder
    const matchesAsOwnerQuery = query(
      collection(db, "matches"),
      where("lostItemUserId", "==", user.uid)
    );

    const matchesAsFinderQuery = query(
      collection(db, "matches"),
      where("foundItemUserId", "==", user.uid)
    );

    const allMatches = new Map<string, Match>();

    const updateMatchesFromSnapshot = (snapshot: any) => {
      snapshot.docs.forEach((docSnap: any) => {
        const matchData = {
          id: docSnap.id,
          ...docSnap.data(),
        } as Match;
        allMatches.set(docSnap.id, matchData);

        // Mark unviewed matches as viewed
        if (!docSnap.data().viewedAt) {
          updateDoc(doc(db, "matches", docSnap.id), {
            viewedAt: Timestamp.now(),
          }).catch(() => {});
        }
      });

      // Convert map to array and sort
      const matchesArray = Array.from(allMatches.values());
      matchesArray.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setMatches(matchesArray);
      setLoadingMatches(false);
    };

    // Subscribe to both queries
    const unsubscribeOwner = onSnapshot(
      matchesAsOwnerQuery,
      updateMatchesFromSnapshot,
      () => {
        setLoadingMatches(false);
      }
    );

    const unsubscribeFinder = onSnapshot(
      matchesAsFinderQuery,
      updateMatchesFromSnapshot,
      () => {
        setLoadingMatches(false);
      }
    );

    return () => {
      unsubscribeOwner();
      unsubscribeFinder();
    };
  }, [user]);

  const handleClaim = async (matchId: string) => {
    if (!user) return;
    
    try {
      // Use API to claim match (server-side with admin SDK bypasses permissions)
      const response = await fetch("/api/claim-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          matchId, 
          userId: user.uid 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to claim match");
      }
      
      alert("Match claimed! You can now coordinate with the finder.");
    } catch (error) {
      alert("Failed to claim match. Please try again.");
    }
  };

  const handleDismiss = async (matchId: string) => {
    try {
      await updateDoc(doc(db, "matches", matchId), {
        status: "dismissed",
      });
    } catch (error) {
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
        {/* Back Button */}
        <button
          onClick={() => router.push("/")}
          className="mb-4 text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-2"
        >
          ← Back to Home
        </button>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Your Matches
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
                onClick={() => router.push(`/matches/${match.id}`)}
                className={`bg-white rounded-lg shadow-md p-6 transition-all cursor-pointer hover:shadow-lg ${
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaim(match.id);
                      }}
                      className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                      ✓ This is My Item
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(match.id);
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                      Not My Item
                    </button>
                  </div>
                )}

                {/* View Details for Claimed Matches */}
                {match.status === "claimed" && (
                  <div className="mt-4 pt-4 border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/matches/${match.id}`);
                      }}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition flex items-center justify-center gap-2"
                    >
                      View Details & Contact via WhatsApp
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

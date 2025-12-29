"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
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
  createdAt: Timestamp;
  viewedAt: Timestamp | null;
}

interface Item {
  id: string;
  category?: string;
  description?: string;
  aiDescription?: string;
  imageUrl?: string;
  location?: { lat: number; lng: number };
  createdAt: Timestamp;
}

export default function MatchDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = params?.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [lostItem, setLostItem] = useState<Item | null>(null);
  const [foundItem, setFoundItem] = useState<Item | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !matchId) return;

    const loadMatchDetails = async () => {
      try {
        // Get match
        const matchDoc = await getDoc(doc(db, "matches", matchId));
        if (!matchDoc.exists()) {
          alert("Match not found");
          router.push("/matches");
          return;
        }

        const matchData = { id: matchDoc.id, ...matchDoc.data() } as Match;

        // Verify user owns this match
        if (matchData.lostItemUserId !== user.uid) {
          alert("Unauthorized");
          router.push("/matches");
          return;
        }

        setMatch(matchData);

        // Mark as viewed
        if (!matchData.viewedAt) {
          await updateDoc(doc(db, "matches", matchId), {
            viewedAt: Timestamp.now(),
          });
        }

        // Get lost item
        const lostItemDoc = await getDoc(doc(db, "items", matchData.lostItemId));
        if (lostItemDoc.exists()) {
          setLostItem({ id: lostItemDoc.id, ...lostItemDoc.data() } as Item);
        }

        // Get found item
        const foundItemDoc = await getDoc(doc(db, "items", matchData.foundItemId));
        if (foundItemDoc.exists()) {
          setFoundItem({ id: foundItemDoc.id, ...foundItemDoc.data() } as Item);
        }

        setLoadingData(false);
      } catch (error) {
        console.error("Error loading match:", error);
        alert("Failed to load match details");
        router.push("/matches");
      }
    };

    loadMatchDetails();
  }, [user, matchId, router]);

  const handleClaim = async () => {
    if (!match) return;
    try {
      await updateDoc(doc(db, "matches", match.id), {
        status: "claimed",
      });
      setMatch({ ...match, status: "claimed" });
      alert("Match claimed! You can now coordinate with the finder.");
    } catch (error) {
      console.error("Error claiming match:", error);
      alert("Failed to claim match.");
    }
  };

  const handleDismiss = async () => {
    if (!match) return;
    try {
      await updateDoc(doc(db, "matches", match.id), {
        status: "dismissed",
      });
      router.push("/matches");
    } catch (error) {
      console.error("Error dismissing match:", error);
      alert("Failed to dismiss match.");
    }
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match || !lostItem || !foundItem) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <p className="text-gray-600">Match not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-5xl mx-auto py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push("/matches")}
          className="mb-4 text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-2"
        >
          ← Back to Matches
        </button>

        {/* Match Score Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-center">
          <div className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-full font-bold text-3xl mb-3">
            {(match.similarityScore * 100).toFixed(0)}% Match
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {match.lostItemCategory || "Item"} Found!
          </h1>
          <p className="text-gray-600">
            Matched on {match.createdAt?.toDate().toLocaleString()}
          </p>
          {match.status === "claimed" && (
            <div className="mt-3 bg-green-100 text-green-800 px-4 py-2 rounded-full inline-block font-semibold">
              ✓ Claimed
            </div>
          )}
        </div>

        {/* Item Comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Lost Item */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-purple-600 mb-4">
              Your Lost Item
            </h2>
            {lostItem.imageUrl && (
              <img
                src={lostItem.imageUrl}
                alt="Lost item"
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
            )}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-600">Category:</p>
                <p className="text-gray-800">{lostItem.category || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Your Description:</p>
                <p className="text-gray-800">{lostItem.description || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">AI Analysis:</p>
                <p className="text-gray-800">{lostItem.aiDescription || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Reported:</p>
                <p className="text-gray-800">{lostItem.createdAt?.toDate().toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Found Item */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-blue-600 mb-4">
              Found Item
            </h2>
            {foundItem.imageUrl && (
              <img
                src={foundItem.imageUrl}
                alt="Found item"
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
            )}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-600">Category:</p>
                <p className="text-gray-800">{foundItem.category || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Finder's Description:</p>
                <p className="text-gray-800">{foundItem.description || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">AI Analysis:</p>
                <p className="text-gray-800">{foundItem.aiDescription || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Found:</p>
                <p className="text-gray-800">{foundItem.createdAt?.toDate().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {match.status === "pending" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Is this your item?
            </h3>
            <div className="flex gap-4">
              <button
                onClick={handleClaim}
                className="flex-1 bg-green-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-green-700 transition text-lg"
              >
                ✓ Yes, This is My Item
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-4 rounded-lg font-semibold hover:bg-gray-300 transition text-lg"
              >
                Not My Item
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

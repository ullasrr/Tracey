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

interface UserDetails {
  email: string;
  displayName?: string;
  phoneNumber?: string;
}

export default function MatchDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = params?.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [lostItem, setLostItem] = useState<Item | null>(null);
  const [foundItem, setFoundItem] = useState<Item | null>(null);
  const [lostItemOwner, setLostItemOwner] = useState<UserDetails | null>(null);
  const [finderDetails, setFinderDetails] = useState<UserDetails | null>(null);
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

        // Verify user is part of this match (either owner or finder)
        if (matchData.lostItemUserId !== user.uid && matchData.foundItemUserId !== user.uid) {
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
        // Get lost item owner details (for finder to contact)
        const ownerDoc = await getDoc(doc(db, "users", matchData.lostItemUserId));
        if (ownerDoc.exists()) {
          const ownerData = ownerDoc.data();
          setLostItemOwner({
            email: ownerData.email || "",
            displayName: ownerData.displayName || ownerData.name || "Unknown User",
            phoneNumber: ownerData.phoneNumber || undefined,
          });
        }

        // Get finder details (for owner to contact)
        const finderDoc = await getDoc(doc(db, "users", matchData.foundItemUserId));
        if (finderDoc.exists()) {
          const finderData = finderDoc.data();
          setFinderDetails({
            email: finderData.email || "",
            displayName: finderData.displayName || finderData.name || "Unknown User",
            phoneNumber: finderData.phoneNumber || undefined,
          });
        }

        
        setLoadingData(false);
      } catch (error) {
        alert("Failed to load match details");
        router.push("/matches");
      }
    };

    loadMatchDetails();
  }, [user, matchId, router]);

  const handleClaim = async () => {
    if (!match || !user) return;
    try {
      // Use API to claim match (server-side with admin SDK bypasses permissions)
      const response = await fetch("/api/claim-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          matchId: match.id, 
          userId: user.uid 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to claim match");
      }
      
      setMatch({ ...match, status: "claimed" });
      alert("Match claimed! The finder can now see your contact details to coordinate the return.");
      // Reload match details to ensure all data is fresh
      window.location.reload();
    } catch (error) {
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

        {/* Contact Details Section (Only for Finder after Confirmation) */}
        {match.status === "claimed" && user?.uid === match.foundItemUserId && lostItemOwner && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
              Owner Contact Details
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-gray-700">
                <div className="text-2xl">👤</div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="font-semibold text-gray-900">{lostItemOwner.displayName || "Not provided"}</p>
                </div>
              </div>

              {lostItemOwner.phoneNumber ? (
                <>
                  <div className="flex items-start gap-3 text-gray-700">
                    <div className="text-2xl">📱</div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="font-semibold text-gray-900">{lostItemOwner.phoneNumber}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const cleanNumber = lostItemOwner.phoneNumber!.replace(/[^\d+]/g, '');
                      const message = encodeURIComponent("Hi! I found your item through Tracey. Let's arrange the return.");
                      window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
                    }}
                    className="w-full mt-4 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-md flex items-center justify-center gap-2 text-lg"
                  >
                    <span className="text-2xl">💬</span>
                    Contact via WhatsApp
                  </button>
                </>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-2">
                  <p className="text-sm text-yellow-800">
                    The owner hasn't added their phone number yet. Please ask them to update their profile.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> Please coordinate a safe location to return the item to its owner.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info for Finder before Confirmation */}
        {match.status === "pending" && user?.uid === match.foundItemUserId && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg shadow-md p-6 mb-6">
            <p className="text-blue-900 font-medium">
              <strong>Waiting for confirmation:</strong> The owner needs to confirm this is their item before you can see their contact details.
            </p>
          </div>
        )}

        {/* Actions */}
        {match.status === "pending" && user?.uid === match.lostItemUserId && (
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

        {/* Contact Details Section for Owner to Contact Finder */}
        {match.status === "claimed" && user?.uid === match.lostItemUserId && finderDetails && (
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
              Finder Contact Details
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-gray-700">
                <div className="text-2xl">👤</div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="font-semibold text-gray-900">{finderDetails.displayName || "Not provided"}</p>
                </div>
              </div>

              {finderDetails.phoneNumber ? (
                <>
                  <div className="flex items-start gap-3 text-gray-700">
                    <div className="text-2xl">📱</div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="font-semibold text-gray-900">{finderDetails.phoneNumber}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const cleanNumber = finderDetails.phoneNumber!.replace(/[^\d+]/g, '');
                      const message = encodeURIComponent("Hi! I saw you found my item on Tracey. Can we arrange a time to meet?");
                      window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
                    }}
                    className="w-full mt-4 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-md flex items-center justify-center gap-2 text-lg"
                  >
                    <span className="text-2xl">💬</span>
                    Contact Finder via WhatsApp
                  </button>
                </>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-2">
                  <p className="text-sm text-yellow-800">
                    The finder hasn't added their phone number yet. Please ask them to update their profile.
                  </p>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-green-800">
                  <strong>Success!</strong> Contact the finder to coordinate picking up your item.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

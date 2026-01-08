"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, Timestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

const MapViewer = dynamic(() => import("@/components/MapViewer"), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] w-full bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
});

interface Item {
  id: string;
  type: string;
  status: string;
  category?: string;
  aiDescription?: string;
  colorTags?: string[];
  imageUrl?: string;
  images?: string[];
  location?: { lat: number; lng: number };
  createdBy: string;
  createdAt: Timestamp;
}

interface FinderDetails {
  displayName?: string;
  phoneNumber?: string;
  email?: string;
}

export default function ItemDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const itemId = params?.itemId as string;

  const [item, setItem] = useState<Item | null>(null);
  const [finderDetails, setFinderDetails] = useState<FinderDetails | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!itemId) return;

    const loadItemDetails = async () => {
      try {
        const itemDoc = await getDoc(doc(db, "items", itemId));
        if (!itemDoc.exists()) {
          alert("Item not found");
          router.push("/search");
          return;
        }

        const itemData = itemDoc.data();
        
        // Get image URL (handle both imageUrl and images array)
        const getImageUrl = (data: any): string | undefined => {
          if (data.imageUrl) return data.imageUrl;
          if (data.images && data.images.length > 0) return data.images[0];
          return undefined;
        };

        setItem({
          id: itemDoc.id,
          ...itemData,
          imageUrl: getImageUrl(itemData),
        } as Item);

        // Set up real-time listener for finder details
        const unsubscribeFinder = onSnapshot(doc(db, "users", itemData.createdBy), (finderDoc) => {
          if (finderDoc.exists()) {
            const finderData = finderDoc.data();
            setFinderDetails({
              displayName: finderData.displayName || finderData.name || "Anonymous",
              phoneNumber: finderData.phoneNumber || undefined,
              email: finderData.email || undefined,
            });
          }
        });

        setLoadingData(false);

        return () => unsubscribeFinder();
      } catch (error) {
        alert("Failed to load item details");
        router.push("/search");
      }
    };

    loadItemDetails();
  }, [itemId, router]);

  const handleClaimAndContact = async () => {
    if (!user) {
      alert("Please log in to claim this item");
      router.push("/auth/login");
      return;
    }

    if (!item) return;

    // Check if claiming own item
    if (item.createdBy === user.uid) {
      alert("This is your own found item!");
      return;
    }

    if (!finderDetails?.phoneNumber) {
      alert("The finder hasn't added their phone number yet. Please try again later.");
      return;
    }

    setClaiming(true);

    try {
      // Use API route to create match (bypasses Firestore security rules)
      const response = await fetch("/api/claim-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to claim item");
      }

      // Open WhatsApp
      const cleanNumber = finderDetails.phoneNumber.replace(/[^\d+]/g, '');
      const message = encodeURIComponent(
        `Hi! I found my ${item.category || 'item'} that you reported on Tracey. Can we arrange a time to meet?`
      );
      window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');

      alert("Claim recorded! You can also view this in your Matches page.");
      router.push("/matches");
    } catch (error: any) {
      alert(error.message || "Failed to claim item. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading item details...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <p className="text-gray-600">Item not found</p>
        </div>
      </div>
    );
  }

  const isOwnItem = user?.uid === item.createdBy;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push("/search")}
          className="mb-4 text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-2 cursor-pointer"
        >
          ← Back to Search
        </button>

        {/* Item Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center">
            <span className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold text-sm mb-3">
              Found Item
            </span>
            <h1 className="text-2xl font-bold text-gray-800">
              {item.category || "Unknown Item"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Reported on {item.createdAt?.toDate().toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Item Image */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Item Photo</h2>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt="Found item"
              className="w-full h-72 object-cover rounded-lg blur-md"
            />
          ) : (
            <div className="w-full h-72 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
              No image available
            </div>
          )}
        </div>

        {/* Location Map */}
        {item.location && item.location.lat && item.location.lng && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span>📍</span> Where It Was Found
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              The finder reported finding this item at the location shown below.
            </p>
            <MapViewer 
              lat={item.location.lat} 
              lng={item.location.lng}
              label="Item was found here"
            />
            <div className="mt-3 text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span>Coordinates:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">
                {item.location.lat.toFixed(6)}, {item.location.lng.toFixed(6)}
              </code>
              <button
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps?q=${item.location!.lat},${item.location!.lng}`,
                    '_blank'
                  );
                }}
                className="ml-auto text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                Open in Google Maps →
              </button>
            </div>
          </div>
        )}

        {/* Finder Details */}
        {finderDetails && !isOwnItem && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
              <span>👤</span> Finder Details
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-700">
                <span className="text-xl">👤</span>
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-semibold">{finderDetails.displayName || "Anonymous"}</p>
                </div>
              </div>

              {finderDetails.phoneNumber ? (
                <div className="flex items-center gap-3 text-gray-700">
                  <span className="text-xl">📱</span>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-semibold">{finderDetails.phoneNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    The finder hasn't added their phone number yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Own Item Notice */}
        {isOwnItem && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 text-center">
            <p className="text-blue-800 font-medium">
              This is your own found item. You cannot claim it.
            </p>
          </div>
        )}

        {/* Claim Button */}
        {!isOwnItem && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              Is this your item?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              If you recognize this as your lost item, click below to claim it and contact the finder via WhatsApp.
            </p>
            <button
              onClick={handleClaimAndContact}
              disabled={claiming || !finderDetails?.phoneNumber}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-lg cursor-pointer"
            >
              {claiming ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <span>✓</span>
                  Claim & Contact via WhatsApp
                </>
              )}
            </button>
            {!finderDetails?.phoneNumber && (
              <p className="text-sm text-orange-600 text-center mt-2">
                Finder hasn't added phone number yet. Check back later.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

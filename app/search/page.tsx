"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import imageCompression from "browser-image-compression";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import MapPicker from "@/components/MapPicker";
import { registerFcmToken } from "@/lib/firebase-messaging";

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Lost item upload states
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLocation, setUploadLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  
  // Notification preference states
  const [checkingPrefs, setCheckingPrefs] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [userDeclined, setUserDeclined] = useState(false);

  // Check push preferences when user clicks "Report Lost Item"
  const handleReportLostClick = async () => {
    if (!user) {
      alert("Please log in to report a lost item");
      return;
    }

    setCheckingPrefs(true);
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const isPushEnabled = userData?.notificationPreferences?.pushEnabled ?? false;
        const hasDeclined = userData?.notificationPreferences?.userDeclined ?? false;
        setPushEnabled(isPushEnabled);
        setUserDeclined(hasDeclined);
        
        // If push not enabled and user hasn't declined, show notification prompt
        if (!isPushEnabled && !hasDeclined) {
          setShowNotificationPrompt(true);
        } else {
          // Push is enabled or user already declined, go straight to form
          setShowUploadForm(true);
        }
      } else {
        // User doc doesn't exist, show notification prompt
        setShowNotificationPrompt(true);
      }
    } catch (err) {
      // On error, proceed with form
      setShowUploadForm(true);
    } finally {
      setCheckingPrefs(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!user) return;
    
    try {
      // Check if permission was previously denied
      if (Notification.permission === "denied") {
        alert(
          "Notifications are blocked. To enable them:\n\n" +
          "1. Click the lock icon (🔒) in your browser's address bar\n" +
          "2. Find 'Notifications' settings\n" +
          "3. Change it to 'Allow'\n" +
          "4. Refresh the page and try again"
        );
        return;
      }

      await registerFcmToken();
      // Save to Firestore: pushEnabled = true, userDeclined = false
      await setDoc(
        doc(db, "users", user.uid),
        { notificationPreferences: { pushEnabled: true, userDeclined: false } },
        { merge: true }
      );
      alert("Notifications enabled! You'll be notified when someone finds a matching item.");
      setPushEnabled(true);
      setUserDeclined(false);
      setShowNotificationPrompt(false);
      setShowUploadForm(true);
    } catch (err) {
      // Check if it's a permission issue
      if (Notification.permission === "denied") {
        alert(
          "Notifications are blocked in your browser settings. To enable:\n\n" +
          "1. Click the lock/info icon in the address bar\n" +
          "2. Change Notifications to 'Allow'\n" +
          "3. Refresh and try again"
        );
      } else {
        alert("Failed to enable notifications. Please try again.");
      }
    }
  };

  const handleSkipNotifications = async () => {
    if (!user) return;
    
    // Save to Firestore: pushEnabled = false, userDeclined = true
    await setDoc(
      doc(db, "users", user.uid),
      { notificationPreferences: { pushEnabled: false, userDeclined: true } },
      { merge: true }
    );
    setUserDeclined(true);
    setShowNotificationPrompt(false);
    setShowUploadForm(true);
  };

  // Helper: Convert file to Base64
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async () => {
    if (!query && !selectedImage) return;

    setLoading(true);
    setHasSearched(false);
    setResults([]);

    try {
      const res = await fetch("/api/search-items", { // Ensure this matches your route folder name
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            query: query,
            searchImage: selectedImage // Send the image if it exists
        }),
      });

      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      // Search failed
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadLostItem = async () => {
    if (!uploadFile || !uploadLocation || !user) {
      alert("Please upload a photo and select a location");
      return;
    }

    setUploading(true);

    try {
      const compressed = await imageCompression(uploadFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
      });

      const imageUrl = await uploadToCloudinary(compressed as File);

      const docRef = await addDoc(collection(db, "items"), {
        type: "lost",
        status: "open",
        images: [imageUrl],
        blurredImages: [],
        userDescription: uploadDescription,
        aiDescription: "",
        category: "unknown",
        colorTags: [],
        embedding: [],
        location: uploadLocation,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Ensure FCM token is registered before AI analysis
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          await registerFcmToken();
        }
      } catch (tokenErr) {
        // Silent fail - FCM is optional
      }

      // Wait for AI analysis to complete
      try {
        const analyzeResponse = await fetch("/api/analyze-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: docRef.id,
            imageUrl,
          }),
        });

        if (analyzeResponse.ok) {
          // After AI analysis completes, trigger auto-match for lost items
          try {
            await fetch("/api/auto-match-lost", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: docRef.id }),
            });
          } catch (matchErr) {
            // Silent fail - matching is async
          }
        }
      } catch (apiErr) {
        // Silent fail - AI analysis error
      }

      // Success! Reset form and show message
      alert("Lost item reported successfully! You'll be notified when someone finds a matching item.");
      setShowUploadForm(false);
      setUploadFile(null);
      setUploadLocation(null);
      setUploadDescription("");
    } catch (err) {
      alert("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">Find Your Lost Item</h1>
      
      {/* --- Loading while checking preferences --- */}
      {checkingPrefs && (
        <div className="p-8 bg-white rounded-xl border text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      )}

      {/* --- Notification Prompt (shown before lost item form) --- */}
      {!checkingPrefs && showNotificationPrompt && !showUploadForm && (
        <div className="p-6 bg-white rounded-xl border-2 border-red-200 shadow-lg">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🔔</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Enable Notifications
            </h2>
            <p className="text-gray-600">
              Before you report your lost item, would you like to enable notifications?
            </p>
          </div>

          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">📱</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Why Enable Notifications?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Get notified instantly when someone finds an item matching yours! 
                  This greatly increases your chances of recovering your lost item.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleEnableNotifications}
              className="w-full px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
            >
              Enable Notifications
            </button>
            <button
              onClick={handleSkipNotifications}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Skip for Now
            </button>
          </div>
        </div>
      )}

      {/* --- Report Lost Item Button --- */}
      {!checkingPrefs && !showUploadForm && !showNotificationPrompt && (
        <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
          <div className="text-center mb-3">
            <div className="text-3xl mb-1">📢</div>
            <p className="text-sm text-gray-700 font-medium">
              Report a lost item to get notified when someone finds it
            </p>
          </div>
          <button
            onClick={handleReportLostClick}
            className="w-full px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors cursor-pointer shadow-md"
          >
            Report Lost Item
          </button>
        </div>
      )}

      {/* --- Upload Lost Item Form --- */}
      {showUploadForm && (
        <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Report Your Lost Item</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Photo *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Add any additional details..."
                className="w-full border border-gray-300 p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Where did you lose it? *
              </label>
              <MapPicker onSelect={(lat, lng) => setUploadLocation({ lat, lng })} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUploadLostItem}
                disabled={uploading || !uploadFile || !uploadLocation}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-md"
              >
                {uploading ? "Uploading..." : "Submit Lost Item"}
              </button>
              <button
                onClick={() => setShowUploadForm(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Search Inputs --- */}
      {!checkingPrefs && !showUploadForm && !showNotificationPrompt && (
        <>
          <div className="text-center">
            <div className="inline-block px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600 mb-4">
              Or search for already found items
            </div>
          </div>
          
          <div className="space-y-3">
            {/* Text Input */}
            <input
              className="w-full border p-3 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Describe the lost item (e.g., 'Black leather wallet')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">OR</span>
            {/* Image Input */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
        </div>

        {/* Image Preview */}
        {selectedImage && (
            <div className="relative w-24 h-24 mt-2">
                <img src={selectedImage} alt="Preview" className="w-full h-full object-cover rounded-md border" />
                <button 
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-xs"
                >
                    ✕
                </button>
            </div>
        )}

        <button
          onClick={handleSearch}
          disabled={loading || (!query && !selectedImage)}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>        </>
      )}
      {/* --- Results Section --- */}
      <div className="space-y-4">
        {loading && <p className="text-center text-gray-500">Analyzing database...</p>}

        {!loading && hasSearched && results.length === 0 && (
            <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed">
                <p className="text-gray-600 font-medium">No results found.</p>
                <p className="text-sm text-gray-400 mt-1">Try changing your description or searching with a different photo.</p>
            </div>
        )}

        {results.map((item) => (
          <div key={item.id} className="border p-4 rounded-lg shadow-sm flex gap-4 hover:shadow-md transition bg-white">
            <img
              src={item.blurredImages?.length ? item.blurredImages[0] : (item.images?.[0] || "/placeholder.png")}
              className="w-24 h-24 object-cover rounded-md shrink-0"
              alt="Item"
            />
            <div className="flex-1">
              <p className="font-semibold text-lg text-gray-800">{item.category}</p>
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">{item.aiDescription}</p>
              <div className="mt-2 flex gap-2">
                {item.colorTags?.map((c: string) => (
                    <span key={c} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{c}</span>
                ))}
                {/* Debug Score */}
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Match: {(item.score * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
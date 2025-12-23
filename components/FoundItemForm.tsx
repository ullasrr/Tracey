"use client";

import { useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import MapPicker from "@/components/MapPicker";
import { registerFcmToken } from "@/lib/firebase-messaging";

export default function FoundItemForm({ uid }: { uid: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [itemSubmitted, setItemSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!file || !location) {
        alert("Image and location required");
        return;
    }

    setLoading(true);

    try {
        const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        });

        const imageUrl = await uploadToCloudinary(compressed as File);

        const docRef = await addDoc(collection(db, "items"), {
        type: "found",
        status: "open",

        images: [imageUrl],
        blurredImages: [],

        aiDescription: "",
        category: "unknown",
        colorTags: [],
        embedding: [],

        location,
        createdBy: uid,
        createdAt: serverTimestamp(),
        });

        // Fire-and-forget AI analysis
        fetch("/api/analyze-item", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            itemId: docRef.id,
            imageUrl,
        }),
        });

        setItemSubmitted(true);
        setShowNotificationPrompt(true);
    } catch (err) {
        console.error("Error submitting item:", err);
        alert("Something went wrong. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
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
      alert("Notifications enabled! You'll be notified when someone reports a matching item.");
      setShowNotificationPrompt(false);
      
      // Reset form for new submission
      setItemSubmitted(false);
      setFile(null);
      setLocation(null);
    } catch (err) {
      console.error("Failed to enable notifications:", err);
      
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

  const handleSkipNotifications = () => {
    setShowNotificationPrompt(false);
    setItemSubmitted(false);
    setFile(null);
    setLocation(null);
    alert("Item reported successfully! You can enable notifications later.");
  };

  if (itemSubmitted && showNotificationPrompt) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Item Reported Successfully!
          </h2>
          <p className="text-gray-600">
            Your found item has been added to our database.
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🔔</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Enable Notifications?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Get notified instantly when someone reports a matching lost item. 
                This increases the chances of reuniting items with their owners!
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleEnableNotifications}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
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
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Photo
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Location
          </label>
          <MapPicker onSelect={(lat, lng) => setLocation({ lat, lng })} />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {loading ? "Uploading..." : "Submit Found Item"}
        </button>
      </div>
    </div>
  );
}

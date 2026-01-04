"use client";

import { useState, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import MapPicker from "@/components/MapPicker";
import { registerFcmToken } from "@/lib/firebase-messaging";

export default function FoundItemForm({ uid }: { uid: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [checkingPrefs, setCheckingPrefs] = useState(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [itemSubmitted, setItemSubmitted] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [userDeclined, setUserDeclined] = useState(false);

  // Check if user has push notifications enabled on mount
  useEffect(() => {
    const checkPushPreference = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const isPushEnabled = userData?.notificationPreferences?.pushEnabled ?? false;
          const hasDeclined = userData?.notificationPreferences?.userDeclined ?? false;
          setPushEnabled(isPushEnabled);
          setUserDeclined(hasDeclined);
          // Only show notification prompt if push is not enabled AND user hasn't declined before
          if (!isPushEnabled && !hasDeclined) {
            setShowNotificationPrompt(true);
          }
        } else {
          // User doc doesn't exist, show notification prompt
          setShowNotificationPrompt(true);
        }
      } catch (err) {
        // On error, proceed with form
        setShowNotificationPrompt(false);
      } finally {
        setCheckingPrefs(false);
      }
    };

    checkPushPreference();
  }, [uid]);

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

        // Wait for AI analysis to complete before triggering auto-match
        try {
          const analyzeResponse = await fetch("/api/analyze-item", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              itemId: docRef.id,
              imageUrl,
            }),
          });

          if (analyzeResponse.ok) {
            // Now trigger auto-match after AI has generated embeddings
            try {
              await fetch("/api/auto-match", {
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

        setItemSubmitted(true);
        // Show success message without notification prompt (since it was already shown before)
        alert("Item reported successfully!");
        // Reset form for new submission
        setFile(null);
        setLocation(null);
    } catch (err) {
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
      // Save to Firestore: pushEnabled = true, userDeclined = false
      await setDoc(
        doc(db, "users", uid),
        { notificationPreferences: { pushEnabled: true, userDeclined: false } },
        { merge: true }
      );
      alert("Notifications enabled! You'll be notified when someone reports a matching item.");
      setPushEnabled(true);
      setUserDeclined(false);
      setShowNotificationPrompt(false);
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
    // Save to Firestore: pushEnabled = false, userDeclined = true
    await setDoc(
      doc(db, "users", uid),
      { notificationPreferences: { pushEnabled: false, userDeclined: true } },
      { merge: true }
    );
    setUserDeclined(true);
    setShowNotificationPrompt(false);
    // Proceed to show the form
  };

  // Show loading while checking preferences
  if (checkingPrefs) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show notification prompt BEFORE the form when pushEnabled is false
  if (showNotificationPrompt && !pushEnabled) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🔔</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enable Notifications
          </h2>
          <p className="text-gray-600">
            Before you report a found item, would you like to enable notifications?
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl">📱</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Why Enable Notifications?
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

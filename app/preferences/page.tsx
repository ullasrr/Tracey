"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registerFcmToken } from "@/lib/firebase-messaging";

interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  minMatchScore: number;
  notifyImmediately: boolean;
  dailyDigest: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  emailEnabled: true,
  pushEnabled: true,
  minMatchScore: 0.7,
  notifyImmediately: true,
  dailyDigest: false,
};

export default function PreferencesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.notificationPreferences) {
            setPrefs({ ...DEFAULT_PREFS, ...userData.notificationPreferences });
          }
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      } finally {
        setLoadingPrefs(false);
      }
    };

    loadPreferences();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // If push notifications are enabled, check/request permission first
      if (prefs.pushEnabled) {
        if (!("Notification" in window)) {
          alert("Push notifications are not supported in this browser.");
          setPrefs({ ...prefs, pushEnabled: false });
          setSaving(false);
          return;
        }

        let permission = Notification.permission;
        
        // If permission already denied, don't proceed
        if (permission === "denied") {
          alert("Notification permission was previously denied. Please enable notifications in your browser settings:\n\n1. Click the lock icon in the address bar\n2. Find 'Notifications' settings\n3. Change from 'Block' to 'Allow'\n4. Reload the page and try again");
          setPrefs({ ...prefs, pushEnabled: false });
          setSaving(false);
          return;
        }
        
        // Request permission if not decided yet
        if (permission === "default") {
          alert("Please allow notifications in the browser prompt that will appear next.");
          permission = await Notification.requestPermission();
        }
        
        // Only proceed if granted
        if (permission === "granted") {
          try {
            await registerFcmToken();
          } catch (fcmError: any) {
            console.error("FCM token registration failed:", fcmError);
            alert(`Failed to setup push notifications: ${fcmError.message}\n\nPreferences will still be saved.`);
          }
        } else {
          // User denied the prompt
          alert("Notification permission denied. Push notifications have been disabled.");
          setPrefs({ ...prefs, pushEnabled: false });
          setSaving(false);
          return;
        }
      }

      // Save preferences
      await setDoc(
        doc(db, "users", user.uid),
        {
          notificationPreferences: prefs,
        },
        { merge: true }
      );

      alert("Preferences saved successfully!");
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingPrefs) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto py-8">
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
            ⚙️ Notification Preferences
          </h1>
          <p className="text-gray-600">
            Customize how you receive match notifications
          </p>
        </div>

        {/* Preferences Form */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Email Notifications */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">
                📧 Email Notifications
              </h3>
              <p className="text-sm text-gray-600">
                Receive match alerts via email
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.emailEnabled}
                onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Push Notifications */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">
                🔔 Push Notifications
              </h3>
              <p className="text-sm text-gray-600">
                Receive instant push notifications
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.pushEnabled}
                onChange={(e) => setPrefs({ ...prefs, pushEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Minimum Match Score */}
          <div className="pb-4 border-b">
            <h3 className="font-semibold text-gray-800 text-lg mb-2">
              🎯 Minimum Match Score
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Only notify me for matches above this confidence level
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={prefs.minMatchScore}
                onChange={(e) => setPrefs({ ...prefs, minMatchScore: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-lg font-bold min-w-[80px] text-center">
                {(prefs.minMatchScore * 100).toFixed(0)}%
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>More matches</span>
              <span>Higher accuracy</span>
            </div>
          </div>

          {/* Instant Notifications */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">
                ⚡ Instant Notifications
              </h3>
              <p className="text-sm text-gray-600">
                Get notified immediately when a match is found
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.notifyImmediately}
                onChange={(e) => setPrefs({ ...prefs, notifyImmediately: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Daily Digest */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">
                📅 Daily Digest
              </h3>
              <p className="text-sm text-gray-600">
                Receive a daily summary of all matches (coming soon)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer opacity-50">
              <input
                type="checkbox"
                checked={prefs.dailyDigest}
                onChange={(e) => setPrefs({ ...prefs, dailyDigest: e.target.checked })}
                disabled
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-purple-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

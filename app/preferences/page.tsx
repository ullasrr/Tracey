"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registerFcmToken } from "@/lib/firebase-messaging";

interface NotificationPreferences {
  pushEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: false, // Default to OFF - prompt user on first report
};

export default function PreferencesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [permissionWarning, setPermissionWarning] = useState("");

  const handleToggleChange = async (enabled: boolean) => {
    if (!user) return;

    if (enabled) {
      // Request permission immediately when toggle is turned on
      if (!("Notification" in window)) {
        setPermissionWarning("Push notifications are not supported in this browser.");
        return;
      }

      const permission = Notification.permission;

      if (permission === "denied") {
        setPermissionWarning(
          "Notification permission was denied. Please enable notifications in your browser settings (click the lock icon in the address bar) and try again."
        );
        return;
      }

      if (permission === "default") {
        // Request permission - this will show the browser prompt
        const result = await Notification.requestPermission();
        
        if (result === "granted") {
          // Register FCM token
          try {
            await registerFcmToken();
          } catch (error: any) {
            setPermissionWarning(
              `Failed to enable notifications: ${error.message || 'Unknown error'}. Try clearing site data or using a different browser profile.`
            );
            // Don't enable the toggle if registration failed
            return;
          }
          
          const updatedPrefs = { ...prefs, pushEnabled: true };
          setPrefs(updatedPrefs);
          setPermissionWarning("");
          
          // Auto-save to database
          await setDoc(
            doc(db, "users", user.uid),
            { notificationPreferences: updatedPrefs },
            { merge: true }
          );
        } else {
          setPermissionWarning("Notification permission was denied. Push notifications remain disabled.");
          return;
        }
      } else if (permission === "granted") {
        // Already granted, just enable and register token
        try {
          await registerFcmToken();
        } catch (error: any) {
          setPermissionWarning(
            `Failed to enable notifications: ${error.message || 'Unknown error'}. Try clearing site data or using a different browser profile.`
          );
          // Don't enable the toggle if registration failed
          return;
        }
        
        const updatedPrefs = { ...prefs, pushEnabled: true };
        setPrefs(updatedPrefs);
        setPermissionWarning("");
        
        // Auto-save to database
        await setDoc(
          doc(db, "users", user.uid),
          { notificationPreferences: updatedPrefs },
          { merge: true }
        );
      }
    } else {
      // Turning off - no permission check needed
      const updatedPrefs = { ...prefs, pushEnabled: false };
      setPrefs(updatedPrefs);
      setPermissionWarning("");
      
      // Auto-save to database
      await setDoc(
        doc(db, "users", user.uid),
        { notificationPreferences: updatedPrefs },
        { merge: true }
      );
    }
  };

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
        let loadedPrefs = { ...DEFAULT_PREFS };
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.notificationPreferences) {
            loadedPrefs = { ...DEFAULT_PREFS, ...userData.notificationPreferences };
          }
        }
        
        // Sync with browser permission state
        if ("Notification" in window) {
          const permission = Notification.permission;
          
          if (permission === "granted") {
            // Browser permission is granted
            // If push is enabled (or no preference set), register FCM token
            if (loadedPrefs.pushEnabled !== false) {
              loadedPrefs.pushEnabled = true;
              setPermissionWarning("");
              
              // Auto-register FCM token
              try {
                await registerFcmToken();
              } catch (error: any) {
                // Show user-friendly error for push service errors
                if (error.message?.includes('push service error') || 
                    error.message?.includes('Push notifications are not available')) {
                  setPermissionWarning(
                    "Push notifications couldn't be enabled. This browser profile may have restrictions. Try clearing site data or use a different profile/browser."
                  );
                  // Don't keep it enabled if registration failed
                  loadedPrefs.pushEnabled = false;
                }
              }
              
              // Update database if changed
              if (!userDoc.exists() || userDoc.data()?.notificationPreferences?.pushEnabled !== true) {
                await setDoc(
                  doc(db, "users", user.uid),
                  {
                    notificationPreferences: loadedPrefs,
                  },
                  { merge: true }
                );
              }
            }
          } else if (permission === "denied") {
            // Browser permission is denied, force disable push notifications
            loadedPrefs.pushEnabled = false;
            setPermissionWarning(
              "Push notifications are blocked in your browser. Enable them in your browser settings (click the lock icon) to receive notifications."
            );
            
            // Update in database if it was previously enabled
            if (userDoc.exists() && userDoc.data()?.notificationPreferences?.pushEnabled) {
              await setDoc(
                doc(db, "users", user.uid),
                {
                  notificationPreferences: loadedPrefs,
                },
                { merge: true }
              );
            }
          } else {
            // Permission is "default" (not asked yet), keep whatever is in the database
            // or use the default (disabled)
          }
        }
        
        setPrefs(loadedPrefs);
      } catch (error) {
        // Failed to load preferences - will use defaults
      } finally {
        setLoadingPrefs(false);
      }
    };

    loadPreferences();
  }, [user]);

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
            Notification Settings
          </h1>
          <p className="text-gray-600">
            Enable or disable instant notifications when items are matched
          </p>
        </div>

        {/* Preferences Form */}
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Permission Warning */}
          {permissionWarning && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">
                {permissionWarning}
              </p>
              <button
                onClick={() => setPermissionWarning("")}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Push Notifications */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">
                Push Notifications
              </h3>
              <p className="text-sm text-gray-600">
                Get instant notifications when someone finds your lost item
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.pushEnabled}
                onChange={(e) => handleToggleChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> When someone reports finding an item that matches yours, 
              you'll receive an instant notification so you can quickly claim it and arrange to get it back.
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Changes are saved automatically
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
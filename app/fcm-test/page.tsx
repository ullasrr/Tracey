"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { registerFcmToken } from "@/lib/firebase-messaging";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export default function FCMTestPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [fcmToken, setFcmToken] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [testTitle, setTestTitle] = useState("Test from Tracey");
  const [testBody, setTestBody] = useState("This is a test notification!");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        email: doc.data().email || "Unknown",
      }));
      setUsers(usersList);
      if (usersList.length > 0) {
        setSelectedUserId(user?.uid || usersList[0].id);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const handleRegisterToken = async () => {
    setRegistering(true);
    setMessage("");
    try {
      const token = await registerFcmToken();
      setFcmToken(token);
      setMessage(`✅ Successfully registered FCM token: ${token.substring(0, 50)}...`);
    } catch (error: any) {
      console.error("Error registering token:", error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setRegistering(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!selectedUserId) {
      setMessage("❌ Please select a user");
      return;
    }

    setSending(true);
    setMessage("");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/fcm/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: selectedUserId,
          title: testTitle,
          body: testBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send notification");
      }

      setMessage(`✅ ${data.message}`);
    } catch (error: any) {
      console.error("Error sending notification:", error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <button
          onClick={() => router.push("/")}
          className="mb-6 text-blue-600 hover:text-blue-800 font-semibold"
        >
          ← Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🔔 FCM Notification Tester
          </h1>
          <p className="text-gray-600 mb-6">
            Test Firebase Cloud Messaging notifications
          </p>

          {/* Step 1: Register Token */}
          <div className="border-b pb-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Step 1: Register FCM Token</h2>
            <button
              onClick={handleRegisterToken}
              disabled={registering}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registering ? "Registering..." : "Register FCM Token"}
            </button>
            {fcmToken && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800 break-all">
                  <strong>Token:</strong> {fcmToken}
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Send Test Notification */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Step 2: Send Test Notification</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} {u.id === user?.uid ? "(You)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Body
                </label>
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleSendTestNotification}
                disabled={sending || !selectedUserId}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Send Test Notification"}
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`mt-6 p-4 rounded-lg ${
              message.startsWith("✅") 
                ? "bg-green-50 border border-green-200 text-green-800" 
                : "bg-red-50 border border-red-200 text-red-800"
            }`}>
              <p className="text-sm break-all">{message}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">📝 Instructions:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Click "Register FCM Token" to get your device token</li>
              <li>Select a user to send notification to (can be yourself)</li>
              <li>Customize the notification title and body</li>
              <li>Click "Send Test Notification"</li>
              <li>Check if notification appears on the selected user's device</li>
            </ol>
            <p className="text-xs text-blue-700 mt-3">
              <strong>Note:</strong> Make sure the user has allowed notifications in their browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

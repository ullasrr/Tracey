"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { createUserIfNotExists } from "@/lib/createUser";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      createUserIfNotExists(user);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth/login");
    } catch (error) {
      // Logout failed
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50">
      {/* Header/Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📍</div>
              <h1 className="text-2xl font-bold text-gray-900">Tracey</h1>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <button
                    onClick={() => router.push("/search")}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    Search
                  </button>
                  <button
                    onClick={() => router.push("/matches")}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    Matches
                  </button>
                  <button
                    onClick={() => router.push("/profile")}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    Profile
                  </button>
                  <div className="hidden sm:block text-sm text-gray-600">
                    {user.email}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => router.push("/auth/login")}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Lost Something?{" "}
              <span className="text-blue-600">We'll Help You Find It</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Tracey connects people who have lost items with those who have
              found them. Report lost or found items with location tracking and
              help reunite belongings with their owners.
            </p>

            {!user && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => router.push("/auth/login")}
                  className="px-8 py-4 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg cursor-pointer"
                >
                  Get Started
                </button>
                <button
                  onClick={() => {
                    const element = document.getElementById("features");
                    element?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-8 py-4 text-lg font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 cursor-pointer"
                >
                  Learn More
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Action Cards (for logged-in users) */}
      {user && (
        <section className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Report Found Item */}
              <div
                onClick={() => router.push("/report/found")}
                className="cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-xl p-8 border-2 border-transparent hover:border-green-500 transition-all"
              >
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Found an Item?
                </h3>
                <p className="text-gray-600 mb-4">
                  Report items you've found to help reunite them with their
                  owners. Add photos and location details.
                </p>
                <div className="text-green-600 font-medium">
                  Report Found Item →
                </div>
              </div>

              {/* Report Lost Item */}
              <div
                onClick={() => router.push("/search")}
                className="cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-xl p-8 border-2 border-transparent hover:border-blue-500 transition-all"
              >
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Lost an Item?
                </h3>
                <p className="text-gray-600 mb-4">
                  Search found items or report your lost item to get notified
                  when someone finds it!
                </p>
                <div className="text-blue-600 font-medium">
                  Search & Report →
                </div>
              </div>

              {/* View Matches */}
              <div
                onClick={() => router.push("/matches")}
                className="cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-xl p-8 border-2 border-transparent hover:border-purple-500 transition-all"
              >
                <div className="text-5xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  View Matches
                </h3>
                <p className="text-gray-600 mb-4">
                  Check AI-powered matches for your lost items. See when someone reports finding a similar item.
                </p>
                <div className="text-purple-600 font-medium">
                  View My Matches →
                </div>
              </div>

              {/* Preferences */}
              <div
                onClick={() => router.push("/preferences")}
                className="cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-xl p-8 border-2 border-transparent hover:border-gray-500 transition-all"
              >
                <div className="text-5xl mb-4">⚙️</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Notification Settings
                </h3>
                <p className="text-gray-600 mb-4">
                  Customize how you receive match notifications. Set your minimum match score and preferences.
                </p>
                <div className="text-gray-600 font-medium">
                  Manage Settings →
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How Tracey Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our platform makes it easy to report and find lost items with
              advanced features
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Photo Upload
              </h3>
              <p className="text-gray-600">
                Upload clear photos of found items with automatic image
                compression for faster loading
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="text-6xl mb-4">📍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Location Tracking
              </h3>
              <p className="text-gray-600">
                Pin exact locations where items were found or lost using our
                interactive map
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Smart Matching
              </h3>
              <p className="text-gray-600">
                AI-powered categorization and color tagging to help match lost
                and found items
              </p>
            </div>
          </div>
        </div>
      </section>



      {/* CTA Section */}
      {!user && (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join Tracey today and help create a community where lost items
              find their way home
            </p>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-8 py-4 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg cursor-pointer"
            >
              Sign Up Now
            </button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">📍</span>
            <span className="text-xl font-bold">Tracey</span>
          </div>
          <p className="text-gray-400 text-sm">
            © 2025 Tracey. Helping reunite lost items with their owners.
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      console.error("Search failed", error);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">Find Your Lost Item</h1>
      
      {/* --- Search Inputs --- */}
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
      </div>

      {/* --- Results Section --- */}
      <div className="space-y-4">
        {loading && <p className="text-center text-gray-500">Analyzing database...</p>}

        {!loading && hasSearched && results.length === 0 && (
            <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed">
                <p className="text-gray-600 font-medium">No results found.</p>
                <p className="text-sm text-gray-400 mt-1">Try changing your description or lowering the similarity threshold.</p>
            </div>
        )}

        {results.map((item) => (
          <div key={item.id} className="border p-4 rounded-lg shadow-sm flex gap-4 hover:shadow-md transition bg-white">
            <img
              src={item.blurredImages?.length ? item.blurredImages[0] : (item.images?.[0] || "/placeholder.png")}
              className="w-24 h-24 object-cover rounded-md flex-shrink-0"
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
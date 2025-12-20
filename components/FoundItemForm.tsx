"use client";

import { useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import MapPicker from "@/components/MapPicker";

export default function FoundItemForm({ uid }: { uid: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file || !location) {
      alert("Image and location required");
      return;
    }

    setLoading(true);

    // Compress image
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
    });

    // Upload to Cloudinary
    const imageUrl = await uploadToCloudinary(compressed as File);

    // Save Firestore item
    await addDoc(collection(db, "items"), {
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

    setLoading(false);
    alert("Found item reported successfully");
  };

  return (
    <div className="space-y-4 max-w-md">
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <MapPicker onSelect={(lat, lng) => setLocation({ lat, lng })} />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        {loading ? "Uploading..." : "Submit Found Item"}
      </button>
    </div>
  );
}

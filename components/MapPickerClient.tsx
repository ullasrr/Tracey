"use client";

import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { useEffect, useState } from "react";

function LocationMarker({
  onSelect,
  initialPosition,
}: {
  onSelect: (lat: number, lng: number) => void;
  initialPosition: [number, number] | null;
}) {
  const [position, setPosition] = useState<[number, number] | null>(initialPosition);
  const map = useMap();

  // Update position when initialPosition changes (from geolocation)
  useEffect(() => {
    if (initialPosition) {
      setPosition(initialPosition);
      map.setView(initialPosition, 16);
    }
  }, [initialPosition, map]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onSelect(lat, lng);
    },
  });

  return position ? <Marker position={position} /> : null;
}

export default function MapPickerClient({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "success" | "error" | "idle">("idle");

  useEffect(() => {
    // Import leaflet ONLY on client
    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
    });

    // Get user's current location
    if ("geolocation" in navigator) {
      setLocationStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          onSelect(latitude, longitude); // Auto-select the location
          setLocationStatus("success");
        },
        () => {
          setLocationStatus("error");
          // Fall back to default location (NITK area)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    }
  }, []);

  const defaultCenter: [number, number] = userLocation || [13.0101, 74.7949];

  return (
    <div>
      {locationStatus === "loading" && (
        <div className="text-sm text-blue-600 mb-2 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          Getting your location...
        </div>
      )}
      {locationStatus === "success" && (
        <div className="text-sm text-green-600 mb-2">
          Location detected! Tap to adjust if needed.
        </div>
      )}
      {locationStatus === "error" && (
        <div className="text-sm text-orange-600 mb-2">
          Couldn't get your location. Please tap on the map to select.
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={15}
        style={{ height: "300px", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker onSelect={onSelect} initialPosition={userLocation} />
      </MapContainer>
    </div>
  );
}


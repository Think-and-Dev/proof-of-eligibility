"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

// IMPORTANT:
// Define your Mapbox token in a .env.local file at the project root:
// NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here
// Then restart `npm run dev`.

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export default function MapboxPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapboxgl.accessToken) {
      // Evita romper la UI si no hay token
      return;
    }

    if (mapRef.current) return; // evita recrear el mapa

    // Obelisco de Buenos Aires (lng, lat)
    const initialCenter: [number, number] = [-58.38157, -34.60374];

    // Centro de Convenciones de Buenos Aires (lng, lat aprox)
    const cecPosition: [number, number] = [-58.3981, -34.5827];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter,
      zoom: 15,
    });

    mapRef.current = map;

    // Marcador fijo en el Obelisco
    new mapboxgl.Marker({ color: "#0ea5e9" })
      .setLngLat(initialCenter)
      .addTo(map);

    // Marcador fijo en el Centro de Convenciones (CEC)
    new mapboxgl.Marker({ color: "#f97316" }) // naranja para distinguirlo
      .setLngLat(cecPosition)
      .addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const hasToken = Boolean(mapboxgl.accessToken);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <main className="w-full max-w-5xl">
        <header className="mb-6 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-black">
            Mapbox test view
          </h1>
          <p className="mt-2 text-sm md:text-base text-black">
            This page is not part of the clinical flow; it is only for experimenting with the map.
          </p>
        </header>

        <section className="bg-white shadow-md rounded-xl border border-slate-100 p-4 md:p-6">
          {!hasToken && (
            <p className="mb-4 text-sm text-red-600">
              No Mapbox token found. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your
              <code> .env.local </code> file and restart the dev server.
            </p>
          )}

          <div
            ref={mapContainerRef}
            className="w-full h-[400px] md:h-[500px] rounded-lg overflow-hidden bg-slate-100"
          />
        </section>
      </main>
    </div>
  );
}

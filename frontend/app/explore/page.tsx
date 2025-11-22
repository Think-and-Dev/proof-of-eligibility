"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

function ExploreMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapboxgl.accessToken) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    // Centro aproximado en CABA
    const center: [number, number] = [-58.41, -34.6];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: 11,
    });

    mapRef.current = map;

    // Pacientes demo (coordenadas aproximadas)
    const demoPoints = [
      {
        id: "P-001",
        nombre: "Paciente 001",
        lng: -58.38157, // Obelisco
        lat: -34.60374,
        color: "#0ea5e9", // celeste
      },
      {
        id: "P-002",
        nombre: "Paciente 002",
        lng: -58.3981, // CEC
        lat: -34.5827,
        color: "#f97316", // naranja
      },
      {
        id: "P-003",
        nombre: "Paciente 003",
        lng: -58.43,
        lat: -34.615,
        color: "#22c55e", // verde
      },
    ];

    const bounds = new mapboxgl.LngLatBounds();

    demoPoints.forEach((p) => {
      new mapboxgl.Marker({ color: p.color })
        .setLngLat([p.lng, p.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong>${p.nombre}</strong><br/>${p.id}`
          )
        )
        .addTo(map);
      bounds.extend([p.lng, p.lat]);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const hasToken = Boolean(mapboxgl.accessToken);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-slate-100">
      {!hasToken && (
        <div className="flex items-center justify-center h-full text-xs text-red-600 px-4 text-center">
          No se encontró un token de Mapbox. Agrega NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN en tu archivo
          .env.local y reinicia el servidor.
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

export default function ExplorePage() {
  return (
    <div className="h-screen bg-slate-50 flex">
      {/* Columna izquierda: filtros */}
      <section className="w-[15%] h-full border-r border-slate-200 overflow-y-auto p-4 text-sm resize-x cursor-col-resize min-w-[180px] max-w-[40%]">
        <h2 className="text-base font-semibold text-black mb-3">Filtros clínicos</h2>

        <div className="space-y-4">
          <div>
            <p className="font-medium text-black mb-1">Rango de edad</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Mín"
                className="w-1/2 rounded-lg border border-slate-300 px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
              <span className="text-xs text-black">a</span>
              <input
                type="number"
                placeholder="Máx"
                className="w-1/2 rounded-lg border border-slate-300 px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Diagnóstico previo
            </label>
            <select
              className="block w-full rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">Todos</option>
              <option value="Alzheimer">Alzheimer</option>
              <option value="MCI">MCI</option>
              <option value="Sin diagnóstico">Sin diagnóstico</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Síntoma principal
            </label>
            <select
              className="block w-full rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">Cualquiera</option>
              <option value="Pérdida de memoria">Pérdida de memoria</option>
              <option value="Dificultad para concentrarse">Dificultad para concentrarse</option>
              <option value="Dificultad para encontrar palabras">
                Dificultad para encontrar palabras
              </option>
              <option value="Cambios en el estado de ánimo">Cambios en el estado de ánimo</option>
            </select>
          </div>

          <p className="text-[11px] text-black/70">
            Estos filtros son un esquema inicial basado en el pre-screening clínico. Más adelante se
            conectarán con datos reales de pacientes.
          </p>
        </div>
      </section>

      {/* Columna central: resultados */}
      <section className="w-[15%] h-full border-r border-slate-200 overflow-y-auto p-4 text-sm flex flex-col resize-x cursor-col-resize min-w-[220px] max-w-[45%]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-black">Pacientes encontrados</h2>
          <span className="text-xs text-black/70">3 resultados</span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <article className="border border-slate-200 rounded-lg p-3 hover:border-sky-500 hover:shadow-sm transition-colors cursor-pointer text-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-black text-sm">
                Paciente 001 <span className="text-xs text-black/70">(P-001)</span>
              </h3>
              <span className="text-[11px] px-2 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
                Elegible
              </span>
            </div>
            <p className="text-xs text-black/80 mb-1">
              Edad: <span className="font-medium">68</span> · Diagnóstico previo:
              <span className="font-medium"> Alzheimer</span>
            </p>
            <p className="text-xs text-black/80">
              Síntomas: Pérdida de memoria, Dificultad para concentrarse
            </p>
          </article>

          <article className="border border-slate-200 rounded-lg p-3 hover:border-sky-500 hover:shadow-sm transition-colors cursor-pointer text-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-black text-sm">
                Paciente 002 <span className="text-xs text-black/70">(P-002)</span>
              </h3>
              <span className="text-[11px] px-2 py-1 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                A revisar
              </span>
            </div>
            <p className="text-xs text-black/80 mb-1">
              Edad: <span className="font-medium">61</span> · Diagnóstico previo:
              <span className="font-medium"> MCI</span>
            </p>
            <p className="text-xs text-black/80">
              Síntomas: Dificultad para encontrar palabras
            </p>
          </article>

          <article className="border border-slate-200 rounded-lg p-3 hover:border-sky-500 hover:shadow-sm transition-colors cursor-pointer text-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-black text-sm">
                Paciente 003 <span className="text-xs text-black/70">(P-003)</span>
              </h3>
              <span className="text-[11px] px-2 py-1 rounded-full border bg-rose-50 border-rose-200 text-rose-700">
                No elegible
              </span>
            </div>
            <p className="text-xs text-black/80 mb-1">
              Edad: <span className="font-medium">73</span> · Diagnóstico previo:
              <span className="font-medium"> Sin diagnóstico</span>
            </p>
            <p className="text-xs text-black/80">
              Síntomas: Cambios en el estado de ánimo
            </p>
          </article>
        </div>
      </section>

      {/* Columna derecha: mapa (ocupa el resto) */}
      <section className="flex-1 h-full p-4 text-sm flex flex-col">
        <div className="mb-3 flex items-center justify-between text-black text-sm">
          <h2 className="text-base font-semibold">Mapa de pacientes</h2>
          <span className="text-xs text-black/70">3 puntos</span>
        </div>
        <div className="flex-1 min-h-0">
          <ExploreMap />
        </div>
      </section>
    </div>
  );
}

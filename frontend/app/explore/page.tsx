"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

type Patient = {
  id: string;
  nombre: string;
  edad: number;
  diagnosticoPrevio: string;
  sintomaPrincipal: string;
  estudioClinico: string;
  estadoPaciente: "Eligible" | "To review" | "Not eligible";
  lng: number;
  lat: number;
};

type ExploreMapProps = {
  patients: Patient[];
  showHospitals: boolean;
  onSelectPatient: (id: string) => void;
};

function ExploreMap({ patients, showHospitals, onSelectPatient }: ExploreMapProps) {
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

    // Coordenadas aproximadas de algunos hospitales públicos de CABA
    const hospitalPoints: [number, number][] = [
      [-58.3955, -34.6033], // Hospital Argerich (aprox.)
      [-58.4101, -34.6293], // Hospital Penna (aprox.)
      [-58.4675, -34.6113], // Hospital Santojanni (aprox.)
      [-58.4604, -34.5859], // Hospital Pirovano (aprox.)
      [-58.4502, -34.6364], // Hospital Piñero (aprox.)
      [-58.4183, -34.5875], // Hospital Fernández (aprox.)
      [-58.4496, -34.5989], // Hospital Tornú (aprox.)
      [-58.4032, -34.6218], // Hospital Ramos Mejía (aprox.)
      [-58.4662, -34.6304], // Hospital Vélez Sarsfield (aprox.)
      [-58.3849, -34.6091], // Hospital Durand (aprox.)
    ];

    // Ejemplo de imagen animada (pulsing dot) basado en la documentación de Mapbox
    const size = 80;

    const pulsingDot = {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),
      context: null as CanvasRenderingContext2D | null,
      onAdd(this: any) {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext("2d");
      },
      render(this: any) {
        const duration = 5000;
        const t = (performance.now() % duration) / duration;

        const radius = (size / 2) * 0.3;
        const outerRadius = (size / 2) * 0.7 * t + radius;
        const context = this.context as CanvasRenderingContext2D;

        context.clearRect(0, 0, this.width, this.height);

        // círculo externo
        context.beginPath();
        context.arc(size / 2, size / 2, outerRadius, 0, Math.PI * 2);
        context.fillStyle = `rgba(56, 189, 248, ${1 - t})`;
        context.fill();

        // círculo interno
        context.beginPath();
        context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(8, 47, 73, 1)";
        context.strokeStyle = "white";
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        const imageData = context.getImageData(0, 0, this.width, this.height);
        this.data = new Uint8Array(imageData.data.buffer);

        // Indicar a Mapbox que la imagen cambió
        (map as any).triggerRepaint();

        return true;
      },
    } as any;

    map.on("load", () => {
      // Fuente de pacientes como GeoJSON clusterizado (se actualiza en otro efecto)
      if (!map.getSource("patients-heatmap-source")) {
        map.addSource("patients-heatmap-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 40,
        } as any);
      }

      // Capa de clústeres (círculos grandes con color según cantidad de puntos)
      if (!map.getLayer("patients-clusters")) {
        map.addLayer({
          id: "patients-clusters",
          type: "circle",
          source: "patients-heatmap-source",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "rgba(56, 189, 248, 0.6)",
              20,
              "rgba(37, 99, 235, 0.7)",
              50,
              "rgba(30, 64, 175, 0.9)",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,
              20,
              24,
              50,
              32,
            ],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "rgba(15, 23, 42, 0.95)",
          },
        });
      }

      // Número de pacientes dentro de cada clúster
      if (!map.getLayer("patients-cluster-count")) {
        map.addLayer({
          id: "patients-cluster-count",
          type: "symbol",
          source: "patients-heatmap-source",
          filter: ["has", "point_count"],
          layout: {
            // Para garantizar anonimidad: si el grupo es menor a 5, se muestra "≤5"
            "text-field": [
              "case",
              ["<", ["get", "point_count"], 5],
              "≤5",
              ["to-string", ["get", "point_count"]],
            ],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#e5e7eb",
          },
        });
      }

      // Puntos individuales no clusterizados, coloreados por estado
      if (!map.getLayer("patients-unclustered-point")) {
        map.addLayer({
          id: "patients-unclustered-point",
          type: "circle",
          source: "patients-heatmap-source",
          filter: ["!has", "point_count"],
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "estado"], "Eligible"],
              "#22c55e",
              ["==", ["get", "estado"], "To review"],
              "#facc15",
              "#ef4444",
            ],
            "circle-radius": 6,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#020617",
          },
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Mostrar/ocultar capa de hospitales según flag externo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.isStyleLoaded()) return;

    const layerId = "pulsing-dot-layer";
    if (!map.getLayer(layerId)) return;

    map.setLayoutProperty(
      layerId,
      "icon-image",
      showHospitals ? "pulsing-dot" : ""
    );
  }, [showHospitals]);

  // Sincronizar marcadores con la lista de pacientes filtrados
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const updateSourceAndBounds = () => {
      const bounds = new mapboxgl.LngLatBounds();

      // Centro de referencia para "compactar" los puntos mock sobre CABA
      const compactCenter: [number, number] = [-58.41, -34.6];
      const compactFactor = 0.8; // 1 = posiciones originales, <1 los acerca al centro

      // Offsets para ajustar la posición en pantalla
      const lngOffset = -0.07; // desplazar a la izquierda (oeste)
      const latOffset = -0.02; // desplazar hacia abajo (sur)

      const features = patients.map((p) => {
        const compactedLng =
          compactCenter[0] + (p.lng - compactCenter[0]) * compactFactor;
        const compactedLat =
          compactCenter[1] + (p.lat - compactCenter[1]) * compactFactor;

        const shiftedLng = compactedLng + lngOffset;
        const shiftedLat = compactedLat + latOffset;

        bounds.extend([shiftedLng, shiftedLat]);

        return {
          type: "Feature" as const,
          properties: {
            estado: p.estadoPaciente,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [shiftedLng, shiftedLat],
          },
        };
      });

      const source = map.getSource(
        "patients-heatmap-source"
      ) as mapboxgl.GeoJSONSource | undefined;

      if (source) {
        source.setData({
          type: "FeatureCollection",
          features,
        } as any);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
      }
    };

    if (map.isStyleLoaded()) {
      updateSourceAndBounds();
    } else {
      const onLoad = () => {
        updateSourceAndBounds();
      };
      map.once("load", onLoad);
    }
  }, [patients]);

  const hasToken = Boolean(mapboxgl.accessToken);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-slate-100">
      {!hasToken && (
        <div className="flex items-center justify-center h-full text-xs text-red-600 px-4 text-center">
          No Mapbox token found. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file and restart the dev server.
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

// Encargado de obtener la información de pacientes desde otro servicio de backend.
// Por ahora devuelve datos mockeados, que luego se reemplazarán por una llamada real (fetch/axios, etc.).
async function fetchPatientsFromBackend(): Promise<Patient[]> {
  // TODO: replace with real backend call
  const patients: Patient[] = [
    {
      id: "P-001",
      nombre: "Patient 001",
      edad: 68,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Memory loss, Difficulty concentrating",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Eligible",
      lng: -58.38157,
      lat: -34.60374,
    },
    {
      id: "P-002",
      nombre: "Patient 002",
      edad: 61,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Difficulty finding words",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "To review",
      lng: -58.3981,
      lat: -34.5827,
    },
    {
      id: "P-003",
      nombre: "Patient 003",
      edad: 73,
      diagnosticoPrevio: "No diagnosis",
      sintomaPrincipal: "Mood changes",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Not eligible",
      lng: -58.43,
      lat: -34.615,
    },
    {
      id: "P-004",
      nombre: "Patient 004",
      edad: 58,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Memory loss",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Eligible",
      lng: -58.39,
      lat: -34.61,
    },
    {
      id: "P-005",
      nombre: "Patient 005",
      edad: 65,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Difficulty concentrating",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "To review",
      lng: -58.37,
      lat: -34.59,
    },
    {
      id: "P-006",
      nombre: "Patient 006",
      edad: 72,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Mood changes",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Not eligible",
      lng: -58.41,
      lat: -34.62,
    },
    {
      id: "P-007",
      nombre: "Patient 007",
      edad: 69,
      diagnosticoPrevio: "No diagnosis",
      sintomaPrincipal: "Memory loss",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Eligible",
      lng: -58.42,
      lat: -34.6,
    },
    {
      id: "P-008",
      nombre: "Patient 008",
      edad: 63,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Difficulty finding words",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "To review",
      lng: -58.36,
      lat: -34.61,
    },
    {
      id: "P-009",
      nombre: "Patient 009",
      edad: 70,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Difficulty concentrating",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Not eligible",
      lng: -58.4,
      lat: -34.59,
    },
    {
      id: "P-010",
      nombre: "Patient 010",
      edad: 66,
      diagnosticoPrevio: "No diagnosis",
      sintomaPrincipal: "Mood changes",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Eligible",
      lng: -58.38,
      lat: -34.6,
    },
    {
      id: "P-011",
      nombre: "Patient 011",
      edad: 62,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Tremor at rest",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Eligible",
      lng: -58.39,
      lat: -34.57,
    },
    {
      id: "P-012",
      nombre: "Patient 012",
      edad: 59,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Muscle rigidity",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "To review",
      lng: -58.41,
      lat: -34.58,
    },
    {
      id: "P-013",
      nombre: "Patient 013",
      edad: 71,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Motor slowness",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Not eligible",
      lng: -58.43,
      lat: -34.56,
    },
    {
      id: "P-014",
      nombre: "Patient 014",
      edad: 64,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Balance problems",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "Eligible",
      lng: -58.37,
      lat: -34.57,
    },
    {
      id: "P-015",
      nombre: "Patient 015",
      edad: 68,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Tremor at rest",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "To review",
      lng: -58.35,
      lat: -34.58,
    },
    {
      id: "P-016",
      nombre: "Patient 016",
      edad: 73,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Muscle rigidity",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Not eligible",
      lng: -58.42,
      lat: -34.55,
    },
    {
      id: "P-017",
      nombre: "Patient 017",
      edad: 57,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Motor slowness",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Eligible",
      lng: -58.44,
      lat: -34.57,
    },
    {
      id: "P-018",
      nombre: "Patient 018",
      edad: 60,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Balance problems",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "To review",
      lng: -58.39,
      lat: -34.54,
    },
    {
      id: "P-019",
      nombre: "Patient 019",
      edad: 69,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Tremor at rest",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Not eligible",
      lng: -58.33,
      lat: -34.59,
    },
    {
      id: "P-020",
      nombre: "Patient 020",
      edad: 63,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Muscle rigidity",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "Eligible",
      lng: -58.36,
      lat: -34.53,
    },
    {
      id: "P-021",
      nombre: "Patient 021",
      edad: 55,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Palpable nodule",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Eligible",
      lng: -58.4,
      lat: -34.62,
    },
    {
      id: "P-022",
      nombre: "Patient 022",
      edad: 52,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Breast pain",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "To review",
      lng: -58.38,
      lat: -34.63,
    },
    {
      id: "P-023",
      nombre: "Patient 023",
      edad: 59,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Mammography alterations",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Not eligible",
      lng: -58.35,
      lat: -34.64,
    },
    {
      id: "P-024",
      nombre: "Patient 024",
      edad: 61,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Palpable nodule",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Eligible",
      lng: -58.37,
      lat: -34.66,
    },
    {
      id: "P-025",
      nombre: "Patient 025",
      edad: 56,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Breast pain",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "To review",
      lng: -58.42,
      lat: -34.63,
    },
    {
      id: "P-026",
      nombre: "Patient 026",
      edad: 58,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Mammography alterations",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Not eligible",
      lng: -58.39,
      lat: -34.65,
    },
    {
      id: "P-027",
      nombre: "Patient 027",
      edad: 54,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Memory loss",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Eligible",
      lng: -58.31,
      lat: -34.6,
    },
    {
      id: "P-028",
      nombre: "Patient 028",
      edad: 67,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Difficulty concentrating",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "To review",
      lng: -58.32,
      lat: -34.61,
    },
    {
      id: "P-029",
      nombre: "Patient 029",
      edad: 71,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Mood changes",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Not eligible",
      lng: -58.34,
      lat: -34.62,
    },
    {
      id: "P-030",
      nombre: "Patient 030",
      edad: 69,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Memory loss",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Eligible",
      lng: -58.33,
      lat: -34.6,
    },
    {
      id: "P-031",
      nombre: "Patient 031",
      edad: 65,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Difficulty finding words",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "To review",
      lng: -58.36,
      lat: -34.59,
    },
    {
      id: "P-032",
      nombre: "Patient 032",
      edad: 74,
      diagnosticoPrevio: "No diagnosis",
      sintomaPrincipal: "Mood changes",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Not eligible",
      lng: -58.37,
      lat: -34.58,
    },
    {
      id: "P-033",
      nombre: "Patient 033",
      edad: 62,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Tremor at rest",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Eligible",
      lng: -58.41,
      lat: -34.55,
    },
    {
      id: "P-034",
      nombre: "Patient 034",
      edad: 60,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Muscle rigidity",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "To review",
      lng: -58.43,
      lat: -34.56,
    },
    {
      id: "P-035",
      nombre: "Patient 035",
      edad: 70,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Motor slowness",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Not eligible",
      lng: -58.45,
      lat: -34.57,
    },
    {
      id: "P-036",
      nombre: "Patient 036",
      edad: 58,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Balance problems",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "Eligible",
      lng: -58.4,
      lat: -34.58,
    },
    {
      id: "P-037",
      nombre: "Patient 037",
      edad: 67,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Tremor at rest",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "To review",
      lng: -58.38,
      lat: -34.55,
    },
    {
      id: "P-038",
      nombre: "Patient 038",
      edad: 72,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Muscle rigidity",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Not eligible",
      lng: -58.35,
      lat: -34.54,
    },
    {
      id: "P-039",
      nombre: "Patient 039",
      edad: 56,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Palpable nodule",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Eligible",
      lng: -58.33,
      lat: -34.63,
    },
    {
      id: "P-040",
      nombre: "Patient 040",
      edad: 53,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Breast pain",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "To review",
      lng: -58.36,
      lat: -34.64,
    },
    {
      id: "P-041",
      nombre: "Patient 041",
      edad: 60,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Mammography alterations",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Not eligible",
      lng: -58.39,
      lat: -34.66,
    },
    {
      id: "P-042",
      nombre: "Patient 042",
      edad: 57,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Palpable nodule",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Eligible",
      lng: -58.41,
      lat: -34.62,
    },
    {
      id: "P-043",
      nombre: "Patient 043",
      edad: 55,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Breast pain",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "To review",
      lng: -58.37,
      lat: -34.61,
    },
    {
      id: "P-044",
      nombre: "Patient 044",
      edad: 62,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Mammography alterations",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Not eligible",
      lng: -58.34,
      lat: -34.65,
    },
    {
      id: "P-045",
      nombre: "Patient 045",
      edad: 69,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Memory loss",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Eligible",
      lng: -58.32,
      lat: -34.57,
    },
    {
      id: "P-046",
      nombre: "Patient 046",
      edad: 63,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Difficulty finding words",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "To review",
      lng: -58.31,
      lat: -34.58,
    },
    {
      id: "P-047",
      nombre: "Patient 047",
      edad: 75,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Mood changes",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Not eligible",
      lng: -58.3,
      lat: -34.59,
    },
    {
      id: "P-048",
      nombre: "Patient 048",
      edad: 61,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Tremor at rest",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Eligible",
      lng: -58.29,
      lat: -34.6,
    },
    {
      id: "P-049",
      nombre: "Patient 049",
      edad: 59,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Muscle rigidity",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "To review",
      lng: -58.28,
      lat: -34.61,
    },
    {
      id: "P-050",
      nombre: "Patient 050",
      edad: 68,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Palpable nodule",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Not eligible",
      lng: -58.27,
      lat: -34.62,
    },
  ];

  // Generar 100 pacientes adicionales de forma random alrededor de CABA
  const extraPatients: Patient[] = [];

  const baseLng = -58.41;
  const baseLat = -34.6;

  const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const possibleDiagnoses = ["Alzheimer", "MCI", "No diagnosis"] as const;
  const possibleSymptoms = [
    "Memory loss",
    "Difficulty concentrating",
    "Difficulty finding words",
    "Mood changes",
  ];
  const possibleStatus: Patient["estadoPaciente"][] = [
    "Eligible",
    "To review",
    "Not eligible",
  ];

  for (let i = 1; i <= 100; i++) {
    const idNumber = 50 + i;

    // Pequeñas variaciones alrededor de CABA para dispersar los puntos
    const jitterLng = (Math.random() - 0.5) * 0.18; // ~ +/- 0.09
    const jitterLat = (Math.random() - 0.5) * 0.16; // ~ +/- 0.08

    extraPatients.push({
      id: `P-${idNumber.toString().padStart(3, "0")}`,
      nombre: `Patient ${idNumber.toString().padStart(3, "0")}`,
      edad: 55 + Math.floor(Math.random() * 21), // entre 55 y 75
      diagnosticoPrevio: randomFrom([...possibleDiagnoses]),
      sintomaPrincipal: randomFrom([...possibleSymptoms]),
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: randomFrom(possibleStatus),
      lng: baseLng + jitterLng,
      lat: baseLat + jitterLat,
    });
  }

  const allPatients = [...patients, ...extraPatients];

  // For the current demo, force all patients to belong to the same trial
  return allPatients.map((p) => ({
    ...p,
    estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
  }));
}

export default function ExplorePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showHospitals, setShowHospitals] = useState<boolean>(false);
  const [selectedStudy, setSelectedStudy] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [symptom, setSymptom] = useState<string>("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  useEffect(() => {
    fetchPatientsFromBackend().then(setPatients).catch(() => {
      setPatients([]);
    });
  }, []);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (selectedStudy && p.estudioClinico !== selectedStudy) return false;
      if (selectedStatus && p.estadoPaciente !== selectedStatus) return false;
      if (diagnosis && p.diagnosticoPrevio !== diagnosis) return false;
      if (symptom && !p.sintomaPrincipal.includes(symptom)) return false;

      const min = ageMin ? parseInt(ageMin, 10) : undefined;
      const max = ageMax ? parseInt(ageMax, 10) : undefined;
      if (!Number.isNaN(min as number) && min !== undefined && p.edad < min) return false;
      if (!Number.isNaN(max as number) && max !== undefined && p.edad > max) return false;

      return true;
    });
  }, [patients, selectedStudy, selectedStatus, diagnosis, symptom, ageMin, ageMax]);

  const totalResults = filteredPatients.length;

  return (
    <div className="h-screen bg-slate-950 flex text-slate-50">
      {/* Columna izquierda: filtros */}
      <section className="w-[15%] h-full border-r border-slate-800 bg-slate-950/80 overflow-y-auto p-4 text-sm resize-x cursor-col-resize min-w-[180px] max-w-[40%]">
        <h2 className="text-base font-semibold text-slate-50 mb-3">Clinical filters</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <input
              id="toggle-hospitals"
              type="checkbox"
              checked={showHospitals}
              onChange={(e) => setShowHospitals(e.target.checked)}
              className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
            />
            <label htmlFor="toggle-hospitals" className="select-none">
              Show public hospitals
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-100 mb-1">
              Clinical trial
            </label>
            <select
              value={selectedStudy}
              onChange={(e) => setSelectedStudy(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 px-2 py-1 text-xs bg-slate-900 text-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">All</option>
              <option value="Alzheimer-Aducanumab-2023-06-01">
                Alzheimer-Aducanumab-2023-06-01
              </option>
              <option value="Alzheimer-Lecanemab-2022-11-15">
                Alzheimer-Lecanemab-2022-11-15
              </option>
              <option value="Parkinson-Prasinezumab-2021-09-30">
                Parkinson-Prasinezumab-2021-09-30
              </option>
              <option value="Parkinson-Tavapadon-2020-04-20">
                Parkinson-Tavapadon-2020-04-20
              </option>
              <option value="Cancer de mama-Pertuzumab-2019-02-10">
                Cancer de mama-Pertuzumab-2019-02-10
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-100 mb-1">
              Patient status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 px-2 py-1 text-xs bg-slate-900 text-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">All</option>
              <option value="Eligible">Eligible</option>
              <option value="To review">To review</option>
              <option value="Not eligible">Not eligible</option>
            </select>
          </div>

          <div>
            <p className="font-medium text-slate-100 mb-1">Age range</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-700 px-2 py-1 text-xs bg-slate-900 text-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
              <span className="text-xs text-slate-300">to</span>
              <input
                type="number"
                placeholder="Max"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-700 px-2 py-1 text-xs bg-slate-900 text-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-100 mb-1">
              Previous diagnosis
            </label>
            <select
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 px-2 py-1 text-xs bg-slate-900 text-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">All</option>
              <option value="Alzheimer">Alzheimer</option>
              <option value="MCI">MCI</option>
              <option value="No diagnosis">No diagnosis</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-100 mb-1">
              Main symptom
            </label>
            <select
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              className="block w-full rounded-lg border border-slate-700 px-2 py-1 text-xs bg-slate-900 text-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">Any</option>
              <option value="Memory loss">Memory loss</option>
              <option value="Difficulty concentrating">
                Difficulty concentrating
              </option>
              <option value="Difficulty finding words">
                Difficulty finding words
              </option>
              <option value="Mood changes">Mood changes</option>
            </select>
          </div>

          <p className="text-[11px] text-slate-400">
            These filters are an initial scheme based on clinical pre-screening. Later they will be
            connected to real patient data.
          </p>
        </div>
      </section>

      {/* Columna central: resultados */}
      <section className="w-[22%] h-full border-r border-slate-800 bg-slate-950/80 overflow-y-auto p-4 text-sm flex flex-col resize-x cursor-col-resize min-w-[220px] max-w-[45%]" id="explore-patient-list">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-50">Matched patients</h2>
          <span className="text-xs text-slate-400">{totalResults} results</span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {filteredPatients.map((p) => (
            <article
              key={p.id}
              data-patient-id={p.id}
              className={`border rounded-lg p-3 bg-slate-950/80 hover:border-sky-500 hover:bg-slate-900/80 hover:shadow-[0_0_18px_rgba(56,189,248,0.25)] transition-colors cursor-pointer text-sm ${
                selectedPatientId === p.id ? "border-sky-500 shadow-[0_0_20px_rgba(56,189,248,0.35)]" : "border-slate-800"
              }`}
              onClick={() => setSelectedPatientId(p.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-50 text-sm">
                  {p.nombre} <span className="text-xs text-slate-400">({p.id})</span>
                </h3>
                {p.estadoPaciente === "Eligible" && (
                  <span className="text-[11px] px-2 py-1 rounded-full border bg-emerald-500/10 border-emerald-400/60 text-emerald-300">
                    Eligible
                  </span>
                )}
                {p.estadoPaciente === "To review" && (
                  <span className="text-[11px] px-2 py-1 rounded-full border bg-amber-500/10 border-amber-400/60 text-amber-300">
                    To review
                  </span>
                )}
                {p.estadoPaciente === "Not eligible" && (
                  <span className="text-[11px] px-2 py-1 rounded-full border bg-rose-500/10 border-rose-400/60 text-rose-300">
                    Not eligible
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mb-1">
                Age: <span className="font-medium">{p.edad}</span> · Previous diagnosis:
                <span className="font-medium"> {p.diagnosticoPrevio}</span>
              </p>
              <p className="text-xs text-slate-300">Symptoms: {p.sintomaPrincipal}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Columna derecha: mapa (ocupa el resto) */}
      <section className="flex-1 h-full p-4 text-sm flex flex-col bg-slate-950/80">
        <div className="mb-3 flex items-center justify-between text-slate-100 text-sm">
          <h2 className="text-base font-semibold">Patient map</h2>
          <span className="text-xs text-slate-400">{totalResults} points</span>
        </div>
        <div className="flex-1 min-h-0">
          <ExploreMap
            patients={filteredPatients}
            showHospitals={showHospitals}
            onSelectPatient={(id) => {
              setSelectedPatientId(id);
              const listEl = document.getElementById("explore-patient-list");
              const cardEl = listEl?.querySelector<HTMLElement>(`[data-patient-id="${id}"]`);
              if (listEl && cardEl) {
                cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            }}
          />
        </div>
      </section>
    </div>
  );
}

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
  estadoPaciente: "Elegible" | "A revisar" | "No elegible";
  lng: number;
  lat: number;
};

type ExploreMapProps = {
  patients: Patient[];
  showHospitals: boolean;
};

function ExploreMap({ patients, showHospitals }: ExploreMapProps) {
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
      // Registrar imagen animada
      if (!map.hasImage("pulsing-dot")) {
        map.addImage("pulsing-dot", pulsingDot, { pixelRatio: 2 });
      }

      // Fuente con puntos sobre hospitales públicos de CABA
      if (!map.getSource("pulsing-dot-source")) {
        map.addSource("pulsing-dot-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: hospitalPoints.map((coordinates) => ({
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "Point" as const,
                coordinates,
              },
            })),
          },
        });
      }

      // Capa que usa la imagen animada
      if (!map.getLayer("pulsing-dot-layer")) {
        map.addLayer({
          id: "pulsing-dot-layer",
          type: "symbol",
          source: "pulsing-dot-source",
          layout: {
            "icon-image": "pulsing-dot",
            "icon-allow-overlap": true,
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

    // Limpiar marcadores previos guardados en el mapa
    const prevMarkers = (map as any)._patientMarkers as mapboxgl.Marker[] | undefined;
    if (prevMarkers && Array.isArray(prevMarkers)) {
      prevMarkers.forEach((m) => m.remove());
    }

    const markers: mapboxgl.Marker[] = [];
    const bounds = new mapboxgl.LngLatBounds();

    // Centro de referencia para "compactar" los puntos mock sobre CABA
    const compactCenter: [number, number] = [-58.41, -34.6];
    const compactFactor = 0.8; // 1 = posiciones originales, <1 los acerca al centro

    // Offsets para ajustar la posición en pantalla
    const lngOffset = -0.07; // desplazar a la izquierda (oeste)
    const latOffset = -0.02; // desplazar hacia abajo (sur)

    patients.forEach((p) => {
      const studyColor =
        p.estudioClinico === "Alzheimer-Aducanumab-2023-06-01"
          ? "#22c55e" // verde
          : p.estudioClinico === "Alzheimer-Lecanemab-2022-11-15"
          ? "#0ea5e9" // celeste
          : p.estudioClinico === "Parkinson-Prasinezumab-2021-09-30"
          ? "#f97316" // naranja
          : p.estudioClinico === "Parkinson-Tavapadon-2020-04-20"
          ? "#a855f7" // violeta
          : "#ef4444"; // rojo para Cancer de mama-Pertuzumab-2019-02-10
      const compactedLng =
        compactCenter[0] + (p.lng - compactCenter[0]) * compactFactor;
      const compactedLat =
        compactCenter[1] + (p.lat - compactCenter[1]) * compactFactor;

      const shiftedLng = compactedLng + lngOffset;
      const shiftedLat = compactedLat + latOffset;

      const pseudoId = `SCR-${p.id}`;

      const mocaScore =
        p.estadoPaciente === "Elegible"
          ? "26/30"
          : p.estadoPaciente === "A revisar"
          ? "23/30"
          : "—";

      const eligibilityReasons =
        p.estadoPaciente === "Elegible"
          ? ["Cumple rango etario.", "Sin comorbilidades excluyentes."]
          : p.estadoPaciente === "A revisar"
          ? ["Verificar comorbilidades y score cognitivo."]
          : ["No cumple criterios de inclusión o presenta criterios de exclusión."];

      const phase =
        p.estudioClinico.startsWith("Alzheimer-") ||
        p.estudioClinico.startsWith("Cancer de mama-")
          ? "III"
          : "II";

      const target =
        p.estudioClinico.startsWith("Alzheimer-Aducanumab")
          ? "Alzheimer leve"
          : p.estudioClinico.startsWith("Alzheimer-Lecanemab")
          ? "MCI / Alzheimer temprano"
          : p.estudioClinico.startsWith("Parkinson-Prasinezumab")
          ? "Parkinson temprano"
          : p.estudioClinico.startsWith("Parkinson-Tavapadon")
          ? "Parkinson leve-moderado"
          : "HER2+ cáncer de mama";

      const cidFilecoin = `bafy-${p.id.toLowerCase()}`;
      const inputHash = `0x${p.id.replace(/[^0-9]/g, "").padEnd(8, "0")}`;
      const engineVersion = "v1.3.2";
      const engineHash = "0x9f3a21";

      const marker = new mapboxgl.Marker({ color: studyColor })
        .setLngLat([shiftedLng, shiftedLat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(
            `
<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #020617; max-width: 260px;">
  <!-- 1. Identidad seudonimizada -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
    <div>
      <div style="font-weight:600;">
        Paciente ${p.nombre.split(" ")[1]} <span style="color:#64748b;">(${p.id})</span>
      </div>
      <div style="font-size:10px; color:#475569; margin-top:2px;">
        Pseudo-ID: <span style="font-weight:500;">${pseudoId}</span>
      </div>
    </div>
    <span
      style="padding:2px 6px; border-radius:999px; border:1px solid ${
        p.estadoPaciente === "Elegible"
          ? "#bbf7d0"
          : p.estadoPaciente === "A revisar"
          ? "#fed7aa"
          : "#fecaca"
      }; background-color:${
        p.estadoPaciente === "Elegible"
          ? "#ecfdf3"
          : p.estadoPaciente === "A revisar"
          ? "#fffbeb"
          : "#fef2f2"
      }; color:${
        p.estadoPaciente === "Elegible"
          ? "#15803d"
          : p.estadoPaciente === "A revisar"
          ? "#b45309"
          : "#b91c1c"
      }; font-size:10px; white-space:nowrap;">
      ${p.estadoPaciente === "A revisar" ? "Revisión requerida" : p.estadoPaciente}
    </span>
  </div>

  <!-- 3. Datos clínicos -->
  <div style="margin-bottom:6px; padding:4px 6px; background-color:#f8fafc; border-radius:6px;">
    <div style="margin-bottom:2px; color:#0f172a;">
      <strong>Datos clínicos</strong>
    </div>
    <ul style="list-style:none; padding-left:0; margin:0;">
      <li>Edad: <span style="font-weight:500;">${p.edad}</span></li>
      <li>Dx previo: <span style="font-weight:500;">${p.diagnosticoPrevio}</span></li>
      <li>Síntomas principales: <span>${p.sintomaPrincipal}</span></li>
      <li>MoCA: <span style="font-weight:500;">${mocaScore}</span></li>
      <li style="margin-top:2px;">
        Razón de elegibilidad:
        <ul style="margin:2px 0 0 12px; padding:0;">
          ${eligibilityReasons
            .map(
              (r) =>
                `<li style="list-style:disc;">${r}</li>`
            )
            .join("")}
        </ul>
      </li>
    </ul>
  </div>

  <!-- 4. Información del estudio -->
  <div style="margin-bottom:6px; padding:4px 6px; background-color:#f9fafb; border-radius:6px; border:1px solid #e5e7eb;">
    <div style="margin-bottom:2px; color:#0f172a; display:flex; align-items:center; gap:4px;">
      <span style="display:inline-block; width:8px; height:8px; border-radius:999px; background-color:${studyColor};"></span>
      <strong>Información del estudio</strong>
    </div>
    <div style="font-size:10px; color:#111827;">
      Estudio: <span style="font-weight:500;">${p.estudioClinico}</span><br/>
      Fase: <span style="font-weight:500;">${phase}</span><br/>
      Target: <span style="font-weight:500;">${target}</span>
    </div>
  </div>

  <!-- 5. Auditoría y blockchain -->
  <div style="margin-bottom:6px; padding:4px 6px; background-color:#0f172a; color:#e5e7eb; border-radius:6px; font-size:10px;">
    <div style="font-weight:600; margin-bottom:2px;">Auditoría & blockchain</div>
    <div>CID Filecoin: <span style="font-family:monospace;">${cidFilecoin}</span></div>
    <div>Input Hash: <span style="font-family:monospace;">${inputHash}</span></div>
    <div>Motor: <span style="font-weight:500;">${engineVersion}</span> (hash <span style="font-family:monospace;">${engineHash}</span>)</div>
  </div>

  <!-- 6. Accesos a credenciales -->
  <div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;">
    <a
      href="/patient/${encodeURIComponent(p.id)}"
      style="display:inline-flex; justify-content:center; align-items:center; margin-bottom:4px; padding:4px 8px; border-radius:999px; border:1px solid #0f172a; background-color:#0f172a; color:#f9fafb; font-size:10px; font-weight:500; text-decoration:none;">
      Ver detalle del paciente
    </a>
    <a
      href="https://vc.example.com/user/${encodeURIComponent(p.id)}"
      target="_blank"
      rel="noreferrer"
      style="color:#0369a1; text-decoration:underline; font-weight:500;">
      Ver Verified Credential del usuario
    </a>
    <a
      href="https://vc.example.com/process/${encodeURIComponent(p.estudioClinico)}"
      target="_blank"
      rel="noreferrer"
      style="color:#0369a1; text-decoration:underline; font-weight:500;">
      Ver Verified Credential del proceso
    </a>
    <div style="font-size:9px; color:#64748b; margin-top:2px;">
      Emitidas por Synk.Health · Oasis TEE Attestation
    </div>
  </div>
</div>
            `.trim()
          )
        )
        .addTo(map);

      markers.push(marker);
      bounds.extend([shiftedLng, shiftedLat]);
    });

    (map as any)._patientMarkers = markers;

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    }
  }, [patients]);

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

// Encargado de obtener la información de pacientes desde otro servicio de backend.
// Por ahora devuelve datos mockeados, que luego se reemplazarán por una llamada real (fetch/axios, etc.).
async function fetchPatientsFromBackend(): Promise<Patient[]> {
  // TODO: reemplazar por llamada real al servicio de backend
  return [
    {
      id: "P-001",
      nombre: "Paciente 001",
      edad: 68,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Pérdida de memoria, Dificultad para concentrarse",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Elegible",
      lng: -58.38157,
      lat: -34.60374,
    },
    {
      id: "P-002",
      nombre: "Paciente 002",
      edad: 61,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Dificultad para encontrar palabras",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "A revisar",
      lng: -58.3981,
      lat: -34.5827,
    },
    {
      id: "P-003",
      nombre: "Paciente 003",
      edad: 73,
      diagnosticoPrevio: "Sin diagnóstico",
      sintomaPrincipal: "Cambios en el estado de ánimo",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "No elegible",
      lng: -58.43,
      lat: -34.615,
    },
    {
      id: "P-004",
      nombre: "Paciente 004",
      edad: 58,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Pérdida de memoria",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Elegible",
      lng: -58.39,
      lat: -34.61,
    },
    {
      id: "P-005",
      nombre: "Paciente 005",
      edad: 65,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Dificultad para concentrarse",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "A revisar",
      lng: -58.37,
      lat: -34.59,
    },
    {
      id: "P-006",
      nombre: "Paciente 006",
      edad: 72,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Cambios en el estado de ánimo",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "No elegible",
      lng: -58.41,
      lat: -34.62,
    },
    {
      id: "P-007",
      nombre: "Paciente 007",
      edad: 69,
      diagnosticoPrevio: "Sin diagnóstico",
      sintomaPrincipal: "Pérdida de memoria",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Elegible",
      lng: -58.42,
      lat: -34.6,
    },
    {
      id: "P-008",
      nombre: "Paciente 008",
      edad: 63,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Dificultad para encontrar palabras",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "A revisar",
      lng: -58.36,
      lat: -34.61,
    },
    {
      id: "P-009",
      nombre: "Paciente 009",
      edad: 70,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Dificultad para concentrarse",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "No elegible",
      lng: -58.4,
      lat: -34.59,
    },
    {
      id: "P-010",
      nombre: "Paciente 010",
      edad: 66,
      diagnosticoPrevio: "Sin diagnóstico",
      sintomaPrincipal: "Cambios en el estado de ánimo",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Elegible",
      lng: -58.38,
      lat: -34.6,
    },
    {
      id: "P-011",
      nombre: "Paciente 011",
      edad: 62,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Temblor en reposo",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Elegible",
      lng: -58.39,
      lat: -34.57,
    },
    {
      id: "P-012",
      nombre: "Paciente 012",
      edad: 59,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Rigidez muscular",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "A revisar",
      lng: -58.41,
      lat: -34.58,
    },
    {
      id: "P-013",
      nombre: "Paciente 013",
      edad: 71,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Lentitud motora",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "No elegible",
      lng: -58.43,
      lat: -34.56,
    },
    {
      id: "P-014",
      nombre: "Paciente 014",
      edad: 64,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Problemas de equilibrio",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "Elegible",
      lng: -58.37,
      lat: -34.57,
    },
    {
      id: "P-015",
      nombre: "Paciente 015",
      edad: 68,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Temblor en reposo",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "A revisar",
      lng: -58.35,
      lat: -34.58,
    },
    {
      id: "P-016",
      nombre: "Paciente 016",
      edad: 73,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Lentitud motora",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "No elegible",
      lng: -58.42,
      lat: -34.55,
    },
    {
      id: "P-017",
      nombre: "Paciente 017",
      edad: 57,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Rigidez muscular",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Elegible",
      lng: -58.44,
      lat: -34.57,
    },
    {
      id: "P-018",
      nombre: "Paciente 018",
      edad: 60,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Problemas de equilibrio",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "A revisar",
      lng: -58.39,
      lat: -34.54,
    },
    {
      id: "P-019",
      nombre: "Paciente 019",
      edad: 69,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Temblor en reposo",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "No elegible",
      lng: -58.33,
      lat: -34.59,
    },
    {
      id: "P-020",
      nombre: "Paciente 020",
      edad: 63,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Lentitud motora",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "Elegible",
      lng: -58.36,
      lat: -34.53,
    },
    {
      id: "P-021",
      nombre: "Paciente 021",
      edad: 55,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Nódulo palpable",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Elegible",
      lng: -58.4,
      lat: -34.62,
    },
    {
      id: "P-022",
      nombre: "Paciente 022",
      edad: 52,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Dolor mamario",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "A revisar",
      lng: -58.38,
      lat: -34.63,
    },
    {
      id: "P-023",
      nombre: "Paciente 023",
      edad: 59,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Alteraciones en mamografía",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "No elegible",
      lng: -58.35,
      lat: -34.64,
    },
    {
      id: "P-024",
      nombre: "Paciente 024",
      edad: 61,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Nódulo palpable",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Elegible",
      lng: -58.37,
      lat: -34.66,
    },
    {
      id: "P-025",
      nombre: "Paciente 025",
      edad: 56,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Dolor mamario",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "A revisar",
      lng: -58.42,
      lat: -34.63,
    },
    {
      id: "P-026",
      nombre: "Paciente 026",
      edad: 58,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Alteraciones en mamografía",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "No elegible",
      lng: -58.39,
      lat: -34.65,
    },
    {
      id: "P-027",
      nombre: "Paciente 027",
      edad: 54,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Pérdida de memoria",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Elegible",
      lng: -58.31,
      lat: -34.6,
    },
    {
      id: "P-028",
      nombre: "Paciente 028",
      edad: 67,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Dificultad para concentrarse",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "A revisar",
      lng: -58.32,
      lat: -34.61,
    },
    {
      id: "P-029",
      nombre: "Paciente 029",
      edad: 71,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Cambios en el estado de ánimo",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "No elegible",
      lng: -58.34,
      lat: -34.62,
    },
    {
      id: "P-030",
      nombre: "Paciente 030",
      edad: 69,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Pérdida de memoria",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "Elegible",
      lng: -58.33,
      lat: -34.6,
    },
    {
      id: "P-031",
      nombre: "Paciente 031",
      edad: 65,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Dificultad para encontrar palabras",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "A revisar",
      lng: -58.36,
      lat: -34.59,
    },
    {
      id: "P-032",
      nombre: "Paciente 032",
      edad: 74,
      diagnosticoPrevio: "Sin diagnóstico",
      sintomaPrincipal: "Cambios en el estado de ánimo",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "No elegible",
      lng: -58.37,
      lat: -34.58,
    },
    {
      id: "P-033",
      nombre: "Paciente 033",
      edad: 62,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Temblor en reposo",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Elegible",
      lng: -58.41,
      lat: -34.55,
    },
    {
      id: "P-034",
      nombre: "Paciente 034",
      edad: 60,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Rigidez muscular",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "A revisar",
      lng: -58.43,
      lat: -34.56,
    },
    {
      id: "P-035",
      nombre: "Paciente 035",
      edad: 70,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Lentitud motora",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "No elegible",
      lng: -58.45,
      lat: -34.57,
    },
    {
      id: "P-036",
      nombre: "Paciente 036",
      edad: 58,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Problemas de equilibrio",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "Elegible",
      lng: -58.4,
      lat: -34.58,
    },
    {
      id: "P-037",
      nombre: "Paciente 037",
      edad: 67,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Temblor en reposo",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "A revisar",
      lng: -58.38,
      lat: -34.55,
    },
    {
      id: "P-038",
      nombre: "Paciente 038",
      edad: 72,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Rigidez muscular",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "No elegible",
      lng: -58.35,
      lat: -34.54,
    },
    {
      id: "P-039",
      nombre: "Paciente 039",
      edad: 56,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Nódulo palpable",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Elegible",
      lng: -58.33,
      lat: -34.63,
    },
    {
      id: "P-040",
      nombre: "Paciente 040",
      edad: 53,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Dolor mamario",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "A revisar",
      lng: -58.36,
      lat: -34.64,
    },
    {
      id: "P-041",
      nombre: "Paciente 041",
      edad: 60,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Alteraciones en mamografía",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "No elegible",
      lng: -58.39,
      lat: -34.66,
    },
    {
      id: "P-042",
      nombre: "Paciente 042",
      edad: 57,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Nódulo palpable",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "Elegible",
      lng: -58.41,
      lat: -34.62,
    },
    {
      id: "P-043",
      nombre: "Paciente 043",
      edad: 55,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Dolor mamario",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "A revisar",
      lng: -58.37,
      lat: -34.61,
    },
    {
      id: "P-044",
      nombre: "Paciente 044",
      edad: 62,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Alteraciones en mamografía",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "No elegible",
      lng: -58.34,
      lat: -34.65,
    },
    {
      id: "P-045",
      nombre: "Paciente 045",
      edad: 69,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Pérdida de memoria",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "Elegible",
      lng: -58.32,
      lat: -34.57,
    },
    {
      id: "P-046",
      nombre: "Paciente 046",
      edad: 63,
      diagnosticoPrevio: "MCI",
      sintomaPrincipal: "Dificultad para encontrar palabras",
      estudioClinico: "Alzheimer-Lecanemab-2022-11-15",
      estadoPaciente: "A revisar",
      lng: -58.31,
      lat: -34.58,
    },
    {
      id: "P-047",
      nombre: "Paciente 047",
      edad: 75,
      diagnosticoPrevio: "Alzheimer",
      sintomaPrincipal: "Cambios en el estado de ánimo",
      estudioClinico: "Alzheimer-Aducanumab-2023-06-01",
      estadoPaciente: "No elegible",
      lng: -58.3,
      lat: -34.59,
    },
    {
      id: "P-048",
      nombre: "Paciente 048",
      edad: 61,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Temblor en reposo",
      estudioClinico: "Parkinson-Prasinezumab-2021-09-30",
      estadoPaciente: "Elegible",
      lng: -58.29,
      lat: -34.6,
    },
    {
      id: "P-049",
      nombre: "Paciente 049",
      edad: 59,
      diagnosticoPrevio: "Parkinson",
      sintomaPrincipal: "Rigidez muscular",
      estudioClinico: "Parkinson-Tavapadon-2020-04-20",
      estadoPaciente: "A revisar",
      lng: -58.28,
      lat: -34.61,
    },
    {
      id: "P-050",
      nombre: "Paciente 050",
      edad: 68,
      diagnosticoPrevio: "Cancer de mama",
      sintomaPrincipal: "Nódulo palpable",
      estudioClinico: "Cancer de mama-Pertuzumab-2019-02-10",
      estadoPaciente: "No elegible",
      lng: -58.27,
      lat: -34.62,
    },
  ];
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
    <div className="h-screen bg-slate-50 flex">
      {/* Columna izquierda: filtros */}
      <section className="w-[15%] h-full border-r border-slate-200 overflow-y-auto p-4 text-sm resize-x cursor-col-resize min-w-[180px] max-w-[40%]">
        <h2 className="text-base font-semibold text-black mb-3">Filtros clínicos</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-black">
            <input
              id="toggle-hospitals"
              type="checkbox"
              checked={showHospitals}
              onChange={(e) => setShowHospitals(e.target.checked)}
              className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="toggle-hospitals" className="select-none">
              Mostrar hospitales públicos
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Estudio clínico
            </label>
            <select
              value={selectedStudy}
              onChange={(e) => setSelectedStudy(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">Todos</option>
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
            <label className="block text-xs font-medium text-black mb-1">
              Estado del paciente
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">Todos</option>
              <option value="Elegible">Elegible</option>
              <option value="A revisar">A revisar</option>
              <option value="No elegible">No elegible</option>
            </select>
          </div>

          <div>
            <p className="font-medium text-black mb-1">Rango de edad</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Mín"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-300 px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
              <span className="text-xs text-black">a</span>
              <input
                type="number"
                placeholder="Máx"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-300 px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-black mb-1">
              Diagnóstico previo
            </label>
            <select
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
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
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
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
          <span className="text-xs text-black/70">{totalResults} resultados</span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {filteredPatients.map((p) => (
            <article
              key={p.id}
              className="border border-slate-200 rounded-lg p-3 hover:border-sky-500 hover:shadow-sm transition-colors cursor-pointer text-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-black text-sm">
                  {p.nombre} <span className="text-xs text-black/70">({p.id})</span>
                </h3>
                {p.estadoPaciente === "Elegible" && (
                  <span className="text-[11px] px-2 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
                    Elegible
                  </span>
                )}
                {p.estadoPaciente === "A revisar" && (
                  <span className="text-[11px] px-2 py-1 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                    A revisar
                  </span>
                )}
                {p.estadoPaciente === "No elegible" && (
                  <span className="text-[11px] px-2 py-1 rounded-full border bg-rose-50 border-rose-200 text-rose-700">
                    No elegible
                  </span>
                )}
              </div>
              <p className="text-xs text-black/80 mb-1">
                Edad: <span className="font-medium">{p.edad}</span> · Diagnóstico previo:
                <span className="font-medium"> {p.diagnosticoPrevio}</span>
              </p>
              <p className="text-xs text-black/80">Síntomas: {p.sintomaPrincipal}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Columna derecha: mapa (ocupa el resto) */}
      <section className="flex-1 h-full p-4 text-sm flex flex-col">
        <div className="mb-3 flex items-center justify-between text-black text-sm">
          <h2 className="text-base font-semibold">Mapa de pacientes</h2>
          <span className="text-xs text-black/70">{totalResults} puntos</span>
        </div>
        <div className="flex-1 min-h-0">
          <ExploreMap patients={filteredPatients} showHospitals={showHospitals} />
        </div>
      </section>
    </div>
  );
}

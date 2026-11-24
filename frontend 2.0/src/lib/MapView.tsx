import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { USER_LOCATION } from "./constants";

export type FacType = "phc" | "chc" | "district" | "private";

const PIN_COLOR: Record<FacType, string> = {
  phc: "var(--mint)",
  chc: "var(--lavender)",
  district: "var(--coral)",
  private: "var(--amber)",
};

export interface FacilityPin {
  id: string | number;
  type: FacType;
  lat: number;
  lng: number;
}

export function MapView({
  facilities,
  selectedId,
  onSelect,
  className = "",
  interactive = true,
  userPin = false,
  center,
}: {
  facilities: FacilityPin[];
  selectedId?: string | number | null;
  onSelect?: (id: string | number) => void;
  className?: string;
  interactive?: boolean;
  userPin?: boolean;
  center?: { lat: number; lng: number };
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /* init once — defensively guarded so a Leaflet failure can never crash the app */
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    let map: L.Map | null = null;
    let layer: L.LayerGroup | null = null;
    try {
      map = L.map(divRef.current, {
        center: [center?.lat ?? USER_LOCATION.lat, center?.lng ?? USER_LOCATION.lng],
        zoom: 10,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        touchZoom: interactive,
        attributionControl: false,
        doubleClickZoom: interactive,
        tapHold: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        crossOrigin: true,
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = layer;
    } catch (e) {
      console.warn("[SwasthyaSetu] map init failed:", e);
      return;
    }

    const t1 = setTimeout(() => {
      try {
        map?.invalidateSize();
      } catch {
        /* noop */
      }
    }, 120);
    const t2 = setTimeout(() => {
      try {
        map?.invalidateSize();
      } catch {
        /* noop */
      }
    }, 700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      try {
        map?.remove();
      } catch {
        /* noop */
      }
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [interactive]);

  /* sync markers */
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    try {
      layer.clearLayers();
      if (userPin) {
        L.marker([USER_LOCATION.lat, USER_LOCATION.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="lpin" style="--pin:#1e88e5; width:16px;height:16px;border:3px solid #fff; box-shadow:0 0 0 3px oklch(0.6 0.13 230 / 0.35)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(layer);
      }
      for (const f of facilities) {
        const marker = L.marker([f.lat, f.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="lpin ${f.id === selectedId ? "sel" : ""}" style="--pin:${PIN_COLOR[f.type]}"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        });
        marker.on("click", () => onSelectRef.current?.(f.id));
        marker.addTo(layer);
      }
    } catch (e) {
      console.warn("[SwasthyaSetu] marker sync failed:", e);
    }
  }, [facilities, selectedId, userPin]);

  /* fly to selection */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId == null) return;
    const f = facilities.find((x) => String(x.id) === String(selectedId));
    if (f) {
      try {
        map.flyTo([f.lat, f.lng], 12, { duration: 1.1 });
      } catch {
        /* noop */
      }
    }
  }, [selectedId, facilities]);

  /* recentre when a location filter changes */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    try {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 9), { animate: true, duration: 0.8 });
    } catch {
      /* noop */
    }
  }, [center]);

  return <div ref={divRef} className={className} />;
}

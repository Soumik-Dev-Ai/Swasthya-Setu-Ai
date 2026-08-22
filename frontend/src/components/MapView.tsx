import { Map, Marker, Overlay, type TileComponentProps } from "pigeon-maps";
import { useState } from "react";

interface MapFacility {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface MapViewProps {
  cityLat: number;
  cityLon: number;
  facilities: MapFacility[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mapTypeId: "roadmap" | "satellite" | "hybrid";
}

// Default OSM tiles (Light/Street)
const osmProvider = (x: number, y: number, z: number) => {
  return `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;
};

// ArcGIS World Imagery (Satellite) - free public ESRI layer
const satelliteProvider = (x: number, y: number, z: number) => {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
};

function MapTile({ tile, tileLoaded, onError }: TileComponentProps & { onError: () => void }) {
  return (
    <img
      src={tile.url}
      srcSet={tile.srcSet}
      alt=""
      onLoad={tileLoaded}
      onError={onError}
      style={{ position: "absolute", left: tile.left, top: tile.top, width: tile.width, height: tile.height }}
    />
  );
}

export function MapView({
  cityLat,
  cityLon,
  facilities,
  selectedId,
  onSelect,
  mapTypeId,
}: MapViewProps) {
  const [infoOpen, setInfoOpen] = useState<string | null>(selectedId);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const activeProvider = mapTypeId === "satellite" || mapTypeId === "hybrid" ? satelliteProvider : osmProvider;

  return (
    <div className="relative h-[400px] lg:h-[520px] w-full overflow-hidden rounded-[6px]">
      <Map
        
        defaultCenter={[cityLat, cityLon]}
        defaultZoom={12}
        provider={activeProvider}
        tileComponent={(props) => <MapTile {...props} onError={() => setMapUnavailable(true)} />}
        attribution={false}
      >
        {facilities.map((f) => (
          <Marker
            key={f.id}
            width={32}
            anchor={[f.lat, f.lon]}
            color={selectedId === f.id ? "#34f5b1" : "#4ee6f0"}
            onClick={() => {
              onSelect(f.id);
              setInfoOpen(f.id);
            }}
          />
        ))}

        {infoOpen && (
          <Overlay
            anchor={[
              facilities.find((x) => x.id === infoOpen)?.lat ?? cityLat,
              facilities.find((x) => x.id === infoOpen)?.lon ?? cityLon,
            ]}
            offset={[100, 80]}
          >
            <div className="w-48 rounded-md border border-white/10 bg-abyss/90 p-3 text-xs text-frost shadow-xl backdrop-blur">
              <strong className="mb-2 block text-white">{facilities.find((x) => x.id === infoOpen)?.name}</strong>
              <div className="mt-1 border-t border-white/10 pt-2">
                <a
                  href={
                    "https://www.google.com/maps/dir/?api=1&destination=" +
                    (facilities.find((x) => x.id === infoOpen)?.lat ?? cityLat) +
                    "," +
                    (facilities.find((x) => x.id === infoOpen)?.lon ?? cityLon)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cyanx hover:text-mint"
                >
                  Get directions &rarr;
                </a>
              </div>
            </div>
          </Overlay>
        )}
      </Map>
      {mapUnavailable && (
        <div role="status" aria-live="polite" className="absolute inset-x-3 bottom-3 rounded-md border border-amber/30 bg-abyss/95 p-3 text-xs text-amber shadow-lg">
          Map tiles are unavailable right now. Use the facility list or Get directions links below.
        </div>
      )}
    </div>
  );
}

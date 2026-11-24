import { useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

/** pastel palette mirroring the CSS accents (three.js-safe hex) */
const PALETTE = ["#ee7b5c", "#6fd1a8", "#b394e0", "#f0b53f", "#7db2ec"];

type ShapeDef = {
  kind: "ico" | "torus" | "knot" | "sphere" | "octa";
  pos: [number, number, number];
  scale: number;
  color: string;
  speed: number;
};

function Shapes({ defs, depth = 0.0 }: { defs: ShapeDef[]; depth: number }) {
  return (
    <>
      {defs.map((d, i) => (
        <Shape key={i} def={d} depth={depth} />
      ))}
    </>
  );
}

function Shape({ def, depth }: { def: ShapeDef; depth: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.x = def.pos[0] + state.pointer.x * depth;
    ref.current.position.y = def.pos[1] + state.pointer.y * depth;
    ref.current.rotation.z = t * 0.05 * def.speed;
  });
  const geo = () => {
    switch (def.kind) {
      case "ico":
        return <icosahedronGeometry args={[1, 0]} />;
      case "torus":
        return <torusGeometry args={[1, 0.34, 24, 64]} />;
      case "knot":
        return <torusKnotGeometry args={[0.72, 0.26, 96, 20]} />;
      case "octa":
        return <octahedronGeometry args={[1, 0]} />;
      default:
        return <sphereGeometry args={[0.9, 48, 48]} />;
    }
  };
  return (
    <Float speed={1.4 * def.speed} rotationIntensity={0.5} floatIntensity={1.6}>
      <mesh ref={ref} position={def.pos} scale={def.scale}>
        {geo()}
        <meshStandardMaterial color={def.color} roughness={0.25} metalness={0.05} transparent opacity={0.82} flatShading />
      </mesh>
    </Float>
  );
}

function Rig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.22, 0.045);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -state.pointer.y * 0.16, 0.045);
  });
  return <group ref={group}>{children}</group>;
}

const HERO_DEFS: ShapeDef[] = [
  { kind: "ico", pos: [-4.6, 2.1, -1.5], scale: 1.7, color: PALETTE[0], speed: 0.8 },
  { kind: "torus", pos: [4.8, 2.4, -2], scale: 1.25, color: PALETTE[1], speed: 1.1 },
  { kind: "knot", pos: [0.2, -0.6, 0.4], scale: 1.1, color: PALETTE[2], speed: 0.7 },
  { kind: "sphere", pos: [-2.4, -2.6, -1], scale: 0.85, color: PALETTE[3], speed: 1.2 },
  { kind: "octa", pos: [3.2, -2.2, -0.6], scale: 0.95, color: PALETTE[4], speed: 0.9 },
  { kind: "torus", pos: [-0.4, 3.3, -2.6], scale: 0.55, color: PALETTE[4], speed: 1.4 },
  { kind: "ico", pos: [6.4, -0.6, -3], scale: 0.6, color: PALETTE[0], speed: 1.0 },
];

const CLOSE_DEFS: ShapeDef[] = [
  { kind: "knot", pos: [-3.6, 1.6, -0.8], scale: 1.9, color: PALETTE[0], speed: 0.8 },
  { kind: "ico", pos: [3.8, 1.9, -1.2], scale: 1.8, color: PALETTE[1], speed: 1.0 },
  { kind: "torus", pos: [0.1, -1.4, 0.6], scale: 1.7, color: PALETTE[2], speed: 0.9 },
  { kind: "sphere", pos: [-4.8, -2.2, -1.4], scale: 1.05, color: PALETTE[3], speed: 1.2 },
  { kind: "octa", pos: [4.6, -2.6, -1], scale: 1.1, color: PALETTE[4], speed: 1.1 },
];

export function HeroCanvas({ close = false }: { close?: boolean }) {
  const defs = close ? CLOSE_DEFS : HERO_DEFS;
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 42 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={1.05} />
      <directionalLight position={[6, 6, 4]} intensity={1.5} />
      <directionalLight position={[-6, -3, -2]} intensity={0.5} color="#ffd9c2" />
      <Rig>
        <Shapes defs={defs} depth={close ? 1.6 : 1.15} />
      </Rig>
    </Canvas>
  );
}

/* ---------- CSS blob fallback for low-end / mobile ---------- */
export function BlobFallback({ close = false }: { close?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute rounded-full opacity-60 blur-3xl"
        style={{ width: "42vmax", height: "42vmax", left: "-8vmax", top: "-6vmax", background: "radial-gradient(circle at 30% 30%, var(--coral), transparent 65%)", animation: "blob-a 14s ease-in-out infinite" }}
      />
      <div
        className="absolute rounded-full opacity-60 blur-3xl"
        style={{ width: "36vmax", height: "36vmax", right: "-10vmax", top: "10vmax", background: "radial-gradient(circle at 60% 40%, var(--mint), transparent 65%)", animation: "blob-b 16s ease-in-out infinite" }}
      />
      <div
        className="absolute rounded-full opacity-55 blur-3xl"
        style={{ width: "30vmax", height: "30vmax", left: "20vmax", bottom: close ? "-10vmax" : "-14vmax", background: "radial-gradient(circle at 50% 50%, var(--lavender), transparent 65%)", animation: "blob-c 18s ease-in-out infinite" }}
      />
      <div
        className="absolute rounded-full opacity-50 blur-3xl"
        style={{ width: "20vmax", height: "20vmax", right: "14vmax", bottom: "6vmax", background: "radial-gradient(circle at 50% 50%, var(--amber), transparent 65%)", animation: "blob-b 20s ease-in-out infinite reverse" }}
      />
    </div>
  );
}

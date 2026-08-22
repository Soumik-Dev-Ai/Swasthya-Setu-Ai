import { useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Line, PerspectiveCamera, Sparkles } from "@react-three/drei";
import * as THREE from "three";

interface NodePoint {
  position: [number, number, number];
  phase: number;
}

function DataNodes({ reduceMotion }: { reduceMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const pointer = useThree((state) => state.pointer);
  const nodes = useMemo<NodePoint[]>(() => Array.from({ length: 52 }, (_, index) => {
    const angle = (index / 52) * Math.PI * 2;
    const radius = 2.1 + ((index * 17) % 23) / 20;
    return { position: [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, ((index % 7) - 3) * 0.18] as [number, number, number], phase: index * 0.37 };
  }), []);
  const links = useMemo(() => nodes.slice(0, 24).map((node, index) => [node.position, nodes[(index + 3) % nodes.length].position] as [[number, number, number], [number, number, number]]), [nodes]);

  useFrame((_, delta) => {
    if (!group.current) return;
    elapsed.current += delta;
    if (reduceMotion) {
      group.current.rotation.set(0, 0, 0);
      return;
    }
    group.current.rotation.z = elapsed.current * 0.012;
    group.current.rotation.x = pointer.y * 0.04;
    group.current.rotation.y = pointer.x * 0.04;
  });

  return (
    <group ref={group} position={[1.1, -0.2, -0.8]}>
      {links.map((points, index) => <Line key={`link-${index}`} points={points} color="#3ccbe2" transparent opacity={0.11} lineWidth={0.6} />)}
      {nodes.map((node, index) => (
        <mesh key={`node-${index}`} position={node.position}>
          <sphereGeometry args={[index % 5 === 0 ? 0.035 : 0.018, 8, 8]} />
          <meshBasicMaterial color={index % 5 === 0 ? "#5de3ff" : "#2ba6bb"} transparent opacity={index % 5 === 0 ? 0.9 : 0.46} />
        </mesh>
      ))}
    </group>
  );
}

function HeroShield({ reduceMotion }: { reduceMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const pointer = useThree((state) => state.pointer);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!group.current) return;
    elapsed.current += delta;
    if (reduceMotion) {
      group.current.rotation.set(0, 0, 0);
      return;
    }
    group.current.rotation.z = elapsed.current * 0.12;
    target.set(pointer.y * 0.18, pointer.x * 0.22, 0);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, target.x, 0.035);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, target.y, 0.035);
  });

  return (
    <Float speed={reduceMotion ? 0 : 1.25} rotationIntensity={reduceMotion ? 0 : 0.18} floatIntensity={reduceMotion ? 0 : 0.55}>
      <group ref={group} position={[0.45, 0.05, 0]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[1.38, 0.018, 12, 64]} />
          <meshBasicMaterial color="#5de3ff" transparent opacity={0.5} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[1.62, 0.008, 8, 64]} />
          <meshBasicMaterial color="#35e3a1" transparent opacity={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.12]}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#b6fbff" emissive="#38cbd9" emissiveIntensity={3.6} metalness={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.2]}>
          <boxGeometry args={[0.32, 1.22, 0.14]} />
          <meshStandardMaterial color="#e7ffff" emissive="#2dd4bf" emissiveIntensity={2.1} metalness={0.2} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0, 0.2]}>
          <boxGeometry args={[1.22, 0.32, 0.14]} />
          <meshStandardMaterial color="#e7ffff" emissive="#2dd4bf" emissiveIntensity={2.1} metalness={0.2} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0, -0.08]} rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[1.05, 0.025, 10, 64]} />
          <meshBasicMaterial color="#35e3a1" transparent opacity={0.72} />
        </mesh>
        <mesh position={[1.65, 0.18, 0]} rotation={[0.3, 0.4, 0]}>
          <icosahedronGeometry args={[0.08, 1]} />
          <meshBasicMaterial color="#5de3ff" />
        </mesh>
        <mesh position={[-1.35, -0.35, 0]} rotation={[0.3, 0.4, 0]}>
          <icosahedronGeometry args={[0.05, 1]} />
          <meshBasicMaterial color="#35e3a1" />
        </mesh>
      </group>
    </Float>
  );
}

export function InteractiveScene() {
  const reduceMotion = Boolean(useReducedMotion());
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#07111f", 0)}>
        <PerspectiveCamera makeDefault position={[0, 0, 7]} fov={42} />
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 2, 3]} color="#5de3ff" intensity={6} distance={8} />
        <pointLight position={[-2, -1, 2]} color="#35e3a1" intensity={4} distance={7} />
        <DataNodes reduceMotion={reduceMotion} />
        <HeroShield reduceMotion={reduceMotion} />
        <Sparkles count={70} scale={[9, 5, 4]} size={1.3} speed={reduceMotion ? 0 : 0.18} color="#7aeaff" opacity={0.32} />
      </Canvas>
    </div>
  );
}

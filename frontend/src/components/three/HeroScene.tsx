import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { warp } from "./warp";

/**
 * Full-viewport cursor vector. Fed by a window-level pointermove listener so
 * header / overlay elements can never block the 3D reactivity.
 * Normalised: x ∈ [-1, 1], y ∈ [-1, 1] (screen-style, y up).
 */
const cursor3d = { x: 0, y: 0, seen: false };

/**
 * Magnetic particle network — rural offline data nodes.
 * Whole-group transforms only: zero per-frame allocation, zero layout cost.
 * During warp the field recedes into depth for a portal feel.
 */
function ParticleNetwork({ count = 200 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  const { positions, segmentPositions } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const pts: THREE.Vector3[] = [];
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 15;
      const y = (rand() - 0.5) * 8.5;
      const z = (rand() - 0.5) * 5;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const seg: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      let linked = 0;
      for (let j = i + 1; j < pts.length && linked < 2; j++) {
        if (pts[i].distanceTo(pts[j]) < 1.9) {
          seg.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
          linked++;
        }
      }
    }
    return { positions: pos, segmentPositions: new Float32Array(seg) };
  }, [count]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const g = group.current;
    const mx = cursor3d.seen ? cursor3d.x : pointer.x;
    const my = cursor3d.seen ? cursor3d.y : pointer.y;
    const k = warp.active ? 0.09 : 0.055;
    g.position.x += (mx * 2.6 - g.position.x) * k;
    g.position.y += (my * 1.7 - g.position.y) * k;
    g.position.z += ((warp.active ? -5.5 : 0) - g.position.z) * 0.08;
    g.rotation.y += delta * (warp.active ? 0.5 : 0.04);
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          color="#4ee6f0"
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[segmentPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#34f5b1" transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function shieldShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 1.18);
  s.bezierCurveTo(-0.3, 1.06, -1.12, 0.72, -1.12, 0.05);
  s.lineTo(-1.12, -0.62);
  s.bezierCurveTo(-1.12, -1.16, -0.55, -1.4, 0, -1.6);
  s.bezierCurveTo(0.55, -1.4, 1.12, -1.16, 1.12, -0.62);
  s.lineTo(1.12, 0.05);
  s.bezierCurveTo(1.12, 0.72, 0.3, 1.06, 0, 1.18);
  return s;
}

/**
 * The medical cross inside the shield.
 * Hyper-reactive cursor tracking:
 *  - rotation.x/y/z map to the mouse with strong targets + fast lerp,
 *  - position tracks the cursor (strong parallax magnetic effect),
 *  - scale breathes with cursor distance from centre.
 * On warp: rotation accelerates, scale balloons, Z flies into the camera.
 */
function MedicalCrossShield() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const floaters = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  const shape = useMemo(() => shieldShape(), []);
  const edges = useMemo(() => {
    const geo = new THREE.ShapeGeometry(shape, 24);
    return new THREE.EdgesGeometry(geo, 24);
  }, [shape]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const g = group.current;

    const mx = cursor3d.seen ? cursor3d.x : mouse.x;
    const my = cursor3d.seen ? cursor3d.y : mouse.y;
    const t = state.clock.elapsedTime;

    // aggressive targets, smooth spring-lerp — never raw snap
    const k = warp.active ? 0.28 : 0.095;
    const targetRotX = -my * 1.15;
    const targetRotY = mx * 1.4;
    const targetRotZ = mx * 0.34;
    const targetX = mx * 1.75;
    const targetY = my * 1.2 + Math.sin(t * 0.7) * 0.1;
    const dist = Math.min(1, Math.hypot(mx, my));
    const targetScale = 1.5 + dist * 0.5;

    g.rotation.x += (targetRotX - g.rotation.x) * k;
    g.rotation.y += (targetRotY - g.rotation.y) * k + delta * (warp.active ? 8.5 : 0.32);
    g.rotation.z += (targetRotZ - g.rotation.z) * 0.09;
    g.position.x += (targetX - g.position.x) * k;
    g.position.y += (targetY - g.position.y) * k;
    g.position.z += ((warp.active ? 7.6 : 0) - g.position.z) * (warp.active ? 0.15 : 0.1);
    g.scale.setScalar(
      g.scale.x + ((warp.active ? 6.4 : targetScale) - g.scale.x) * (warp.active ? 0.12 : 0.075)
    );

    if (ring.current) {
      ring.current.rotation.z -= delta * (warp.active ? 3.2 : 0.45);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = warp.active ? 0.95 : 0.5;
    }
    if (floaters.current) {
      floaters.current.rotation.y += delta * (warp.active ? 3.4 : 0.5);
      floaters.current.rotation.x = Math.sin(t * 0.3) * 0.45;
    }
  });

  return (
    <group position={[2.6, 0.1, 0]}>
      <group ref={group} scale={1.5}>
        {/* shield body */}
        <mesh geometry={new THREE.ShapeGeometry(shape, 24)}>
          <meshPhysicalMaterial
            color="#34f5b1"
            emissive="#123d31"
            emissiveIntensity={0.35}
            transparent
            opacity={0.1}
            roughness={0.25}
            metalness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* shield rim */}
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#4ee6f0" transparent opacity={0.55} />
        </lineSegments>
        {/* medical cross */}
        <mesh position={[0, 0.02, 0.02]}>
          <boxGeometry args={[0.62, 1.5, 0.24]} />
          <meshStandardMaterial color="#2ee8a8" emissive="#0f7a58" emissiveIntensity={0.85} metalness={0.55} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.02, 0.02]}>
          <boxGeometry args={[1.5, 0.62, 0.24]} />
          <meshStandardMaterial color="#2ee8a8" emissive="#0f7a58" emissiveIntensity={0.85} metalness={0.55} roughness={0.22} />
        </mesh>
        {/* orbit ring */}
        <mesh ref={ring} rotation={[Math.PI / 2.2, 0, 0]}>
          <torusGeometry args={[1.72, 0.012, 8, 90]} />
          <meshBasicMaterial color="#4ee6f0" transparent opacity={0.5} />
        </mesh>
        {/* orbiting wireframe nodes */}
        <group ref={floaters}>
          {[
            [1.9, 0.7, 0.2],
            [-1.75, -0.5, 0.5],
            [0.4, 2.0, -0.4],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <octahedronGeometry args={[0.14, 0]} />
              <meshBasicMaterial color={i % 2 ? "#34f5b1" : "#4ee6f0"} wireframe transparent opacity={0.55} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

export function HeroScene() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      cursor3d.x = (e.clientX / window.innerWidth) * 2 - 1;
      cursor3d.y = -((e.clientY / window.innerHeight) * 2 - 1);
      cursor3d.seen = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 8.2], fov: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={1.15} color="#d9f6ff" />
        <pointLight position={[0, 0, 2.4]} intensity={2.4} decay={0} color="#34f5b1" />
        <pointLight position={[-4, 2, -2]} intensity={1.7} decay={0} color="#4ee6f0" />
        <ParticleNetwork />
        <MedicalCrossShield />
      </Suspense>
    </Canvas>
  );
}

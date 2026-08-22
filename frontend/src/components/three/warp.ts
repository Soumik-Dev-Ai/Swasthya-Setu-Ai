/**
 * Shared warp state — the Landing flips this on "Continue";
 * the HeroScene's useFrame loop reads it every frame to drive
 * the cinematic camera-zoom transition.
 */
export const warp = { active: false };

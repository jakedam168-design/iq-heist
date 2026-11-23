import type { GoldBarSpawn, PropPlacement, RoomId, Vec2, WallRect } from './types';

/**
 * 3D Museum / Mansion Floorplan (36m wide x 28m deep)
 * X range: -18 to +18
 * Z range: -14 to +14
 *
 * Rooms:
 * - Main Lobby:   x in [-10, 10],  z in [1, 14]     (South-Central)
 * - Art Gallery:  x in [-18, -10], z in [-14, 14]   (West Wing)
 * - Guard Study:  x in [10, 18],   z in [-14, 14]   (East Wing)
 * - Storage Room: x in [-10, 10],  z in [-14, 1]    (North-Central + Exit Gate at z = -13.2)
 *
 * Doorways (all >= 3.6m wide for smooth 3rd-person navigation & zero snagging):
 * - Lobby <-> Art Gallery:   x = -10, z in [5.5, 9.5]   (4.0m wide)
 * - Lobby <-> Guard Study:   x = +10, z in [5.5, 9.5]   (4.0m wide)
 * - Lobby <-> Storage Room:  z = +1,  x in [-2.2, 2.2]  (4.4m wide)
 * - Storage <-> Art Gallery: x = -10, z in [-8.5, -4.5] (4.0m wide)
 * - Storage <-> Guard Study: x = +10, z in [-8.5, -4.5] (4.0m wide)
 */

export const MAP_HALF_W = 18;
export const MAP_HALF_D = 14;
export const WALL_HEIGHT = 4.6;
export const WALL_THICKNESS = 0.7;

export const ROBBER_SPAWN: Vec2 = { x: 0, z: 3.4 };
export const POLICE_SPAWN: Vec2 = { x: 0, z: 11.1 };
export const EXIT_GATE_POS: Vec2 = { x: 0, z: -12.7 };
export const EXIT_GATE_TRIGGER_RADIUS = 2.0;

// Police barrier during the 6-second Hide Phase (holds Police in South Vestibule z > 9.4)
export const POLICE_HIDE_BARRIER: WallRect = {
  id: 'police_hide_barrier',
  minX: -4.2,
  maxX: 4.2,
  minZ: 9.6,
  maxZ: 10.1,
  height: 3.0,
  kind: 'gate',
};

export const MUSEUM_WALLS: readonly WallRect[] = [
  // Outer Perimeter Walls
  { id: 'outer_north_w', minX: -18.35, maxX: -2.4, minZ: -14.35, maxZ: -13.65, kind: 'outer' },
  { id: 'outer_north_e', minX: 2.4, maxX: 18.35, minZ: -14.35, maxZ: -13.65, kind: 'outer' },
  { id: 'outer_north_gate_back', minX: -2.4, maxX: 2.4, minZ: -14.55, maxZ: -13.95, kind: 'gate' },
  { id: 'outer_south', minX: -18.35, maxX: 18.35, minZ: 13.65, maxZ: 14.35, kind: 'outer' },
  { id: 'outer_west', minX: -18.35, maxX: -17.65, minZ: -14.35, maxZ: 14.35, kind: 'outer' },
  { id: 'outer_east', minX: 17.65, maxX: 18.35, minZ: -14.35, maxZ: 14.35, kind: 'outer' },

  // Police Entrance Vestibule Jambs (frames South Police spawn nicely)
  { id: 'vestibule_w', minX: -4.5, maxX: -3.9, minZ: 9.8, maxZ: 13.65, kind: 'inner' },
  { id: 'vestibule_e', minX: 3.9, maxX: 4.5, minZ: 9.8, maxZ: 13.65, kind: 'inner' },

  // West Wing Divider (x = -10) with two 4m doorways: z in [-8.5, -4.5] and z in [5.5, 9.5]
  { id: 'div_west_n', minX: -10.35, maxX: -9.65, minZ: -13.65, maxZ: -8.5, kind: 'inner' },
  { id: 'div_west_m', minX: -10.35, maxX: -9.65, minZ: -4.5, maxZ: 5.5, kind: 'inner' },
  { id: 'div_west_s', minX: -10.35, maxX: -9.65, minZ: 9.5, maxZ: 13.65, kind: 'inner' },

  // East Wing Divider (x = +10) with two 4m doorways: z in [-8.5, -4.5] and z in [5.5, 9.5]
  { id: 'div_east_n', minX: 9.65, maxX: 10.35, minZ: -13.65, maxZ: -8.5, kind: 'inner' },
  { id: 'div_east_m', minX: 9.65, maxX: 10.35, minZ: -4.5, maxZ: 5.5, kind: 'inner' },
  { id: 'div_east_s', minX: 9.65, maxX: 10.35, minZ: 9.5, maxZ: 13.65, kind: 'inner' },

  // Central Horizontal Divider (Lobby / Storage at z = +1) with 4.4m doorway x in [-2.2, 2.2]
  { id: 'div_center_w', minX: -9.65, maxX: -2.2, minZ: 0.65, maxZ: 1.35, kind: 'inner' },
  { id: 'div_center_e', minX: 2.2, maxX: 9.65, minZ: 0.65, maxZ: 1.35, kind: 'inner' },

  // Structural Pillars & Built-in Wall Furniture (flush against walls or symmetrical columns)
  { id: 'pillar_lobby_nw', minX: -5.4, maxX: -4.4, minZ: 4.4, maxZ: 5.4, kind: 'pillar' },
  { id: 'pillar_lobby_ne', minX: 4.4, maxX: 5.4, minZ: 4.4, maxZ: 5.4, kind: 'pillar' },
  { id: 'pillar_storage_w', minX: -5.4, maxX: -4.4, minZ: -5.8, maxZ: -4.8, kind: 'pillar' },
  { id: 'pillar_storage_e', minX: 4.4, maxX: 5.4, minZ: -5.8, maxZ: -4.8, kind: 'pillar' },

  // Guard Study Bookshelves (flush against east wall)
  { id: 'study_bookshelf_n', minX: 16.55, maxX: 17.65, minZ: -11.4, maxZ: -6.2, height: 3.1, kind: 'bookshelf' },
  { id: 'study_bookshelf_s', minX: 16.55, maxX: 17.65, minZ: 1.8, maxZ: 7.0, height: 3.1, kind: 'bookshelf' },
  // Guard Study Security Desk
  { id: 'study_desk', minX: 12.6, maxX: 15.2, minZ: -2.1, maxZ: -0.7, height: 1.05, kind: 'desk' },
];

export const GOLD_BAR_SPAWNS: readonly GoldBarSpawn[] = [
  // Gold Bar 1: Art Gallery North Alcove
  { id: 'gold_gallery', room: 'art_gallery', x: -14.2, z: -10.4 },
  // Gold Bar 2: Guard Study South-East Vault Corner
  { id: 'gold_study', room: 'guard_study', x: 14.2, z: 10.2 },
  // Gold Bar 3: Storage Room West Crate Bay
  { id: 'gold_storage', room: 'storage_room', x: -6.8, z: -9.8 },
];

export const MUSEUM_PROPS: readonly PropPlacement[] = [
  // === MAIN LOBBY ===
  { id: 'p_lobby_plant_1', type: 'potted_plant', room: 'main_lobby', x: -8.3, z: 2.5, rotY: 0, colliderRadius: 0.5 },
  { id: 'p_lobby_plant_2', type: 'potted_plant', room: 'main_lobby', x: 8.3, z: 2.5, rotY: Math.PI / 2, colliderRadius: 0.5 },
  { id: 'p_lobby_plant_3', type: 'potted_plant', room: 'main_lobby', x: -8.3, z: 12.2, rotY: Math.PI, colliderRadius: 0.5 },
  { id: 'p_lobby_plant_4', type: 'potted_plant', room: 'main_lobby', x: 8.3, z: 12.2, rotY: 0, colliderRadius: 0.5 },
  { id: 'p_lobby_bench_1', type: 'gallery_bench', room: 'main_lobby', x: -6.2, z: 8.2, rotY: Math.PI / 2, colliderRadius: 0.7 },
  { id: 'p_lobby_bench_2', type: 'gallery_bench', room: 'main_lobby', x: 6.2, z: 8.2, rotY: Math.PI / 2, colliderRadius: 0.7 },
  { id: 'p_lobby_pedestal_1', type: 'marble_pedestal', room: 'main_lobby', x: -3.0, z: 2.5, rotY: 0, colliderRadius: 0.52 },
  { id: 'p_lobby_vase_1', type: 'golden_vase', room: 'main_lobby', x: 3.0, z: 2.5, rotY: 0, colliderRadius: 0.44 },
  { id: 'p_lobby_chair_1', type: 'velvet_chair', room: 'main_lobby', x: -7.8, z: 5.0, rotY: Math.PI / 2, colliderRadius: 0.52 },
  { id: 'p_lobby_chair_2', type: 'velvet_chair', room: 'main_lobby', x: 7.8, z: 5.0, rotY: -Math.PI / 2, colliderRadius: 0.52 },
  { id: 'p_lobby_trash_1', type: 'trash_can', room: 'main_lobby', x: -3.2, z: 12.4, rotY: 0, colliderRadius: 0.36 },
  { id: 'p_lobby_trash_2', type: 'trash_can', room: 'main_lobby', x: 3.2, z: 12.4, rotY: 0, colliderRadius: 0.36 },

  // === ART GALLERY (West Wing) ===
  { id: 'p_gal_pedestal_1', type: 'marble_pedestal', room: 'art_gallery', x: -14.2, z: -4.2, rotY: 0, colliderRadius: 0.52 },
  { id: 'p_gal_vase_1', type: 'golden_vase', room: 'art_gallery', x: -16.1, z: -7.5, rotY: 0, colliderRadius: 0.44 },
  { id: 'p_gal_vase_2', type: 'golden_vase', room: 'art_gallery', x: -16.1, z: 1.5, rotY: Math.PI / 2, colliderRadius: 0.44 },
  { id: 'p_gal_bench_1', type: 'gallery_bench', room: 'art_gallery', x: -13.8, z: 1.5, rotY: Math.PI / 2, colliderRadius: 0.7 },
  { id: 'p_gal_bench_2', type: 'gallery_bench', room: 'art_gallery', x: -13.8, z: 8.6, rotY: 0, colliderRadius: 0.7 },
  { id: 'p_gal_chair_1', type: 'velvet_chair', room: 'art_gallery', x: -16.2, z: 11.4, rotY: Math.PI / 2, colliderRadius: 0.52 },
  { id: 'p_gal_chair_2', type: 'velvet_chair', room: 'art_gallery', x: -11.8, z: 11.8, rotY: Math.PI, colliderRadius: 0.52 },
  { id: 'p_gal_plant_1', type: 'potted_plant', room: 'art_gallery', x: -16.2, z: -12.1, rotY: 0, colliderRadius: 0.5 },
  { id: 'p_gal_plant_2', type: 'potted_plant', room: 'art_gallery', x: -11.5, z: -12.1, rotY: Math.PI, colliderRadius: 0.5 },
  { id: 'p_gal_pedestal_2', type: 'marble_pedestal', room: 'art_gallery', x: -11.8, z: 3.4, rotY: 0, colliderRadius: 0.52 },
  { id: 'p_gal_trash_1', type: 'trash_can', room: 'art_gallery', x: -11.4, z: -2.8, rotY: 0, colliderRadius: 0.36 },

  // === GUARD STUDY (East Wing) ===
  { id: 'p_study_chair_1', type: 'velvet_chair', room: 'guard_study', x: 13.9, z: -3.4, rotY: 0, colliderRadius: 0.52 },
  { id: 'p_study_chair_2', type: 'velvet_chair', room: 'guard_study', x: 12.1, z: 2.2, rotY: Math.PI / 2, colliderRadius: 0.52 },
  { id: 'p_study_chair_3', type: 'velvet_chair', room: 'guard_study', x: 15.6, z: 8.6, rotY: -Math.PI / 2, colliderRadius: 0.52 },
  { id: 'p_study_plant_1', type: 'potted_plant', room: 'guard_study', x: 11.6, z: -12.1, rotY: 0, colliderRadius: 0.5 },
  { id: 'p_study_plant_2', type: 'potted_plant', room: 'guard_study', x: 16.0, z: 12.1, rotY: Math.PI / 2, colliderRadius: 0.5 },
  { id: 'p_study_trash_1', type: 'trash_can', room: 'guard_study', x: 16.0, z: -2.2, rotY: 0, colliderRadius: 0.36 },
  { id: 'p_study_pedestal_1', type: 'marble_pedestal', room: 'guard_study', x: 14.0, z: -9.8, rotY: 0, colliderRadius: 0.52 },
  { id: 'p_study_vase_1', type: 'golden_vase', room: 'guard_study', x: 11.6, z: -1.6, rotY: 0, colliderRadius: 0.44 },
  { id: 'p_study_crate_1', type: 'wooden_crate', room: 'guard_study', x: 11.7, z: 12.0, rotY: 0, colliderRadius: 0.58 },
  { id: 'p_study_bench_1', type: 'gallery_bench', room: 'guard_study', x: 14.2, z: 4.5, rotY: Math.PI / 2, colliderRadius: 0.7 },

  // === STORAGE ROOM (North Wing) ===
  { id: 'p_stor_crate_1', type: 'wooden_crate', room: 'storage_room', x: -8.1, z: -11.8, rotY: 0, colliderRadius: 0.58 },
  { id: 'p_stor_crate_2', type: 'wooden_crate', room: 'storage_room', x: -6.5, z: -11.9, rotY: Math.PI / 2, colliderRadius: 0.58 },
  { id: 'p_stor_crate_3', type: 'wooden_crate', room: 'storage_room', x: -8.2, z: -1.4, rotY: 0, colliderRadius: 0.58 },
  { id: 'p_stor_crate_4', type: 'wooden_crate', room: 'storage_room', x: 7.9, z: -11.6, rotY: 0, colliderRadius: 0.58 },
  { id: 'p_stor_crate_5', type: 'wooden_crate', room: 'storage_room', x: 6.3, z: -11.7, rotY: Math.PI / 2, colliderRadius: 0.58 },
  { id: 'p_stor_crate_6', type: 'wooden_crate', room: 'storage_room', x: 8.1, z: -1.4, rotY: Math.PI, colliderRadius: 0.58 },
  { id: 'p_stor_pedestal_1', type: 'marble_pedestal', room: 'storage_room', x: -3.5, z: -9.8, rotY: 0, colliderRadius: 0.52 },
  { id: 'p_stor_vase_1', type: 'golden_vase', room: 'storage_room', x: 3.6, z: -9.8, rotY: 0, colliderRadius: 0.44 },
  { id: 'p_stor_trash_1', type: 'trash_can', room: 'storage_room', x: 8.3, z: -8.8, rotY: 0, colliderRadius: 0.36 },
  { id: 'p_stor_plant_1', type: 'potted_plant', room: 'storage_room', x: -3.5, z: -1.1, rotY: 0, colliderRadius: 0.5 },
  { id: 'p_stor_plant_2', type: 'potted_plant', room: 'storage_room', x: 3.5, z: -1.1, rotY: Math.PI / 2, colliderRadius: 0.5 },
  { id: 'p_stor_bench_1', type: 'gallery_bench', room: 'storage_room', x: 5.8, z: -2.4, rotY: 0, colliderRadius: 0.7 },
];

export const PATROL_WAYPOINTS: readonly Vec2[] = [
  { x: 0, z: 7.5 },       // Main Lobby Center
  { x: -6.5, z: 7.5 },    // Lobby West Door Approach
  { x: -13.6, z: 6.0 },   // Art Gallery South
  { x: -13.8, z: -6.5 },  // Art Gallery North
  { x: -7.5, z: -6.5 },   // Storage West
  { x: 0, z: -8.0 },      // Storage Exit Approach
  { x: 7.5, z: -6.5 },    // Storage East
  { x: 13.8, z: -6.5 },   // Guard Study North
  { x: 13.8, z: 6.5 },    // Guard Study South
  { x: 6.5, z: 7.5 },     // Lobby East Door Approach
];

export function getRoomAtPosition(x: number, z: number): RoomId {
  if (x < -10) return 'art_gallery';
  if (x > 10) return 'guard_study';
  if (z < 1) return 'storage_room';
  return 'main_lobby';
}

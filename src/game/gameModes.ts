import type { GameModeDefinition, GameModeId, PropType, RoomId } from './types';

export const PROP_LABELS: Record<PropType, string> = {
  wooden_crate: 'Wooden Crate',
  velvet_chair: 'Velvet Chair',
  potted_plant: 'Potted Plant',
  trash_can: 'Trash Can',
  marble_pedestal: 'Marble Pedestal',
  golden_vase: 'Golden Vase',
  gallery_bench: 'Gallery Bench',
};

export const ROOM_LABELS: Record<RoomId, string> = {
  main_lobby: 'Main Lobby',
  art_gallery: 'Art Gallery',
  guard_study: 'Guard Study',
  storage_room: 'Storage Room',
};

const MODES: readonly GameModeDefinition[] = [
  {
    id: 'shadow_heist',
    slotNumber: 1,
    name: 'Shadow Heist',
    tagline: 'Stealth in Dynamic Light',
    description: 'Slip through sweeping spotlight cones and disable security relays under cover of darkness.',
    unlocked: false,
    roundDurationSeconds: 90,
    hidePhaseSeconds: 6,
    goldGoal: 3,
    accentHex: '#8b5cf6',
    robberBrief: 'Stay in shadows and hack 3 vault relays.',
    policeBrief: 'Sweep rooms with tactical flashlights to expose the thief.',
  },
  {
    id: 'hidden_in_crowd',
    slotNumber: 2,
    name: 'Hidden in the Crowd',
    tagline: 'Social Blend & Deception',
    description: 'Mimic museum guests at a gala exhibition while stealing artifacts in plain sight.',
    unlocked: false,
    roundDurationSeconds: 90,
    hidePhaseSeconds: 6,
    goldGoal: 3,
    accentHex: '#ec4899',
    robberBrief: 'Act like an NPC guest and lift 3 gala artifacts.',
    policeBrief: 'Observe unnatural movement to spot the real player.',
  },
  {
    id: 'prop_shift',
    slotNumber: 3,
    name: 'Prop Shift',
    tagline: 'Morph Into Museum Props',
    description: 'Transform into crates, chairs, vases, and pedestals. Collect 3 Gold Bars and unlock the Exit Gate before time runs out.',
    unlocked: true,
    roundDurationSeconds: 90,
    hidePhaseSeconds: 6,
    goldGoal: 3,
    accentHex: '#f59e0b',
    robberBrief: 'Collect 3 Gold Bars in human form, disguise as props to hide, then reach the North Exit Gate.',
    policeBrief: 'Spot out-of-place props and Tag the Robber. Wrong prop tags trigger a 3s Penalty Freeze!',
  },
  {
    id: 'parkour_chase',
    slotNumber: 4,
    name: 'Parkour Chase',
    tagline: 'High-Speed Rooftop Vaulting',
    description: 'Leap across museum skylights, ledges, and scaffolding in a high-tempo pursuit.',
    unlocked: false,
    roundDurationSeconds: 90,
    hidePhaseSeconds: 5,
    goldGoal: 3,
    accentHex: '#10b981',
    robberBrief: 'Chain vaults and wall-runs to grab 3 roof beacons.',
    policeBrief: 'Cut off routes and intercept the runner.',
  },
  {
    id: 'warp_heist',
    slotNumber: 5,
    name: 'Warp Heist',
    tagline: 'Tactical Portal Mindgames',
    description: 'Link paired room portals to ambush, juke, and outmaneuver your opponent across wings.',
    unlocked: false,
    roundDurationSeconds: 90,
    hidePhaseSeconds: 6,
    goldGoal: 3,
    accentHex: '#06b6d4',
    robberBrief: 'Drop twin portals to teleport past patrols with loot.',
    policeBrief: 'Track portal signatures and trap the exit.',
  },
];

export class GameModesManager {
  private readonly modesMap: Map<GameModeId, GameModeDefinition>;

  constructor(definitions: readonly GameModeDefinition[] = MODES) {
    this.modesMap = new Map(definitions.map((m) => [m.id, m]));
  }

  getAll(): readonly GameModeDefinition[] {
    return Array.from(this.modesMap.values()).sort((a, b) => a.slotNumber - b.slotNumber);
  }

  getById(id: GameModeId): GameModeDefinition {
    const mode = this.modesMap.get(id);
    if (!mode) {
      throw new Error(`Unknown game mode: ${id}`);
    }
    return mode;
  }

  getDefaultPlayable(): GameModeDefinition {
    const unlocked = this.getAll().find((m) => m.unlocked);
    if (!unlocked) {
      throw new Error('No unlocked game mode configured');
    }
    return unlocked;
  }

  isPlayable(id: GameModeId): boolean {
    return Boolean(this.modesMap.get(id)?.unlocked);
  }
}

export const gameModes = new GameModesManager();

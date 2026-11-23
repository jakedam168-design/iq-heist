export type PlayerRole = 'robber' | 'police';

export type PropType =
  | 'wooden_crate'
  | 'velvet_chair'
  | 'potted_plant'
  | 'trash_can'
  | 'marble_pedestal'
  | 'golden_vase'
  | 'gallery_bench';

export type GameModeId =
  | 'shadow_heist'
  | 'hidden_in_crowd'
  | 'prop_shift'
  | 'parkour_chase'
  | 'warp_heist';

export type ScreenPhase =
  | 'lobby'
  | 'playing'
  | 'paused'
  | 'round_end'
  | 'match_end';

export type RoundStage = 'hide' | 'chase';

export type MatchType = 'solo' | 'multiplayer_host' | 'multiplayer_guest';

export type RoundOutcome =
  | 'robber_escaped'
  | 'police_arrested'
  | 'time_expired';

export interface Vec2 {
  x: number;
  z: number;
}

export interface WallRect {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height?: number;
  kind?: 'outer' | 'inner' | 'pillar' | 'gate' | 'bookshelf' | 'desk';
}

export interface PropPlacement {
  id: string;
  type: PropType;
  room: RoomId;
  x: number;
  z: number;
  rotY: number;
  scale?: number;
  colliderRadius: number;
}

export type RoomId = 'main_lobby' | 'art_gallery' | 'guard_study' | 'storage_room';

export interface GoldBarSpawn {
  id: string;
  room: RoomId;
  x: number;
  z: number;
}

export interface PlayerSimState {
  x: number;
  y: number;
  z: number;
  rotY: number;
  vx: number;
  vz: number;
  vy: number;
  role: PlayerRole;
  disguiseProp: PropType | null;
  sprintTimer: number;
  sprintCooldown: number;
  penaltyTimer: number;
  tagCooldown: number;
  disguiseCooldown: number;
  walkDistance: number;
}

export interface RoundSummary {
  roundNumber: 1 | 2;
  robberIsLocal: boolean;
  robberLabel: string;
  policeLabel: string;
  outcome: RoundOutcome;
  winnerRole: PlayerRole;
  winnerSide: 'local' | 'remote';
  elapsedSeconds: number;
  goldCollected: number;
}

export interface MatchSummary {
  rounds: RoundSummary[];
  winner: 'local' | 'remote' | 'draw';
  headline: string;
  reason: string;
  localLabel: string;
  remoteLabel: string;
}

export interface HudSnapshot {
  screen: ScreenPhase;
  roundNumber: 1 | 2;
  roundStage: RoundStage;
  timeRemaining: number;
  hideCountdown: number;
  localRole: PlayerRole;
  remoteRole: PlayerRole;
  currentRoom: string;
  goldCollected: number;
  goldTotal: number;
  exitUnlocked: boolean;
  disguiseProp: PropType | null;
  nearbyProp: { id: string; type: PropType; label: string } | null;
  sprintCooldownPct: number;
  sprintActive: boolean;
  tagCooldownPct: number;
  penaltyRemaining: number;
  disguiseCooldownPct: number;
  statusBanner: string | null;
  statusBannerTone: 'info' | 'gold' | 'danger' | 'success';
  penaltyFlash: boolean;
  roundSummary: RoundSummary | null;
  matchSummary: MatchSummary | null;
  isConnectedPeer: boolean;
  matchType: MatchType;
}

export interface GameModeDefinition {
  id: GameModeId;
  slotNumber: number;
  name: string;
  tagline: string;
  description: string;
  unlocked: boolean;
  roundDurationSeconds: number;
  hidePhaseSeconds: number;
  goldGoal: number;
  accentHex: string;
  robberBrief: string;
  policeBrief: string;
}

export type NetMessage =
  | {
      type: 'lobby_start';
      modeId: GameModeId;
      hostRoleRound1: PlayerRole;
      roundNumber: 1 | 2;
    }
  | {
      type: 'state_sync';
      x: number;
      y: number;
      z: number;
      rotY: number;
      disguiseProp: PropType | null;
      sprintActive: boolean;
      penaltyTimer: number;
      ts: number;
    }
  | {
      type: 'gold_pickup';
      goldId: string;
      goldCollected: number;
    }
  | {
      type: 'disguise_puff';
      x: number;
      z: number;
      propType: PropType | null;
    }
  | {
      type: 'tag_pulse';
      x: number;
      z: number;
      rotY: number;
      result: 'arrest' | 'wrong_prop' | 'miss';
    }
  | {
      type: 'round_over';
      outcome: RoundOutcome;
      elapsedSeconds: number;
      goldCollected: number;
    }
  | {
      type: 'next_round';
      roundNumber: 2;
    }
  | {
      type: 'rematch';
      hostRoleRound1: PlayerRole;
    }
  | {
      type: 'return_lobby';
    };

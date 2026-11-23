import {
  EXIT_GATE_POS,
  EXIT_GATE_TRIGGER_RADIUS,
  MAP_HALF_D,
  MAP_HALF_W,
  MUSEUM_PROPS,
  MUSEUM_WALLS,
  POLICE_HIDE_BARRIER,
} from './mapData';
import type {
  MatchSummary,
  PlayerRole,
  PropPlacement,
  RoundOutcome,
  RoundSummary,
  Vec2,
  WallRect,
} from './types';

export const PLAYER_RADIUS = 0.46;
export const DISGUISE_RANGE = 3.2;
export const GOLD_PICKUP_RADIUS = 1.55;
export const POLICE_TAG_RANGE = 3.45;
export const POLICE_TAG_MIN_DOT = 0.32;
export const POLICE_PENALTY_DURATION = 3.0;
export const POLICE_TAG_MISS_COOLDOWN = 0.9;
export const DISGUISE_COOLDOWN = 0.45;

export const ROBBER_BASE_SPEED = 5.4;
export const POLICE_BASE_SPEED = 5.55;
export const SPRINT_MULTIPLIER = 1.62;
export const PENALTY_SPEED_MULTIPLIER = 0.24;
export const SPRINT_DURATION = 2.3;
export const SPRINT_COOLDOWN = 5.5;

/**
 * Resolves circle vs AABB collisions against museum walls and static props
 * so players slide smoothly along walls and never walk through geometry.
 */
export function resolveMovementCollision(
  nextX: number,
  nextZ: number,
  radius: number = PLAYER_RADIUS,
  options?: {
    includePoliceBarrier?: boolean;
    walls?: readonly WallRect[];
    props?: readonly PropPlacement[];
  },
): Vec2 {
  let x = Math.max(-MAP_HALF_W + radius + 0.35, Math.min(MAP_HALF_W - radius - 0.35, nextX));
  let z = Math.max(-MAP_HALF_D + radius + 0.35, Math.min(MAP_HALF_D - radius - 0.35, nextZ));

  const walls = options?.walls ?? MUSEUM_WALLS;
  const props = options?.props ?? MUSEUM_PROPS;
  const allWalls = options?.includePoliceBarrier ? [...walls, POLICE_HIDE_BARRIER] : walls;

  // Run 2 iterations for crisp corner resolution
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < allWalls.length; i++) {
      const w = allWalls[i];
      const closestX = Math.max(w.minX, Math.min(x, w.maxX));
      const closestZ = Math.max(w.minZ, Math.min(z, w.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          x += (dx / dist) * overlap;
          z += (dz / dist) * overlap;
        } else {
          // Center is inside AABB: push out along shallowest axis
          const penLeft = Math.abs(x - w.minX);
          const penRight = Math.abs(w.maxX - x);
          const penTop = Math.abs(z - w.minZ);
          const penBottom = Math.abs(w.maxZ - z);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) x = w.minX - radius;
          else if (minPen === penRight) x = w.maxX + radius;
          else if (minPen === penTop) z = w.minZ - radius;
          else z = w.maxZ + radius;
        }
      }
    }

    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      const dx = x - p.x;
      const dz = z - p.z;
      const minDist = radius + p.colliderRadius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          x += (dx / dist) * overlap;
          z += (dz / dist) * overlap;
        } else {
          x += minDist;
        }
      }
    }
  }

  return { x, z };
}

/**
 * Finds the best candidate prop for the Robber to shift into based on distance
 * and camera/facing alignment.
 */
export function findNearestDisguiseProp(
  playerX: number,
  playerZ: number,
  facingYaw: number,
  props: readonly PropPlacement[] = MUSEUM_PROPS,
  maxRange: number = DISGUISE_RANGE,
): PropPlacement | null {
  const fwdX = Math.sin(facingYaw);
  const fwdZ = Math.cos(facingYaw);
  let best: PropPlacement | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const dx = p.x - playerX;
    const dz = p.z - playerZ;
    const dist = Math.hypot(dx, dz);
    if (dist > maxRange) continue;

    // Slightly favor props in front of player while still allowing nearby 360° selection
    const dot = dist > 0.01 ? (dx * fwdX + dz * fwdZ) / dist : 1;
    const alignmentBonus = dot > 0 ? dot * 0.65 : 0;
    const score = dist - alignmentBonus;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/**
 * Snaps any radian yaw angle cleanly to the nearest 90° increment (0, π/2, π, 3π/2).
 */
export function snapAngleTo90Degrees(yaw: number): number {
  const step = Math.PI / 2;
  const snapped = Math.round(yaw / step) * step;
  const normalized = ((snapped % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.abs(normalized) < 1e-6 ? 0 : normalized;
}

export interface TagResult {
  outcome: 'arrest' | 'wrong_prop' | 'miss';
  hitPropId?: string;
}

/**
 * Evaluates a Police Tag/Arrest pulse directly in front of the Police officer.
 * - Hits Robber (human OR disguised) -> 'arrest'
 * - Hits real innocent prop -> 'wrong_prop' (3s Penalty Freeze!)
 * - Hits nothing -> 'miss'
 */
export function evaluatePoliceTag(
  policeX: number,
  policeZ: number,
  policeYaw: number,
  robberX: number,
  robberZ: number,
  props: readonly PropPlacement[] = MUSEUM_PROPS,
  range: number = POLICE_TAG_RANGE,
): TagResult {
  const fwdX = Math.sin(policeYaw);
  const fwdZ = Math.cos(policeYaw);

  // 1. Check Robber first (generous close-range hit if right next to police or inside front cone)
  const rdx = robberX - policeX;
  const rdz = robberZ - policeZ;
  const rDist = Math.hypot(rdx, rdz);
  if (rDist <= range) {
    const rDot = rDist > 0.01 ? (rdx * fwdX + rdz * fwdZ) / rDist : 1;
    if (rDist <= 1.35 || rDot >= POLICE_TAG_MIN_DOT) {
      return { outcome: 'arrest' };
    }
  }

  // 2. Check innocent museum props inside scanner cone
  let closestProp: PropPlacement | null = null;
  let closestDist = Infinity;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const pdx = p.x - policeX;
    const pdz = p.z - policeZ;
    const pDist = Math.hypot(pdx, pdz);
    if (pDist > range) continue;
    const pDot = pDist > 0.01 ? (pdx * fwdX + pdz * fwdZ) / pDist : 1;
    if (pDot >= POLICE_TAG_MIN_DOT && pDist < closestDist) {
      closestDist = pDist;
      closestProp = p;
    }
  }

  if (closestProp) {
    return { outcome: 'wrong_prop', hitPropId: closestProp.id };
  }

  return { outcome: 'miss' };
}

/**
 * Checks whether the Robber can collect a Gold Bar (must be in human form!).
 */
export function canCollectGoldBar(
  robberX: number,
  robberZ: number,
  disguiseProp: string | null,
  goldX: number,
  goldZ: number,
): boolean {
  if (disguiseProp !== null) return false;
  return Math.hypot(robberX - goldX, robberZ - goldZ) <= GOLD_PICKUP_RADIUS;
}

/**
 * Checks whether the Robber has escaped through the unlocked North Exit Gate (must be human + 3/3 Gold).
 */
export function hasRobberEscaped(
  robberX: number,
  robberZ: number,
  disguiseProp: string | null,
  goldCollected: number,
  goldGoal: number,
): boolean {
  if (disguiseProp !== null) return false;
  if (goldCollected < goldGoal) return false;
  return (
    Math.hypot(robberX - EXIT_GATE_POS.x, robberZ - EXIT_GATE_POS.z) <=
    EXIT_GATE_TRIGGER_RADIUS
  );
}

export function createRoundSummary(params: {
  roundNumber: 1 | 2;
  localRole: PlayerRole;
  localLabel: string;
  remoteLabel: string;
  outcome: RoundOutcome;
  elapsedSeconds: number;
  goldCollected: number;
}): RoundSummary {
  const robberIsLocal = params.localRole === 'robber';
  const winnerRole: PlayerRole = params.outcome === 'robber_escaped' ? 'robber' : 'police';
  const winnerSide: 'local' | 'remote' =
    winnerRole === params.localRole ? 'local' : 'remote';

  return {
    roundNumber: params.roundNumber,
    robberIsLocal,
    robberLabel: robberIsLocal ? params.localLabel : params.remoteLabel,
    policeLabel: robberIsLocal ? params.remoteLabel : params.localLabel,
    outcome: params.outcome,
    winnerRole,
    winnerSide,
    elapsedSeconds: Math.max(0, Math.round(params.elapsedSeconds * 10) / 10),
    goldCollected: params.goldCollected,
  };
}

/**
 * Compares both rounds of a 2-round role-swap match and declares the Match Winner:
 * - Primary: Most rounds won (2-0 wins outright).
 * - Tiebreaker (1-1):
 *   - If both escaped as Robber -> faster escape time wins!
 *   - If both won as Police -> faster arrest time wins (arrest beats timeout; if both timed out, fewer gold conceded wins)!
 */
export function evaluateMatchWinner(
  round1: RoundSummary,
  round2: RoundSummary,
  localLabel: string,
  remoteLabel: string,
): MatchSummary {
  const rounds = [round1, round2];
  const localWins = rounds.filter((r) => r.winnerSide === 'local').length;
  const remoteWins = rounds.filter((r) => r.winnerSide === 'remote').length;

  if (localWins > remoteWins) {
    return {
      rounds,
      winner: 'local',
      headline: `${localLabel} Wins!`,
      reason: `Dominated both rounds (${localWins}–${remoteWins})`,
      localLabel,
      remoteLabel,
    };
  }
  if (remoteWins > localWins) {
    return {
      rounds,
      winner: 'remote',
      headline: `${remoteLabel} Wins!`,
      reason: `Won both rounds (${remoteWins}–${localWins})`,
      localLabel,
      remoteLabel,
    };
  }

  // 1-1 tie -> compare performance
  const localRobberRound = rounds.find((r) => r.robberIsLocal)!;
  const remoteRobberRound = rounds.find((r) => !r.robberIsLocal)!;

  // Both escaped as Robber
  if (
    localRobberRound.outcome === 'robber_escaped' &&
    remoteRobberRound.outcome === 'robber_escaped'
  ) {
    if (localRobberRound.elapsedSeconds < remoteRobberRound.elapsedSeconds) {
      return {
        rounds,
        winner: 'local',
        headline: `${localLabel} Wins!`,
        reason: `Escaped faster (${localRobberRound.elapsedSeconds.toFixed(1)}s vs ${remoteRobberRound.elapsedSeconds.toFixed(1)}s)`,
        localLabel,
        remoteLabel,
      };
    }
    if (remoteRobberRound.elapsedSeconds < localRobberRound.elapsedSeconds) {
      return {
        rounds,
        winner: 'remote',
        headline: `${remoteLabel} Wins!`,
        reason: `Escaped faster (${remoteRobberRound.elapsedSeconds.toFixed(1)}s vs ${localRobberRound.elapsedSeconds.toFixed(1)}s)`,
        localLabel,
        remoteLabel,
      };
    }
  }

  // Both won as Police (neither robber escaped)
  const localPoliceRound = remoteRobberRound;
  const remotePoliceRound = localRobberRound;

  const localArrested = localPoliceRound.outcome === 'police_arrested';
  const remoteArrested = remotePoliceRound.outcome === 'police_arrested';

  if (localArrested && !remoteArrested) {
    return {
      rounds,
      winner: 'local',
      headline: `${localLabel} Wins!`,
      reason: `Secured an arrest in ${localPoliceRound.elapsedSeconds.toFixed(1)}s`,
      localLabel,
      remoteLabel,
    };
  }
  if (remoteArrested && !localArrested) {
    return {
      rounds,
      winner: 'remote',
      headline: `${remoteLabel} Wins!`,
      reason: `Secured an arrest in ${remotePoliceRound.elapsedSeconds.toFixed(1)}s`,
      localLabel,
      remoteLabel,
    };
  }
  if (localArrested && remoteArrested) {
    if (localPoliceRound.elapsedSeconds < remotePoliceRound.elapsedSeconds) {
      return {
        rounds,
        winner: 'local',
        headline: `${localLabel} Wins!`,
        reason: `Arrested faster (${localPoliceRound.elapsedSeconds.toFixed(1)}s vs ${remotePoliceRound.elapsedSeconds.toFixed(1)}s)`,
        localLabel,
        remoteLabel,
      };
    }
    if (remotePoliceRound.elapsedSeconds < localPoliceRound.elapsedSeconds) {
      return {
        rounds,
        winner: 'remote',
        headline: `${remoteLabel} Wins!`,
        reason: `Arrested faster (${remotePoliceRound.elapsedSeconds.toFixed(1)}s vs ${localPoliceRound.elapsedSeconds.toFixed(1)}s)`,
        localLabel,
        remoteLabel,
      };
    }
  }

  // Final tiebreaker: more Gold Bars stolen as Robber
  if (localRobberRound.goldCollected > remoteRobberRound.goldCollected) {
    return {
      rounds,
      winner: 'local',
      headline: `${localLabel} Wins!`,
      reason: `Stole more Gold Bars (${localRobberRound.goldCollected} vs ${remoteRobberRound.goldCollected})`,
      localLabel,
      remoteLabel,
    };
  }
  if (remoteRobberRound.goldCollected > localRobberRound.goldCollected) {
    return {
      rounds,
      winner: 'remote',
      headline: `${remoteLabel} Wins!`,
      reason: `Stole more Gold Bars (${remoteRobberRound.goldCollected} vs ${localRobberRound.goldCollected})`,
      localLabel,
      remoteLabel,
    };
  }

  return {
    rounds,
    winner: 'draw',
    headline: 'Dead Heat Draw!',
    reason: 'Identical performance across both rounds',
    localLabel,
    remoteLabel,
  };
}

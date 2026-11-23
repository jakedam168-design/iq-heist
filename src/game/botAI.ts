import { EXIT_GATE_POS, GOLD_BAR_SPAWNS, MUSEUM_PROPS, PATROL_WAYPOINTS } from './mapData';
import {
  DISGUISE_COOLDOWN,
  POLICE_BASE_SPEED,
  POLICE_PENALTY_DURATION,
  POLICE_TAG_MISS_COOLDOWN,
  POLICE_TAG_RANGE,
  ROBBER_BASE_SPEED,
  SPRINT_COOLDOWN,
  SPRINT_DURATION,
  SPRINT_MULTIPLIER,
  PENALTY_SPEED_MULTIPLIER,
  evaluatePoliceTag,
  findNearestDisguiseProp,
  resolveMovementCollision,
  snapAngleTo90Degrees,
} from './rules';
import type { PlayerSimState, PropType, RoundStage, Vec2 } from './types';

export interface BotStepCallbacks {
  onDisguiseChange: (x: number, z: number, prop: PropType | null) => void;
  onPoliceTag: (
    x: number,
    z: number,
    rotY: number,
    outcome: 'arrest' | 'wrong_prop' | 'miss',
  ) => void;
}

export class SoloBotController {
  private waypointIdx = 0;
  private hideHoldTimer = 0;
  private scanDecisionTimer = 2.4;
  private lastKnownTarget: Vec2 | null = null;
  private investigateTimer = 0;

  reset(): void {
    this.waypointIdx = 0;
    this.hideHoldTimer = 0;
    this.scanDecisionTimer = 2.6;
    this.lastKnownTarget = null;
    this.investigateTimer = 0;
  }

  step(
    dt: number,
    bot: PlayerSimState,
    opponent: PlayerSimState,
    roundStage: RoundStage,
    collectedGoldIds: ReadonlySet<string>,
    callbacks: BotStepCallbacks,
  ): void {
    bot.sprintTimer = Math.max(0, bot.sprintTimer - dt);
    bot.sprintCooldown = Math.max(0, bot.sprintCooldown - dt);
    bot.penaltyTimer = Math.max(0, bot.penaltyTimer - dt);
    bot.tagCooldown = Math.max(0, bot.tagCooldown - dt);
    bot.disguiseCooldown = Math.max(0, bot.disguiseCooldown - dt);

    if (bot.role === 'police') {
      this.stepPoliceBot(dt, bot, opponent, roundStage, callbacks);
    } else {
      this.stepRobberBot(dt, bot, opponent, roundStage, collectedGoldIds, callbacks);
    }
  }

  private stepPoliceBot(
    dt: number,
    bot: PlayerSimState,
    robber: PlayerSimState,
    roundStage: RoundStage,
    callbacks: BotStepCallbacks,
  ): void {
    if (roundStage === 'hide') {
      bot.vx = 0;
      bot.vz = 0;
      bot.rotY = Math.PI; // Face north into museum
      return;
    }

    const dxR = robber.x - bot.x;
    const dzR = robber.z - bot.z;
    const distR = Math.hypot(dxR, dzR);
    const robberSpeed = Math.hypot(robber.vx, robber.vz);

    // Bot spots robber if robber is human and reasonably close, OR disguised but moving nearby
    const spottedHuman = robber.disguiseProp === null && distR < 10.5;
    const spottedMovingProp = robber.disguiseProp !== null && robberSpeed > 0.7 && distR < 8.5;

    let target: Vec2;
    if (spottedHuman || spottedMovingProp) {
      this.lastKnownTarget = { x: robber.x, z: robber.z };
      this.investigateTimer = 2.2;
      target = this.lastKnownTarget;

      // Use Sprint when chasing
      if (distR > 3.6 && distR < 10 && bot.sprintCooldown <= 0 && bot.penaltyTimer <= 0) {
        bot.sprintTimer = SPRINT_DURATION;
        bot.sprintCooldown = SPRINT_COOLDOWN;
      }
    } else if (this.lastKnownTarget && this.investigateTimer > 0) {
      this.investigateTimer -= dt;
      target = this.lastKnownTarget;
      if (Math.hypot(target.x - bot.x, target.z - bot.z) < 1.1) {
        this.investigateTimer = 0;
      }
    } else {
      target = PATROL_WAYPOINTS[this.waypointIdx];
      if (Math.hypot(target.x - bot.x, target.z - bot.z) < 1.4) {
        this.waypointIdx = (this.waypointIdx + 1) % PATROL_WAYPOINTS.length;
        target = PATROL_WAYPOINTS[this.waypointIdx];
      }
    }

    this.moveToward(dt, bot, target, POLICE_BASE_SPEED * 0.92, false);

    // Police Bot Tag logic
    this.scanDecisionTimer -= dt;
    if (bot.tagCooldown <= 0 && bot.penaltyTimer <= 0) {
      const shouldTagRobber = (spottedHuman || spottedMovingProp) && distR <= POLICE_TAG_RANGE * 0.88;
      const shouldSuspicionScan = this.scanDecisionTimer <= 0 && distR < 4.5;

      if (shouldTagRobber || shouldSuspicionScan) {
        if (shouldTagRobber) {
          bot.rotY = Math.atan2(dxR, dzR);
        }
        const res = evaluatePoliceTag(bot.x, bot.z, bot.rotY, robber.x, robber.z, MUSEUM_PROPS);
        if (res.outcome === 'wrong_prop') {
          bot.penaltyTimer = POLICE_PENALTY_DURATION;
          bot.tagCooldown = POLICE_PENALTY_DURATION;
        } else if (res.outcome === 'miss') {
          bot.tagCooldown = POLICE_TAG_MISS_COOLDOWN;
        }
        this.scanDecisionTimer = 3.2 + Math.random() * 2.5;
        callbacks.onPoliceTag(bot.x, bot.z, bot.rotY, res.outcome);
      }
    }
  }

  private stepRobberBot(
    dt: number,
    bot: PlayerSimState,
    police: PlayerSimState,
    roundStage: RoundStage,
    collectedGoldIds: ReadonlySet<string>,
    callbacks: BotStepCallbacks,
  ): void {
    const distPolice = Math.hypot(police.x - bot.x, police.z - bot.z);

    // When Police is close during chase, disguise as a nearby prop & snap align!
    if (roundStage === 'chase' && distPolice < 8.0 && this.hideHoldTimer <= 0) {
      if (bot.disguiseProp === null && bot.disguiseCooldown <= 0) {
        const nearest = findNearestDisguiseProp(bot.x, bot.z, bot.rotY, MUSEUM_PROPS, 4.0);
        if (nearest) {
          bot.disguiseProp = nearest.type;
          bot.rotY = snapAngleTo90Degrees(bot.rotY);
          bot.disguiseCooldown = DISGUISE_COOLDOWN;
          this.hideHoldTimer = 2.8;
          bot.vx = 0;
          bot.vz = 0;
          callbacks.onDisguiseChange(bot.x, bot.z, nearest.type);
          return;
        }
      }
    }

    if (bot.disguiseProp !== null) {
      this.hideHoldTimer -= dt;
      // Stay frozen while police is nearby
      if (distPolice < 6.8 && this.hideHoldTimer > -3.5) {
        bot.vx = 0;
        bot.vz = 0;
        return;
      }
      // Safe enough (or police passed) -> revert to human form to continue heist
      if (bot.disguiseCooldown <= 0) {
        bot.disguiseProp = null;
        bot.disguiseCooldown = DISGUISE_COOLDOWN;
        this.hideHoldTimer = 0;
        callbacks.onDisguiseChange(bot.x, bot.z, null);
      }
    }

    // Choose objective: nearest uncollected Gold Bar, or Exit Gate when all 3 are collected
    let objective: Vec2 = EXIT_GATE_POS;
    const remaining = GOLD_BAR_SPAWNS.filter((g) => !collectedGoldIds.has(g.id));
    if (remaining.length > 0) {
      let bestDist = Infinity;
      for (const g of remaining) {
        const d = Math.hypot(g.x - bot.x, g.z - bot.z);
        if (d < bestDist) {
          bestDist = d;
          objective = { x: g.x, z: g.z };
        }
      }
    }

    // Navigate via doorway checkpoints if crossing room dividers
    const navTarget = this.chooseDoorwayStep(bot, objective);
    if (distPolice < 10 && bot.sprintCooldown <= 0 && roundStage === 'chase') {
      bot.sprintTimer = SPRINT_DURATION;
      bot.sprintCooldown = SPRINT_COOLDOWN;
    }
    this.moveToward(dt, bot, navTarget, ROBBER_BASE_SPEED * 0.88, false);
  }

  private chooseDoorwayStep(bot: PlayerSimState, goal: Vec2): Vec2 {
    const botWing = bot.x < -10 ? -1 : bot.x > 10 ? 1 : 0;
    const goalWing = goal.x < -10 ? -1 : goal.x > 10 ? 1 : 0;

    if (botWing !== goalWing) {
      const doorX = botWing === -1 || goalWing === -1 ? -10 : 10;
      const doorZ = bot.z < 1 ? -6.5 : 7.5;
      if (Math.abs(bot.x - doorX) > 1.2 || Math.abs(bot.z - doorZ) > 1.6) {
        return { x: doorX, z: doorZ };
      }
    } else if (botWing === 0 && (bot.z > 1) !== (goal.z > 1)) {
      // Cross central doorway between Lobby and Storage
      if (Math.abs(bot.x) > 1.6 || Math.abs(bot.z - 1) > 1.5) {
        return { x: 0, z: 1.0 };
      }
    }
    return goal;
  }

  private moveToward(
    dt: number,
    bot: PlayerSimState,
    target: Vec2,
    baseSpeed: number,
    includeBarrier: boolean,
  ): void {
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) {
      bot.vx = 0;
      bot.vz = 0;
      return;
    }

    let speed = baseSpeed;
    if (bot.penaltyTimer > 0) speed *= PENALTY_SPEED_MULTIPLIER;
    else if (bot.sprintTimer > 0) speed *= SPRINT_MULTIPLIER;

    const dirX = dx / dist;
    const dirZ = dz / dist;
    bot.vx = dirX * speed;
    bot.vz = dirZ * speed;

    const resolved = resolveMovementCollision(bot.x + bot.vx * dt, bot.z + bot.vz * dt, 0.46, {
      includePoliceBarrier: includeBarrier,
    });
    const moved = Math.hypot(resolved.x - bot.x, resolved.z - bot.z);
    bot.walkDistance += moved;
    bot.x = resolved.x;
    bot.z = resolved.z;

    const targetYaw = Math.atan2(dirX, dirZ);
    let diff = targetYaw - bot.rotY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bot.rotY += diff * Math.min(1, dt * 10);
  }
}

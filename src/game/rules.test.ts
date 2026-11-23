import test from 'node:test';
import assert from 'node:assert/strict';
import { gameModes } from './gameModes';
import {
  EXIT_GATE_POS,
  GOLD_BAR_SPAWNS,
  MUSEUM_PROPS,
  POLICE_SPAWN,
  ROBBER_SPAWN,
  getRoomAtPosition,
} from './mapData';
import {
  canCollectGoldBar,
  createRoundSummary,
  evaluateMatchWinner,
  evaluatePoliceTag,
  findNearestDisguiseProp,
  hasRobberEscaped,
  resolveMovementCollision,
  snapAngleTo90Degrees,
} from './rules';

test('GameModes registry exposes 5 modes with only Prop Shift unlocked', () => {
  const all = gameModes.getAll();
  assert.equal(all.length, 5);
  assert.equal(all[2].id, 'prop_shift');
  assert.equal(all[2].unlocked, true);
  assert.equal(all[0].unlocked, false);
  assert.equal(all[1].unlocked, false);
  assert.equal(all[3].unlocked, false);
  assert.equal(all[4].unlocked, false);
  assert.equal(gameModes.getDefaultPlayable().id, 'prop_shift');
});

test('Map spawns and Gold Bars sit cleanly in open space without wall/prop overlap', () => {
  const robberResolved = resolveMovementCollision(ROBBER_SPAWN.x, ROBBER_SPAWN.z);
  assert.ok(
    Math.hypot(robberResolved.x - ROBBER_SPAWN.x, robberResolved.z - ROBBER_SPAWN.z) < 0.05,
    'Robber spawn should not collide with walls or props',
  );

  const policeResolved = resolveMovementCollision(POLICE_SPAWN.x, POLICE_SPAWN.z, 0.46, {
    includePoliceBarrier: true,
  });
  assert.ok(
    Math.hypot(policeResolved.x - POLICE_SPAWN.x, policeResolved.z - POLICE_SPAWN.z) < 0.05,
    'Police spawn should sit cleanly inside vestibule behind hide barrier',
  );

  for (const gold of GOLD_BAR_SPAWNS) {
    const resolved = resolveMovementCollision(gold.x, gold.z);
    assert.ok(
      Math.hypot(resolved.x - gold.x, resolved.z - gold.z) < 0.05,
      `Gold bar ${gold.id} should be unobstructed`,
    );
    assert.equal(getRoomAtPosition(gold.x, gold.z), gold.room);
  }
});

test('Collision prevents walking through interior divider walls and hide barrier', () => {
  // Attempt to cross the West divider wall solid section (x = -10, z = 0)
  const blockedWall = resolveMovementCollision(-10.0, 0);
  assert.ok(Math.abs(blockedWall.x - -10.0) >= 0.45, 'Player must be pushed out of solid divider wall');

  // Doorway at x = -10, z = 7.5 must remain completely open
  const inDoorway = resolveMovementCollision(-10.0, 7.5);
  assert.ok(Math.hypot(inDoorway.x - -10.0, inDoorway.z - 7.5) < 0.01, 'Doorway should allow passage');

  // Police Hide Barrier at z = 9.85 blocks movement during Hide Phase
  const blockedGate = resolveMovementCollision(0, 9.8, 0.46, { includePoliceBarrier: true });
  assert.ok(blockedGate.z < 9.6 || blockedGate.z > 10.1, 'Police hide barrier must block crossing');
});

test('Disguise finder picks nearest prop and snapAngleTo90Degrees aligns cleanly', () => {
  const targetProp = MUSEUM_PROPS[0];
  const found = findNearestDisguiseProp(targetProp.x + 1.2, targetProp.z, -Math.PI / 2);
  assert.ok(found);
  assert.equal(found.id, targetProp.id);

  assert.equal(snapAngleTo90Degrees(0.2), 0);
  assert.ok(Math.abs(snapAngleTo90Degrees(1.4) - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(snapAngleTo90Degrees(3.0) - Math.PI) < 1e-6);
  assert.ok(Math.abs(snapAngleTo90Degrees(-1.4) - (3 * Math.PI) / 2) < 1e-6);
});

test('Police Tag arrests robber (human or disguised), penalizes wrong prop, and misses open air', () => {
  // Facing +Z (yaw = 0)
  const arrestHit = evaluatePoliceTag(0, 0, 0, 0, 2.5, []);
  assert.equal(arrestHit.outcome, 'arrest');

  // Innocent prop in front, robber far away -> wrong_prop penalty
  const prop = MUSEUM_PROPS.find((p) => p.id === 'p_lobby_pedestal_1')!;
  const wrongPropHit = evaluatePoliceTag(prop.x, prop.z - 2.0, 0, 14, 10);
  assert.equal(wrongPropHit.outcome, 'wrong_prop');
  assert.equal(wrongPropHit.hitPropId, prop.id);

  // Open corridor with no prop or robber in range -> miss
  const miss = evaluatePoliceTag(0, 6.0, 0, -14, -10);
  assert.equal(miss.outcome, 'miss');
});

test('Gold Bar collection and Exit Gate escape require human form', () => {
  const g = GOLD_BAR_SPAWNS[0];
  assert.equal(canCollectGoldBar(g.x + 0.5, g.z, null, g.x, g.z), true);
  assert.equal(canCollectGoldBar(g.x + 0.5, g.z, 'wooden_crate', g.x, g.z), false);

  assert.equal(hasRobberEscaped(EXIT_GATE_POS.x, EXIT_GATE_POS.z + 0.8, null, 3, 3), true);
  assert.equal(hasRobberEscaped(EXIT_GATE_POS.x, EXIT_GATE_POS.z + 0.8, 'trash_can', 3, 3), false);
  assert.equal(hasRobberEscaped(EXIT_GATE_POS.x, EXIT_GATE_POS.z + 0.8, null, 2, 3), false);
});

test('2-Round Match Winner compares wins first, then faster escape/arrest tiebreaker', () => {
  // Both escape as robber -> faster escape wins
  const r1 = createRoundSummary({
    roundNumber: 1,
    localRole: 'robber',
    localLabel: 'You',
    remoteLabel: 'Bot',
    outcome: 'robber_escaped',
    elapsedSeconds: 42.5,
    goldCollected: 3,
  });
  const r2 = createRoundSummary({
    roundNumber: 2,
    localRole: 'police',
    localLabel: 'You',
    remoteLabel: 'Bot',
    outcome: 'robber_escaped',
    elapsedSeconds: 58.2,
    goldCollected: 3,
  });
  const fasterEscapeMatch = evaluateMatchWinner(r1, r2, 'You', 'Bot');
  assert.equal(fasterEscapeMatch.winner, 'local');

  // Both arrest as police -> faster arrest wins
  const p1 = createRoundSummary({
    roundNumber: 1,
    localRole: 'robber',
    localLabel: 'You',
    remoteLabel: 'Friend',
    outcome: 'police_arrested',
    elapsedSeconds: 31.0,
    goldCollected: 1,
  });
  const p2 = createRoundSummary({
    roundNumber: 2,
    localRole: 'police',
    localLabel: 'You',
    remoteLabel: 'Friend',
    outcome: 'police_arrested',
    elapsedSeconds: 22.4,
    goldCollected: 1,
  });
  const fasterArrestMatch = evaluateMatchWinner(p1, p2, 'You', 'Friend');
  assert.equal(fasterArrestMatch.winner, 'local');
});

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoloBotController } from './botAI';
import { gameModes, PROP_LABELS, ROOM_LABELS } from './gameModes';
import {
  GOLD_BAR_SPAWNS,
  MUSEUM_PROPS,
  POLICE_SPAWN,
  ROBBER_SPAWN,
  getRoomAtPosition,
} from './mapData';
import { buildMuseumWorld, type MuseumWorld } from './museumBuilder';
import type { NetworkManager } from './networkManager';
import {
  buildCharacterRig,
  createSharedMaterials,
  type CharacterRig,
  type SharedMaterialLibrary,
} from './proceduralModels';
import { createProceduralTextures, type ProceduralTexturePack } from './proceduralTextures';
import {
  DISGUISE_COOLDOWN,
  PENALTY_SPEED_MULTIPLIER,
  POLICE_BASE_SPEED,
  POLICE_PENALTY_DURATION,
  POLICE_TAG_MISS_COOLDOWN,
  ROBBER_BASE_SPEED,
  SPRINT_COOLDOWN,
  SPRINT_DURATION,
  SPRINT_MULTIPLIER,
  canCollectGoldBar,
  createRoundSummary,
  evaluateMatchWinner,
  evaluatePoliceTag,
  findNearestDisguiseProp,
  hasRobberEscaped,
  resolveMovementCollision,
  snapAngleTo90Degrees,
} from './rules';
import { soundEngine } from './soundEngine';
import type {
  GameModeId,
  HudSnapshot,
  MatchSummary,
  MatchType,
  NetMessage,
  PlayerRole,
  PlayerSimState,
  PropType,
  RoundOutcome,
  RoundStage,
  RoundSummary,
  ScreenPhase,
} from './types';
import { VfxPool } from './vfxPool';

// Scratch vectors allocated once outside the 60fps loop (zero GC)
const _camAnchor = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function makeInitialPlayer(role: PlayerRole): PlayerSimState {
  const spawn = role === 'robber' ? ROBBER_SPAWN : POLICE_SPAWN;
  return {
    x: spawn.x,
    y: 0,
    z: spawn.z,
    rotY: Math.PI, // Facing North into the museum (never facing a wall)
    vx: 0,
    vz: 0,
    vy: 0,
    role,
    disguiseProp: null,
    sprintTimer: 0,
    sprintCooldown: 0,
    penaltyTimer: 0,
    tagCooldown: 0,
    disguiseCooldown: 0,
    walkDistance: 0,
  };
}

export class HeistEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;
  private readonly textures: ProceduralTexturePack;
  private readonly mats: SharedMaterialLibrary;
  private readonly world: MuseumWorld;
  private readonly vfx: VfxPool;
  private readonly onHudUpdate: (snapshot: HudSnapshot) => void;
  private network: NetworkManager | null = null;

  private robberRig: CharacterRig;
  private policeRig: CharacterRig;

  // Match & Round State
  private screen: ScreenPhase = 'lobby';
  private matchType: MatchType = 'solo';
  private activeModeId: GameModeId = 'prop_shift';
  private roundNumber: 1 | 2 = 1;
  private roundStage: RoundStage = 'hide';
  private roundDuration = 90;
  private hideDuration = 6;
  private goldGoal = 3;
  private roundElapsed = 0;
  private lastTickSecond = -1;

  private localRole: PlayerRole = 'robber';
  private remoteRole: PlayerRole = 'police';
  private hostRoleRound1: PlayerRole = 'robber';
  private localState: PlayerSimState = makeInitialPlayer('robber');
  private remoteState: PlayerSimState = makeInitialPlayer('police');
  private remoteTarget = {
    x: POLICE_SPAWN.x,
    y: 0,
    z: POLICE_SPAWN.z,
    rotY: Math.PI,
    disguiseProp: null as PropType | null,
    penaltyTimer: 0,
  };

  private collectedGoldIds = new Set<string>();
  private roundSummaries: RoundSummary[] = [];
  private currentRoundSummary: RoundSummary | null = null;
  private currentMatchSummary: MatchSummary | null = null;
  private bot = new SoloBotController();

  // Camera Orbit & Feel State
  private camYaw = 0; // 0 => camera sits South looking North
  private camPitch = 0.44;
  private camSmoothedPos = new THREE.Vector3(0, 7.5, 11);
  private camSmoothedLook = new THREE.Vector3(0, 1.3, 0);
  private lobbyOrbitTime = 0;
  private cameraShake = 0;
  private hitstopTimer = 0;
  private localSquash = 1;
  private remoteSquash = 1;
  private footstepAccum = 0;

  // Status banner & flash feedback
  private statusBanner: string | null = null;
  private statusBannerTone: 'info' | 'gold' | 'danger' | 'success' = 'info';
  private statusBannerTimer = 0;
  private penaltyFlashTimer = 0;

  // Input State (Unified Mobile Touch + Desktop Keyboard/Mouse)
  private joyX = 0;
  private joyY = 0;
  private heldKeys = new Set<string>();
  private isDraggingMouse = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Loop & Throttling
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private lastHudEmitMs = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareWebGL();

    // Renderer configured strictly per Three.js skill & software-WebGL guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Scene + Atmosphere + Mandatory Studio RoomEnvironment PBR Reflections
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1422);
    this.scene.fog = new THREE.FogExp2(0x0d1422, 0.017);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Camera
    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.2, 90);
    this.renderer.setSize(width, height, false);

    // Studio Warm/Cool Lighting Rig (1 shadow-casting warm key + cool hemisphere + 3 gallery fill lights)
    const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x3a2e25, 0.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.55);
    keyLight.position.set(11, 22, 13);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 4;
    keyLight.shadow.camera.far = 52;
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.025;
    this.scene.add(keyLight);

    // Warm room gallery overhead accent lights (unshadowed, <= 4 active)
    const lobbyLight = new THREE.PointLight(0xffdfb0, 1.8, 22, 1.5);
    lobbyLight.position.set(0, 4.1, 6.5);
    const galleryLight = new THREE.PointLight(0xffe7c2, 1.6, 22, 1.5);
    galleryLight.position.set(-14, 4.1, -2);
    const studyLight = new THREE.PointLight(0xffd2a6, 1.6, 22, 1.5);
    studyLight.position.set(14, 4.1, 2);
    this.scene.add(lobbyLight, galleryLight, studyLight);

    // Procedural Textures, Materials, 4-Room Museum, Character Rigs & VFX Pool
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.mats = createSharedMaterials(this.textures.contactShadow);
    this.world = buildMuseumWorld(this.textures, this.mats);
    this.scene.add(this.world.worldGroup);

    this.robberRig = buildCharacterRig('robber', this.mats);
    this.policeRig = buildCharacterRig('police', this.mats);
    this.scene.add(this.robberRig.root, this.policeRig.root);
    this.syncRigTransformsImmediate();

    this.vfx = new VfxPool();
    this.scene.add(this.vfx.group);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind input & resize listeners
    this.bindListeners();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.handleResize();

    this.syncBodyState();
    this.emitHud(true);

    // Start frame loop
    this.lastTimeMs = performance.now();
    this.scheduleNextFrame();
  }

  attachNetwork(network: NetworkManager | null): void {
    this.network = network;
  }

  // === MATCH LIFECYCLE API ===

  startMatch(options: {
    modeId: GameModeId;
    matchType: MatchType;
    hostRoleRound1: PlayerRole;
  }): void {
    soundEngine.unlock();
    const mode = gameModes.getById(options.modeId);
    this.activeModeId = mode.id;
    this.matchType = options.matchType;
    this.hostRoleRound1 = options.hostRoleRound1;
    this.roundDuration = mode.roundDurationSeconds;
    this.hideDuration = mode.hidePhaseSeconds;
    this.goldGoal = mode.goldGoal;
    this.roundSummaries = [];
    this.currentRoundSummary = null;
    this.currentMatchSummary = null;

    this.beginRound(1);

    if (this.matchType === 'multiplayer_host') {
      this.network?.send({
        type: 'lobby_start',
        modeId: this.activeModeId,
        hostRoleRound1: this.hostRoleRound1,
        roundNumber: 1,
      });
    }
  }

  startRound2(): void {
    soundEngine.unlock();
    if (this.roundNumber === 2 && this.screen === 'playing') return;
    this.beginRound(2);
    if (this.matchType === 'multiplayer_host') {
      this.network?.send({ type: 'next_round', roundNumber: 2 });
    }
  }

  returnToLobby(notifyPeer = true): void {
    if (notifyPeer && this.network?.isConnected()) {
      this.network.send({ type: 'return_lobby' });
    }
    this.screen = 'lobby';
    this.heldKeys.clear();
    this.joyX = 0;
    this.joyY = 0;
    this.world.targetHighlightRing.visible = false;
    this.syncBodyState();
    this.emitHud(true);
  }

  setPaused(paused: boolean): void {
    if (this.screen !== 'playing' && this.screen !== 'paused') return;
    this.screen = paused ? 'paused' : 'playing';
    this.heldKeys.clear();
    this.joyX = 0;
    this.joyY = 0;
    this.syncBodyState();
    this.emitHud(true);
  }

  restartSoloMatch(): void {
    this.startMatch({
      modeId: this.activeModeId,
      matchType: 'solo',
      hostRoleRound1: this.hostRoleRound1,
    });
  }

  private beginRound(roundNumber: 1 | 2): void {
    this.roundNumber = roundNumber;
    this.roundStage = 'hide';
    this.roundElapsed = 0;
    this.lastTickSecond = -1;
    this.hitstopTimer = 0;
    this.cameraShake = 0;
    this.penaltyFlashTimer = 0;
    this.currentRoundSummary = null;
    this.collectedGoldIds.clear();
    this.heldKeys.clear();
    this.joyX = 0;
    this.joyY = 0;

    // Determine roles with automatic Round 2 swap
    const hostRole: PlayerRole =
      roundNumber === 1
        ? this.hostRoleRound1
        : this.hostRoleRound1 === 'robber'
          ? 'police'
          : 'robber';

    if (this.matchType === 'multiplayer_guest') {
      this.localRole = hostRole === 'robber' ? 'police' : 'robber';
      this.remoteRole = hostRole;
    } else {
      this.localRole = hostRole;
      this.remoteRole = hostRole === 'robber' ? 'police' : 'robber';
    }

    this.localState = makeInitialPlayer(this.localRole);
    this.remoteState = makeInitialPlayer(this.remoteRole);
    this.remoteTarget = {
      x: this.remoteState.x,
      y: 0,
      z: this.remoteState.z,
      rotY: this.remoteState.rotY,
      disguiseProp: null,
      penaltyTimer: 0,
    };
    this.bot.reset();

    // Reset museum gold bars, exit gate, and hide barrier
    for (const g of this.world.goldPickups) {
      g.collected = false;
      g.group.visible = true;
    }
    this.world.setExitUnlocked(false);
    this.world.setHideBarrierVisible(true);

    // Reset character rigs
    this.robberRig.setDisguise(null);
    this.policeRig.setDisguise(null);
    this.syncRigTransformsImmediate();

    // Align camera behind local player looking North into the museum (with immediate wall pull-in!)
    this.camYaw = 0;
    this.camPitch = this.localRole === 'police' ? 0.5 : 0.42;
    this.snapCameraToPlayer();

    this.screen = 'playing';
    this.showBanner(
      this.localRole === 'robber'
        ? `ROUND ${roundNumber} · HIDE & LOOT 3 GOLD BARS!`
        : `ROUND ${roundNumber} · WAIT ${this.hideDuration}s FOR ROBBER TO HIDE`,
      this.localRole === 'robber' ? 'gold' : 'info',
      3.0,
    );
    this.syncBodyState();
    this.emitHud(true);
  }

  // === PUBLIC MOBILE / UI CONTROL HOOKS ===

  setJoystickVector(x: number, y: number): void {
    this.joyX = Math.max(-1, Math.min(1, x));
    this.joyY = Math.max(-1, Math.min(1, y));
  }

  rotateCameraBy(deltaX: number, deltaY: number): void {
    if (this.screen !== 'playing') return;
    this.camYaw -= deltaX * 0.0062;
    this.camPitch = Math.max(0.18, Math.min(0.95, this.camPitch + deltaY * 0.0048));
  }

  triggerPrimaryAction(): void {
    if (this.screen !== 'playing') return;
    soundEngine.unlock();
    if (this.localRole === 'robber') {
      this.triggerRobberDisguise();
    } else {
      this.triggerPoliceTag();
    }
  }

  triggerSnapAlign(): void {
    if (this.screen !== 'playing') return;
    if (this.localRole !== 'robber' || this.localState.disguiseProp === null) return;
    soundEngine.unlock();
    this.localState.rotY = snapAngleTo90Degrees(this.localState.rotY);
    this.localSquash = 1.15;
    soundEngine.playSnapAlign();
    this.showBanner('ALIGNED 90°', 'info', 1.1);
    this.emitHud(true);
  }

  triggerSprintJump(): void {
    if (this.screen !== 'playing') return;
    soundEngine.unlock();
    if (this.localRole === 'police' && this.roundStage === 'hide') return;
    if (this.localState.penaltyTimer > 0) return;
    if (this.localState.sprintCooldown > 0) return;

    this.localState.sprintTimer = SPRINT_DURATION;
    this.localState.sprintCooldown = SPRINT_COOLDOWN;
    if (this.localRole === 'robber' && this.localState.y <= 0.01) {
      this.localState.vy = 4.9;
      this.localSquash = 1.2;
    }
    soundEngine.playSprint();
    this.vfx.emitBurst(
      this.localState.x,
      0.35,
      this.localState.z,
      this.localRole === 'robber' ? 0xf59e0b : 0x38bdf8,
      8,
      2.6,
      0.36,
    );
    this.emitHud(true);
  }

  private triggerRobberDisguise(): void {
    if (this.localState.disguiseCooldown > 0) return;

    if (this.localState.disguiseProp !== null) {
      // Revert to human form
      this.localState.disguiseProp = null;
      this.localState.disguiseCooldown = DISGUISE_COOLDOWN;
      this.localSquash = 1.24;
      soundEngine.playPropMorph(false);
      this.vfx.emitBurst(this.localState.x, 0.75, this.localState.z, 0xfbbf24, 14, 3.2, 0.45);
      this.network?.send({
        type: 'disguise_puff',
        x: this.localState.x,
        z: this.localState.z,
        propType: null,
      });
      this.emitHud(true);
      return;
    }

    const nearest = findNearestDisguiseProp(
      this.localState.x,
      this.localState.z,
      this.localState.rotY,
      MUSEUM_PROPS,
    );
    if (!nearest) {
      this.showBanner('MOVE CLOSER TO ANY MUSEUM PROP TO DISGUISE', 'info', 1.6);
      this.emitHud(true);
      return;
    }

    this.localState.disguiseProp = nearest.type;
    this.localState.disguiseCooldown = DISGUISE_COOLDOWN;
    this.localSquash = 0.76;
    soundEngine.playPropMorph(true);
    this.vfx.emitBurst(this.localState.x, 0.65, this.localState.z, 0xf59e0b, 16, 3.4, 0.5);
    this.showBanner(`DISGUISED AS ${PROP_LABELS[nearest.type].toUpperCase()}`, 'gold', 1.8);
    this.network?.send({
      type: 'disguise_puff',
      x: this.localState.x,
      z: this.localState.z,
      propType: nearest.type,
    });
    this.emitHud(true);
  }

  private triggerPoliceTag(): void {
    if (this.roundStage === 'hide') {
      this.showBanner('WAIT FOR HIDE COUNTDOWN TO FINISH', 'info', 1.2);
      return;
    }
    if (this.localState.penaltyTimer > 0 || this.localState.tagCooldown > 0) return;

    soundEngine.playScannerPulse();
    const res = evaluatePoliceTag(
      this.localState.x,
      this.localState.z,
      this.localState.rotY,
      this.remoteState.x,
      this.remoteState.z,
      MUSEUM_PROPS,
    );

    if (res.outcome === 'arrest') {
      this.vfx.emitScannerPulse(this.localState.x, this.localState.z, this.localState.rotY, 0x38bdf8);
      this.vfx.emitBurst(this.remoteState.x, 0.9, this.remoteState.z, 0x38bdf8, 22, 4.4, 0.65);
      this.hitstopTimer = 0.065;
      this.cameraShake = 0.55;
      soundEngine.playArrestSiren();
      this.network?.send({
        type: 'tag_pulse',
        x: this.localState.x,
        z: this.localState.z,
        rotY: this.localState.rotY,
        result: 'arrest',
      });
      this.finishRound('police_arrested', true);
    } else if (res.outcome === 'wrong_prop') {
      this.localState.penaltyTimer = POLICE_PENALTY_DURATION;
      this.localState.tagCooldown = POLICE_PENALTY_DURATION;
      this.penaltyFlashTimer = 0.7;
      this.cameraShake = 0.35;
      this.vfx.emitScannerPulse(this.localState.x, this.localState.z, this.localState.rotY, 0xef4444);
      soundEngine.playWrongPropBuzzer();
      this.showBanner('WRONG PROP! 3s PENALTY FREEZE', 'danger', 2.6);
      this.network?.send({
        type: 'tag_pulse',
        x: this.localState.x,
        z: this.localState.z,
        rotY: this.localState.rotY,
        result: 'wrong_prop',
      });
    } else {
      this.localState.tagCooldown = POLICE_TAG_MISS_COOLDOWN;
      this.vfx.emitScannerPulse(this.localState.x, this.localState.z, this.localState.rotY, 0x60a5fa);
      this.showBanner('NO TARGET IN SCANNER RANGE', 'info', 1.1);
      this.network?.send({
        type: 'tag_pulse',
        x: this.localState.x,
        z: this.localState.z,
        rotY: this.localState.rotY,
        result: 'miss',
      });
    }
    this.emitHud(true);
  }

  // === NETWORK PACKET INGESTION ===

  handleNetworkMessage(msg: NetMessage): void {
    switch (msg.type) {
      case 'lobby_start':
        this.startMatch({
          modeId: msg.modeId,
          matchType: 'multiplayer_guest',
          hostRoleRound1: msg.hostRoleRound1,
        });
        break;

      case 'state_sync':
        this.remoteTarget.x = msg.x;
        this.remoteTarget.y = msg.y;
        this.remoteTarget.z = msg.z;
        this.remoteTarget.rotY = msg.rotY;
        this.remoteTarget.disguiseProp = msg.disguiseProp;
        this.remoteTarget.penaltyTimer = msg.penaltyTimer;
        break;

      case 'disguise_puff':
        this.remoteState.disguiseProp = msg.propType;
        this.remoteTarget.disguiseProp = msg.propType;
        this.remoteSquash = 0.78;
        this.vfx.emitBurst(msg.x, 0.7, msg.z, 0xf59e0b, 12, 3.0, 0.45);
        soundEngine.playPropMorph(msg.propType !== null);
        break;

      case 'gold_pickup': {
        this.collectedGoldIds.add(msg.goldId);
        const item = this.world.goldPickups.find((g) => g.id === msg.goldId);
        if (item && !item.collected) {
          item.collected = true;
          item.group.visible = false;
          this.vfx.emitBurst(item.x, 0.7, item.z, 0xffd166, 16, 3.4, 0.52);
        }
        soundEngine.playGoldPickup(this.collectedGoldIds.size);
        if (this.collectedGoldIds.size >= this.goldGoal) {
          this.world.setExitUnlocked(true);
          soundEngine.playExitUnlock();
          this.showBanner('ALL 3 GOLD STOLEN! NORTH EXIT GATE UNLOCKED!', 'gold', 3.0);
        } else {
          this.showBanner(
            `GOLD BAR STOLEN (${this.collectedGoldIds.size}/${this.goldGoal})`,
            'gold',
            2.0,
          );
        }
        this.emitHud(true);
        break;
      }

      case 'tag_pulse':
        this.vfx.emitScannerPulse(
          msg.x,
          msg.z,
          msg.rotY,
          msg.result === 'wrong_prop' ? 0xef4444 : 0x38bdf8,
        );
        if (msg.result === 'wrong_prop') {
          soundEngine.playWrongPropBuzzer();
          this.showBanner('POLICE TAGGED A REAL PROP! (3s FREEZE)', 'success', 2.2);
        } else if (msg.result === 'arrest') {
          soundEngine.playArrestSiren();
        }
        break;

      case 'round_over':
        this.finishRound(msg.outcome, false, msg.elapsedSeconds, msg.goldCollected);
        break;

      case 'next_round':
        this.beginRound(2);
        break;

      case 'rematch':
        this.startMatch({
          modeId: this.activeModeId,
          matchType: 'multiplayer_guest',
          hostRoleRound1: msg.hostRoleRound1,
        });
        break;

      case 'return_lobby':
        this.returnToLobby(false);
        break;
    }
  }

  private finishRound(
    outcome: RoundOutcome,
    broadcast: boolean,
    overrideElapsed?: number,
    overrideGold?: number,
  ): void {
    if (this.screen !== 'playing') return;

    const elapsed = overrideElapsed ?? this.roundElapsed;
    const goldCount = overrideGold ?? this.collectedGoldIds.size;

    if (broadcast && this.network?.isConnected()) {
      this.network.send({
        type: 'round_over',
        outcome,
        elapsedSeconds: elapsed,
        goldCollected: goldCount,
      });
    }

    const localLabel = this.matchType === 'solo' ? 'You' : this.matchType === 'multiplayer_host' ? 'Host (You)' : 'Guest (You)';
    const remoteLabel = this.matchType === 'solo' ? 'AI Bot' : this.matchType === 'multiplayer_host' ? 'Friend' : 'Host';

    const summary = createRoundSummary({
      roundNumber: this.roundNumber,
      localRole: this.localRole,
      localLabel,
      remoteLabel,
      outcome,
      elapsedSeconds: elapsed,
      goldCollected: goldCount,
    });
    this.currentRoundSummary = summary;
    this.roundSummaries.push(summary);

    if (outcome === 'robber_escaped') {
      soundEngine.playVictoryFanfare();
    } else if (outcome === 'police_arrested') {
      soundEngine.playArrestSiren();
    } else {
      soundEngine.playCountdownTick(true);
    }

    if (this.roundNumber === 1) {
      this.screen = 'round_end';
    } else {
      this.currentMatchSummary = evaluateMatchWinner(
        this.roundSummaries[0],
        this.roundSummaries[1],
        localLabel,
        remoteLabel,
      );
      this.screen = 'match_end';
    }

    this.heldKeys.clear();
    this.joyX = 0;
    this.joyY = 0;
    this.syncBodyState();
    this.emitHud(true);
  }

  // === MAIN SIMULATION & RENDER LOOP ===

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTimeMs) / 1000);
    this.lastTimeMs = now;
    const dt = Math.min(rawDt, 0.05);

    this.update(dt, now);
    this.renderer.render(this.scene, this.camera);

    if (now - this.lastHudEmitMs >= 100) {
      this.emitHud(false);
    }

    this.scheduleNextFrame();
  }

  private update(dt: number, nowMs: number): void {
    // Visual timers tick in real dt even during brief hitstop
    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) this.statusBanner = null;
    }
    if (this.penaltyFlashTimer > 0) {
      this.penaltyFlashTimer = Math.max(0, this.penaltyFlashTimer - dt);
    }
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.9);
    }

    // Animate Gold Bars & VFX
    const spinT = nowMs * 0.001;
    for (const g of this.world.goldPickups) {
      if (g.collected) continue;
      g.spinner.rotation.y = spinT * 1.9;
      g.spinner.position.y = 0.72 + Math.sin(spinT * 3.1 + g.x) * 0.11;
      const pulse = 0.92 + Math.sin(spinT * 4.0) * 0.1;
      g.beaconRing.scale.setScalar(pulse);
    }
    this.vfx.update(dt);

    // Lobby / End Screens: Cinematic Museum Camera Tour
    if (this.screen !== 'playing') {
      if (this.screen === 'lobby') {
        this.lobbyOrbitTime += dt * 0.22;
        const r = 11.2;
        this.camera.position.set(
          Math.sin(this.lobbyOrbitTime) * r,
          6.8 + Math.sin(this.lobbyOrbitTime * 1.4) * 0.7,
          Math.cos(this.lobbyOrbitTime) * (r * 0.72) + 2.5,
        );
        this.camera.lookAt(Math.sin(this.lobbyOrbitTime * 0.7) * 2.5, 1.35, -1.8);
      }
      return;
    }

    // Sim-level hitstop freeze on arrest impact
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateGameplayCamera(dt);
      return;
    }

    // Round Timer & Hide -> Chase Phase Transition
    this.roundElapsed += dt;
    const timeRemaining = Math.max(0, this.roundDuration - this.roundElapsed);
    const hideRemaining = Math.max(0, this.hideDuration - this.roundElapsed);

    if (this.roundStage === 'hide') {
      const sec = Math.ceil(hideRemaining);
      if (sec !== this.lastTickSecond && sec > 0 && sec <= 5) {
        this.lastTickSecond = sec;
        soundEngine.playCountdownTick(false);
      }
      if (hideRemaining <= 0) {
        this.roundStage = 'chase';
        this.world.setHideBarrierVisible(false);
        soundEngine.playCountdownTick(true);
        this.showBanner(
          this.localRole === 'police'
            ? 'GATE OPEN! HUNT DOWN THE ROBBER!'
            : 'POLICE RELEASED! STAY SHARP!',
          this.localRole === 'police' ? 'info' : 'danger',
          2.6,
        );
        this.emitHud(true);
      }
    } else {
      const sec = Math.ceil(timeRemaining);
      if (sec !== this.lastTickSecond && sec > 0 && sec <= 10) {
        this.lastTickSecond = sec;
        soundEngine.playCountdownTick(sec <= 3);
      }
      if (timeRemaining <= 0) {
        // Host or Solo decides timeout (Police wins when Robber fails to escape in time)
        if (this.matchType !== 'multiplayer_guest') {
          this.finishRound('time_expired', true);
          return;
        }
      }
    }

    // Update Local Player Movement
    this.updateLocalPlayer(dt);

    // Update Remote Player (Bot in Solo mode OR interpolated WebRTC peer)
    if (this.matchType === 'solo') {
      this.bot.step(
        dt,
        this.remoteState,
        this.localState,
        this.roundStage,
        this.collectedGoldIds,
        {
          onDisguiseChange: (x, z, prop) => {
            this.remoteSquash = 0.78;
            this.vfx.emitBurst(x, 0.7, z, 0xf59e0b, 12, 2.8, 0.45);
            soundEngine.playPropMorph(prop !== null);
          },
          onPoliceTag: (x, z, rotY, outcome) => {
            this.vfx.emitScannerPulse(
              x,
              z,
              rotY,
              outcome === 'wrong_prop' ? 0xef4444 : 0x38bdf8,
            );
            if (outcome === 'arrest') {
              this.vfx.emitBurst(this.localState.x, 0.9, this.localState.z, 0x38bdf8, 22, 4.2, 0.6);
              this.hitstopTimer = 0.065;
              this.cameraShake = 0.55;
              this.finishRound('police_arrested', false);
            } else if (outcome === 'wrong_prop') {
              soundEngine.playWrongPropBuzzer();
              this.showBanner('BOT POLICE TAGGED A REAL PROP! (3s FREEZE)', 'success', 2.2);
            }
          },
        },
      );
    } else {
      // Smooth ~20Hz network lerp for remote player
      const alpha = 1 - Math.exp(-14 * dt);
      const prevX = this.remoteState.x;
      const prevZ = this.remoteState.z;
      this.remoteState.x = THREE.MathUtils.lerp(this.remoteState.x, this.remoteTarget.x, alpha);
      this.remoteState.y = THREE.MathUtils.lerp(this.remoteState.y, this.remoteTarget.y, alpha);
      this.remoteState.z = THREE.MathUtils.lerp(this.remoteState.z, this.remoteTarget.z, alpha);
      let dAngle = this.remoteTarget.rotY - this.remoteState.rotY;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      this.remoteState.rotY += dAngle * alpha;
      this.remoteState.disguiseProp = this.remoteTarget.disguiseProp;
      this.remoteState.penaltyTimer = this.remoteTarget.penaltyTimer;
      this.remoteState.walkDistance += Math.hypot(
        this.remoteState.x - prevX,
        this.remoteState.z - prevZ,
      );

      // Broadcast our own state at ~20Hz
      this.network?.sendStateSync(
        {
          type: 'state_sync',
          x: this.localState.x,
          y: this.localState.y,
          z: this.localState.z,
          rotY: this.localState.rotY,
          disguiseProp: this.localState.disguiseProp,
          sprintActive: this.localState.sprintTimer > 0,
          penaltyTimer: this.localState.penaltyTimer,
          ts: nowMs,
        },
        nowMs,
      );
    }

    // Robber Gold Pickup & Exit Gate Check (authoritative on whichever side plays Robber, or Solo)
    const robberState = this.localRole === 'robber' ? this.localState : this.remoteState;
    const isLocalRobberOrSolo = this.localRole === 'robber' || this.matchType === 'solo';
    if (isLocalRobberOrSolo) {
      for (const g of this.world.goldPickups) {
        if (g.collected) continue;
        if (canCollectGoldBar(robberState.x, robberState.z, robberState.disguiseProp, g.x, g.z)) {
          g.collected = true;
          g.group.visible = false;
          this.collectedGoldIds.add(g.id);
          this.vfx.emitBurst(g.x, 0.7, g.z, 0xffd166, 18, 3.6, 0.55);
          soundEngine.playGoldPickup(this.collectedGoldIds.size);
          this.network?.send({
            type: 'gold_pickup',
            goldId: g.id,
            goldCollected: this.collectedGoldIds.size,
          });

          if (this.collectedGoldIds.size >= this.goldGoal) {
            this.world.setExitUnlocked(true);
            soundEngine.playExitUnlock();
            this.showBanner('ALL 3 GOLD BARS COLLECTED! NORTH EXIT OPEN!', 'gold', 3.4);
          } else {
            this.showBanner(
              `GOLD BAR ${this.collectedGoldIds.size}/${this.goldGoal} STOLEN!`,
              'gold',
              2.2,
            );
          }
          this.emitHud(true);
        }
      }

      if (
        hasRobberEscaped(
          robberState.x,
          robberState.z,
          robberState.disguiseProp,
          this.collectedGoldIds.size,
          this.goldGoal,
        )
      ) {
        this.finishRound('robber_escaped', this.matchType !== 'solo');
        return;
      }
    }

    // Update nearby prop highlight ring for Local Robber
    if (this.localRole === 'robber' && this.localState.disguiseProp === null) {
      const nearest = findNearestDisguiseProp(
        this.localState.x,
        this.localState.z,
        this.localState.rotY,
        MUSEUM_PROPS,
      );
      if (nearest) {
        this.world.targetHighlightRing.visible = true;
        this.world.targetHighlightRing.position.set(nearest.x, 0.045, nearest.z);
        this.world.targetHighlightRing.rotation.z = spinT * 1.4;
      } else {
        this.world.targetHighlightRing.visible = false;
      }
    } else {
      this.world.targetHighlightRing.visible = false;
    }

    // Update 3D Rigs & Animations
    this.localSquash = THREE.MathUtils.damp(this.localSquash, 1, 12, dt);
    this.remoteSquash = THREE.MathUtils.damp(this.remoteSquash, 1, 12, dt);
    this.syncRigAnimations(dt);

    // Update Third-Person Damped Camera with Wall Pull-In
    this.updateGameplayCamera(dt);
  }

  private updateLocalPlayer(dt: number): void {
    const p = this.localState;
    p.sprintTimer = Math.max(0, p.sprintTimer - dt);
    p.sprintCooldown = Math.max(0, p.sprintCooldown - dt);
    p.penaltyTimer = Math.max(0, p.penaltyTimer - dt);
    p.tagCooldown = Math.max(0, p.tagCooldown - dt);
    p.disguiseCooldown = Math.max(0, p.disguiseCooldown - dt);

    // Keyboard camera yaw rotate option (J / L)
    if (this.heldKeys.has('KeyJ')) this.camYaw += 2.2 * dt;
    if (this.heldKeys.has('KeyL')) this.camYaw -= 2.2 * dt;

    // Combine Virtual Thumbstick + WASD / Arrow keys
    let inputX = this.joyX;
    let inputY = this.joyY; // +Y is forward on thumbstick
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) inputY += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) inputY -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) inputX += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) inputX -= 1;

    const mag = Math.hypot(inputX, inputY);
    if (mag > 1) {
      inputX /= mag;
      inputY /= mag;
    }

    // Vertical hop gravity
    if (p.y > 0 || p.vy > 0) {
      p.y += p.vy * dt;
      p.vy -= 14.5 * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        this.localSquash = 0.84;
      }
    }

    // Police cannot move past vestibule barrier during 6s hide phase
    const includeBarrier = p.role === 'police' && this.roundStage === 'hide';

    if (mag > 0.08) {
      // Camera-relative movement on XZ plane
      const sinYaw = Math.sin(this.camYaw);
      const cosYaw = Math.cos(this.camYaw);
      // Forward vector from camera is (-sinYaw, -cosYaw)
      // Right vector is (cosYaw, -sinYaw)
      const worldDirX = -sinYaw * inputY + cosYaw * inputX;
      const worldDirZ = -cosYaw * inputY - sinYaw * inputX;

      let speed = p.role === 'robber' ? ROBBER_BASE_SPEED : POLICE_BASE_SPEED;
      if (p.disguiseProp !== null) speed *= 0.82;
      if (p.penaltyTimer > 0) speed *= PENALTY_SPEED_MULTIPLIER;
      else if (p.sprintTimer > 0) speed *= SPRINT_MULTIPLIER;

      const stepMag = Math.min(1, mag);
      p.vx = worldDirX * speed * stepMag;
      p.vz = worldDirZ * speed * stepMag;

      const resolved = resolveMovementCollision(p.x + p.vx * dt, p.z + p.vz * dt, 0.46, {
        includePoliceBarrier: includeBarrier,
      });
      const moved = Math.hypot(resolved.x - p.x, resolved.z - p.z);
      p.x = resolved.x;
      p.z = resolved.z;
      p.walkDistance += moved;

      // Subtle footsteps synced to distance traveled
      if (p.y <= 0.02 && p.disguiseProp === null) {
        this.footstepAccum += moved;
        if (this.footstepAccum >= 1.55) {
          this.footstepAccum = 0;
          soundEngine.playFootstep(p.sprintTimer > 0);
        }
      }

      // Smoothly face movement direction
      const targetYaw = Math.atan2(worldDirX, worldDirZ);
      let diff = targetYaw - p.rotY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.rotY += diff * Math.min(1, dt * 13);
    } else {
      p.vx = 0;
      p.vz = 0;
    }
  }

  private syncRigTransformsImmediate(): void {
    const rState = this.localRole === 'robber' ? this.localState : this.remoteState;
    const pState = this.localRole === 'police' ? this.localState : this.remoteState;

    this.robberRig.root.position.set(rState.x, rState.y, rState.z);
    this.robberRig.root.rotation.y = rState.rotY;
    this.robberRig.setDisguise(rState.disguiseProp);

    this.policeRig.root.position.set(pState.x, pState.y, pState.z);
    this.policeRig.root.rotation.y = pState.rotY;
    this.policeRig.setDisguise(null);
  }

  private syncRigAnimations(dt: number): void {
    const pairs: Array<{ rig: CharacterRig; state: PlayerSimState; squash: number }> = [
      {
        rig: this.robberRig,
        state: this.localRole === 'robber' ? this.localState : this.remoteState,
        squash: this.localRole === 'robber' ? this.localSquash : this.remoteSquash,
      },
      {
        rig: this.policeRig,
        state: this.localRole === 'police' ? this.localState : this.remoteState,
        squash: this.localRole === 'police' ? this.localSquash : this.remoteSquash,
      },
    ];

    for (const { rig, state, squash } of pairs) {
      rig.root.position.set(state.x, state.y, state.z);
      rig.root.rotation.y = state.rotY;
      rig.setDisguise(state.disguiseProp);

      // Squash & stretch around bottom pivot
      const invSqrt = 1 / Math.sqrt(Math.max(0.5, squash));
      rig.root.scale.set(invSqrt, squash, invSqrt);

      if (state.disguiseProp === null) {
        const speed = Math.hypot(state.vx, state.vz);
        const swing = speed > 0.2 ? Math.sin(state.walkDistance * 3.1) * 0.62 : 0;
        rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, swing, 16, dt);
        rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, -swing, 16, dt);
        rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -swing * 0.75, 16, dt);
        rig.rightArm.rotation.x = THREE.MathUtils.damp(
          rig.rightArm.rotation.x,
          state.role === 'police' ? -0.35 + swing * 0.35 : swing * 0.75,
          16,
          dt,
        );
        // Subtle penalty wobble if police is frozen
        rig.bodyTilt.rotation.z =
          state.penaltyTimer > 0 ? Math.sin(performance.now() * 0.03) * 0.08 : 0;
      }
    }
  }

  private computeDesiredCamera(): void {
    const p = this.localState;
    _camAnchor.set(p.x, p.y + (p.disguiseProp ? 0.95 : 1.45), p.z);

    const orbitDist = p.sprintTimer > 0 ? 6.6 : 6.0;
    const horizDist = orbitDist * Math.cos(this.camPitch);
    const vertOffset = orbitDist * Math.sin(this.camPitch);

    _camDesired.set(
      _camAnchor.x + Math.sin(this.camYaw) * horizDist,
      _camAnchor.y + vertOffset,
      _camAnchor.z + Math.cos(this.camYaw) * horizDist,
    );

    // Wall pull-in raycast so camera never clips behind interior or outer museum walls
    _camDir.subVectors(_camDesired, _camAnchor);
    const desiredLen = _camDir.length();
    if (desiredLen > 0.1) {
      _camDir.divideScalar(desiredLen);
      _raycaster.set(_camAnchor, _camDir);
      _raycaster.near = 0.2;
      _raycaster.far = desiredLen;
      const hits = _raycaster.intersectObjects(this.world.wallMeshesForCamera, false);
      if (hits.length > 0) {
        const pullDist = Math.max(1.6, hits[0].distance - 0.42);
        _camDesired.copy(_camAnchor).addScaledVector(_camDir, pullDist);
      }
    }

    // Hard interior bounds safeguard so camera never drifts outside outer museum perimeter
    _camDesired.x = THREE.MathUtils.clamp(_camDesired.x, -17.15, 17.15);
    _camDesired.z = THREE.MathUtils.clamp(_camDesired.z, -13.15, 13.15);
    _camDesired.y = Math.max(1.5, _camDesired.y);
  }

  private snapCameraToPlayer(): void {
    this.scene.updateMatrixWorld(true);
    this.computeDesiredCamera();
    this.camSmoothedPos.copy(_camDesired);
    this.camSmoothedLook.copy(_camAnchor);
    this.camera.position.copy(this.camSmoothedPos);
    this.camera.lookAt(this.camSmoothedLook);
    this.renderer.render(this.scene, this.camera);
  }

  private updateGameplayCamera(dt: number): void {
    const p = this.localState;
    this.computeDesiredCamera();

    const dampAlpha = 1 - Math.exp(-12 * dt);
    this.camSmoothedPos.lerp(_camDesired, dampAlpha);
    this.camSmoothedLook.lerp(_camAnchor, 1 - Math.exp(-16 * dt));

    // Trauma camera shake on arrest or wrong-prop penalty
    const shakeSq = this.cameraShake * this.cameraShake;
    const shakeX = shakeSq > 0.001 ? (Math.random() - 0.5) * shakeSq * 0.45 : 0;
    const shakeY = shakeSq > 0.001 ? (Math.random() - 0.5) * shakeSq * 0.45 : 0;

    this.camera.position.set(
      this.camSmoothedPos.x + shakeX,
      Math.max(0.8, this.camSmoothedPos.y + shakeY),
      this.camSmoothedPos.z,
    );
    this.camera.lookAt(this.camSmoothedLook);

    // Subtle FOV kick while sprinting
    const targetFov = p.sprintTimer > 0 ? 63 : 56;
    if (Math.abs(this.camera.fov - targetFov) > 0.08) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 8, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private showBanner(
    text: string,
    tone: 'info' | 'gold' | 'danger' | 'success',
    duration = 2.0,
  ): void {
    this.statusBanner = text;
    this.statusBannerTone = tone;
    this.statusBannerTimer = duration;
  }

  private syncBodyState(): void {
    if (typeof document === 'undefined') return;
    if (this.screen === 'lobby') document.body.dataset.state = 'title';
    else if (this.screen === 'playing') document.body.dataset.state = 'playing';
    else if (this.screen === 'paused') document.body.dataset.state = 'paused';
    else document.body.dataset.state = 'gameover';
  }

  private emitHud(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastHudEmitMs < 95) return;
    this.lastHudEmitMs = now;

    const nearestProp =
      this.screen === 'playing' &&
      this.localRole === 'robber' &&
      this.localState.disguiseProp === null
        ? findNearestDisguiseProp(
            this.localState.x,
            this.localState.z,
            this.localState.rotY,
            MUSEUM_PROPS,
          )
        : null;

    const tagDenom =
      this.localState.penaltyTimer > 0 ? POLICE_PENALTY_DURATION : POLICE_TAG_MISS_COOLDOWN;

    this.onHudUpdate({
      screen: this.screen,
      roundNumber: this.roundNumber,
      roundStage: this.roundStage,
      timeRemaining: Math.max(0, this.roundDuration - this.roundElapsed),
      hideCountdown: Math.max(0, this.hideDuration - this.roundElapsed),
      localRole: this.localRole,
      remoteRole: this.remoteRole,
      currentRoom: ROOM_LABELS[getRoomAtPosition(this.localState.x, this.localState.z)],
      goldCollected: this.collectedGoldIds.size,
      goldTotal: this.goldGoal,
      exitUnlocked: this.collectedGoldIds.size >= this.goldGoal,
      disguiseProp: this.localState.disguiseProp,
      nearbyProp: nearestProp
        ? { id: nearestProp.id, type: nearestProp.type, label: PROP_LABELS[nearestProp.type] }
        : null,
      sprintCooldownPct: Math.min(1, this.localState.sprintCooldown / SPRINT_COOLDOWN),
      sprintActive: this.localState.sprintTimer > 0,
      tagCooldownPct: Math.min(1, this.localState.tagCooldown / tagDenom),
      penaltyRemaining: this.localState.penaltyTimer,
      disguiseCooldownPct: Math.min(1, this.localState.disguiseCooldown / DISGUISE_COOLDOWN),
      statusBanner: this.statusBanner,
      statusBannerTone: this.statusBannerTone,
      penaltyFlash: this.penaltyFlashTimer > 0,
      roundSummary: this.currentRoundSummary,
      matchSummary: this.currentMatchSummary,
      isConnectedPeer: Boolean(this.network?.isConnected()),
      matchType: this.matchType,
    });
  }

  // === DESKTOP KEYBOARD / MOUSE LISTENERS ===

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.screen === 'playing') {
        e.preventDefault();
        this.setPaused(true);
      } else if (this.screen === 'paused') {
        e.preventDefault();
        this.setPaused(false);
      }
      return;
    }

    if (this.screen !== 'playing') return;

    if (!this.heldKeys.has(e.code)) {
      // Edge-triggered one-shot actions
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.triggerPrimaryAction();
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        this.triggerSnapAlign();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
        e.preventDefault();
        this.triggerSprintJump();
      }
    }

    this.heldKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.heldKeys.clear();
    this.isDraggingMouse = false;
    this.joyX = 0;
    this.joyY = 0;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.screen !== 'playing') return;
    if (e.target !== this.renderer.domElement) return;
    this.isDraggingMouse = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    soundEngine.unlock();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDraggingMouse || this.screen !== 'playing') return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.rotateCameraBy(dx, dy);
  };

  private onMouseUp = (): void => {
    this.isDraggingMouse = false;
  };

  private bindListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onWindowBlur);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private handleResize(): void {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onWindowBlur);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.world.dispose();
    this.vfx.dispose();
    this.mats.dispose();
    this.textures.dispose();
    if (this.scene.environment) this.scene.environment.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

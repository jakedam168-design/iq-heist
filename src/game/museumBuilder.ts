import * as THREE from 'three';
import {
  EXIT_GATE_POS,
  GOLD_BAR_SPAWNS,
  MAP_HALF_D,
  MAP_HALF_W,
  MUSEUM_PROPS,
  MUSEUM_WALLS,
  POLICE_HIDE_BARRIER,
  WALL_HEIGHT,
} from './mapData';
import { buildGoldBarPickup, buildPropModel, type SharedMaterialLibrary } from './proceduralModels';
import type { ProceduralTexturePack } from './proceduralTextures';
import type { PropPlacement } from './types';

export interface GoldPickupInstance {
  id: string;
  x: number;
  z: number;
  group: THREE.Group;
  spinner: THREE.Group;
  beaconRing: THREE.Mesh;
  collected: boolean;
}

export interface MuseumWorld {
  worldGroup: THREE.Group;
  wallMeshesForCamera: THREE.Object3D[];
  propMeshes: Map<string, { placement: PropPlacement; group: THREE.Group }>;
  goldPickups: GoldPickupInstance[];
  exitGateLeft: THREE.Mesh;
  exitGateRight: THREE.Mesh;
  exitLaserMat: THREE.MeshStandardMaterial;
  exitBeaconLight: THREE.PointLight;
  hideBarrierGroup: THREE.Group;
  targetHighlightRing: THREE.Mesh;
  setExitUnlocked: (unlocked: boolean) => void;
  setHideBarrierVisible: (visible: boolean) => void;
  dispose: () => void;
}

export function buildMuseumWorld(
  textures: ProceduralTexturePack,
  mats: SharedMaterialLibrary,
): MuseumWorld {
  const worldGroup = new THREE.Group();
  const wallMeshesForCamera: THREE.Object3D[] = [];
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };

  // === 1. ZONED ARCHITECTURAL FLOORS (4 distinct room finishes, y = 0) ===
  const addFloor = (
    w: number,
    d: number,
    x: number,
    z: number,
    map: THREE.Texture,
    roughness: number,
  ) => {
    const geo = trackGeo(new THREE.PlaneGeometry(w, d));
    geo.rotateX(-Math.PI / 2);
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map,
        roughness,
        metalness: 0.08,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
  };

  // Main Lobby (South-Central: x [-10, 10], z [1, 14])
  addFloor(20, 13, 0, 7.5, textures.marbleFloor, 0.28);
  // Storage Room (North-Central: x [-10, 10], z [-14, 1])
  addFloor(20, 15, 0, -6.5, textures.storageSlate, 0.65);
  // Art Gallery (West Wing: x [-18, -10], z [-14, 14])
  addFloor(8, 28, -14, 0, textures.oakParquet, 0.42);
  // Guard Study (East Wing: x [10, 18], z [-14, 14])
  addFloor(8, 28, 14, 0, textures.mahoganyParquet, 0.45);

  // Decorative Lobby Red Velvet Carpet Runner (offset y = 0.022 to prevent Z-fighting)
  const carpetMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x8f1d2c, roughness: 0.9, metalness: 0.02 }),
  );
  const carpetBorderMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd4a24c, roughness: 0.45, metalness: 0.45 }),
  );
  const carpetBorder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 0.02, 8.6)), carpetBorderMat);
  carpetBorder.position.set(0, 0.015, 5.6);
  carpetBorder.receiveShadow = true;
  worldGroup.add(carpetBorder);

  const carpetInner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 0.024, 8.2)), carpetMat);
  carpetInner.position.set(0, 0.022, 5.6);
  carpetInner.receiveShadow = true;
  worldGroup.add(carpetInner);

  // === 2. WALLS, PILLARS, BOOKSHELVES, SECURITY DESK ===
  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.wallPlaster,
      roughness: 0.72,
      metalness: 0.04,
    }),
  );
  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x262e3d, roughness: 0.45, metalness: 0.3 }),
  );
  const pillarMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe3dcd0, roughness: 0.34, metalness: 0.06 }),
  );

  for (const w of MUSEUM_WALLS) {
    const width = w.maxX - w.minX;
    const depth = w.maxZ - w.minZ;
    const height = w.height ?? WALL_HEIGHT;
    const cx = (w.minX + w.maxX) / 2;
    const cz = (w.minZ + w.maxZ) / 2;

    if (w.kind === 'bookshelf') {
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(cx, 0, cz);
      const cabinet = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width, height, depth)),
        mats.woodDark,
      );
      cabinet.position.y = height / 2;
      cabinet.castShadow = true;
      cabinet.receiveShadow = true;
      shelfGroup.add(cabinet);

      // Colorful procedural book rows on 3 shelves
      const bookColors = [0x9e2a2b, 0x335c67, 0xe09f3e, 0x3a5a40, 0x4a4e69];
      for (let row = 0; row < 3; row++) {
        for (let b = 0; b < 8; b++) {
          const bMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: bookColors[(row * 3 + b) % bookColors.length],
              roughness: 0.78,
            }),
          );
          const book = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.42, 0.46)), bMat);
          book.position.set(-width * 0.42, 0.7 + row * 0.78, -depth / 2 + 0.55 + b * 0.58);
          shelfGroup.add(book);
        }
      }
      worldGroup.add(shelfGroup);
      wallMeshesForCamera.push(cabinet);
      continue;
    }

    if (w.kind === 'desk') {
      const deskGroup = new THREE.Group();
      deskGroup.position.set(cx, 0, cz);
      const base = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width - 0.14, height - 0.12, depth - 0.14)),
        mats.woodDark,
      );
      base.position.y = (height - 0.12) / 2;
      base.castShadow = true;
      base.receiveShadow = true;
      deskGroup.add(base);

      const top = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(width, 0.12, depth)), mats.woodWarm);
      top.position.y = height - 0.06;
      top.castShadow = true;
      deskGroup.add(top);

      // Dual security monitors on guard desk
      const screenMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          emissive: 0x0369a1,
          emissiveIntensity: 0.85,
          roughness: 0.2,
        }),
      );
      [-0.45, 0.45].forEach((mx) => {
        const monitor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.42, 0.06)), mats.ironTrim);
        monitor.position.set(mx, height + 0.25, 0);
        deskGroup.add(monitor);
        const screen = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.54, 0.34, 0.02)), screenMat);
        screen.position.set(mx, height + 0.25, 0.04);
        deskGroup.add(screen);
      });
      worldGroup.add(deskGroup);
      continue;
    }

    const mesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width, height, depth)),
      w.kind === 'pillar' ? pillarMat : wallMat,
    );
    mesh.position.set(cx, height / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
    wallMeshesForCamera.push(mesh);

    // Top crown trim on walls and pillars
    const crown = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width + 0.12, 0.18, depth + 0.12)),
      w.kind === 'pillar' ? mats.brassGold : trimMat,
    );
    crown.position.set(cx, height + 0.04, cz);
    worldGroup.add(crown);
  }

  // Doorway Overhead Lintels (architectural framing over all 5 wide doorways!)
  const addLintel = (x: number, z: number, w: number, d: number) => {
    const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, 0.9, d)), trimMat);
    lintel.position.set(x, WALL_HEIGHT - 0.45, z);
    worldGroup.add(lintel);
    const goldStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08)), mats.brassGold);
    goldStrip.position.set(x, WALL_HEIGHT - 0.9, z);
    worldGroup.add(goldStrip);
  };
  addLintel(-10, 7.5, 0.82, 4.1);
  addLintel(-10, -6.5, 0.82, 4.1);
  addLintel(10, 7.5, 0.82, 4.1);
  addLintel(10, -6.5, 0.82, 4.1);
  addLintel(0, 1.0, 4.5, 0.82);

  // Perimeter gallery cornice lighting strips (keeps overhead lobby vista crystal clear)
  const corniceMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdca842, roughness: 0.32, metalness: 0.75 }),
  );
  const northCornice = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(MAP_HALF_W * 2 - 1.2, 0.12, 0.14)),
    corniceMat,
  );
  northCornice.position.set(0, WALL_HEIGHT - 0.1, -MAP_HALF_D + 0.42);
  worldGroup.add(northCornice);

  // === 3. FRAMED PROCEDURAL ART GALLERY PAINTINGS ===
  const paintingCoords: Array<{ x: number; z: number; rotY: number; idx: number }> = [
    { x: -17.56, z: -9.5, rotY: Math.PI / 2, idx: 0 },
    { x: -17.56, z: -2.0, rotY: Math.PI / 2, idx: 1 },
    { x: -17.56, z: 5.5, rotY: Math.PI / 2, idx: 2 },
    { x: -10.42, z: 0.5, rotY: -Math.PI / 2, idx: 3 },
    { x: -6.0, z: 1.42, rotY: 0, idx: 0 },
    { x: 6.0, z: 1.42, rotY: 0, idx: 2 },
  ];
  paintingCoords.forEach((p) => {
    const frameGroup = new THREE.Group();
    frameGroup.position.set(p.x, 2.45, p.z);
    frameGroup.rotation.y = p.rotY;

    const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 1.75, 0.1)), mats.brassGold);
    frameGroup.add(frame);

    const artMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.paintings[p.idx % textures.paintings.length],
        roughness: 0.55,
      }),
    );
    const canvas = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2.05, 1.48)), artMat);
    canvas.position.z = 0.056;
    frameGroup.add(canvas);
    worldGroup.add(frameGroup);
  });

  // === 4. LOCKED / UNLOCKABLE GLOWING NORTH EXIT GATE ===
  const exitGroup = new THREE.Group();
  exitGroup.position.set(EXIT_GATE_POS.x, 0, -13.75);
  worldGroup.add(exitGroup);

  const gatePillarGeo = trackGeo(new THREE.BoxGeometry(0.65, 4.4, 0.85));
  const leftPost = new THREE.Mesh(gatePillarGeo, mats.ironTrim);
  leftPost.position.set(-2.2, 2.2, 0);
  const rightPost = new THREE.Mesh(gatePillarGeo, mats.ironTrim);
  rightPost.position.set(2.2, 2.2, 0);
  const gateHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.1, 0.85, 0.95)), mats.ironTrim);
  gateHeader.position.set(0, 4.2, 0);
  exitGroup.add(leftPost, rightPost, gateHeader);

  const exitLaserMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.35,
      roughness: 0.25,
      metalness: 0.5,
      transparent: true,
      opacity: 0.88,
    }),
  );

  // Sliding armored vault doors
  const doorGeo = trackGeo(new THREE.BoxGeometry(1.9, 3.6, 0.22));
  const exitGateLeft = new THREE.Mesh(doorGeo, exitLaserMat);
  exitGateLeft.position.set(-0.96, 1.8, 0);
  const exitGateRight = new THREE.Mesh(doorGeo, exitLaserMat);
  exitGateRight.position.set(0.96, 1.8, 0);
  exitGroup.add(exitGateLeft, exitGateRight);

  // Glowing exit sign strip above door
  const signStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.24, 0.16)), exitLaserMat);
  signStrip.position.set(0, 4.2, 0.48);
  exitGroup.add(signStrip);

  // Exit floor threshold pad
  const exitPad = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(3.8, 0.04, 1.8)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0xef4444,
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
    ),
  );
  exitPad.position.set(0, 0.02, 1.0);
  exitGroup.add(exitPad);

  const exitBeaconLight = new THREE.PointLight(0xef4444, 3.2, 12, 1.8);
  exitBeaconLight.position.set(0, 3.3, 1.3);
  exitGroup.add(exitBeaconLight);

  // === 5. SOUTH POLICE HIDE-PHASE LASER BARRIER ===
  const hideBarrierGroup = new THREE.Group();
  hideBarrierGroup.position.set(
    (POLICE_HIDE_BARRIER.minX + POLICE_HIDE_BARRIER.maxX) / 2,
    0,
    (POLICE_HIDE_BARRIER.minZ + POLICE_HIDE_BARRIER.maxZ) / 2,
  );
  const barrierMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
    }),
  );
  const barrierWidth = POLICE_HIDE_BARRIER.maxX - POLICE_HIDE_BARRIER.minX;
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(barrierWidth, 0.08, 0.08)), barrierMat);
    bar.position.y = 0.65 + i * 0.65;
    hideBarrierGroup.add(bar);
  }
  const barrierField = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(barrierWidth, 2.8, 0.05)),
    barrierMat,
  );
  barrierField.position.y = 1.45;
  hideBarrierGroup.add(barrierField);
  worldGroup.add(hideBarrierGroup);

  // === 6. PLACE ALL 45 PROCEDURAL 3D PROPS ===
  const propMeshes = new Map<string, { placement: PropPlacement; group: THREE.Group }>();
  for (const p of MUSEUM_PROPS) {
    const meshGroup = buildPropModel(p.type, mats, true);
    meshGroup.position.set(p.x, 0, p.z);
    meshGroup.rotation.y = p.rotY;
    if (p.scale) meshGroup.scale.setScalar(p.scale);
    worldGroup.add(meshGroup);
    propMeshes.set(p.id, { placement: p, group: meshGroup });
  }

  // Highlight ring beneath nearest disguiseable prop (shown to Robber only)
  const targetHighlightRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(0.68, 0.84, 24)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  targetHighlightRing.rotation.x = -Math.PI / 2;
  targetHighlightRing.position.y = 0.04;
  targetHighlightRing.visible = false;
  worldGroup.add(targetHighlightRing);

  // === 7. PLACE 3 GLOWING GOLD BARS ===
  const goldPickups: GoldPickupInstance[] = GOLD_BAR_SPAWNS.map((spawn) => {
    const built = buildGoldBarPickup(mats);
    built.group.position.set(spawn.x, 0, spawn.z);
    worldGroup.add(built.group);
    return {
      id: spawn.id,
      x: spawn.x,
      z: spawn.z,
      group: built.group,
      spinner: built.spinner,
      beaconRing: built.beaconRing,
      collected: false,
    };
  });

  // Subtle floor surround outside museum walls so perimeter never drops into bright void
  const surround = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(MAP_HALF_W * 4, MAP_HALF_D * 4)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0d131f, roughness: 0.95 })),
  );
  surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.05;
  worldGroup.add(surround);

  const setExitUnlocked = (unlocked: boolean) => {
    if (unlocked) {
      exitLaserMat.color.setHex(0x10b981);
      exitLaserMat.emissive.setHex(0x059669);
      exitLaserMat.opacity = 0.65;
      exitBeaconLight.color.setHex(0x10b981);
      exitGateLeft.position.x = -2.25;
      exitGateRight.position.x = 2.25;
      (exitPad.material as THREE.MeshStandardMaterial).emissive.setHex(0x10b981);
    } else {
      exitLaserMat.color.setHex(0xef4444);
      exitLaserMat.emissive.setHex(0xdc2626);
      exitLaserMat.opacity = 0.88;
      exitBeaconLight.color.setHex(0xef4444);
      exitGateLeft.position.x = -0.96;
      exitGateRight.position.x = 0.96;
      (exitPad.material as THREE.MeshStandardMaterial).emissive.setHex(0xef4444);
    }
  };

  const setHideBarrierVisible = (visible: boolean) => {
    hideBarrierGroup.visible = visible;
  };

  return {
    worldGroup,
    wallMeshesForCamera,
    propMeshes,
    goldPickups,
    exitGateLeft,
    exitGateRight,
    exitLaserMat,
    exitBeaconLight,
    hideBarrierGroup,
    targetHighlightRing,
    setExitUnlocked,
    setHideBarrierVisible,
    dispose: () => {
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}

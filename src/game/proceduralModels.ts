import * as THREE from 'three';
import type { PlayerRole, PropType } from './types';

export interface SharedMaterialLibrary {
  woodWarm: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  ironTrim: THREE.MeshStandardMaterial;
  velvetRed: THREE.MeshStandardMaterial;
  brassGold: THREE.MeshStandardMaterial;
  pureGold: THREE.MeshStandardMaterial;
  marbleWhite: THREE.MeshStandardMaterial;
  marbleVeined: THREE.MeshStandardMaterial;
  terracotta: THREE.MeshStandardMaterial;
  soilDark: THREE.MeshStandardMaterial;
  foliageLight: THREE.MeshStandardMaterial;
  foliageDark: THREE.MeshStandardMaterial;
  chromeSteel: THREE.MeshStandardMaterial;
  darkLiner: THREE.MeshStandardMaterial;
  robberSuit: THREE.MeshStandardMaterial;
  robberAccent: THREE.MeshStandardMaterial;
  robberMask: THREE.MeshStandardMaterial;
  policeNavy: THREE.MeshStandardMaterial;
  policeLight: THREE.MeshStandardMaterial;
  skinTone: THREE.MeshStandardMaterial;
  scannerGlow: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createSharedMaterials(contactShadowTex: THREE.Texture): SharedMaterialLibrary {
  const mats: SharedMaterialLibrary = {
    woodWarm: new THREE.MeshStandardMaterial({ color: 0x9f6b3e, roughness: 0.78, metalness: 0.04 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x523120, roughness: 0.52, metalness: 0.08 }),
    ironTrim: new THREE.MeshStandardMaterial({ color: 0x262c36, roughness: 0.36, metalness: 0.72 }),
    velvetRed: new THREE.MeshStandardMaterial({ color: 0x9e1b2d, roughness: 0.86, metalness: 0.05 }),
    brassGold: new THREE.MeshStandardMaterial({ color: 0xdca842, roughness: 0.24, metalness: 0.88 }),
    pureGold: new THREE.MeshStandardMaterial({
      color: 0xffcb3b,
      emissive: 0x6b4500,
      emissiveIntensity: 0.35,
      roughness: 0.16,
      metalness: 0.94,
    }),
    marbleWhite: new THREE.MeshStandardMaterial({ color: 0xddd6ca, roughness: 0.44, metalness: 0.05 }),
    marbleVeined: new THREE.MeshStandardMaterial({ color: 0xc2b9aa, roughness: 0.5, metalness: 0.05 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xb85b3c, roughness: 0.72, metalness: 0.05 }),
    soilDark: new THREE.MeshStandardMaterial({ color: 0x32251d, roughness: 0.95, metalness: 0.0 }),
    foliageLight: new THREE.MeshStandardMaterial({ color: 0x3b8c52, roughness: 0.68, metalness: 0.02 }),
    foliageDark: new THREE.MeshStandardMaterial({ color: 0x245e37, roughness: 0.75, metalness: 0.02 }),
    chromeSteel: new THREE.MeshStandardMaterial({ color: 0xc2ccd6, roughness: 0.22, metalness: 0.86 }),
    darkLiner: new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.85, metalness: 0.1 }),
    robberSuit: new THREE.MeshStandardMaterial({ color: 0x1d2330, roughness: 0.74, metalness: 0.1 }),
    robberAccent: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.35 }),
    robberMask: new THREE.MeshStandardMaterial({ color: 0x0d1017, roughness: 0.8, metalness: 0.05 }),
    policeNavy: new THREE.MeshStandardMaterial({ color: 0x1e3a6e, roughness: 0.65, metalness: 0.12 }),
    policeLight: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25, metalness: 0.5 }),
    skinTone: new THREE.MeshStandardMaterial({ color: 0xebb995, roughness: 0.62, metalness: 0.02 }),
    scannerGlow: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.6,
    }),
    contactShadowMat: new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    dispose: () => {
      Object.values(mats).forEach((v) => {
        if (v instanceof THREE.Material) v.dispose();
      });
    },
  };
  return mats;
}

export function addContactShadow(parent: THREE.Object3D, radius: number, mats: SharedMaterialLibrary): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 18);
  geo.rotateX(-Math.PI / 2);
  const disc = new THREE.Mesh(geo, mats.contactShadowMat);
  disc.position.y = 0.015;
  parent.add(disc);
  return disc;
}

function enableShadows(group: THREE.Object3D, cast: boolean): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material !== undefined) {
      obj.castShadow = cast;
      obj.receiveShadow = true;
    }
  });
}

/**
 * Builds composite 4–10 part procedural 3D models for all 7 museum prop archetypes.
 * Every prop is pivoted cleanly at bottom-center (y = 0) flush with the floor.
 */
export function buildPropModel(
  type: PropType,
  mats: SharedMaterialLibrary,
  includeShadowDisc = true,
): THREE.Group {
  const g = new THREE.Group();
  g.name = `prop_${type}`;

  switch (type) {
    case 'wooden_crate': {
      // Recessed main body + 4 perimeter frames + diagonal brace + 4 iron corner brackets
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), mats.woodDark);
      core.position.y = 0.48;
      g.add(core);

      const plankBar = new THREE.BoxGeometry(1.02, 0.14, 1.02);
      const topFrame = new THREE.Mesh(plankBar, mats.woodWarm);
      topFrame.position.y = 0.92;
      g.add(topFrame);

      const botFrame = new THREE.Mesh(plankBar, mats.woodWarm);
      botFrame.position.y = 0.08;
      g.add(botFrame);

      const postGeo = new THREE.BoxGeometry(0.14, 0.96, 0.14);
      const offsets = [
        [-0.44, -0.44],
        [0.44, -0.44],
        [-0.44, 0.44],
        [0.44, 0.44],
      ];
      offsets.forEach(([ox, oz]) => {
        const post = new THREE.Mesh(postGeo, mats.woodWarm);
        post.position.set(ox, 0.5, oz);
        g.add(post);
      });

      // Diagonal wooden brace on front/back
      const braceGeo = new THREE.BoxGeometry(0.96, 0.11, 0.98);
      const brace = new THREE.Mesh(braceGeo, mats.woodWarm);
      brace.position.y = 0.5;
      brace.rotation.z = Math.PI / 4;
      g.add(brace);

      // Iron corner brackets
      const bracketGeo = new THREE.BoxGeometry(1.05, 0.07, 1.05);
      const ironBand = new THREE.Mesh(bracketGeo, mats.ironTrim);
      ironBand.position.y = 0.96;
      g.add(ironBand);

      if (includeShadowDisc) addContactShadow(g, 0.78, mats);
      break;
    }

    case 'velvet_chair': {
      // 4 tapered mahogany legs + seat frame + plush crimson cushion + tufted backrest + brass trim
      const legGeo = new THREE.CylinderGeometry(0.045, 0.032, 0.46, 8);
      [
        [-0.3, -0.28],
        [0.3, -0.28],
        [-0.3, 0.28],
        [0.3, 0.28],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, mats.woodDark);
        leg.position.set(lx, 0.23, lz);
        g.add(leg);
      });

      const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.68), mats.woodDark);
      baseFrame.position.y = 0.46;
      g.add(baseFrame);

      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.64), mats.velvetRed);
      cushion.position.y = 0.56;
      g.add(cushion);

      const backFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.1), mats.woodDark);
      backFrame.position.set(0, 0.92, -0.3);
      g.add(backFrame);

      const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.58, 0.12), mats.velvetRed);
      backPad.position.set(0, 0.93, -0.27);
      g.add(backPad);

      const brassCrest = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.055, 0.11), mats.brassGold);
      brassCrest.position.set(0, 1.29, -0.3);
      g.add(brassCrest);

      // Armrests
      const armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.58);
      [-0.33, 0.33].forEach((ax) => {
        const arm = new THREE.Mesh(armGeo, mats.woodDark);
        arm.position.set(ax, 0.74, -0.02);
        g.add(arm);
      });

      if (includeShadowDisc) addContactShadow(g, 0.68, mats);
      break;
    }

    case 'potted_plant': {
      // Lathe terracotta planter + rim + soil mound + central stalk + 6 layered botanical leaves
      const potPoints = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.24, 0.0),
        new THREE.Vector2(0.34, 0.46),
        new THREE.Vector2(0.38, 0.5),
        new THREE.Vector2(0.38, 0.57),
        new THREE.Vector2(0.32, 0.57),
        new THREE.Vector2(0.28, 0.46),
      ];
      const pot = new THREE.Mesh(new THREE.LatheGeometry(potPoints, 14), mats.terracotta);
      g.add(pot);

      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.28, 0.08, 12), mats.soilDark);
      soil.position.y = 0.49;
      g.add(soil);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.56, 8), mats.foliageDark);
      stem.position.y = 0.78;
      g.add(stem);

      const leafGeo = new THREE.ConeGeometry(0.22, 0.62, 5);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const leaf = new THREE.Mesh(leafGeo, i % 2 === 0 ? mats.foliageLight : mats.foliageDark);
        leaf.position.set(Math.cos(angle) * 0.22, 0.92 + (i % 2) * 0.14, Math.sin(angle) * 0.22);
        leaf.rotation.z = -Math.cos(angle) * 0.68;
        leaf.rotation.x = Math.sin(angle) * 0.68;
        g.add(leaf);
      }

      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mats.foliageLight);
      crown.position.y = 1.18;
      g.add(crown);

      if (includeShadowDisc) addContactShadow(g, 0.62, mats);
      break;
    }

    case 'trash_can': {
      // Tapered brushed steel body (Lathe) + chrome rim + recessed dark interior + base pedal
      const bodyPoints = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.26, 0.0),
        new THREE.Vector2(0.31, 0.78),
        new THREE.Vector2(0.33, 0.82),
        new THREE.Vector2(0.29, 0.82),
      ];
      const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPoints, 16), mats.chromeSteel);
      g.add(body);

      const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.06, 14), mats.darkLiner);
      liner.position.y = 0.8;
      g.add(liner);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.03, 8, 18), mats.ironTrim);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.82;
      g.add(ring);

      const baseBand = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.275, 0.07, 16), mats.ironTrim);
      baseBand.position.y = 0.035;
      g.add(baseBand);

      const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.14), mats.ironTrim);
      pedal.position.set(0, 0.05, 0.31);
      g.add(pedal);

      if (includeShadowDisc) addContactShadow(g, 0.48, mats);
      break;
    }

    case 'marble_pedestal': {
      // Stepped plinth + fluted octagonal column + beveled capital + brass museum plaque
      const base1 = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.86), mats.marbleVeined);
      base1.position.y = 0.06;
      g.add(base1);

      const base2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), mats.marbleWhite);
      base2.position.y = 0.18;
      g.add(base2);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.86, 8), mats.marbleWhite);
      shaft.position.y = 0.67;
      g.add(shaft);

      const cap1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.72), mats.marbleVeined);
      cap1.position.y = 1.15;
      g.add(cap1);

      const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.84), mats.marbleWhite);
      cap2.position.y = 1.24;
      g.add(cap2);

      const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.03), mats.brassGold);
      plaque.position.set(0, 0.78, 0.31);
      g.add(plaque);

      if (includeShadowDisc) addContactShadow(g, 0.68, mats);
      break;
    }

    case 'golden_vase': {
      // Ebony plinth + sculptural Lathe amphora in brushed gold + twin TubeGeometry handles + collar
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.18, 12), mats.ironTrim);
      plinth.position.y = 0.09;
      g.add(plinth);

      const vaseProfile = [
        new THREE.Vector2(0.0, 0.18),
        new THREE.Vector2(0.2, 0.18),
        new THREE.Vector2(0.16, 0.28),
        new THREE.Vector2(0.34, 0.58),
        new THREE.Vector2(0.31, 0.82),
        new THREE.Vector2(0.15, 0.98),
        new THREE.Vector2(0.18, 1.14),
        new THREE.Vector2(0.25, 1.22),
        new THREE.Vector2(0.2, 1.22),
        new THREE.Vector2(0.12, 1.08),
      ];
      const amphora = new THREE.Mesh(new THREE.LatheGeometry(vaseProfile, 18), mats.brassGold);
      g.add(amphora);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.025, 8, 16), mats.pureGold);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.98;
      g.add(collar);

      // Twin ornate handles
      [-1, 1].forEach((side) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.16, 1.05, 0),
          new THREE.Vector3(side * 0.42, 0.98, 0),
          new THREE.Vector3(side * 0.4, 0.68, 0),
          new THREE.Vector3(side * 0.28, 0.56, 0),
        ]);
        const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.026, 6, false), mats.brassGold);
        g.add(handle);
      });

      if (includeShadowDisc) addContactShadow(g, 0.54, mats);
      break;
    }

    case 'gallery_bench': {
      // 4 dark iron legs + stretcher bar + walnut seat frame + tufted velvet cushion + brass studs
      const legGeo = new THREE.BoxGeometry(0.08, 0.42, 0.08);
      [
        [-0.64, -0.24],
        [0.64, -0.24],
        [-0.64, 0.24],
        [0.64, 0.24],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, mats.ironTrim);
        leg.position.set(lx, 0.21, lz);
        g.add(leg);
      });

      const stretcher = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.06, 0.06), mats.ironTrim);
      stretcher.position.y = 0.18;
      g.add(stretcher);

      const apron = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.1, 0.64), mats.woodDark);
      apron.position.y = 0.44;
      g.add(apron);

      const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.14, 0.58), mats.velvetRed);
      cushion.position.y = 0.55;
      g.add(cushion);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.03, 0.62), mats.brassGold);
      trim.position.y = 0.49;
      g.add(trim);

      if (includeShadowDisc) addContactShadow(g, 0.92, mats);
      break;
    }
  }

  enableShadows(g, true);
  return g;
}

export interface CharacterRig {
  root: THREE.Group;
  humanGroup: THREE.Group;
  disguiseContainer: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  bodyTilt: THREE.Object3D;
  currentDisguise: PropType | null;
  setDisguise: (prop: PropType | null) => void;
}

/**
 * Builds a composite stylized 3D character rig (Robber or Police) with articulated limbs
 * and an integrated Prop Shift disguise container.
 */
export function buildCharacterRig(
  role: PlayerRole,
  mats: SharedMaterialLibrary,
): CharacterRig {
  const root = new THREE.Group();
  const humanGroup = new THREE.Group();
  const bodyTilt = new THREE.Group();
  humanGroup.add(bodyTilt);
  root.add(humanGroup);

  const disguiseContainer = new THREE.Group();
  root.add(disguiseContainer);

  const suitMat = role === 'robber' ? mats.robberSuit : mats.policeNavy;
  const accentMat = role === 'robber' ? mats.robberAccent : mats.brassGold;

  // Articulated legs pivoted at hip (y = 0.64)
  const makeLeg = (xOff: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 0.64, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.2), suitMat);
    thigh.position.y = -0.26;
    pivot.add(thigh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.28), mats.ironTrim);
    shoe.position.set(0, -0.57, 0.04);
    pivot.add(shoe);
    return pivot;
  };
  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);
  bodyTilt.add(leftLeg, rightLeg);

  // Torso + vest/belt details
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), suitMat);
  torso.position.y = 0.96;
  bodyTilt.add(torso);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.33), mats.ironTrim);
  belt.position.y = 0.69;
  bodyTilt.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), accentMat);
  buckle.position.set(0, 0.69, 0.16);
  bodyTilt.add(buckle);

  if (role === 'robber') {
    // Loot duffel pack + gold stripe sash
    const duffel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.2), mats.woodDark);
    duffel.position.set(0, 0.98, -0.23);
    bodyTilt.add(duffel);

    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.32), mats.robberAccent);
    sash.position.y = 1.05;
    bodyTilt.add(sash);
  } else {
    // Police officer gold badge + shoulder epaulets
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), mats.brassGold);
    badge.position.set(0.14, 1.08, 0.17);
    bodyTilt.add(badge);

    [-0.24, 0.24].forEach((ex) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.18), mats.policeLight);
      ep.position.set(ex, 1.28, 0);
      bodyTilt.add(ep);
    });
  }

  // Articulated arms pivoted at shoulder (y = 1.2)
  const makeArm = (xOff: number, holdScanner: boolean): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 1.2, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.48, 0.16), suitMat);
    arm.position.y = -0.22;
    pivot.add(arm);
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.15), mats.ironTrim);
    glove.position.y = -0.48;
    pivot.add(glove);

    if (holdScanner) {
      // Glowing blue Police Prop Scanner baton
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.24, 8), mats.ironTrim);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, -0.48, 0.12);
      pivot.add(handle);

      const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.16), mats.scannerGlow);
      emitter.position.set(0, -0.48, 0.28);
      pivot.add(emitter);
    }
    return pivot;
  };
  const leftArm = makeArm(-0.34, false);
  const rightArm = makeArm(0.34, role === 'police');
  bodyTilt.add(leftArm, rightArm);

  // Head + Role Headgear
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), mats.skinTone);
  head.position.y = 1.48;
  bodyTilt.add(head);

  if (role === 'robber') {
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.38), mats.robberMask);
    mask.position.set(0, 1.51, 0.01);
    bodyTilt.add(mask);

    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.robberSuit);
    beanie.position.y = 1.61;
    bodyTilt.add(beanie);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 10), mats.robberAccent);
    cuff.position.y = 1.64;
    bodyTilt.add(cuff);
  } else {
    // Officer peaked cap + visor shades
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), mats.ironTrim);
    visor.position.set(0, 1.51, 0.17);
    bodyTilt.add(visor);

    const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.12, 10), mats.policeNavy);
    capBase.position.y = 1.68;
    bodyTilt.add(capBase);

    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.22), mats.ironTrim);
    capBrim.position.set(0, 1.64, 0.14);
    bodyTilt.add(capBrim);

    const insignia = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.04), mats.brassGold);
    insignia.position.set(0, 1.71, 0.2);
    bodyTilt.add(insignia);
  }

  addContactShadow(humanGroup, 0.56, mats);
  enableShadows(humanGroup, true);

  // Pre-build disguise prop cache for instant zero-allocation morphing!
  const propCache = new Map<PropType, THREE.Group>();
  let currentDisguise: PropType | null = null;

  const setDisguise = (prop: PropType | null) => {
    if (currentDisguise === prop) return;
    currentDisguise = prop;

    // Hide all cached prop models
    propCache.forEach((m) => {
      m.visible = false;
    });

    if (prop === null) {
      humanGroup.visible = true;
    } else {
      humanGroup.visible = false;
      let propMesh = propCache.get(prop);
      if (!propMesh) {
        propMesh = buildPropModel(prop, mats, true);
        propCache.set(prop, propMesh);
        disguiseContainer.add(propMesh);
      }
      propMesh.visible = true;
    }
  };

  return {
    root,
    humanGroup,
    disguiseContainer,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    bodyTilt,
    get currentDisguise() {
      return currentDisguise;
    },
    setDisguise,
  };
}

/**
 * Builds a gleaming 3-bar stacked Gold Bullion pickup with floating beacon ring.
 */
export function buildGoldBarPickup(mats: SharedMaterialLibrary): {
  group: THREE.Group;
  spinner: THREE.Group;
  beaconRing: THREE.Mesh;
} {
  const group = new THREE.Group();
  const spinner = new THREE.Group();
  spinner.position.y = 0.72;
  group.add(spinner);

  // Tapered ingot geometry (beveled trapezoid via Cylinder with 4 sides)
  const ingotGeo = new THREE.CylinderGeometry(0.14, 0.19, 0.44, 4);
  ingotGeo.rotateY(Math.PI / 4);
  ingotGeo.rotateZ(Math.PI / 2);

  const bar1 = new THREE.Mesh(ingotGeo, mats.pureGold);
  bar1.position.set(0, -0.06, -0.11);
  const bar2 = new THREE.Mesh(ingotGeo, mats.pureGold);
  bar2.position.set(0, -0.06, 0.11);
  const bar3 = new THREE.Mesh(ingotGeo, mats.pureGold);
  bar3.position.set(0, 0.1, 0);
  spinner.add(bar1, bar2, bar3);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beaconRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 24), ringMat);
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.03;
  group.add(beaconRing);

  addContactShadow(group, 0.52, mats);
  enableShadows(spinner, true);

  return { group, spinner, beaconRing };
}

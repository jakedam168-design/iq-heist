import * as THREE from 'three';

interface ParticleSlot {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

const MAX_PARTICLES = 96;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Zero-GC pooled particle burst + expanding police scanner ring system using InstancedMesh.
 */
export class VfxPool {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly slots: ParticleSlot[];
  private cursor = 0;

  // Expanding holographic scanner pulse ring for Police Tag / Arrest
  private readonly scanRing: THREE.Mesh;
  private readonly scanRingMat: THREE.MeshBasicMaterial;
  private scanLife = 0;
  private scanMaxLife = 0.42;

  constructor() {
    const geo = new THREE.OctahedronGeometry(0.14, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.slots = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.slots.push({
        active: false,
        life: 0,
        maxLife: 0.5,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0,
      });
      _dummy.position.set(0, -10, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);

    // Police scanner pulse ring
    const ringGeo = new THREE.RingGeometry(0.65, 1.0, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.scanRing = new THREE.Mesh(ringGeo, this.scanRingMat);
    this.scanRing.visible = false;
    this.group.add(this.scanRing);
  }

  emitBurst(
    x: number,
    y: number,
    z: number,
    hexColor: number,
    count: number,
    speed: number,
    maxLife = 0.52,
  ): void {
    _color.setHex(hexColor);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const s = this.slots[idx];
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.45;
      const horiz = speed * (0.45 + Math.random() * 0.75);
      s.active = true;
      s.life = maxLife * (0.75 + Math.random() * 0.35);
      s.maxLife = s.life;
      s.x = x + (Math.random() - 0.5) * 0.25;
      s.y = y + Math.random() * 0.4;
      s.z = z + (Math.random() - 0.5) * 0.25;
      s.vx = Math.cos(angle) * horiz;
      s.vy = 1.4 + Math.random() * 2.4;
      s.vz = Math.sin(angle) * horiz;
      s.size = 0.65 + Math.random() * 0.8;
      this.mesh.setColorAt(idx, _color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  emitScannerPulse(x: number, z: number, rotY: number, hexColor: number): void {
    this.scanLife = this.scanMaxLife;
    this.scanRing.visible = true;
    this.scanRing.position.set(x + Math.sin(rotY) * 1.15, 0.14, z + Math.cos(rotY) * 1.15);
    this.scanRing.scale.setScalar(0.3);
    this.scanRingMat.color.setHex(hexColor);
    this.scanRingMat.opacity = 0.85;
  }

  update(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      anyChanged = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummy.position.set(0, -10, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      s.vy -= 6.8 * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.05, s.y + s.vy * dt);
      s.z += s.vz * dt;
      const t = s.life / s.maxLife;
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.rotation.set(s.life * 6, s.life * 4, 0);
      _dummy.scale.setScalar(s.size * t);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anyChanged) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    if (this.scanLife > 0) {
      this.scanLife -= dt;
      if (this.scanLife <= 0) {
        this.scanRing.visible = false;
      } else {
        const progress = 1 - this.scanLife / this.scanMaxLife;
        this.scanRing.scale.setScalar(0.4 + progress * 3.1);
        this.scanRingMat.opacity = (1 - progress) * 0.85;
      }
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.scanRing.geometry.dispose();
    this.scanRingMat.dispose();
  }
}

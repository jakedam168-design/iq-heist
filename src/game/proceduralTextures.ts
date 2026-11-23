import * as THREE from 'three';

export interface ProceduralTexturePack {
  marbleFloor: THREE.CanvasTexture;
  oakParquet: THREE.CanvasTexture;
  mahoganyParquet: THREE.CanvasTexture;
  storageSlate: THREE.CanvasTexture;
  wallPlaster: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  paintings: THREE.CanvasTexture[];
  dispose: () => void;
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function makeMarbleCheckerCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const half = 128;

  for (let gy = 0; gy < 2; gy++) {
    for (let gx = 0; gx < 2; gx++) {
      const light = (gx + gy) % 2 === 0;
      ctx.fillStyle = light ? '#ebe4d6' : '#2f3a4a';
      ctx.fillRect(gx * half, gy * half, half, half);

      // Subtle marble veins
      ctx.strokeStyle = light ? 'rgba(158, 146, 128, 0.25)' : 'rgba(148, 168, 194, 0.16)';
      ctx.lineWidth = 1.5;
      for (let v = 0; v < 4; v++) {
        ctx.beginPath();
        const sx = gx * half + ((v * 37 + gx * 19) % half);
        ctx.moveTo(sx, gy * half);
        ctx.bezierCurveTo(
          sx + 18,
          gy * half + 44,
          sx - 20,
          gy * half + 86,
          sx + 10,
          gy * half + half,
        );
        ctx.stroke();
      }
    }
  }

  // Fine brass grout border
  ctx.strokeStyle = 'rgba(180, 152, 92, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half, 256);
  ctx.moveTo(0, half);
  ctx.lineTo(256, half);
  ctx.stroke();

  return c;
}

function makeWoodParquetCanvas(baseHex: string, plankHex: string, grainHex: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  const plankH = 32;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * 64;
    for (let col = -1; col < 3; col++) {
      const x = col * 128 + offset;
      const y = row * plankH;
      ctx.fillStyle = (row + col) % 2 === 0 ? baseHex : plankHex;
      ctx.fillRect(x + 1, y + 1, 126, plankH - 2);

      ctx.strokeStyle = grainHex;
      ctx.lineWidth = 1;
      for (let g = 0; g < 3; g++) {
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 6 + g * 9);
        ctx.lineTo(x + 124, y + 8 + g * 9);
        ctx.stroke();
      }
    }
  }
  return c;
}

function makeStorageSlateCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3c4553';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const shade = 58 + ((x * 7 + y * 13) % 14);
      ctx.fillStyle = `rgb(${shade}, ${shade + 7}, ${shade + 17})`;
      ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  }

  // Subtle industrial caution speckle
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 60; i++) {
    ctx.fillRect((i * 43) % 256, (i * 89) % 256, 3, 3);
  }
  return c;
}

function makeWallPlasterCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  // Warm gallery upper plaster
  ctx.fillStyle = '#dad2c4';
  ctx.fillRect(0, 0, 256, 172);
  // Chair rail molding
  ctx.fillStyle = '#c5b79f';
  ctx.fillRect(0, 168, 256, 10);
  // Lower wainscoting panel
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(0, 178, 256, 78);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 188, 104, 52);
  ctx.strokeRect(140, 188, 104, 52);
  // Gold baseboard trim
  ctx.fillStyle = '#b48a46';
  ctx.fillRect(0, 248, 256, 8);
  return c;
}

function makeContactShadowCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(6, 10, 18, 0.62)');
  grad.addColorStop(0.55, 'rgba(6, 10, 18, 0.28)');
  grad.addColorStop(1, 'rgba(6, 10, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

function makePaintingCanvas(variant: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext('2d')!;

  const palettes = [
    ['#1b263b', '#e0a96d', '#c1121f', '#f4f1de'],
    ['#1d3557', '#457b9d', '#f1faee', '#e63946'],
    ['#264653', '#2a9d8f', '#e9c46a', '#e76f51'],
    ['#2b2d42', '#8d99ae', '#edf2f4', '#d90429'],
  ];
  const pal = palettes[variant % palettes.length];
  ctx.fillStyle = pal[0];
  ctx.fillRect(0, 0, 256, 192);

  // Geometric modernist museum composition
  ctx.fillStyle = pal[1];
  ctx.beginPath();
  ctx.arc(92 + (variant * 24) % 70, 96, 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal[2];
  ctx.fillRect(136 - variant * 12, 28, 86, 118);

  ctx.fillStyle = pal[3];
  ctx.beginPath();
  ctx.moveTo(32, 168);
  ctx.lineTo(148, 42);
  ctx.lineTo(222, 168);
  ctx.closePath();
  ctx.globalAlpha = 0.72;
  ctx.fill();
  ctx.globalAlpha = 1;

  return c;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  const marbleFloor = configureColorTexture(makeMarbleCheckerCanvas(), 8, 6, maxAnisotropy);
  const oakParquet = configureColorTexture(
    makeWoodParquetCanvas('#8b5e3c', '#7c5132', 'rgba(48, 28, 12, 0.22)'),
    4,
    10,
    maxAnisotropy,
  );
  const mahoganyParquet = configureColorTexture(
    makeWoodParquetCanvas('#5b3228', '#4f2920', 'rgba(26, 10, 8, 0.28)'),
    4,
    10,
    maxAnisotropy,
  );
  const storageSlate = configureColorTexture(makeStorageSlateCanvas(), 8, 6, maxAnisotropy);
  const wallPlaster = configureColorTexture(makeWallPlasterCanvas(), 3, 1, maxAnisotropy);

  const contactShadow = new THREE.CanvasTexture(makeContactShadowCanvas());
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  const paintings = [0, 1, 2, 3].map((v) => {
    const tex = new THREE.CanvasTexture(makePaintingCanvas(v));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(4, maxAnisotropy);
    tex.needsUpdate = true;
    return tex;
  });

  return {
    marbleFloor,
    oakParquet,
    mahoganyParquet,
    storageSlate,
    wallPlaster,
    contactShadow,
    paintings,
    dispose: () => {
      marbleFloor.dispose();
      oakParquet.dispose();
      mahoganyParquet.dispose();
      storageSlate.dispose();
      wallPlaster.dispose();
      contactShadow.dispose();
      paintings.forEach((p) => p.dispose());
    },
  };
}

import * as THREE from 'three';

export interface WorldFloorTextures {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export function createWorldFloorTextures(
  theme: 'cobble' | 'marsh' | 'lava' | 'astral',
  maxAnisotropy: number,
): WorldFloorTextures {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  let seed = theme === 'cobble' ? 17 : theme === 'marsh' ? 31 : theme === 'lava' ? 53 : 79;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  if (theme === 'cobble') {
    // Sunlit warm sandstone & concrete courtyard pavers (high-speed movement clarity)
    ctx.fillStyle = '#7b634b';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#b5b5b5';
    rctx.fillRect(0, 0, size, size);

    const rows = 8;
    const cols = 6;
    const cellH = size / rows;
    const cellW = size / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cellW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cellW + offset + 3;
        const y = r * cellH + 3;
        const w = cellW - 6;
        const h = cellH - 6;
        const base = Math.floor(132 + rand() * 34);
        ctx.fillStyle = `rgb(${base + 18}, ${base}, ${base - 22})`;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();

        const rv = rand() > 0.68 ? 95 : 175;
        rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rctx.beginPath();
        rctx.roundRect(x, y, w, h, 4);
        rctx.fill();
      }
    }
    // Crisp tactical yard markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, size - 16, size - 16);
  } else if (theme === 'marsh') {
    ctx.fillStyle = '#2d5a52';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#999999';
    rctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 36; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rad = 24 + rand() * 44;
      const isPool = rand() > 0.6;
      ctx.fillStyle = isPool ? 'rgba(20, 184, 166, 0.36)' : 'rgba(71, 102, 88, 0.72)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();

      const rv = isPool ? 42 : 175;
      rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rctx.beginPath();
      rctx.arc(x, y, rad, 0, Math.PI * 2);
      rctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = rand() * (size - 70);
      const y = rand() * (size - 70);
      ctx.fillStyle = 'rgba(110, 128, 120, 0.85)';
      ctx.fillRect(x, y, 56, 40);
    }
  } else if (theme === 'lava') {
    ctx.fillStyle = '#3b2b27';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#bbbbbb';
    rctx.fillRect(0, 0, size, size);

    const step = 64;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const shade = Math.floor(66 + rand() * 30);
        ctx.fillStyle = `rgb(${shade + 18}, ${shade + 4}, ${shade})`;
        ctx.fillRect(x + 3, y + 3, step - 6, step - 6);
      }
    }
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      let px = rand() * size;
      let py = rand() * size;
      ctx.moveTo(px, py);
      for (let s = 0; s < 4; s++) {
        px += (rand() - 0.5) * 110;
        py += (rand() - 0.5) * 110;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#293768';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#555555';
    rctx.fillRect(0, 0, size, size);

    const tile = 128;
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        const dark = ((x + y) / tile) % 2 === 0;
        ctx.fillStyle = dark ? '#2d3b72' : '#3a4c8f';
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 6, y + 6, tile - 12, tile - 12);
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(18, 18);
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(18, 18);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap };
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

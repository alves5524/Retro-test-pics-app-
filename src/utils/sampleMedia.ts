/**
 * Deterministic local sample generators (no external network dependencies)
 * so users can immediately test static images and animated motion clips.
 */

export function createSamplePhotoCanvas(width = 960, height = 1200): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Warm sunset / editorial sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.72);
  skyGrad.addColorStop(0, '#D9CFC1');
  skyGrad.addColorStop(0.55, '#E9B97F');
  skyGrad.addColorStop(1, '#CE5E3A');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft studio sun disc
  const sunGrad = ctx.createRadialGradient(
    width * 0.62,
    height * 0.34,
    20,
    width * 0.62,
    height * 0.34,
    width * 0.34
  );
  sunGrad.addColorStop(0, '#FFF5DF');
  sunGrad.addColorStop(0.55, 'rgba(255, 224, 165, 0.55)');
  sunGrad.addColorStop(1, 'rgba(206, 94, 58, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(width * 0.62, height * 0.34, width * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Rolling distant editorial hills
  const drawHill = (yBase: number, amp: number, phase: number, fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 12) {
      const t = x / width;
      const y = yBase + Math.sin(t * Math.PI * 1.6 + phase) * amp + Math.cos(t * 4.2) * (amp * 0.22);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const hill1 = ctx.createLinearGradient(0, height * 0.5, 0, height * 0.75);
  hill1.addColorStop(0, '#9B9A62');
  hill1.addColorStop(1, '#6C7338');
  drawHill(height * 0.57, 42, 0.4, hill1);

  const hill2 = ctx.createLinearGradient(0, height * 0.62, 0, height * 0.88);
  hill2.addColorStop(0, '#6B7732');
  hill2.addColorStop(1, '#3E461F');
  drawHill(height * 0.68, 54, 2.2, hill2);

  // Foreground modernist arch / architectural silhouette + portrait shadow
  ctx.fillStyle = '#211F1D';
  ctx.fillRect(width * 0.1, height * 0.44, width * 0.24, height * 0.56);

  // Arch cutout filled with sky light
  ctx.save();
  ctx.beginPath();
  ctx.arc(width * 0.22, height * 0.59, width * 0.08, Math.PI, 0);
  ctx.lineTo(width * 0.3, height * 0.78);
  ctx.lineTo(width * 0.14, height * 0.78);
  ctx.closePath();
  ctx.fillStyle = '#F2D2A9';
  ctx.fill();
  ctx.restore();

  // Sculptural portrait silhouette in foreground center-right
  ctx.save();
  const figGrad = ctx.createLinearGradient(width * 0.44, height * 0.38, width * 0.85, height * 0.96);
  figGrad.addColorStop(0, '#44352E');
  figGrad.addColorStop(0.5, '#251D1A');
  figGrad.addColorStop(1, '#12100F');
  ctx.fillStyle = figGrad;

  // Shoulders
  ctx.beginPath();
  ctx.moveTo(width * 0.34, height);
  ctx.quadraticCurveTo(width * 0.42, height * 0.69, width * 0.64, height * 0.69);
  ctx.quadraticCurveTo(width * 0.88, height * 0.69, width * 0.94, height);
  ctx.closePath();
  ctx.fill();

  // Head + neck
  ctx.beginPath();
  ctx.ellipse(width * 0.64, height * 0.52, width * 0.11, height * 0.115, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(width * 0.59, height * 0.6, width * 0.1, height * 0.12);

  // Soft directional rim highlight along the sunlit side of the silhouette
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(width * 0.64, height * 0.52, width * 0.11, height * 0.115, -0.06, 0, Math.PI * 2);
  ctx.clip();
  const rimGrad = ctx.createLinearGradient(width * 0.52, height * 0.46, width * 0.76, height * 0.54);
  rimGrad.addColorStop(0, 'rgba(37, 29, 26, 0)');
  rimGrad.addColorStop(0.62, 'rgba(182, 92, 56, 0.35)');
  rimGrad.addColorStop(0.88, 'rgba(247, 214, 165, 0.75)');
  rimGrad.addColorStop(1, 'rgba(255, 240, 212, 0.92)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(width * 0.5, height * 0.38, width * 0.3, height * 0.28);
  ctx.restore();
  ctx.restore();

  // Foreground road / stripe
  ctx.fillStyle = '#EFE3C8';
  ctx.fillRect(0, height * 0.82, width, height * 0.045);

  // Foreground shadow hill
  drawHill(height * 0.89, 32, 4.1, '#1E2115');

  return canvas;
}

export function drawProceduralMotionFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number
): void {
  const duration = 6.0;
  const phase = ((timeSec % duration) / duration) * Math.PI * 2;

  // Dynamic background tonal sweep
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#E8DCC4');
  bg.addColorStop(0.5 + Math.sin(phase) * 0.15, '#D9854B');
  bg.addColorStop(1, '#262321');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Orbiting tonal spheres for crisp halftone & gradient-map motion test
  for (let i = 0; i < 3; i++) {
    const angle = phase + (i * Math.PI * 2) / 3;
    const cx = width * 0.5 + Math.cos(angle) * (width * 0.24);
    const cy = height * 0.5 + Math.sin(angle * 1.0) * (height * 0.22);
    const radius = width * (0.14 + 0.03 * Math.sin(phase * 2 + i));

    const orb = ctx.createRadialGradient(
      cx - radius * 0.3,
      cy - radius * 0.3,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    orb.addColorStop(0, '#FFF8EB');
    orb.addColorStop(0.55, i === 0 ? '#E13D48' : i === 1 ? '#A3B944' : '#3E6BE3');
    orb.addColorStop(1, '#151413');

    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sweeping graphic bar
  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(phase * 0.5);
  const barGrad = ctx.createLinearGradient(-width * 0.35, 0, width * 0.35, 0);
  barGrad.addColorStop(0, '#141414');
  barGrad.addColorStop(0.5, '#F5EFE2');
  barGrad.addColorStop(1, '#141414');
  ctx.fillStyle = barGrad;
  ctx.fillRect(-width * 0.34, -height * 0.045, width * 0.68, height * 0.09);
  ctx.restore();

  // Crisp graphic frame border
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = Math.max(4, width * 0.014);
  ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
}

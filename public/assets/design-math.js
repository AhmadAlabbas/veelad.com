// Shared by the browser editor, server mockup renderer and production instructions.
export function defaultPlacement(product) {
  return {
    x: 0.5,
    y: 0.5,
    scale: product.defaultScale,
    rotation: 0,
    repeat: false,
    background: "transparent",
    view: product.views[0],
  };
}
export function imageLayout(
  width,
  height,
  canvasWidth,
  canvasHeight,
  placement,
) {
  const fit =
    Math.min(canvasWidth / width, canvasHeight / height) * placement.scale;
  const w = width * fit,
    h = height * fit,
    angle = (placement.rotation * Math.PI) / 180;
  const bounds = {
    width: Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h,
    height: Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h,
  };
  const x = placement.x * canvasWidth,
    y = placement.y * canvasHeight;
  return {
    width: w,
    height: h,
    x,
    y,
    angle,
    bounds,
    cropped:
      x - bounds.width / 2 < -0.01 ||
      y - bounds.height / 2 < -0.01 ||
      x + bounds.width / 2 > canvasWidth + 0.01 ||
      y + bounds.height / 2 > canvasHeight + 0.01,
  };
}
export function patternCenters(layout, cw, ch, repeat) {
  if (!repeat) return [{ x: layout.x, y: layout.y }];
  const nx = Math.ceil((cw + layout.bounds.width) / layout.width) + 2,
    ny = Math.ceil((ch + layout.bounds.height) / layout.height) + 2;
  if (!Number.isFinite(nx * ny) || nx * ny > 256) return null;
  const centers = [];
  for (let j = -ny; j <= ny; j++)
    for (let i = -nx; i <= nx; i++) {
      const x = layout.x + i * layout.width,
        y = layout.y + j * layout.height;
      if (
        x + layout.bounds.width / 2 >= 0 &&
        y + layout.bounds.height / 2 >= 0 &&
        x - layout.bounds.width / 2 <= cw &&
        y - layout.bounds.height / 2 <= ch
      )
        centers.push({ x, y });
    }
  return centers.length <= 256 ? centers : null;
}
export function qualityEstimate(width, height, product, placement) {
  if (!width || !height) return { level: "empty", dpi: null, cropped: false };
  const [cw, ch] = product.preview,
    layout = imageLayout(width, height, cw, ch, placement);
  const dense = placement.repeat && !patternCenters(layout, cw, ch, true);
  if (!product.canvas)
    return {
      level: "template_required",
      dpi: null,
      cropped: !placement.repeat && layout.cropped,
      dense,
    };
  const dpi = Math.floor(
    Math.min(
      width / (((layout.width / cw) * product.canvas[0]) / 300),
      height / (((layout.height / ch) * product.canvas[1]) / 300),
    ),
  );
  return {
    level: dpi >= 300 ? "recommended" : dpi >= 150 ? "review" : "low",
    dpi,
    cropped: !placement.repeat && layout.cropped,
    dense,
  };
}
export function affineTriangle(source, target) {
  const [p0, p1, p2] = source,
    [q0, q1, q2] = target,
    det =
      p0[0] * (p1[1] - p2[1]) +
      p1[0] * (p2[1] - p0[1]) +
      p2[0] * (p0[1] - p1[1]);
  if (Math.abs(det) < 1e-9) return null;
  const coefficients = (axis) => [
    (q0[axis] * (p1[1] - p2[1]) +
      q1[axis] * (p2[1] - p0[1]) +
      q2[axis] * (p0[1] - p1[1])) /
      det,
    (q0[axis] * (p2[0] - p1[0]) +
      q1[axis] * (p0[0] - p2[0]) +
      q2[axis] * (p1[0] - p0[0])) /
      det,
    (q0[axis] * (p1[0] * p2[1] - p2[0] * p1[1]) +
      q1[axis] * (p2[0] * p0[1] - p0[0] * p2[1]) +
      q2[axis] * (p0[0] * p1[1] - p1[0] * p0[1])) /
      det,
  ];
  const x = coefficients(0),
    y = coefficients(1);
  return [x[0], y[0], x[1], y[1], x[2], y[2]];
}
// Sub-pixel overlap prevents antialiased clipping from leaving white mesh seams.
export function triangleClip(points, padding = 0.65) {
  const area = points.reduce(
      (sum, p, i) =>
        sum + p[0] * points[(i + 1) % 3][1] - points[(i + 1) % 3][0] * p[1],
      0,
    ),
    sign = area >= 0 ? 1 : -1;
  const normals = points.map((p, i) => {
    const q = points[(i + 1) % 3],
      dx = q[0] - p[0],
      dy = q[1] - p[1],
      length = Math.hypot(dx, dy) || 1;
    return [(sign * dy) / length, (-sign * dx) / length];
  });
  return points.map((p, i) => {
    const a = normals[(i + 2) % 3],
      b = normals[i],
      amount = padding / Math.max(0.1, 1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * amount, p[1] + (a[1] + b[1]) * amount];
  });
}
export function pointToUV(point, projection) {
  for (const indices of projection.triangles) {
    const v = indices.map((i) => projection.vertices[i]),
      [a, b, c] = v;
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-8) continue;
    const u =
        ((b[1] - c[1]) * (point[0] - c[0]) +
          (c[0] - b[0]) * (point[1] - c[1])) /
        den,
      w =
        ((c[1] - a[1]) * (point[0] - c[0]) +
          (a[0] - c[0]) * (point[1] - c[1])) /
        den,
      z = 1 - u - w;
    if (u >= -0.001 && w >= -0.001 && z >= -0.001)
      return {
        x: u * a[2] + w * b[2] + z * c[2],
        y: u * a[3] + w * b[3] + z * c[3],
      };
  }
  return null;
}

// A pixel belongs to one surface point. Unlike overlapping clipped triangles,
// this preserves translucent ink opacity and leaves no visible mesh seams.
const surfaceMaps = [];
export function projectTexture(
  pixels,
  textureWidth,
  textureHeight,
  projection,
  width = projection.width,
  height = projection.height,
) {
  let cached = surfaceMaps.find(
    (item) =>
      item.projection === projection &&
      item.width === width &&
      item.height === height,
  );
  if (!cached) {
    const u = new Float32Array(width * height),
      v = new Float32Array(width * height);
    u.fill(-1);
    for (const indices of projection.triangles) {
      const points = indices.map((i) => projection.vertices[i]),
        [a, b, c] = points.map((p) => [
          (p[0] * width) / projection.width,
          (p[1] * height) / projection.height,
          p[2],
          p[3],
        ]);
      const denominator =
        (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-8) continue;
      const left = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))),
        right = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0]))),
        top = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))),
        bottom = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
          const p =
              ((b[1] - c[1]) * (x + 0.5 - c[0]) +
                (c[0] - b[0]) * (y + 0.5 - c[1])) /
              denominator,
            q =
              ((c[1] - a[1]) * (x + 0.5 - c[0]) +
                (a[0] - c[0]) * (y + 0.5 - c[1])) /
              denominator,
            r = 1 - p - q;
          if (p < -1e-6 || q < -1e-6 || r < -1e-6) continue;
          const index = y * width + x;
          u[index] = p * a[2] + q * b[2] + r * c[2];
          v[index] = p * a[3] + q * b[3] + r * c[3];
        }
    }
    cached = { projection, width, height, u, v };
    surfaceMaps.unshift(cached);
    if (surfaceMaps.length > 3) surfaceMaps.pop();
  } else {
    surfaceMaps.splice(surfaceMaps.indexOf(cached), 1);
    surfaceMaps.unshift(cached);
  }
  const output = new Uint8ClampedArray(width * height * 4),
    { u, v } = cached;
  for (let i = 0; i < u.length; i++) {
    if (u[i] < 0) continue;
    const x = Math.max(
        0,
        Math.min(textureWidth - 1, u[i] * textureWidth - 0.5),
      ),
      y = Math.max(0, Math.min(textureHeight - 1, v[i] * textureHeight - 0.5)),
      x0 = Math.floor(x),
      y0 = Math.floor(y),
      x1 = Math.min(textureWidth - 1, x0 + 1),
      y1 = Math.min(textureHeight - 1, y0 + 1),
      fx = x - x0,
      fy = y - y0;
    const o0 = (y0 * textureWidth + x0) * 4,
      o1 = (y0 * textureWidth + x1) * 4,
      o2 = (y1 * textureWidth + x0) * 4,
      o3 = (y1 * textureWidth + x1) * 4;
    const a0 = (1 - fx) * (1 - fy) * pixels[o0 + 3],
      a1 = fx * (1 - fy) * pixels[o1 + 3],
      a2 = (1 - fx) * fy * pixels[o2 + 3],
      a3 = fx * fy * pixels[o3 + 3],
      alpha = a0 + a1 + a2 + a3;
    const red =
        pixels[o0] * a0 + pixels[o1] * a1 + pixels[o2] * a2 + pixels[o3] * a3,
      green =
        pixels[o0 + 1] * a0 +
        pixels[o1 + 1] * a1 +
        pixels[o2 + 1] * a2 +
        pixels[o3 + 1] * a3,
      blue =
        pixels[o0 + 2] * a0 +
        pixels[o1 + 2] * a1 +
        pixels[o2 + 2] * a2 +
        pixels[o3 + 2] * a3;
    const offset = i * 4;
    if (alpha > 0) {
      output[offset] = red / alpha;
      output[offset + 1] = green / alpha;
      output[offset + 2] = blue / alpha;
      output[offset + 3] = alpha;
    }
  }
  return output;
}

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

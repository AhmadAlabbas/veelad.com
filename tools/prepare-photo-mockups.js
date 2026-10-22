// Prepare generated photographic-style bases and deterministic print meshes.
// Sources is a JSON object mapping each view to its original generated PNG path.
// node tools/prepare-photo-mockups.js /private/path/sources.json
import fs from "node:fs/promises";
import sharp from "sharp";
const sources = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
const surfaces = JSON.parse(
  await fs.readFile(new URL("./photo-surfaces.json", import.meta.url), "utf8"),
);
const output = new URL("../public/assets/mockups/", import.meta.url),
  size = 1000;
for (const [view, spec] of Object.entries(surfaces)) {
  const base = await sharp(sources[view])
    .resize(size, size, { fit: "fill" })
    .webp({ quality: 95, effort: 6 })
    .toBuffer();
  const luma = await sharp(base).greyscale().blur(5).raw().toBuffer();
  const sample = (x, y) =>
    luma[
      Math.max(0, Math.min(size - 1, Math.round(y))) * size +
        Math.max(0, Math.min(size - 1, Math.round(x)))
    ];
  const vertices = [],
    triangles = [],
    nx = spec.cylinder ? 96 : 24,
    ny = spec.cylinder ? 20 : 30;
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const u = i / nx,
        v = j / ny;
      let x, y;
      if (spec.cylinder) {
        const c = spec.cylinder,
          theta = (u * 2 - 1) * Math.PI,
          angle = spec.back ? theta + (theta < 0 ? Math.PI : -Math.PI) : theta;
        x = c.center + c.radius * Math.sin(angle);
        y =
          c.top -
          0.025 * (1 - Math.cos(angle)) +
          v * (c.height - 0.01 * (1 - Math.cos(angle)));
      } else {
        const [a, b, c, d] = spec.quad;
        x =
          (1 - v) * ((1 - u) * a[0] + u * b[0]) +
          v * ((1 - u) * d[0] + u * c[0]);
        y =
          (1 - v) * ((1 - u) * a[1] + u * b[1]) +
          v * ((1 - u) * d[1] + u * c[1]);
      }
      x *= size;
      y *= size;
      if (spec.cloth) {
        const fade = Math.sin(u * Math.PI) * Math.sin(v * Math.PI),
          dx = (sample(x + 5, y) - sample(x - 5, y)) * 0.075,
          dy = (sample(x, y + 5) - sample(x, y - 5)) * 0.075;
        x += Math.max(-2.5, Math.min(2.5, dx)) * fade;
        y += Math.max(-2.5, Math.min(2.5, dy)) * fade;
      }
      vertices.push([
        +x.toFixed(3),
        +y.toFixed(3),
        +u.toFixed(6),
        +v.toFixed(6),
      ]);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      if (spec.cylinder) {
        const theta = (((i + 0.5) / nx) * 2 - 1) * Math.PI;
        if (Math.cos(theta) * (spec.back ? -1 : 1) < 0.15) continue;
      }
      const k = j * (nx + 1) + i;
      triangles.push([k, k + 1, k + nx + 2], [k, k + nx + 2, k + nx + 1]);
    }
  await fs.writeFile(new URL(view + ".webp", output), base);
  await fs.writeFile(
    new URL(view + ".json", output),
    JSON.stringify({
      width: size,
      height: size,
      render_version: "veelad-neutral-2",
      vertices,
      triangles,
      ...(spec.clip ? { clip_path: spec.clip } : {}),
    }) + "\n",
  );
  console.log("Prepared photographic base and surface:", view);
}

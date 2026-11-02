import test from "node:test";
import assert from "node:assert/strict";
import { snapLayerPosition } from "../public/assets/design-math.js";

const canvas = { width: 1000, height: 800 };
const layer = (x, y, width = 100, height = 100, extra = {}) =>
  ({ x, y, width, height, rotation: 0, ...extra });

test("smart alignment snaps layer centre to artboard centre in logical coordinates", () => {
  const result = snapLayerPosition(layer(496, 402), [], canvas);
  assert.equal(result.x, 500);
  assert.equal(result.y, 400);
  assert.deepEqual(result.guides, { x: 500, y: 400 });
});

test("smart alignment matches the nearest peer edge instead of always centering", () => {
  const result = snapLayerPosition(
    layer(300, 170),
    [layer(408, 320, 100, 100, { id: "other" })],
    canvas,
    { threshold: 9 },
  );
  assert.equal(result.x, 308);
  assert.equal(result.guides.x, 358);
  assert.equal(result.y, 170);
  assert.equal(result.guides.y, null);
});

test("smart alignment honors rotated peer bounds", () => {
  const result = snapLayerPosition(
    layer(520, 160),
    [layer(600, 340, 200, 50, { rotation: 90 })],
    canvas,
  );
  assert.ok(Math.abs(result.x - 525) < 1e-8);
  assert.ok(Math.abs(result.guides.x - 575) < 1e-8);
});

test("hidden peers, unchanged positions and disabled snapping yield no guides", () => {
  const source = layer(300, 210);
  const hidden = layer(408, 320, 100, 100, { visible: false });
  assert.deepEqual(snapLayerPosition(source, [hidden], canvas).guides, {
    x: null, y: null,
  });
  assert.deepEqual(snapLayerPosition(source, [], canvas, { threshold: 0 }), {
    x: 300, y: 210, guides: { x: null, y: null },
  });
});

test("smart alignment never changes design size or rotation", () => {
  const source = layer(496, 402, 220, 90, { rotation: 30, id: "edit" });
  const before = structuredClone(source);
  const result = snapLayerPosition(source, [], canvas);
  assert.deepEqual(source, before);
  assert.deepEqual(Object.keys(result).sort(), ["guides", "x", "y"]);
});

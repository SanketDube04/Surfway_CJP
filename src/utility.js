// ---------------------------------------------------------------------------
// Geometry helpers for multi-part 3D characters and objects
// ---------------------------------------------------------------------------

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

function getRandomFloat(min, max) {
    let r = ( (Math.random() * max) + min).toFixed(2);
    return r;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function radToDeg(r) { return r * 180 / Math.PI; }
function degToRad(d) { return d * Math.PI / 180; }

/**
 * Build a single axis-aligned box from min (x1,y1,z1) to max (x2,y2,z2).
 * indexOffset = the vertex index offset so indices are globally unique when
 * multiple boxes are combined into one mesh.
 */
function makeBoxGeometry(x1, y1, z1, x2, y2, z2, indexOffset, uMin=0, vMin=0, uMax=1, vMax=1) {
  // ... (positions and normals remain identical)
  const p = [
    // Front face (z2)
    x1, y2, z2,   x1, y1, z2,   x2, y1, z2,   x2, y2, z2,
    // Right face (x2)
    x2, y1, z2,   x2, y2, z2,   x2, y2, z1,   x2, y1, z1,
    // Back face (z1)
    x2, y2, z1,   x2, y1, z1,   x1, y1, z1,   x1, y2, z1,
    // Left face (x1)
    x1, y1, z1,   x1, y2, z1,   x1, y2, z2,   x1, y1, z2,
    // Top face (y2)
    x1, y2, z2,   x2, y2, z2,   x2, y2, z1,   x1, y2, z1,
    // Bottom face (y1)
    x1, y1, z2,   x2, y1, z2,   x2, y1, z1,   x1, y1, z1,
  ];

  const n = [
     0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
     1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
     0, 0,-1,   0, 0,-1,   0, 0,-1,   0, 0,-1,
    -1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
     0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
     0,-1, 0,   0,-1, 0,   0,-1, 0,   0,-1, 0,
  ];

  const t = [];
  for (let i = 0; i < 6; i++) {
    t.push(uMin, vMax,  uMin, vMin,  uMax, vMin,  uMax, vMax);
  }

  const o = indexOffset;
  const idx = [
    o,   o+1, o+2,   o,   o+2, o+3,
    o+4, o+5, o+6,   o+4, o+6, o+7,
    o+8, o+9, o+10,  o+8, o+10,o+11,
    o+12,o+13,o+14,  o+12,o+14,o+15,
    o+16,o+17,o+18,  o+16,o+18,o+19,
    o+20,o+21,o+22,  o+20,o+22,o+23,
  ];

  return { positions: p, vertexNormals: n, textureCoordinates: t, indices: idx };
}

/**
 * Generate a vertical 2D Quad (billboard) facing down the Z axis.
 */
function makeQuadGeometryZ(width, height) {
  const halfW = width / 2;
  const halfH = height / 2;
  const p = [
    -halfW,  halfH, 0,  // Top-left
    -halfW, -halfH, 0,  // Bottom-left
     halfW, -halfH, 0,  // Bottom-right
     halfW,  halfH, 0,  // Top-right
  ];
  const n = [
    0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
  ];
  const t = [
    0, 0,   // Top-left -> Top of image
    0, 1,   // Bottom-left -> Bottom of image
    1, 1,   // Bottom-right -> Bottom of image
    1, 0,   // Top-right -> Top of image
  ];
  const idx = [
    0, 1, 2,   0, 2, 3
  ];
  return { positions: p, vertexNormals: n, textureCoordinates: t, indices: idx, vertexCount: idx.length };
}

/**
 * Builds a cylinder/disc along the Z-axis (perfect for coins).
 */
function makeCylinderGeometryZ(radius, thickness, segments, indexOffset) {
  const p = [], n = [], t = [], idx = [];
  const halfT = thickness / 2;
  const o = indexOffset;

  // Front face (Z = halfT)
  p.push(0, 0, halfT); // Center point
  n.push(0, 0, 1);
  t.push(0.5, 0.5);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    p.push(Math.cos(angle) * radius, Math.sin(angle) * radius, halfT);
    n.push(0, 0, 1);
    t.push(0.5 + Math.cos(angle)*0.5, 0.5 + Math.sin(angle)*0.5);
  }
  let centerIdx = o;
  for (let i = 1; i <= segments; i++) {
    idx.push(centerIdx, centerIdx + i, centerIdx + i + 1);
  }
  let vOffset = centerIdx + segments + 2;

  // Back face (Z = -halfT)
  p.push(0, 0, -halfT);
  n.push(0, 0, -1);
  t.push(0.5, 0.5);
  for (let i = 0; i <= segments; i++) {
    const angle = -(i / segments) * Math.PI * 2; // reverse winding
    p.push(Math.cos(angle) * radius, Math.sin(angle) * radius, -halfT);
    n.push(0, 0, -1);
    t.push(0.5 + Math.cos(angle)*0.5, 0.5 + Math.sin(angle)*0.5);
  }
  centerIdx = vOffset;
  for (let i = 1; i <= segments; i++) {
    idx.push(centerIdx, centerIdx + i, centerIdx + i + 1);
  }
  vOffset = centerIdx + segments + 2;

  // Edge / Rim
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cx = Math.cos(angle), cy = Math.sin(angle);
    // front rim vertex
    p.push(cx * radius, cy * radius, halfT);
    n.push(cx, cy, 0);
    t.push(i / segments, 1);
    // back rim vertex
    p.push(cx * radius, cy * radius, -halfT);
    n.push(cx, cy, 0);
    t.push(i / segments, 0);
  }
  for (let i = 0; i < segments; i++) {
    const base = vOffset + i * 2;
    idx.push(base, base+1, base+2);
    idx.push(base+1, base+3, base+2);
  }

  return { positions: p, vertexNormals: n, textureCoordinates: t, indices: idx };
}


function combineGeometry(parts) {
  let positions = [], vertexNormals = [], textureCoordinates = [], indices = [];
  for (const part of parts) {
    positions          = positions.concat(part.positions);
    vertexNormals      = vertexNormals.concat(part.vertexNormals);
    textureCoordinates = textureCoordinates.concat(part.textureCoordinates);
    indices            = indices.concat(part.indices);
  }
  return { positions, vertexNormals, textureCoordinates, indices, vertexCount: indices.length };
}

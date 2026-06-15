// ---------------------------------------------------------------------------
// Police — animated officer that maintains a fixed gap behind the player
// and only closes in when the player stumbles (hits an obstacle/barrier)
// ---------------------------------------------------------------------------

function police(gl) {
  // No texture needed — we use solid colors per body part
  var texture = loadTexture(gl, 'assets/asset_custom/police.png'); // fallback, not used

  // ── Helper: create one animated body part ──────────────────────────────
  function makePart(x1, y1, z1, x2, y2, z2, pivot, maxAngle, phase, jumpAngle, color) {
    return {
      geom      : combineGeometry([makeBoxGeometry(x1, y1, z1, x2, y2, z2, 0)]),
      buf       : null,
      pivot     : pivot,
      maxAngle  : maxAngle  || 0,
      phase     : phase     || 0,
      jumpAngle : jumpAngle || 0,
      color     : color     || [1.0, 1.0, 1.0, 1.0],
    };
  }

  // ── Colors matched to police.png (Melody character) ───────────────────
  var HAIR_WHITE    = [0.82, 0.82, 0.82, 1.0];  // white/gray hair
  var SKIN_BROWN    = [0.76, 0.60, 0.42, 1.0];  // brown skin
  var SHIRT_ORANGE  = [0.90, 0.55, 0.10, 1.0];  // orange shirt
  var PANTS_PURPLE  = [0.35, 0.28, 0.55, 1.0];  // purple pants
  var SHOES_DARK    = [0.20, 0.18, 0.22, 1.0];  // dark shoes
  var SWATTER_RED   = [0.85, 0.15, 0.10, 1.0];  // red flyswatter
  var SWATTER_STICK = [0.60, 0.30, 0.15, 1.0];  // brown handle

  // ── Body part definitions ─────────────────────────────────────────────
  var parts = [
    // Hair (white/gray, on top of head, no swing)
    makePart(-0.08, 0.00,-0.08,  0.08, 0.06, 0.08,  [0.00,  0.25, 0], 0,    0,          0,    HAIR_WHITE),
    // Head (skin, no swing)
    makePart(-0.07,-0.07,-0.07,  0.07, 0.07, 0.07,  [0.00,  0.18, 0], 0,    0,          0,    SKIN_BROWN),
    // Torso (orange shirt, no swing — slightly wider than player)
    makePart(-0.13,-0.12,-0.07,  0.13, 0.08, 0.07,  [0.00,  0.03, 0], 0,    0,          0,    SHIRT_ORANGE),
    // Left arm (orange sleeve, swings)
    makePart(-0.04,-0.16,-0.04,  0.04, 0.00, 0.04,  [-0.17, 0.10, 0], 0.45, Math.PI,   -0.80, SHIRT_ORANGE),
    // Right arm (orange sleeve, swings — flyswatter arm)
    makePart(-0.04,-0.16,-0.04,  0.04, 0.00, 0.04,  [ 0.17, 0.10, 0], 0.45, 0,         -0.80, SHIRT_ORANGE),
    // Left hand (skin, swings with left arm)
    makePart(-0.035,-0.06,-0.035, 0.035, 0.00, 0.035, [-0.17,-0.06, 0], 0.45, Math.PI,  -0.80, SKIN_BROWN),
    // Right hand (skin, swings with right arm)
    makePart(-0.035,-0.06,-0.035, 0.035, 0.00, 0.035, [ 0.17,-0.06, 0], 0.45, 0,        -0.80, SKIN_BROWN),
    // Flyswatter stick (attached to right arm pivot, swings with it)
    makePart(-0.015, 0.00,-0.015, 0.015, 0.30, 0.015, [ 0.17, 0.10, 0], 0.45, 0,       -0.80, SWATTER_STICK),
    // Flyswatter head (red paddle on top of stick)
    makePart(-0.06, 0.26,-0.04,  0.06, 0.38, 0.04,  [ 0.17, 0.10, 0], 0.45, 0,         -0.80, SWATTER_RED),
    // Left leg (purple pants, swings)
    makePart(-0.04,-0.18,-0.05,  0.04, 0.00, 0.05,  [-0.06,-0.09, 0], 0.55, 0,         -0.70, PANTS_PURPLE),
    // Right leg (purple pants, swings)
    makePart(-0.04,-0.18,-0.05,  0.04, 0.00, 0.05,  [ 0.06,-0.09, 0], 0.55, Math.PI,  -0.70, PANTS_PURPLE),
    // Left shoe (dark, swings with left leg)
    makePart(-0.045,-0.05,-0.06, 0.045, 0.00, 0.06, [-0.06,-0.27, 0], 0.55, 0,         -0.70, SHOES_DARK),
    // Right shoe (dark, swings with right leg)
    makePart(-0.045,-0.05,-0.06, 0.045, 0.00, 0.06, [ 0.06,-0.27, 0], 0.55, Math.PI,  -0.70, SHOES_DARK),
  ];

  // "MELODY" text label on the police's back (faces camera)
  var melodyTexture = createTextTexture(gl, 'MELODY', {
    fontSize: 56, textColor: '#ffffff', bgColor: null, width: 256, height: 128
  });
  parts.push({
    geom      : makeQuadGeometryZ(0.22, 0.10),
    buf       : null,
    pivot     : [0.00, 0.01, 0.071],   // just in front of torso back face
    maxAngle  : 0,
    phase     : 0,
    jumpAngle : 0,
    color     : null,
    texture   : melodyTexture,
  });

  // Combined mesh for collision bounding
  var combinedGeom = combineGeometry([
    makeBoxGeometry(-0.07,-0.07,-0.07,  0.07, 0.07, 0.07,  0),
    makeBoxGeometry(-0.13,-0.12,-0.07,  0.13, 0.08, 0.07, 24),
  ]);

  return Object.assign(combinedGeom, {
    texture,
    rotation    : 0.0,
    translate   : [0.0, GROUND_Y, -0.65],
    type        : 'police',
    isCharacter : true,
    lane        : 1,
    jump        : 0,
    flyboost    : false,
    animTime    : 0,
    gap         : 2.50,
    chasing     : false,
    parts,
  });
}


// ---------------------------------------------------------------------------
// police_tick — called every frame
// ---------------------------------------------------------------------------
function police_tick(object, player) {

  // ── Smoothly mirror the player's lane ─────────────────────────────────
  var targetX = LANES[player.lane];
  object.translate[0] += (targetX - object.translate[0]) * 0.05;
  object.translate[1]  = GROUND_Y;  // ground level — 3D parts handle height via pivots

  // ── Gap management ────────────────────────────────────────────────────
  if (object.chasing) {
    // Close in at a fixed rate — takes ~3 seconds to cross 2.5 units
    object.gap -= 0.014;
    if (object.gap < 0) object.gap = 0;
  }
  // Police position is ALWAYS relative to the player so both "run" at the
  // same speed and only the gap changes.
  object.translate[2] = player.translate[2] + object.gap;

  // ── Catch detection ───────────────────────────────────────────────────
  var sameLane = Math.abs(object.translate[0] - player.translate[0]) < 0.30;
  if (sameLane && object.gap <= 0.25) {
    game_over = true;
  }
}

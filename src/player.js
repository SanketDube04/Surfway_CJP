// ---------------------------------------------------------------------------
// Player — per-part animated humanoid with running / jump pose
// ---------------------------------------------------------------------------

// Physics constants (shared across modules)
var JUMP_VEL  = 0.11;
var GRAVITY   = 0.004;
var GROUND_Y  = -0.70;

function player(gl) {
  // No texture needed — we use solid colors per body part
  var texture = loadTexture(gl, 'assets/asset_custom/player.png'); // fallback, not used

  // ── Helper: create one animated body part ──────────────────────────────
  // Box geometry is defined relative to the pivot at (0,0,0).
  // Limbs extend DOWNWARD (negative Y) from the pivot so they swing correctly.
  // color: [R, G, B, A] in 0-1 range
  function makePart(x1, y1, z1, x2, y2, z2, pivot, maxAngle, phase, jumpAngle, color) {
    return {
      geom      : combineGeometry([makeBoxGeometry(x1, y1, z1, x2, y2, z2, 0)]),
      buf       : null,          // filled by initCharacterPartBuffers
      pivot     : pivot,
      maxAngle  : maxAngle  || 0,
      phase     : phase     || 0,
      jumpAngle : jumpAngle || 0,
      color     : color     || [1.0, 1.0, 1.0, 1.0],
    };
  }

  // ── Colors matched to player.png (CJP character) ──────────────────────
  var HAIR_BLACK   = [0.15, 0.12, 0.10, 1.0];  // dark hair
  var SKIN_BROWN   = [0.76, 0.60, 0.42, 1.0];  // brown skin
  var SHIRT_GREEN  = [0.25, 0.55, 0.20, 1.0];  // green "CJP" shirt
  var PANTS_PURPLE = [0.35, 0.28, 0.55, 1.0];  // purple pants
  var SHOES_GRAY   = [0.45, 0.45, 0.45, 1.0];  // gray shoes

  // ── Body part definitions ─────────────────────────────────────────────
  // Running gait: left arm + right leg swing together (phase=PI),
  //               right arm + left leg swing together (phase=0).
  // Jump pose: arms swing back (+angle), legs tuck forward (-angle).
  var parts = [
    // Hair (sits on top of head, no swing)
    makePart(-0.08, 0.00,-0.08,  0.08, 0.05, 0.08,  [0.00,  0.25, 0], 0,    0,          0,    HAIR_BLACK),
    // Head (skin, no swing)
    makePart(-0.07,-0.07,-0.07,  0.07, 0.07, 0.07,  [0.00,  0.18, 0], 0,    0,          0,    SKIN_BROWN),
    // Torso (green shirt, no swing)
    makePart(-0.11,-0.12,-0.06,  0.11, 0.08, 0.06,  [0.00,  0.03, 0], 0,    0,          0,    SHIRT_GREEN),
    // Left arm (green sleeve, swings)
    makePart(-0.04,-0.16,-0.04,  0.04, 0.00, 0.04,  [-0.15, 0.10, 0], 0.50, Math.PI,   -0.80, SHIRT_GREEN),
    // Right arm (green sleeve, swings)
    makePart(-0.04,-0.16,-0.04,  0.04, 0.00, 0.04,  [ 0.15, 0.10, 0], 0.50, 0,         -0.80, SHIRT_GREEN),
    // Left hand (skin, swings with left arm)
    makePart(-0.035,-0.06,-0.035, 0.035, 0.00, 0.035, [-0.15,-0.06, 0], 0.50, Math.PI,  -0.80, SKIN_BROWN),
    // Right hand (skin, swings with right arm)
    makePart(-0.035,-0.06,-0.035, 0.035, 0.00, 0.035, [ 0.15,-0.06, 0], 0.50, 0,        -0.80, SKIN_BROWN),
    // Left leg (purple pants, swings)
    makePart(-0.04,-0.18,-0.05,  0.04, 0.00, 0.05,  [-0.05,-0.09, 0], 0.55, 0,         -0.70, PANTS_PURPLE),
    // Right leg (purple pants, swings)
    makePart(-0.04,-0.18,-0.05,  0.04, 0.00, 0.05,  [ 0.05,-0.09, 0], 0.55, Math.PI,  -0.70, PANTS_PURPLE),
    // Left shoe (gray, swings with left leg)
    makePart(-0.045,-0.05,-0.06, 0.045, 0.00, 0.06, [-0.05,-0.27, 0], 0.55, 0,         -0.70, SHOES_GRAY),
    // Right shoe (gray, swings with right leg)
    makePart(-0.045,-0.05,-0.06, 0.045, 0.00, 0.06, [ 0.05,-0.27, 0], 0.55, Math.PI,  -0.70, SHOES_GRAY),
  ];

  // "CJP" text label on the player's back (faces camera)
  var cjpTexture = createTextTexture(gl, 'CJP', {
    fontSize: 80, textColor: '#cc2222', bgColor: null, width: 256, height: 128
  });
  parts.push({
    geom      : makeQuadGeometryZ(0.18, 0.10),
    buf       : null,
    pivot     : [0.00, 0.01, 0.061],   // just in front of torso back face
    maxAngle  : 0,
    phase     : 0,
    jumpAngle : 0,
    color     : null,
    texture   : cjpTexture,
  });

  // Combined mesh for collision/bounding — uses head+torso boxes only
  var combinedGeom = combineGeometry([
    makeBoxGeometry(-0.07,-0.07,-0.07,  0.07, 0.07, 0.07,  0),
    makeBoxGeometry(-0.11,-0.12,-0.06,  0.11, 0.08, 0.06, 24),
  ]);

  return Object.assign(combinedGeom, {
    texture,
    rotation    : 0.0,
    translate   : [0.0, GROUND_Y, -3.15],
    type        : 'player',
    isCharacter : true,
    lane        : 1,
    jump        : 0,
    score       : 0,
    vy          : 0.0,
    jumpboost   : false,
    flyboost    : false,
    animTime    : 0,
    parts,
  });
}


// ---------------------------------------------------------------------------
// player_tick — called every frame while game is running
// ---------------------------------------------------------------------------
function player_tick(object, obstacles) {

  // ── Lane switching (discrete index → smooth lerp) ──────────────────────
  var wantsLeft  = false;
  var wantsRight = false;

  if (statusKeys[37] || statusKeys[65]) {
    wantsLeft = true; statusKeys[37] = statusKeys[65] = false;
  }
  if (statusKeys[39] || statusKeys[68]) {
    wantsRight = true; statusKeys[39] = statusKeys[68] = false;
  }

  if (wantsLeft  && object.lane > 0) object.lane--;
  if (wantsRight && object.lane < 2) object.lane++;

  // Smooth slide
  object.translate[0] += (LANES[object.lane] - object.translate[0]) * 0.28;

  // ── Jump input (only when grounded and not flying) ──────────────────────
  if (statusKeys[32] && object.jump === 0 && !object.flyboost) {
    object.jump = 1;
    object.vy   = object.jumpboost ? JUMP_VEL * 1.7 : JUMP_VEL;
    statusKeys[32] = false;
  }

  // ── Fly-boost: hover at fixed height ──────────────────────────────────
  if (object.flyboost) {
    var hoverY = GROUND_Y + 0.70;
    object.translate[1] += (hoverY - object.translate[1]) * 0.06;
    return;
  }

  // ── Normal gravity arc ─────────────────────────────────────────────────
  if (object.jump === 1) {
    object.vy          -= GRAVITY;
    object.translate[1] += object.vy;

    if (object.translate[1] <= GROUND_Y) {
      object.translate[1] = GROUND_Y;
      object.vy           = 0;
      object.jump         = 0;
    }
  }
}

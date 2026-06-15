// ---------------------------------------------------------------------------
// Obstacle — train / container block that must be dodged or jumped over
// ---------------------------------------------------------------------------

function obstacle(gl, laneIdx, z_dist) {

  // Make the train much longer: Z from -1.80 to +1.80 (3.6 units long)
  // X: ±0.22, Y: -0.45 to +0.35
  // Multi-part train: body + roof + wheels for more realistic look
  var idx = 0;
  var trainParts = [];
  // Main body
  trainParts.push(makeBoxGeometry(-0.28, -0.30, -1.80, 0.28, 0.30, 1.80, idx)); idx += 24;
  // Roof (slightly narrower, rounded look)
  trainParts.push(makeBoxGeometry(-0.24, 0.30, -1.75, 0.24, 0.40, 1.75, idx)); idx += 24;
  // Bottom rail / undercarriage
  trainParts.push(makeBoxGeometry(-0.30, -0.42, -1.70, 0.30, -0.30, 1.70, idx)); idx += 24;
  const geom = combineGeometry(trainParts);

  var r       = getRandomInt(0, 1);
  var texture = (r === 0)
    ? loadTexture(gl, 'assets/train.jpg')
    : loadTexture(gl, 'assets/container.jpg');

  return Object.assign(geom, {
    texture,
    rotation  : 0.0,
    translate : [LANES[laneIdx], -0.55, z_dist],
    lane      : laneIdx,
    type      : 'obstacle',
    topY      : -0.55 + 0.40,  // = -0.15 (taller roof)
    hit       : false,          // debounce: only trigger chase once per obstacle
  });
}


function obstacle_delete(gl) {
  var dist    = obstacles[obstacles.length - 1].translate[2] - 50;
  var laneIdx = getRandomInt(0, 2);
  obstacles.shift();
  buffer_obstacles.shift();
  obstacles.push(obstacle(gl, laneIdx, dist));
  buffer_obstacles.push(initBuffers(gl, obstacles[obstacles.length - 1]));
}


function obstacle_tick(gl, obstacles, player) {
  for (let i = 0; i < obstacles.length; ++i) {
    obstacles[i].translate[2] += speed;

    // ── Collision ────────────────────────────────────────────────────────
    // Skip collisions during the first 3 seconds (invincibility)
    var elapsed = (typeof then !== 'undefined' && gameStartTime > 0) ? then - gameStartTime : 999;
    if (elapsed < INVINCIBLE_SECS) continue;

    var sameLane   = obstacles[i].lane === player.lane;
    // Overlap Z checks player Z (±0.15) against train Z (±1.80)
    var overlapZ   = !(
      player.translate[2] - 0.15 >= obstacles[i].translate[2] + 1.80 ||
      player.translate[2] + 0.15 <= obstacles[i].translate[2] - 1.80
    );
    // Player clears by jumping: waist Y must be above obstacle topY
    var playerAbove = player.translate[1] >= obstacles[i].topY;

    if (sameLane && overlapZ && !playerAbove && !obstacles[i].hit) {
      obstacles[i].hit = true;
      // Trigger police chase — police causes the actual game_over
      objects[1].chasing = true;
    }

    // Reset hit flag once obstacle has passed (so recycled obstacles work)
    if (obstacles[i].translate[2] > 2) {
      obstacle_delete(gl);
      i--;
    }
  }
}

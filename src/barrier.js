// ---------------------------------------------------------------------------
// Barrier — low hurdle; hitting it slows player and triggers police chase
// ---------------------------------------------------------------------------

function barrier(gl, laneIdx, z_dist) {

  // Multi-part barrier: horizontal bar + two vertical posts
  var idx = 0;
  var barParts = [];
  // Main horizontal bar (wider, thinner)
  barParts.push(makeBoxGeometry(-0.30, -0.05, -0.03, 0.30, 0.05, 0.03, idx)); idx += 24;
  // Left post
  barParts.push(makeBoxGeometry(-0.28, -0.50, -0.03, -0.22, 0.05, 0.03, idx)); idx += 24;
  // Right post
  barParts.push(makeBoxGeometry(0.22, -0.50, -0.03, 0.28, 0.05, 0.03, idx)); idx += 24;
  const geom = combineGeometry(barParts);
  const texture = loadTexture(gl, './assets/barrier.jpg');

  return Object.assign(geom, {
    texture,
    rotation  : 0.0,
    translate : [LANES[laneIdx], -0.78, z_dist],
    lane      : laneIdx,
    type      : 'barricade',
    hit       : false,   // debounce — fires once per barrier
  });
}


function barrier_delete(gl, index) {
  var laneIdx = getRandomInt(0, 2);
  barriers[index]        = barrier(gl, laneIdx, -50);
  buffer_barriers[index] = initBuffers(gl, barriers[index]);
}


function barrier_tick(gl, barriers, player) {
  for (let i = 0; i < barriers.length; ++i) {
    barriers[i].translate[2] += speed;

    // ── Collision ────────────────────────────────────────────────────────
    // Skip collisions during the first 3 seconds (invincibility)
    var elapsed = (typeof then !== 'undefined' && gameStartTime > 0) ? then - gameStartTime : 999;
    if (elapsed < INVINCIBLE_SECS) continue;

    var sameLane  = barriers[i].lane === player.lane;
    var overlapZ  = !(
      player.translate[2] - 0.15 >= barriers[i].translate[2] + 0.05 ||
      player.translate[2] + 0.15 <= barriers[i].translate[2] - 0.05
    );
    // Barrier is low — player clears it by jumping (threshold near ground)
    var onGround  = player.translate[1] < GROUND_Y + 0.05;

    if (sameLane && overlapZ && onGround && !barriers[i].hit) {
      barriers[i].hit = true;

      // Slow world speed
      speed       = Math.max(0.035, speed - 0.012);
      speed_wall  = Math.max(0.06,  speed_wall - 0.03);

      // Also trigger police chase (same consequence as hitting an obstacle)
      objects[1].chasing = true;

      // Restore speed after 5 s
      setTimeout(function () {
        speed      = Math.min(speed + 0.012, 0.15);
        speed_wall = Math.min(speed_wall + 0.03, 0.30);
      }, 5000);
    }

    if (barriers[i].translate[2] > 2) {
      barrier_delete(gl, i);
    }
  }
}

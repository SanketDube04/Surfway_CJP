// ---------------------------------------------------------------------------
// Coin — spinning flat disc that increases player score by 1 on collection
// ---------------------------------------------------------------------------

function coin(gl, laneIdx, initial_z) {

  // Round golden disc: radius 0.12, thickness 0.04, 12 segments (dodecagon) looks great
  const geom = makeQuadGeometryZ(0.35, 0.35);
  const texture = loadTexture(gl, 'assets/asset_custom/coins.png');

  return Object.assign(geom, {
    texture,
    rotation  : 0,
    translate : [LANES[laneIdx], -0.55, initial_z], // raised to be more visible
    lane      : laneIdx,
    type      : 'coins',
  });
}


function coin_delete(gl, index) {
  var laneIdx = getRandomInt(0, 2);
  // Replace in-place at the given index (keeps array length stable)
  coins[index]        = coin(gl, laneIdx, -20);
  buffer_coins[index] = initBuffers(gl, coins[index]);
}


function coin_tick(gl, coins, player) {
  for (let i = 0; i < coins.length; ++i) {
    coins[i].translate[2] += speed;
    coins[i].rotation     -= 0.08;   // spin
    // Gentle bobbing to make coins more noticeable
    coins[i].translate[1] = -0.55 + Math.sin(Date.now() * 0.004 + i * 1.5) * 0.06;

    var sameLane = coins[i].lane === player.lane;
    var overlapZ = (
      player.translate[2] - 0.15 <= coins[i].translate[2] &&
      player.translate[2] + 0.15 >= coins[i].translate[2]
    );
    // Allow collection at any height (ground or mid-jump) within reasonable Y range
    var overlapY = Math.abs(player.translate[1] - coins[i].translate[1]) < 0.35;

    if (sameLane && overlapZ && overlapY) {
      player.score += 1;
      coin_delete(gl, i);
      // Do NOT i-- here: coin_delete replaces in-place, so index i now
      // points to a fresh coin at z=-20 which is fine to skip this frame.
    } else if (coins[i].translate[2] > 2) {
      coin_delete(gl, i);
    }
  }
}

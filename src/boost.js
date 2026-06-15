// ---------------------------------------------------------------------------
// Boost — power-up pickup: jump boost or fly boost
// ---------------------------------------------------------------------------

function boost(gl, laneIdx, z_dist) {

  const part = makeBoxGeometry(-0.12, -0.12, -0.12, 0.12, 0.12, 0.12, 0);
  const geom = combineGeometry([part]);

  var s = getRandomInt(0, 1);
  var texture, type;
  if (s === 0) {
    texture = loadTexture(gl, './assets/flyboost.jpg');
    type    = 'fly';
  } else {
    texture = loadTexture(gl, './assets/jumpboost.png');
    type    = 'jump';
  }

  return Object.assign(geom, {
    texture,
    rotation  : 0,
    translate : [LANES[laneIdx], -0.50, z_dist],
    lane      : laneIdx,
    type      : type,
  });
}


function boost_delete(gl, index) {
  var laneIdx = getRandomInt(0, 2);
  boosts[index]        = boost(gl, laneIdx, -35);
  buffer_boosts[index] = initBuffers(gl, boosts[index]);
}


function boost_tick(gl, boosts, player) {
  for (let i = 0; i < boosts.length; ++i) {
    boosts[i].translate[2] += speed;
    boosts[i].rotation     += 0.05;   // gentle spin
    // Vertical bobbing to catch the player's eye
    boosts[i].translate[1] = -0.50 + Math.sin(Date.now() * 0.005 + i) * 0.08;

    var sameLane = boosts[i].lane === player.lane;
    var overlapZ = (
      player.translate[2] - 0.15 <= boosts[i].translate[2] &&
      player.translate[2] + 0.15 >= boosts[i].translate[2]
    );
    var overlapY = Math.abs(player.translate[1] - boosts[i].translate[1]) < 0.45;

    if (sameLane && overlapZ && overlapY) {
      if (boosts[i].type === 'jump') {
        player.jumpboost = true;
        setTimeout(function () {
          player.jumpboost = false;
        }, 5000);
      } else if (boosts[i].type === 'fly') {
        player.flyboost = true;
        player.jump     = 1;
        setTimeout(function () {
          player.flyboost     = false;
          player.jump         = 1;   // let gravity bring player down naturally
          player.vy           = 0;
        }, 8000);
      }
      boost_delete(gl, i);
    } else if (boosts[i].translate[2] > 2) {
      boost_delete(gl, i);
    }
  }
}

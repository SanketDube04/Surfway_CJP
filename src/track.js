
function track(gl, side_x) {
  const parts = [];
  let idx = 0;
  
  // Left Rail (taller, more visible metal rail)
  parts.push(makeBoxGeometry(-0.26, -0.02, -1.0, -0.21, 0.03, 1.0, idx)); idx += 24;
  // Right Rail
  parts.push(makeBoxGeometry(0.21, -0.02, -1.0, 0.26, 0.03, 1.0, idx)); idx += 24;
  
  // 6 Wooden sleepers (more cross-beams for realism)
  for (let z of [-0.80, -0.48, -0.16, 0.16, 0.48, 0.80]) {
    parts.push(makeBoxGeometry(-0.38, -0.04, z - 0.05, 0.38, -0.01, z + 0.05, idx));
    idx += 24;
  }

  // Gravel bed under the sleepers
  parts.push(makeBoxGeometry(-0.42, -0.07, -1.0, 0.42, -0.04, 1.0, idx)); idx += 24;

  const geom = combineGeometry(parts);
  const texture = loadTexture(gl, 'assets/asset_custom/railwaytrack.png');

  return Object.assign(geom, {
    texture,
    rotation  : 0.0,
    translate : [side_x, -0.9, -3.15],
    type      : 'mono',
  });
}

function track_delete(gl, index) {
  var dist = tracks[tracks.length - 1].translate[2] - 2.0;
  tracks.splice(0, 3);
  buffer_tracks.splice(0, 3);

  [LANES[0], LANES[1], LANES[2]].forEach(function (x) {
    var t = track(gl, x);
    t.translate[2] = dist;
    tracks.push(t);
    buffer_tracks.push(initBuffers(gl, t));
  });
}

function track_tick(gl, tracks) {
  for (var i = 0; i < 20; ++i) {
    tracks[3 * i].translate[2]     += speed;
    tracks[3 * i + 1].translate[2] += speed;
    tracks[3 * i + 2].translate[2] += speed;

    if (tracks[3 * i].translate[2] > 5.0) {
      track_delete(gl, i);
      i--;
    }
  }
}

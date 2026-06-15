
function wall(gl, z_dist, scale, side) {
  // Tall building/wall slab beside the track; height varies by scale
  // We stack multiple smaller boxes to force the texture to repeat, 
  // preventing it from stretching into one giant blurry image.
  const parts = [];
  const height = 15.0 * scale;
  const cols = 3;  // depth is 12, so 3 segments of 4 units
  const rows = Math.max(1, Math.round(height / 4)); // ~4 units per story
  
  const dZ = 12.0 / cols;
  const dY = height / rows;
  
  let indexOffset = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
       const zStart = -6.0 + c * dZ;
       const zEnd   = -6.0 + (c + 1) * dZ;
       const yStart = -1.0 + r * dY;
       const yEnd   = -1.0 + (r + 1) * dY;
       
       parts.push(makeBoxGeometry(-5.0, yStart, zStart, 5.0, yEnd, zEnd, indexOffset));
       indexOffset += 24;
    }
  }
  
  const geom = combineGeometry(parts);
  const texture = loadTexture(gl, './assets/wall.jpg');

  return Object.assign(geom, {
    texture,
    rotation  : 0.0,
    translate : [13 * side, 0, z_dist],
    initial_z : z_dist,
    type      : 'wall',
    side      : side,
  });
}

function wall_delete(gl, object) {
  var r = getRandomFloat(0.2, 0.8);
  if (object.side === -1) {
    var dist = walls_left[walls_left.length - 1].translate[2] - 14;
    walls_left.shift();
    walls_left.push(wall(gl, dist, r, object.side));
    buffer_walls_left.shift();
    buffer_walls_left.push(initBuffers(gl, walls_left[walls_left.length - 1]));
  } else {
    var dist = walls_right[walls_right.length - 1].translate[2] - 14;
    walls_right.shift();
    walls_right.push(wall(gl, dist, r, object.side));
    buffer_walls_right.shift();
    buffer_walls_right.push(initBuffers(gl, walls_right[walls_right.length - 1]));
  }
}

function wall_tick(gl, walls_left, walls_right) {
  for (var i = 0; i < walls_left.length; ++i) {
    walls_left[i].translate[2] += speed;
    if (walls_left[i].translate[2] > 2.0) {
      wall_delete(gl, walls_left[i]);
      i--;
    }
  }
  for (var i = 0; i < walls_right.length; ++i) {
    walls_right[i].translate[2] += speed;
    if (walls_right[i].translate[2] > 2.0) {
      wall_delete(gl, walls_right[i]);
      i--;
    }
  }
}

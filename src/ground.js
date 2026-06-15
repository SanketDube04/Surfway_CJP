
function ground(gl) {
  // Widen ground: X from -15.0 to 15.0, but build it out of 6 tiled segments 
  // so the ground texture repeats and doesn't look stretched or blurry.
  const parts = [];
  const cols = 6;
  const dX = 30.0 / cols;
  
  let indexOffset = 0;
  for (let c = 0; c < cols; c++) {
    const xStart = -15.0 + c * dX;
    const xEnd   = -15.0 + (c + 1) * dX;
    parts.push(makeBoxGeometry(xStart, -0.05, -2.0, xEnd, 0.05, 2.0, indexOffset));
    indexOffset += 24;
  }
  
  const geom = combineGeometry(parts);
  const texture = loadTexture(gl, 'assets/ground.png');

  return Object.assign(geom, {
    texture,
    rotation  : 0.0,
    translate : [0.0, -1.0, 0],
    type      : 'mono',
  });
}

function ground_delete(gl, index) {
  var dist = objects[objects.length - 1].translate[2] - 4.0;
  objects.splice(index, 1);
  buffer_objects.splice(index, 1);

  var g = ground(gl);
  g.translate[2] = dist;
  objects.push(g);
  buffer_objects.push(initBuffers(gl, g));
}

function ground_tick(gl, objects) {
  for (var i = 2; i < objects.length; ++i) {
    objects[i].translate[2] += speed;
    if (objects[i].translate[2] > 5.0) {
      ground_delete(gl, i);
      i--;
    }
  }
}

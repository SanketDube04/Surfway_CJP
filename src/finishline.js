
function finishline(gl) {

  const part = makeBoxGeometry(-2.5, -0.5, -0.1, 2.5, 0.5, 0.1, 0);
  const geom = combineGeometry([part]);
  const texture = loadTexture(gl, 'assets/finish.jpg');

  return Object.assign(geom, {
    texture,
    rotation  : 0,
    translate : [0, 1.5, -45],
    type      : 'finishline',
  });
}

function finishline_tick(flag, player) {
  flag.translate[2] += speed;

  var overlapZ = !(
    player.translate[2] - 0.15 >= flag.translate[2] + 0.1 ||
    player.translate[2] + 0.15 <= flag.translate[2] - 0.1
  );

  if (overlapZ) {
    finish = 1;
  }
}

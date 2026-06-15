function clearScene(gl, translate) {

  // Match the fogColor from fragment shader for a seamless horizon
  gl.clearColor(0.55, 0.85, 0.98, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const fieldOfView = 45 * Math.PI / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, fieldOfView, aspect, 0.1, 1000.0);

  // Move camera back and up so we can see the police behind the player
  const viewMatrix = mat4.create();
  // Rotate to look down slightly
  mat4.rotate(viewMatrix, viewMatrix, 10 * Math.PI / 180, [1, 0, 0]);
  // Move camera up (Y=-0.6) and back (Z=-2.5) -> inverted for view matrix
  mat4.translate(viewMatrix, viewMatrix, [0.0, -0.6, -2.5]);

  mat4.multiply(projectionMatrix, projectionMatrix, viewMatrix);

  return projectionMatrix;
}


// ---------------------------------------------------------------------------
// drawScene — for all non-character objects (obstacles, coins, tracks, etc.)
// ---------------------------------------------------------------------------
function drawScene(gl, programInfo, buffers, deltaTime, projectionMatrix, object, texture) {

  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, object.translate);
  mat4.rotate(modelViewMatrix, modelViewMatrix, object.rotation, [0, 1, 0]);

  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelViewMatrix);
  mat4.transpose(normalMatrix, normalMatrix);

  // Vertex positions
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  // Texture coords
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
  gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

  // Normals
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
  gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix,  false, modelViewMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix,     false, normalMatrix);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(programInfo.uniformLocations.texture0, 0);
  gl.uniform1i(programInfo.uniformLocations.flash, flash);
  gl.uniform1i(programInfo.uniformLocations.gray,  gray);
  gl.uniform1i(programInfo.uniformLocations.useSpecular, object.type === 'coins');
  gl.uniform1i(programInfo.uniformLocations.useSolidColor, false);

  gl.drawElements(gl.TRIANGLES, object.vertexCount, gl.UNSIGNED_SHORT, 0);
}


// ---------------------------------------------------------------------------
// drawCharacter — draws every body part of an animated character separately.
// Each part has its own solid color and pivot-based rotation for limb swing.
// ---------------------------------------------------------------------------
function drawCharacter(gl, programInfo, character, projectionMatrix, deltaTime) {
  if (!character.parts) return;

  webglUtils.resizeCanvasToDisplaySize(gl.canvas);

  var t       = character.animTime || 0;
  var runFreq = 10.0;   // radians per second — controls run speed

  // Determine animation mode
  var isRunning = game_start && !game_over && !finish &&
                  character.jump === 0 && !character.flyboost;
  var isJumping = character.jump === 1;
  var isFlying  = character.flyboost || false;

  // Jump blend factor: 0 = ground pose, 1 = full jump pose
  // Uses velocity to create smooth transition (high vy at launch → 0 at apex → negative on fall)
  var jumpBlend = 0;
  if (isJumping && !isFlying) {
    // Normalize vy: at launch vy=0.10, at apex vy=0, at landing vy≈-0.10
    // We want full jump pose at apex (vy near 0) and partial on takeoff/landing
    var absVy = Math.abs(character.vy || 0);
    jumpBlend = 1.0 - Math.min(absVy / 0.10, 1.0) * 0.3;  // 0.7 to 1.0 range
  }

  // Vertical "bob" makes the run cycle feel weighty
  var bobOffset = 0;
  if (isRunning) {
    bobOffset = Math.abs(Math.sin(t * runFreq)) * 0.04;
  }

  // Landing squash: briefly compress the character vertically on touchdown
  var scaleY = 1.0;
  if (!character._prevJump && character._prevJump !== undefined) {
    // Was not jumping last frame — do nothing
  }
  if (character._wasJumping && character.jump === 0) {
    // Just landed! Start squash timer
    character._landTime = t;
  }
  character._wasJumping = (character.jump === 1);
  if (character._landTime) {
    var landElapsed = t - character._landTime;
    if (landElapsed < 0.15) {
      // Quick squash then stretch: compress Y by up to 15%
      scaleY = 1.0 - 0.15 * Math.sin(landElapsed / 0.15 * Math.PI);
    } else {
      character._landTime = null;
    }
  }

  // Use the shader program once for all parts
  gl.useProgram(programInfo.program);

  // Set common uniforms that don't change per-part
  gl.uniform1i(programInfo.uniformLocations.flash, flash);
  gl.uniform1i(programInfo.uniformLocations.gray,  gray);
  gl.uniform1i(programInfo.uniformLocations.useSpecular, false);
  gl.uniform1i(programInfo.uniformLocations.useSolidColor, true);

  character.parts.forEach(function (part) {
    if (!part.buf) return;   // buffers not yet initialised

    // Calculate this part's swing angle with smooth blending
    var angle = 0;
    if (isRunning) {
      angle = Math.sin(t * runFreq + part.phase) * part.maxAngle;
    } else if (isJumping || isFlying) {
      // Smoothly blend to jump pose using jumpBlend factor
      var runAngle = Math.sin(t * runFreq + part.phase) * part.maxAngle;
      angle = runAngle + (part.jumpAngle - runAngle) * jumpBlend;
    }

    // Build model-view matrix: translate → pivot → rotate
    var mvMatrix = mat4.create();

    // 1. Move to character world position + vertical bobbing
    mat4.translate(mvMatrix, mvMatrix, [
      character.translate[0],
      character.translate[1] + bobOffset,
      character.translate[2]
    ]);

    // 2. Landing squash effect (compress Y briefly on touchdown)
    if (scaleY !== 1.0) {
      mat4.scale(mvMatrix, mvMatrix, [1.0, scaleY, 1.0]);
    }

    // 3. Slight forward lean during jump (looks more dynamic)
    if (isJumping && !isFlying) {
      mat4.rotate(mvMatrix, mvMatrix, -0.15 * jumpBlend, [1, 0, 0]);
    }

    // 4. Character Y-rotation
    mat4.rotate(mvMatrix, mvMatrix, character.rotation, [0, 1, 0]);

    // 5. Move to part's pivot point in character-local space
    mat4.translate(mvMatrix, mvMatrix, part.pivot);

    // 6. Swing rotation around the X axis (forward/backward)
    mat4.rotate(mvMatrix, mvMatrix, angle, [1, 0, 0]);

    // Normal matrix for correct lighting
    var normalMatrix = mat4.create();
    mat4.invert(normalMatrix, mvMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    var buf = part.buf;

    // Vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.position);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    // Texture coords (not used for solid color, but must be bound)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.textureCoord);
    gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

    // Normals
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.normal);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.indices);

    // Per-part uniforms
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix,  false, mvMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix,     false, normalMatrix);

    // If the part has its own texture (e.g. text label), use it; otherwise solid color
    if (part.texture) {
      gl.uniform1i(programInfo.uniformLocations.useSolidColor, false);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, part.texture);
      gl.uniform1i(programInfo.uniformLocations.texture0, 0);
    } else {
      gl.uniform1i(programInfo.uniformLocations.useSolidColor, true);
      gl.uniform4fv(programInfo.uniformLocations.partColor, part.color);
    }

    gl.drawElements(gl.TRIANGLES, part.geom.vertexCount, gl.UNSIGNED_SHORT, 0);
  });

  // Advance animation clock
  character.animTime = t + deltaTime;
}

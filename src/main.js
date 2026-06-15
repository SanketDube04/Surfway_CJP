// ---------------------------------------------------------------------------
// Global game state
// ---------------------------------------------------------------------------
var statusKeys        = {};
var cubeRotation      = 0.0;
var cameraAngleDegHoriz = 0;
var cameraAngleDegVert  = 0;
var num_walls         = 30;
var flash             = false;
var gray              = false;
var game_over         = false;
var game_start        = false;
var finish            = 0;
var gameStartTime     = 0;       // timestamp when game_start becomes true
var INVINCIBLE_SECS   = 3.0;     // seconds of invincibility at start

// Game speed (increases with score)
var speed             = 0.075;
var speed_wall        = 0.20;
var lastSpeedMilestone = 0;

var then              = 0;

// Flash effect state
var flashActive       = false;
var flashFrames       = 0;

// Gray toggle debounce
var grayKeyHeld       = false;

// Lane X positions — shared by ALL modules
var LANES = [-1.05, 0.0, 1.05];

// ---------------------------------------------------------------------------
main();
// ---------------------------------------------------------------------------

function main() {
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  // ── Vertex shader ─────────────────────────────────────────────────────────
  const vsSource = `
  attribute vec4 aVertexPosition;
  attribute vec3 aVertexNormal;
  attribute vec2 aTextureCoord;

  uniform mat4 uNormalMatrix;
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  uniform bool flash;

  varying highp vec2 vTextureCoord;
  varying highp vec3 vLighting;
  varying highp vec4 vWorldPosition;
  varying highp vec3 vNormal;

  void main(void) {
    vWorldPosition = uModelViewMatrix * aVertexPosition;
    gl_Position = uProjectionMatrix * vWorldPosition;
    vTextureCoord = aTextureCoord;

    // We pass normal to FS for specular
    highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 0.0);
    vNormal = normalize(transformedNormal.xyz);

    // Ambient + Diffuse
    highp vec3 ambientLight = vec3(0.55, 0.55, 0.60); // slightly blue-ish ambient
    highp vec3 directionalLightColor = vec3(0.80, 0.75, 0.65); // warm sunlight
    if (flash) {
      directionalLightColor = vec3(1.8, 1.8, 1.8);
    }
    highp vec3 directionalVector = normalize(vec3(0.4, 0.8, 0.3));
    highp float directional = max(dot(vNormal, directionalVector), 0.0);
    vLighting = ambientLight + (directionalLightColor * directional);
  }
  `;

  // ── Fragment shader ───────────────────────────────────────────────────────
  const fsSource = `
  precision mediump float;
  varying vec2 vTextureCoord;
  varying highp vec3 vLighting;
  varying highp vec4 vWorldPosition;
  varying highp vec3 vNormal;

  uniform sampler2D texture0;
  uniform bool gray;
  uniform bool uUseSpecular;
  uniform bool uUseSolidColor;
  uniform vec4 uPartColor;

  vec4 toGrayscale(in vec4 color) {
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    return vec4(lum, lum, lum, color.a);
  }

  void main(void) {
    highp vec4 texColor;

    if (uUseSolidColor) {
      // 3D character parts use a solid color
      texColor = uPartColor;
    } else {
      texColor = texture2D(texture0, vTextureCoord);
      // Discard transparent pixels (removes PNG background)
      if (texColor.a < 0.1) {
        discard;
      }
    }

    vec3 finalLighting = vLighting;

    // Camera is roughly at vec3(0.0, 0.6, 2.5) in world space
    highp vec3 cameraPos = vec3(0.0, 0.6, 2.5);
    highp vec3 viewDir = normalize(cameraPos - vWorldPosition.xyz);
    highp vec3 lightDir = normalize(vec3(0.4, 0.8, 0.3));

    // Specular highlight (for shiny objects like coins)
    if (uUseSpecular) {
      highp vec3 halfVector = normalize(lightDir + viewDir);
      highp float specular = pow(max(dot(vNormal, halfVector), 0.0), 32.0);
      finalLighting += vec3(0.8, 0.8, 0.6) * specular; // golden shine
    }

    vec4 lit = vec4(texColor.rgb * finalLighting, texColor.a);
    vec4 colorOut = gray ? toGrayscale(lit) : lit;

    // Distance Fog (matches sky color)
    highp float dist = length(cameraPos - vWorldPosition.xyz);
    highp float fogFactor = smoothstep(20.0, 48.0, dist);
    highp vec4 fogColor = vec4(0.55, 0.85, 0.98, 1.0); // Rich sky blue

    gl_FragColor = mix(colorOut, fogColor, fogFactor);
  }
  `;

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition : gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      textureCoord   : gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
      vertexNormal   : gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
    },
    uniformLocations: {
      projectionMatrix : gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix  : gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      normalMatrix     : gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
      gray             : gl.getUniformLocation(shaderProgram, 'gray'),
      texture0         : gl.getUniformLocation(shaderProgram, 'texture0'),
      flash            : gl.getUniformLocation(shaderProgram, 'flash'),
      useSpecular      : gl.getUniformLocation(shaderProgram, 'uUseSpecular'),
      useSolidColor    : gl.getUniformLocation(shaderProgram, 'uUseSolidColor'),
      partColor        : gl.getUniformLocation(shaderProgram, 'uPartColor'),
    },
  };

  // ── Scene object arrays ───────────────────────────────────────────────────
  // objects[0] = player, objects[1] = police, objects[2+] = ground tiles
  var objects        = [];
  var tracks         = [];
  var walls_left     = [];
  var walls_right    = [];
  var coins          = [];
  var obstacles      = [];
  var barriers       = [];
  // boosts removed — user disabled powerups

  // buffer_objects[0] / [1] are dummy placeholders (characters use drawCharacter)
  // buffer_objects[2+] map 1-to-1 with objects[2+] (ground tiles)
  var buffer_objects       = [];
  var buffer_tracks        = [];
  var buffer_coins         = [];
  var buffer_obstacles     = [];
  var buffer_barriers      = [];
  // buffer_boosts removed
  var buffer_walls_left    = [];
  var buffer_walls_right   = [];

  // Expose globally so tick functions in other files can reference them
  window.objects           = objects;
  window.tracks            = tracks;
  window.walls_left        = walls_left;
  window.walls_right       = walls_right;
  window.coins             = coins;
  window.obstacles         = obstacles;
  window.barriers          = barriers;

  window.buffer_objects    = buffer_objects;
  window.buffer_tracks     = buffer_tracks;
  window.buffer_coins      = buffer_coins;
  window.buffer_obstacles  = buffer_obstacles;
  window.buffer_barriers   = buffer_barriers;

  window.buffer_walls_left = buffer_walls_left;
  window.buffer_walls_right= buffer_walls_right;

  // ── Build initial scene ───────────────────────────────────────────────────
  objects.push(player(gl));    // index 0 — isCharacter
  objects.push(police(gl));    // index 1 — isCharacter
  objects.push(ground(gl));    // index 2 — first ground tile

  // Extend ground tiles in Z
  for (let i = 3; i < 15; ++i) {
    var g = ground(gl);
    g.translate[2] = objects[i - 1].translate[2] - 4.0;
    objects.push(g);
  }

  // Tracks — three lanes × 20 rows
  tracks.push(track(gl, -1.05));
  tracks.push(track(gl,  0.0));
  tracks.push(track(gl,  1.05));
  for (let i = 1; i < 20; ++i) {
    var tz = tracks[3 * i - 1].translate[2] - 2.0;
    var tL = track(gl, -1.05); tL.translate[2] = tz; tracks.push(tL);
    var tC = track(gl,  0.0);  tC.translate[2] = tz; tracks.push(tC);
    var tR = track(gl,  1.05); tR.translate[2] = tz; tracks.push(tR);
  }

  // ── Initialise WebGL buffers ───────────────────────────────────────────────
  // Characters: per-part buffers (for 3D animation)
  initCharacterPartBuffers(gl, objects[0]);   // player
  initCharacterPartBuffers(gl, objects[1]);   // police

  // Push dummy nulls so buffer_objects indices match objects indices
  buffer_objects.push(null);   // index 0 — player  (drawn by drawCharacter)
  buffer_objects.push(null);   // index 1 — police  (drawn by drawCharacter)

  // Ground tiles (objects[2+])
  for (var i = 2; i < objects.length; ++i)    buffer_objects.push(initBuffers(gl, objects[i]));
  for (var i = 0; i < tracks.length; ++i)      buffer_tracks.push(initBuffers(gl, tracks[i]));

  // ── Render loop ───────────────────────────────────────────────────────────
  function render(now) {
    now *= 0.001;                          // convert ms → seconds
    const deltaTime = now - then;
    then = now;

    // Record the moment the game starts (for invincibility timer)
    if (game_start && gameStartTime === 0) {
      gameStartTime = now;
    }

    // ── Input handling ─────────────────────────────────────────────────────
    // Flash effect (F key) — single-press
    if (statusKeys[70]) {
      statusKeys[70] = false;
      flashActive    = true;
      flashFrames    = 0;
      flash          = true;
    }
    if (flashActive) {
      flashFrames++;
      if (flashFrames % 30 === 0) flash = !flash;
      if (flashFrames >= 480)    { flashActive = false; flash = false; }
    }

    // Gray mode (B key) — debounced single-press toggle
    if (statusKeys[66] && !grayKeyHeld) {
      gray        = !gray;
      grayKeyHeld = true;
    }
    if (!statusKeys[66]) grayKeyHeld = false;

    // ── HUD update ─────────────────────────────────────────────────────────
    update_score();

    if (game_over || finish) Game_over();

    // ── Speed progression (every 10 coins) ─────────────────────────────────
    var score = objects[0].score;
    if (score > 0 && score >= lastSpeedMilestone + 10) {
      lastSpeedMilestone = score;
      speed       = Math.min(0.105, speed      + 0.006);  // cap at 1.4×
      speed_wall  = Math.min(0.210, speed_wall + 0.015);  // wall speed proportional
    }

    // ── Game-object tick (only while running) ──────────────────────────────
    if (!game_over && !finish && game_start) {

      // Separate random rolls to prevent same-tile multi-spawns
      var rand  = getRandomInt(1, 200);
      var rand2 = getRandomInt(1, 200);
      var rand3 = getRandomInt(1, 200);
      var rand4 = getRandomInt(1, 200);

      if (rand  % 13 === 0 && coins.length < 45) {
        var cLane = getRandomInt(0, 2);
        var cZ    = coins.length === 0 ? -10 : coins[coins.length - 1].translate[2] - 2;
        coins.push(coin(gl, cLane, cZ));
        buffer_coins.push(initBuffers(gl, coins[coins.length - 1]));
      }

      if (rand2 % 17 === 0 && obstacles.length < 5) {
        var oLane = getRandomInt(0, 2);
        var oZ    = obstacles.length === 0 ? -10 : obstacles[obstacles.length - 1].translate[2] - 55;
        obstacles.push(obstacle(gl, oLane, oZ));
        buffer_obstacles.push(initBuffers(gl, obstacles[obstacles.length - 1]));
      }

      if (rand3 % 19 === 0 && barriers.length < 5) {
        var bLane = getRandomInt(0, 2);
        var bZ    = barriers.length === 0 ? -35 : barriers[barriers.length - 1].translate[2] - 9;
        barriers.push(barrier(gl, bLane, bZ));
        buffer_barriers.push(initBuffers(gl, barriers[barriers.length - 1]));
      }

      // Boosts/powerups removed
      obstacle_tick(gl, obstacles, objects[0]);
      barrier_tick(gl, barriers, objects[0]);
      coin_tick(gl, coins, objects[0]);
      player_tick(objects[0], obstacles);
      police_tick(objects[1], objects[0]);
      ground_tick(gl, objects);
      track_tick(gl, tracks);

    }

    // ── Draw ───────────────────────────────────────────────────────────────
    const projectionMatrix = clearScene(gl, objects[0].translate);

    // Characters (player + police) — animated per-part draw
    drawCharacter(gl, programInfo, objects[0], projectionMatrix, deltaTime);
    drawCharacter(gl, programInfo, objects[1], projectionMatrix, deltaTime);

    // Ground tiles (objects[2+], buffer_objects[2+])
    for (let i = 2; i < objects.length; i++) {
      drawScene(gl, programInfo, buffer_objects[i], deltaTime,
                projectionMatrix, objects[i], objects[i].texture);
    }

    for (let i = 0; i < buffer_tracks.length; i++) {
      drawScene(gl, programInfo, buffer_tracks[i], deltaTime,
                projectionMatrix, tracks[i], tracks[i].texture);
    }
    for (let i = 0; i < buffer_coins.length; ++i) {
      drawScene(gl, programInfo, buffer_coins[i], deltaTime,
                projectionMatrix, coins[i], coins[i].texture);
    }
    for (let i = 0; i < buffer_obstacles.length; ++i) {
      drawScene(gl, programInfo, buffer_obstacles[i], deltaTime,
                projectionMatrix, obstacles[i], obstacles[i].texture);
    }
    for (let i = 0; i < buffer_barriers.length; ++i) {
      drawScene(gl, programInfo, buffer_barriers[i], deltaTime,
                projectionMatrix, barriers[i], barriers[i].texture);
    }


    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}


// ---------------------------------------------------------------------------
// Initialise per-part WebGL buffers for animated characters.
// Each body part gets its own set of position/normal/texcoord/index buffers.
// ---------------------------------------------------------------------------
function initCharacterPartBuffers(gl, character) {
  if (!character.parts) return;
  character.parts.forEach(function (part) {
    part.buf = initBuffers(gl, part.geom);
  });
}


// ---------------------------------------------------------------------------
// WebGL helpers
// ---------------------------------------------------------------------------
function initBuffers(gl, object) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(object.positions), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(object.indices), gl.STATIC_DRAW);

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(object.textureCoordinates), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(object.vertexNormals), gl.STATIC_DRAW);

  return {
    position    : positionBuffer,
    normal      : normalBuffer,
    textureCoord: textureCoordBuffer,
    indices     : indexBuffer,
    type        : object.type,
  };
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader   = loadShader(gl, gl.VERTEX_SHADER,   vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }
  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

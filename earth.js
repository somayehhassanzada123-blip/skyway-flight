/* =====================================================================
   AEROLIGHT — 3D rotating Earth (Three.js via CDN)
   - Night-side Earth tinted in Aerolight blue, with glowing city lights
   - Fresnel atmosphere rim + outer glow
   - Smooth continuous rotation, subtle mouse parallax
   - Pauses when the hero is off-screen; falls back to a static image if
     WebGL or Three.js is unavailable.
   ===================================================================== */
(() => {
  "use strict";

  const container = document.getElementById("globe");
  if (!container) return;

  // ---- Feature detection: Three.js loaded + WebGL available ----
  const hasWebGL = (() => {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch { return false; }
  })();
  if (typeof window.THREE === "undefined" || !hasWebGL) return; // static fallback image stays visible

  const THREE = window.THREE;

  // ---- Renderer / scene / camera ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.6); // sphere of radius 1 fills ~80% of the canvas

  // ---- Textures (data URIs from earth-textures.js work on file:// too) ----
  const loader = new THREE.TextureLoader();
  const src = window.AEROLIGHT_TEXTURES || {
    day: "assets/images/earth-day.jpg",
    lights: "assets/images/earth-lights.jpg",
  };
  const dayTex = loader.load(src.day);
  const lightsTex = loader.load(src.lights);
  [dayTex, lightsTex].forEach((t) => { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });

  // Light direction (from upper-right, slightly behind) — gives the blue lit limb
  const sunDir = new THREE.Vector3(0.6, 0.9, 0.35).normalize();

  // ---- Earth surface shader ----
  const earthMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: dayTex },
      uLights: { value: lightsTex },
      uSun: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDay;
      uniform sampler2D uLights;
      uniform vec3 uSun;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vec3 day = texture2D(uDay, vUv).rgb;
        vec3 lights = texture2D(uLights, vUv).rgb;

        float sun = dot(normalize(vNormalW), uSun);
        float dayMix = smoothstep(-0.25, 0.55, sun);

        // Blue-tinted surface (deep navy on night side, electric blue on lit side)
        float lum = dot(day, vec3(0.299, 0.587, 0.114));
        vec3 nightBase = vec3(0.012, 0.03, 0.08) + lum * vec3(0.04, 0.09, 0.22);
        vec3 dayBase = day * vec3(0.35, 0.6, 1.25) * 0.85 + vec3(0.0, 0.03, 0.09);
        vec3 color = mix(nightBase, dayBase, dayMix);

        // City lights only on the night side (warm gold)
        float nightMask = 1.0 - smoothstep(-0.15, 0.35, sun);
        color += pow(lights, vec3(1.6)) * vec3(1.0, 0.78, 0.45) * 1.6 * nightMask;

        // Fresnel rim — atmospheric blue edge
        float fresnel = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 2.6);
        color += vec3(0.18, 0.45, 1.0) * fresnel * (0.55 + 0.9 * dayMix);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), earthMaterial);

  // ---- Outer atmosphere glow (back-faces of a slightly larger sphere) ----
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.12, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDir } },
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          float rim = dot(normalize(vNormalW), normalize(vViewDir));
          float intensity = pow(clamp(0.72 + rim, 0.0, 1.0), 5.0);
          float lit = 0.55 + 0.45 * smoothstep(-0.3, 0.8, dot(normalize(vNormalW), uSun));
          gl_FragColor = vec4(vec3(0.2, 0.5, 1.0) * lit, 1.0) * intensity;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );

  // Group with axial tilt
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = 0.41; // ~23.4° axial tilt
  tiltGroup.rotation.x = 0.25;
  tiltGroup.add(earth);
  scene.add(tiltGroup);
  scene.add(atmosphere);

  earth.rotation.y = -1.6; // start with the Americas facing the viewer

  // ---- Sizing ----
  const resize = () => {
    const size = container.clientWidth;
    if (!size) return;
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  // ---- Mouse parallax ----
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 0.12;
    target.y = (e.clientY / window.innerHeight - 0.5) * 0.08;
  }, { passive: true });

  // ---- Animation loop (paused while off-screen) ----
  const ROTATION_SPEED = 0.06; // radians / second → smooth, continuous
  let visible = true;
  let running = false;
  let last = performance.now();

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  io.observe(container.closest(".hero") || container);

  function tick(now) {
    if (!visible) { running = false; return; }
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    earth.rotation.y += ROTATION_SPEED * dt;
    current.x += (target.x - current.x) * 0.04;
    current.y += (target.y - current.y) * 0.04;
    tiltGroup.rotation.y = current.x;
    tiltGroup.rotation.x = 0.25 + current.y;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  container.classList.add("is-3d");
  start();
})();

type Point = [number, number];

// Each vertex stores its position, the point it grows from, and its birth time.
function fernMesh(): Float32Array {
  const vertices: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, origin: Point, birth: number) => {
    for (const p of [a, b, c]) vertices.push(...p, ...origin, birth);
  };
  const stem = (a: Point, b: Point, width: number, birth: number) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = -(b[1] - a[1]) / length * width;
    const dy = (b[0] - a[0]) / length * width;
    const p: Point = [a[0] + dx, a[1] + dy];
    const q: Point = [a[0] - dx, a[1] - dy];
    const r: Point = [b[0] + dx, b[1] + dy];
    const s: Point = [b[0] - dx, b[1] - dy];
    triangle(p, q, r, a, birth);
    triangle(q, s, r, a, birth);
  };
  const leaf = (root: Point, tip: Point, width: number, birth: number) => {
    const dx = tip[0] - root[0], dy = tip[1] - root[1];
    const length = Math.hypot(dx, dy);
    const contour: Point[] = [];
    for (let side of [1, -1]) {
      for (let i = 0; i <= 8; i++) {
        const t = side === 1 ? i / 8 : 1 - i / 8;
        const swell = Math.pow(Math.sin(Math.PI * t), .8) * width * side;
        contour.push([root[0] + dx * t - dy / length * swell, root[1] + dy * t + dx / length * swell]);
      }
    }
    for (let i = 0; i < contour.length - 1; i++) triangle(root, contour[i], contour[i + 1], root, birth);
  };
  const spine = (t: number): Point => [-.38 + .9 * t * t, -.98 + 1.9 * t];
  for (let i = 0; i < 80; i++) {
    const t = i / 80;
    stem(spine(t), spine((i + 1) / 80), .005 * (1 - t * .7), t * .84);
  }
  for (let i = 0; i < 23; i++) {
    const t = .13 + i * .036;
    const root = spine(t);
    const length = .58 * Math.pow(Math.sin(Math.PI * t), .85) * (1 - t * .5);
    for (const side of [-1, 1]) {
      const branch = (s: number): Point => [root[0] + side * length * s + .04 * s * s, root[1] + .13 * s + .07 * s * s];
      for (let j = 0; j < 10; j++) {
        const s = j / 10;
        stem(branch(s), branch((j + 1) / 10), .002, t * .84 + s * .08);
        if (j === 0) continue;
        const anchor = branch(s);
        const size = .075 * Math.pow(Math.sin(Math.PI * s), .6) * (1 - t * .55);
        for (const facing of [-1, 1]) {
          leaf(anchor, [anchor[0] + side * size * .5, anchor[1] + facing * size], size * .25, t * .84 + s * .08);
        }
      }
      leaf(branch(.88), branch(1.09), .015 * (1 - t), t * .84 + .08);
    }
  }
  return new Float32Array(vertices);
}

export function growFern(initialCanvas: HTMLCanvasElement) {
  let canvas = initialCanvas;
  const mesh = fernMesh();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let progress = motion.matches ? 1 : 0;
  let frame = 0;
  let draw!: (growth: number) => void;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  if (gl) {
    const shader = (type: number, source: string) => {
      const result = gl.createShader(type)!;
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Fern shader compilation failed');
      return result;
    };
    try {
      const program = gl.createProgram()!;
      const vertex = shader(gl.VERTEX_SHADER, `
        attribute vec2 a_position;
        attribute vec2 a_origin;
        attribute float a_birth;
        uniform float u_growth;
        void main() {
          float opening = smoothstep(a_birth, a_birth + 0.13, u_growth);
          gl_Position = vec4(mix(a_origin, a_position, opening), 0.0, 1.0);
        }
      `);
      const fragment = shader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        void main() { gl_FragColor = vec4(0.36, 0.43, 0.25, 1.0); }
      `);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Fern shader linking failed');
      gl.useProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
      for (const [name, size, offset] of [['a_position', 2, 0], ['a_origin', 2, 8], ['a_birth', 1, 16]] as const) {
        const attribute = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 20, offset);
      }
      const growth = gl.getUniformLocation(program, 'u_growth');
      draw = value => {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(growth, value);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 5);
      };
    } catch {
      // A canvas cannot switch context types after WebGL has been acquired.
      const replacement = canvas.cloneNode() as HTMLCanvasElement;
      canvas.replaceWith(replacement);
      canvas = replacement;
    }
  }
  if (!draw) {
    const context = canvas.getContext('2d');
    if (!context) return;
    draw = value => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#5c6e40';
      context.beginPath();
      for (let i = 0; i < mesh.length; i += 15) {
        for (let vertex = 0; vertex < 3; vertex++) {
          const k = i + vertex * 5;
          const t = Math.max(0, Math.min(1, (value - mesh[k + 4]) / .13));
          const opening = t * t * (3 - 2 * t);
          const x = mesh[k + 2] + (mesh[k] - mesh[k + 2]) * opening;
          const y = mesh[k + 3] + (mesh[k + 1] - mesh[k + 3]) * opening;
          const px = (x + 1) * canvas.width / 2, py = (1 - y) * canvas.height / 2;
          if (vertex === 0) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath();
      }
      context.fill();
    };
  }
  const resize = () => {
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * scale);
    canvas.height = Math.round(canvas.clientHeight * scale);
    draw(progress);
  };
  resize();
  window.addEventListener('resize', resize);
  const start = performance.now();
  const animate = (now: number) => {
    progress = Math.min((now - start) / 3000, 1);
    draw(progress);
    if (progress < 1) frame = requestAnimationFrame(animate);
  };
  if (!motion.matches) frame = requestAnimationFrame(animate);
  motion.addEventListener('change', () => {
    cancelAnimationFrame(frame);
    progress = 1;
    draw(progress);
  });
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame), { once: true });
}

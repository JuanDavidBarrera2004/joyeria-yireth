// Visor 3D de pulsera tejida (WebGL2, sin librerías).
// Unidades en milímetros. La pulsera está acostada en el plano XZ; el frente (θ = 0) mira a la cámara.

/* ---------------- matemáticas ---------------- */
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
function perspectiva(fov, asp, n, f) {
  const t = 1 / Math.tan(fov / 2), r = 1 / (n - f);
  return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * r, -1, 0, 0, 2 * f * n * r, 0];
}
function mirar(ojo, obj, arriba) {
  const z = v3.norm(v3.sub(ojo, obj)), x = v3.norm(v3.cross(arriba, z)), y = v3.cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3.dot(x, ojo), -v3.dot(y, ojo), -v3.dot(z, ojo), 1];
}
function mult(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

/* ---------------- geometría ---------------- */
// Cada malla: { p: [], n: [], uv: [] } (listas planas, triángulos sueltos)
const nuevaMalla = () => ({ p: [], n: [], uv: [] });
function tri(m, a, b, c, na, nb, nc, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
  m.p.push(...a, ...b, ...c); m.n.push(...na, ...nb, ...nc); m.uv.push(...ua, ...ub, ...uc);
}
// Superficie en rejilla (nu x nv) con normales por diferencias finitas
function rejilla(m, nu, nv, f, cerradaV = true) {
  const P = [];
  for (let i = 0; i <= nu; i++) { P.push([]); for (let j = 0; j <= nv; j++) P[i].push(f(i / nu, j / nv)); }
  const N = [];
  for (let i = 0; i <= nu; i++) {
    N.push([]);
    for (let j = 0; j <= nv; j++) {
      const du = v3.sub(P[Math.min(i + 1, nu)][j].pos, P[Math.max(i - 1, 0)][j].pos);
      const jm = cerradaV ? (j - 1 + nv) % nv : Math.max(j - 1, 0), jp = cerradaV ? (j + 1) % nv : Math.min(j + 1, nv);
      const dv = v3.sub(P[i][jp].pos, P[i][jm].pos);
      let n = v3.norm(v3.cross(du, dv));
      if (P[i][j].fuera && v3.dot(n, P[i][j].fuera) < 0) n = v3.mul(n, -1);
      N[i].push(n);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = P[i][j], b = P[i + 1][j], c = P[i + 1][j + 1], d = P[i][j + 1];
    const uvA = [i / nu, j / nv], uvB = [(i + 1) / nu, j / nv], uvC = [(i + 1) / nu, (j + 1) / nv], uvD = [i / nu, (j + 1) / nv];
    tri(m, a.pos, b.pos, c.pos, N[i][j], N[i + 1][j], N[i + 1][j + 1], uvA, uvB, uvC);
    tri(m, a.pos, c.pos, d.pos, N[i][j], N[i + 1][j + 1], N[i][j + 1], uvA, uvC, uvD);
  }
}
function esfera(m, c, r, nivel, facetada, semilla = 1) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v3.norm);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < nivel; s++) {
    const cache = {}, medio = (a, b) => { const k = a < b ? a + "_" + b : b + "_" + a; if (cache[k] === undefined) { cache[k] = V.length; V.push(v3.norm(v3.mul(v3.add(V[a], V[b]), .5))); } return cache[k]; };
    const NF = [];
    for (const [a, b, d] of F) { const ab = medio(a, b), bd = medio(b, d), da = medio(d, a); NF.push([a, ab, da], [b, bd, ab], [d, da, bd], [ab, bd, da]); }
    F = NF;
  }
  let rnd = semilla * 9301 + 49297;
  const azar = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280) - .5;
  for (const [a, b, d] of F) {
    const A = v3.add(c, v3.mul(V[a], r)), B = v3.add(c, v3.mul(V[b], r)), D = v3.add(c, v3.mul(V[d], r));
    if (facetada) {
      // cara plana con un leve giro aleatorio: da el brillo del corte diamantado
      let n = v3.norm(v3.add(v3.mul(v3.add(v3.add(V[a], V[b]), V[d]), 1 / 3), [azar() * .35, azar() * .35, azar() * .35]));
      tri(m, A, B, D, n, n, n);
    } else tri(m, A, B, D, V[a], V[b], V[d]);
  }
}
function toro(m, c, ex, ey, R, r, nu = 40, nv = 14) {
  // ex, ey: ejes del plano del aro
  const ez = v3.norm(v3.cross(ex, ey));
  rejilla(m, nu, nv, (u, v) => {
    const a = u * 2 * Math.PI, b = v * 2 * Math.PI;
    const dir = v3.add(v3.mul(ex, Math.cos(a)), v3.mul(ey, Math.sin(a)));
    const fuera = v3.add(v3.mul(dir, Math.cos(b)), v3.mul(ez, Math.sin(b)));
    return { pos: v3.add(c, v3.add(v3.mul(dir, R), v3.mul(fuera, r))), fuera };
  });
}
function disco(m, c, ex, ey, r, seg = 64, frente = true) {
  const n = v3.norm(frente ? v3.cross(ex, ey) : v3.cross(ey, ex));
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * 2 * Math.PI, a1 = (i + 1) / seg * 2 * Math.PI;
    const p0 = v3.add(c, v3.add(v3.mul(ex, Math.cos(a0) * r), v3.mul(ey, Math.sin(a0) * r)));
    const p1 = v3.add(c, v3.add(v3.mul(ex, Math.cos(a1) * r), v3.mul(ey, Math.sin(a1) * r)));
    const u0 = [.5 + Math.cos(a0) * .5, .5 - Math.sin(a0) * .5], u1 = [.5 + Math.cos(a1) * .5, .5 - Math.sin(a1) * .5];
    if (frente) tri(m, c, p0, p1, n, n, n, [.5, .5], u0, u1); else tri(m, c, p1, p0, n, n, n, [.5, .5], u1, u0);
  }
}

/* ---------------- la pulsera ---------------- */
const R = 31;                 // radio de la pulsera (≈ 62 mm de diámetro)
const BA = 1.8, BB = 3.1;     // medio grosor de la banda tejida: hacia afuera y de alto
const marco = th => ({
  p: [R * Math.sin(th), 0, R * Math.cos(th)],
  t: [Math.cos(th), 0, -Math.sin(th)],
  r: [Math.sin(th), 0, Math.cos(th)],
  u: [0, 1, 0],
});
const ang = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

function banda(m, th0, th1) {
  const largo = Math.abs(th1 - th0) * R, nu = Math.max(8, Math.round(largo * 3.2)), nv = 30, paso = 3.4;
  rejilla(m, nu, nv, (u, v) => {
    const th = th0 + (th1 - th0) * u, f = marco(th), phi = v * 2 * Math.PI;
    const s = th * R / paso, k = Math.floor(s), fs = s - k, lado = (k % 2 === 0) ? 1 : -1;
    // nudos de macramé: un lóbulo que alterna de borde y hebras en diagonal
    const lobulo = Math.exp(-(((fs - .5) / .34) ** 2)) * Math.exp(-((ang(phi - lado * 1.15) / .8) ** 2));
    const hebra = .5 + .5 * Math.cos(2 * Math.PI * (s * 1 - lado * phi / (2 * Math.PI) * 1.6));
    const h = 1 + .26 * lobulo + .09 * hebra;
    const off = v3.add(v3.mul(f.r, Math.cos(phi) * BA * h), v3.mul(f.u, Math.sin(phi) * BB * h));
    return { pos: v3.add(f.p, off), fuera: off };
  });
}
function tapa(m, th, signo) {
  const f = marco(th), n = v3.mul(f.t, signo), c = f.p, seg = 30;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * 2 * Math.PI, a1 = (i + 1) / seg * 2 * Math.PI;
    const p0 = v3.add(c, v3.add(v3.mul(f.r, Math.cos(a0) * BA * 1.05), v3.mul(f.u, Math.sin(a0) * BB * 1.05)));
    const p1 = v3.add(c, v3.add(v3.mul(f.r, Math.cos(a1) * BA * 1.05), v3.mul(f.u, Math.sin(a1) * BB * 1.05)));
    tri(m, c, p0, p1, n, n, n);
  }
}
function cordon(m, th0, th1, r, dy = 0, dr = 0) {
  const largo = Math.abs(th1 - th0) * R, nu = Math.max(6, Math.round(largo * 1.5));
  rejilla(m, nu, 12, (u, v) => {
    const th = th0 + (th1 - th0) * u, f = marco(th), phi = v * 2 * Math.PI;
    const centro = v3.add(v3.add(f.p, v3.mul(f.u, dy)), v3.mul(f.r, dr));
    const off = v3.add(v3.mul(f.r, Math.cos(phi) * r), v3.mul(f.u, Math.sin(phi) * r));
    return { pos: v3.add(centro, off), fuera: off };
  });
}
function cordonRecto(m, a, b, r) {
  const d = v3.norm(v3.sub(b, a)), e1 = v3.norm(v3.cross(d, Math.abs(d[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), e2 = v3.cross(d, e1);
  rejilla(m, 10, 12, (u, v) => {
    const phi = v * 2 * Math.PI, off = v3.add(v3.mul(e1, Math.cos(phi) * r), v3.mul(e2, Math.sin(phi) * r));
    return { pos: v3.add(v3.add(a, v3.mul(v3.sub(b, a), u)), off), fuera: off };
  });
}

// Construye todas las mallas según la configuración
export function construirPulsera(cfg) {
  const oro = nuevaMalla(), hilo = nuevaMalla(), foto = nuevaMalla();
  const items = [];
  const izq = cfg.izq || [], der = cfg.der || [];
  if (izq.length || der.length || cfg.herraje) items.push({ tipo: "remate", d: 2.6 });
  for (const d of [...izq].reverse()) items.push({ tipo: "balin", d });
  if (cfg.herraje) items.push({ tipo: "herraje", d: 19 });
  for (const d of der) items.push({ tipo: "balin", d });
  if (items.length) items.push({ tipo: "remate", d: 2.6 });
  const sep = .25, total = items.reduce((t, x) => t + x.d, 0) + sep * Math.max(0, items.length - 1);
  let s = -total / 2;
  for (const it of items) { it.s = s + it.d / 2; s += it.d + sep; }
  const thB = items.length ? (total / 2) / R + .02 : .05;     // donde termina la zona de balines
  const thK = Math.PI - .5;                                    // donde empieza el nudo corredizo

  // banda tejida a cada lado, cordón fino por dentro de los balines y cordones de atrás
  banda(hilo, thB, thK);
  banda(hilo, -thK, -thB);
  tapa(hilo, thB, -1); tapa(hilo, -thB, 1); tapa(hilo, thK, 1); tapa(hilo, -thK, -1);
  cordon(hilo, -thB - .02, thB + .02, .7);
  cordon(hilo, thK - .03, Math.PI + .42, .75, .95);
  cordon(hilo, -thK + .03, -Math.PI - .42, .75, -.95);
  // nudo corredizo (atrás) y colas con nudito
  for (const signo of [1, -1]) {
    const fk = marco(Math.PI + signo * .05);
    rejilla(hilo, 26, 18, (u, v) => {
      const a = (u - .5) * 9, phi = v * 2 * Math.PI, h = 1 + .12 * Math.cos(u * 2 * Math.PI * 5);
      const off = v3.add(v3.mul(fk.r, Math.cos(phi) * 2.6 * h), v3.mul(fk.u, Math.sin(phi) * 2.6 * h));
      return { pos: v3.add(v3.add(fk.p, v3.mul(fk.t, a + signo * 3.5)), off), fuera: off };
    });
  }
  for (const signo of [1, -1]) {
    const f = marco(Math.PI + signo * .42), ini = v3.add(f.p, [0, signo * .95, 0]);
    const fin = v3.add(v3.add(ini, v3.mul(f.r, 9)), v3.mul(f.t, signo * 3));
    cordonRecto(hilo, ini, fin, .75);
    esfera(hilo, fin, 1.5, 2, false);
  }

  // balines, remates y herraje
  let semilla = 3;
  for (const it of items) {
    const th = it.s / R, f = marco(th);
    if (it.tipo === "balin") esfera(oro, f.p, it.d / 2, cfg.liso ? 3 : 2, !cfg.liso, semilla++);
    else if (it.tipo === "remate") esfera(oro, f.p, it.d / 2, 2, false);
    else if (it.tipo === "herraje") {
      const c = v3.add(f.p, v3.mul(f.r, 1.6)), rr = 7;
      toro(oro, c, f.t, f.u, rr, .85, 60, 12);
      disco(foto, v3.add(c, v3.mul(f.r, .25)), f.t, f.u, rr - .2, 72, true);
      disco(oro, v3.sub(c, v3.mul(f.r, .25)), f.t, f.u, rr - .2, 72, false);
      for (const lado of [-1, 1]) toro(oro, v3.add(f.p, v3.mul(f.t, lado * 8.6)), f.t, f.r, 1.5, .45, 24, 10);
    }
  }
  return { oro, hilo, foto };
}

/* ---------------- WebGL ---------------- */
const VS = `#version 300 es
in vec3 aP; in vec3 aN; in vec2 aU;
uniform mat4 uVP;
out vec3 vP; out vec3 vN; out vec2 vU;
void main(){ vP=aP; vN=aN; vU=aU; gl_Position=uVP*vec4(aP,1.0); }`;
const FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec2 vU;
uniform vec3 uCam; uniform vec3 uCol; uniform int uModo; uniform sampler2D uTex; uniform float uTexOk;
out vec4 o;
float ent(vec3 r){
  float e = mix(0.10, 0.42, r.y*0.5+0.5);
  e += 2.2*smoothstep(0.86,0.97,dot(r,normalize(vec3(0.45,0.85,0.35))));
  e += 1.3*smoothstep(0.90,0.985,dot(r,normalize(vec3(-0.75,0.35,0.55))));
  e += 0.9*smoothstep(0.92,0.99,dot(r,normalize(vec3(0.2,0.15,-1.0))));
  e += 0.25*smoothstep(0.0,0.5,r.y)*(0.5+0.5*sin(r.x*9.0));
  return e;
}
void main(){
  vec3 N=normalize(vN), V=normalize(uCam-vP);
  vec3 L1=normalize(vec3(0.4,0.9,0.6)), L2=normalize(vec3(-0.6,0.45,0.35));
  vec3 base=pow(uCol,vec3(2.2)), c;
  if(uModo==3){ float d=length(vU-0.5)*2.0; o=vec4(0.18,0.12,0.08,0.28*(1.0-smoothstep(0.35,1.0,d))); return; }
  if(uModo==0){
    vec3 Rf=reflect(-V,N);
    float sp=pow(max(dot(Rf,L1),0.0),90.0)*2.2+pow(max(dot(Rf,L2),0.0),60.0)*0.9;
    c = base*(0.06+0.22*max(dot(N,L1),0.0)) + base*ent(Rf)*0.95 + mix(base,vec3(1.0),0.45)*sp;
    c += base*pow(1.0-max(dot(N,V),0.0),3.0)*0.35;
  } else if(uModo==1){
    float d=max(dot(N,L1),0.0)*0.85+max(dot(N,L2),0.0)*0.35+0.2;
    float sh=pow(1.0-max(dot(N,V),0.0),2.0)*0.22;
    c = base*d + sh*mix(base,vec3(1.0),0.6) + vec3(pow(max(dot(reflect(-L1,N),V),0.0),24.0)*0.06);
  } else {
    vec3 t = uTexOk>0.5 ? pow(texture(uTex,vU).rgb,vec3(2.2)) : base;
    float d=0.6+0.5*max(dot(N,L1),0.0);
    vec3 Rf=reflect(-V,N);
    c = t*d + vec3(pow(max(dot(Rf,L1),0.0),40.0)*0.35);
  }
  c = c/(1.0+c*0.32);
  o=vec4(pow(c,vec3(1.0/2.2)),1.0);
}`;

export function crearVisor(canvas, alCambiar) {
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const U = n => gl.getUniformLocation(pr, n), A = n => gl.getAttribLocation(pr, n);
  const uVP = U("uVP"), uCam = U("uCam"), uCol = U("uCol"), uModo = U("uModo"), uTexOk = U("uTexOk");
  gl.uniform1i(U("uTex"), 0);

  const subir = mal => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const bufs = [];
    for (const [nom, dat, n] of [["aP", mal.p, 3], ["aN", mal.n, 3], ["aU", mal.uv, 2]]) {
      const b = gl.createBuffer(); bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dat), gl.STATIC_DRAW);
      const l = A(nom); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    return { vao, bufs, n: mal.p.length / 3 };
  };
  const borrar = o => { if (!o) return; gl.deleteVertexArray(o.vao); o.bufs.forEach(b => gl.deleteBuffer(b)); };

  // sombra en el piso
  const piso = nuevaMalla(); { const y = -6.5, s = 52; tri(piso, [-s, y, -s], [-s, y, s], [s, y, s], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0], [0, 1], [1, 1]); tri(piso, [-s, y, -s], [s, y, s], [s, y, -s], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0], [1, 1], [1, 0]); }
  const gPiso = subir(piso);

  const tex = gl.createTexture(); let texOk = false, texUrl = "";
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 160, 80, 255]));
  const cargarFoto = url => {
    if (url === texUrl) return; texUrl = url; texOk = false;
    if (!url) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      if (texUrl !== url) return;
      const cv = document.createElement("canvas"); cv.width = cv.height = 512; const cx = cv.getContext("2d");
      const k = Math.max(512 / img.width, 512 / img.height) * 1.12, w = img.width * k, h = img.height * k;
      cx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      texOk = true; pedir();
    };
    img.src = url;
  };

  let g = {}, colores = { oro: [1, .78, .34], hilo: [.1, .1, .1] };
  let yaw = -.35, pitch = .42, dist = 118, auto = true, pend = true;
  const pedir = () => { pend = true; };

  function actualizar(cfg) {
    const m = construirPulsera(cfg);
    for (const k of ["oro", "hilo", "foto"]) { borrar(g[k]); g[k] = subir(m[k]); }
    colores = { oro: cfg.colorOro, hilo: cfg.colorHilo };
    cargarFoto(cfg.herraje?.foto || "");
    pedir();
  }
  function dibujar() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const ojo = [dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw)];
    const vp = mult(perspectiva(.6, w / h, 5, 600), mirar(ojo, [0, -1, 0], [0, 1, 0]));
    gl.uniformMatrix4fv(uVP, false, vp); gl.uniform3fv(uCam, ojo);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const pinta = (o, modo, col) => { if (!o || !o.n) return; gl.uniform1i(uModo, modo); gl.uniform3fv(uCol, col); gl.bindVertexArray(o.vao); gl.drawArrays(gl.TRIANGLES, 0, o.n); };
    pinta(g.hilo, 1, colores.hilo); pinta(g.oro, 0, colores.oro);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1f(uTexOk, texOk ? 1 : 0);
    pinta(g.foto, 2, colores.oro);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    pinta(gPiso, 3, [0, 0, 0]); gl.depthMask(true);
  }
  (function bucle() {
    if (auto) { yaw += .004; pend = true; }
    if (pend) { pend = false; dibujar(); }
    requestAnimationFrame(bucle);
  })();

  // girar con mouse o dedo, acercar con la rueda o pellizcando
  const toques = new Map(); let pinch0 = 0, dist0 = dist;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); toques.set(e.pointerId, [e.clientX, e.clientY]); auto = false; alCambiar?.("mano");
    if (toques.size === 2) { const [a, b] = [...toques.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = dist; } });
  canvas.addEventListener("pointermove", e => {
    if (!toques.has(e.pointerId)) return;
    const prev = toques.get(e.pointerId); toques.set(e.pointerId, [e.clientX, e.clientY]);
    if (toques.size === 1) { yaw -= (e.clientX - prev[0]) * .009; pitch = Math.max(-1.2, Math.min(1.35, pitch + (e.clientY - prev[1]) * .009)); }
    else if (toques.size === 2) { const [a, b] = [...toques.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) dist = Math.max(55, Math.min(220, dist0 * pinch0 / d)); }
    pedir();
  });
  const fin = e => { toques.delete(e.pointerId); if (toques.size < 2) pinch0 = 0; };
  canvas.addEventListener("pointerup", fin); canvas.addEventListener("pointercancel", fin);
  canvas.addEventListener("wheel", e => { e.preventDefault(); dist = Math.max(55, Math.min(220, dist * (1 + Math.sign(e.deltaY) * .08))); auto = false; pedir(); }, { passive: false });

  return {
    actualizar,
    vista(tipo) {
      auto = false;
      if (tipo === "frente") { yaw = 0; pitch = .3; dist = 105; }
      else if (tipo === "arriba") { yaw = 0; pitch = 1.3; dist = 125; }
      else if (tipo === "girar") { auto = true; }
      else { yaw = -.35; pitch = .42; dist = 118; auto = true; }
      pedir();
    },
  };
}

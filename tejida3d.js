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
  const oro = nuevaMalla(), hilo = nuevaMalla(), foto = nuevaMalla(), silueta = nuevaMalla();
  const items = [];
  const izq = cfg.izq || [], der = cfg.der || [];
  if (izq.length || der.length || cfg.herraje) items.push({ tipo: "remate", d: 2.6 });
  for (const d of [...izq].reverse()) items.push({ tipo: "balin", d });
  const rec = cfg.herraje && cfg.herraje.recorte;                 // { aspecto } cuando se pudo quitar el fondo
  const hAlto = rec ? 17 : 14, hAncho = rec ? Math.min(20, hAlto * rec.aspecto) : 14;
  const punta = rec ? hAncho / 2 : 7;                              // media anchura hasta la punta del herraje
  const AMARRE = 3.6;                                              // argolla + lazo de hilo + nudo en cada punta
  if (cfg.herraje) items.push({ tipo: "herraje", d: 2 * (punta + AMARRE) + .4 });
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
  // el cordón llega a cada punta del herraje y se amarra allí (no pasa por detrás de la joya)
  const itH = items.find(x => x.tipo === "herraje");
  if (itH) {
    cordon(hilo, -thB - .02, (itH.s - punta - AMARRE + .3) / R, .7);
    cordon(hilo, (itH.s + punta + AMARRE - .3) / R, thB + .02, .7);
  } else cordon(hilo, -thB - .02, thB + .02, .7);
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
    else if (it.tipo === "herraje" && rec) {
      // la joya recortada: frente con la foto y respaldo dorado con la misma silueta
      const ex = v3.mul(f.t, hAncho / 2), ey = v3.mul(f.u, hAlto / 2), cf = v3.add(f.p, v3.mul(f.r, 1.5)), cb = v3.add(f.p, v3.mul(f.r, 1.1));
      const q = (m, c, n, flip) => {
        const A = v3.sub(v3.sub(c, ex), v3.mul(ey, -1)), B = v3.add(v3.add(c, ex), ey), C = v3.add(v3.sub(c, v3.mul(ey, 1)), ex), D = v3.sub(v3.sub(c, ex), ey);
        // A arriba-izq, B arriba-der, C abajo-der, D abajo-izq
        const uA = [flip ? 1 : 0, 0], uB = [flip ? 0 : 1, 0], uC = [flip ? 0 : 1, 1], uD = [flip ? 1 : 0, 1];
        tri(m, A, D, C, n, n, n, uA, uD, uC); tri(m, A, C, B, n, n, n, uA, uC, uB);
      };
      if (rec.relieve) {
        // pieza dorada con relieve (igual que los balines: metal que cambia con el color del oro)
        const { gw, gh, h, a } = rec.relieve, prof = 1.7, base = v3.add(f.p, v3.mul(f.r, 1.0));
        const H = (i, j) => h[Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i))];
        const pos = (i, j) => { const u = i / (gw - 1), v = j / (gh - 1); return v3.add(v3.add(v3.add(base, v3.mul(ex, 2 * u - 1)), v3.mul(ey, 1 - 2 * v)), v3.mul(f.r, H(i, j) * prof)); };
        const nor = (i, j) => {
          const du = (H(i + 1, j) - H(i - 1, j)) / 2 * prof / (2 * hAncho / (gw - 1)), dv = (H(i, j + 1) - H(i, j - 1)) / 2 * prof / (2 * hAlto / (gh - 1));
          return v3.norm(v3.add(v3.add(f.r, v3.mul(f.t, -du)), v3.mul(f.u, dv)));
        };
        const uv = (i, j) => [i / (gw - 1), j / (gh - 1)];
        for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
          if (Math.max(a[j * gw + i], a[j * gw + i + 1], a[(j + 1) * gw + i], a[(j + 1) * gw + i + 1]) < .3) continue;
          tri(silueta, pos(i, j), pos(i, j + 1), pos(i + 1, j + 1), nor(i, j), nor(i, j + 1), nor(i + 1, j + 1), uv(i, j), uv(i, j + 1), uv(i + 1, j + 1));
          tri(silueta, pos(i, j), pos(i + 1, j + 1), pos(i + 1, j), nor(i, j), nor(i + 1, j + 1), nor(i + 1, j), uv(i, j), uv(i + 1, j + 1), uv(i + 1, j));
        }
        q(silueta, v3.add(f.p, v3.mul(f.r, .8)), v3.mul(f.r, -1), false);
      } else {
        q(foto, cf, f.r, false);
        q(silueta, cb, v3.mul(f.r, -1), false);
      }
      // amarre en cada punta: argolla dorada en la punta, lazo de hilo enlazado y nudo envolvente
      for (const lado of [-1, 1]) {
        const en = d => v3.add(v3.add(f.p, v3.mul(f.t, lado * (punta + d))), v3.mul(f.r, 1.2));
        toro(oro, en(-.3), f.t, f.u, 1.3, .42, 28, 10);                 // argolla (plano de la joya)
        toro(hilo, en(1.0), f.t, f.r, 1.3, .5, 28, 10);                // lazo de hilo que pasa por la argolla
        const nudo = v3.add(f.p, v3.mul(f.t, lado * (punta + 2.9)));
        for (let k = 0; k < 3; k++) toro(hilo, v3.add(nudo, v3.mul(f.t, lado * (k - 1) * .55)), f.u, f.r, .95, .42, 20, 10); // vueltas del nudo
      }
    }
    else if (it.tipo === "herraje") {
      const c = v3.add(f.p, v3.mul(f.r, 1.6)), rr = 7;
      toro(oro, c, f.t, f.u, rr, .85, 60, 12);
      disco(foto, v3.add(c, v3.mul(f.r, .25)), f.t, f.u, rr - .2, 72, true);
      disco(oro, v3.sub(c, v3.mul(f.r, .25)), f.t, f.u, rr - .2, 72, false);
      // amarre en cada punta: argolla dorada en la punta, lazo de hilo enlazado y nudo envolvente
      for (const lado of [-1, 1]) {
        const en = d => v3.add(v3.add(f.p, v3.mul(f.t, lado * (punta + d))), v3.mul(f.r, 1.2));
        toro(oro, en(-.3), f.t, f.u, 1.3, .42, 28, 10);                 // argolla (plano de la joya)
        toro(hilo, en(1.0), f.t, f.r, 1.3, .5, 28, 10);                // lazo de hilo que pasa por la argolla
        const nudo = v3.add(f.p, v3.mul(f.t, lado * (punta + 2.9)));
        for (let k = 0; k < 3; k++) toro(hilo, v3.add(nudo, v3.mul(f.t, lado * (k - 1) * .55)), f.u, f.r, .95, .42, 20, 10); // vueltas del nudo
      }
    }
  }
  return { oro, hilo, foto, silueta };
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
  } else if(uModo==4){
    if(texture(uTex,vU).a<0.45) discard;
    vec3 Rf=reflect(-V,N);
    c = base*(0.08+0.25*max(dot(N,L1),0.0)) + base*ent(Rf)*0.8;
  } else {
    vec4 tx = texture(uTex,vU);
    if(uModo==5 && tx.a<0.45) discard;
    vec3 t = uTexOk>0.5 ? pow(tx.rgb,vec3(2.2)) : base;
    float d=0.6+0.5*max(dot(N,L1),0.0);
    vec3 Rf=reflect(-V,N);
    c = t*d + vec3(pow(max(dot(Rf,L1),0.0),40.0)*0.35);
  }
  c = c/(1.0+c*0.32);
  o=vec4(pow(c,vec3(1.0/2.2)),1.0);
}`;

/* ---------- quitar el fondo de la foto del herraje ---------- */
const cargarImg = url => new Promise(ok => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
function analizar(img, max = 480) {
  const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h);
  // color del fondo = promedio del borde; qué tan parejo es
  const borde = [];
  for (let x = 0; x < w; x += 2) borde.push((0 * w + x) * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y += 2) borde.push((y * w) * 4, (y * w + w - 1) * 4);
  let m = [0, 0, 0]; for (const i of borde) { m[0] += d.data[i]; m[1] += d.data[i + 1]; m[2] += d.data[i + 2]; } m = m.map(v => v / borde.length);
  let dev = 0; for (const i of borde) dev += Math.hypot(d.data[i] - m[0], d.data[i + 1] - m[1], d.data[i + 2] - m[2]); dev /= borde.length;
  return { cv, cx, d, w, h, fondo: m, dev, claro: (m[0] + m[1] + m[2]) / 3 };
}
function recortarFondo(a) {
  const { d, w, h, fondo } = a, px = d.data, T1 = 34, T2 = 62;
  const dist = i => Math.hypot(px[i] - fondo[0], px[i + 1] - fondo[1], px[i + 2] - fondo[2]);
  const es = new Uint8Array(w * h), cola = [];
  const meter = (x, y) => { const p = y * w + x; if (es[p]) return; if (dist(p * 4) < T2) { es[p] = 1; cola.push(p); } };
  for (let x = 0; x < w; x++) { meter(x, 0); meter(x, h - 1); }
  for (let y = 0; y < h; y++) { meter(0, y); meter(w - 1, y); }
  while (cola.length) { const p = cola.pop(), x = p % w, y = (p / w) | 0; if (x > 0) meter(x - 1, y); if (x < w - 1) meter(x + 1, y); if (y > 0) meter(x, y - 1); if (y < h - 1) meter(x, y + 1); }
  let x0 = w, y0 = h, x1 = 0, y1 = 0, quedan = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (es[p]) { const dd = dist(i); px[i + 3] = dd < T1 ? 0 : Math.round(255 * (dd - T1) / (T2 - T1)); }
    if (px[i + 3] > 128) { quedan++; const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const frac = quedan / (w * h);
  if (frac < .02 || frac > .6 || x1 <= x0 || y1 <= y0) return null;
  // si la joya toca mucho el borde, el fondo no se separó bien
  let toca = 0, nb = 0;
  const chk = p => { nb++; if (px[p * 4 + 3] > 128) toca++; };
  for (let x = 0; x < w; x++) { chk(x); chk((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { chk(y * w); chk(y * w + w - 1); }
  if (toca / nb > .04) return null;
  // que lo recortado sea joya (tenga oro) y no, por ejemplo, la bandeja donde está
  let oro = 0, tot = 0;
  for (let p = 0; p < w * h; p += 2) { const i = p * 4; if (px[i + 3] < 128) continue; tot++;
    const R = px[i], G = px[i + 1], B = px[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx > 70 && (mx - mn) / mx > .26 && R >= G && G > B) oro++; }
  if (!tot || oro / tot < .18) return null;
  // quedarse solo con las piezas grandes (quita restos de bandejas, sombras y polvo)
  {
    const N = w * h, comp = new Int32Array(N).fill(-1), tams = [];
    for (let p0 = 0; p0 < N; p0++) {
      if (px[p0 * 4 + 3] < 128 || comp[p0] >= 0) continue;
      const id = tams.length; let t = 0; const st = [p0]; comp[p0] = id;
      while (st.length) { const p = st.pop(); t++; const x = p % w, y = (p / w) | 0;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && px[q * 4 + 3] >= 128 && comp[q] < 0) { comp[q] = id; st.push(q); } }
      tams.push(t);
    }
    // oro de cada pieza: se usa solo la pieza de oro más grande (una joya por pulsera)
    const oroC = new Array(tams.length).fill(0);
    for (let p = 0; p < N; p++) { const c = comp[p]; if (c < 0) continue; const i = p * 4, R = px[i], G = px[i + 1], B = px[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx > 70 && (mx - mn) / mx > .26 && R >= G && G > B) oroC[c]++; }
    let elegido = -1; tams.forEach((t, c) => { if (oroC[c] / t >= .18 && (elegido < 0 || t > tams[elegido])) elegido = c; });
    if (elegido < 0) return null;
    const vale = tams.map((t, c) => c === elegido);
    x0 = w; y0 = h; x1 = 0; y1 = 0; let oro2 = 0, tot2 = 0;
    for (let p = 0; p < N; p++) {
      const i = p * 4, c = comp[p];
      if (c < 0 || !vale[c]) { px[i + 3] = 0; continue; }
      const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      tot2++; const R = px[i], G = px[i + 1], B = px[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx > 70 && (mx - mn) / mx > .26 && R >= G && G > B) oro2++;
    }
    if (!tot2 || oro2 / tot2 < .18 || x1 <= x0) return null;
  }
  a.cx.putImageData(d, 0, 0);
  const pad = 4; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = document.createElement("canvas"); out.width = cw; out.height = ch;
  out.getContext("2d").drawImage(a.cv, x0, y0, cw, ch, 0, 0, cw, ch);
  return { canvas: out, recorte: { aspecto: cw / ch } };
}
// Segundo método: encuentra el oro por su color, rellena las piedras encerradas y se queda con la pieza más grande
function recortarOro(a) {
  const { d, w, h } = a, px = d.data, N = w * h;
  let m = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * 4, R = px[i] / 255, G = px[i + 1] / 255, B = px[i + 2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), dl = mx - mn;
    if (mx < .3 || dl / mx < .26) continue;
    let hh = mx === R ? ((G - B) / dl) % 6 : mx === G ? (B - R) / dl + 2 : (R - G) / dl + 4; hh *= 60; if (hh < 0) hh += 360;
    if (hh >= 16 && hh <= 58) m[p] = 1;
  }
  const dilatar = (src, r) => { const o = new Uint8Array(N); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!src[y * w + x]) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) o[Y * w + X] = 1; } } return o; };
  const erosionar = (src, r) => { const inv = src.map(v => 1 - v), di = dilatar(inv, r); return di.map(v => 1 - v); };
  m = erosionar(dilatar(m, 3), 2);
  // rellenar huecos (piedras rodeadas de oro)
  const fuera = new Uint8Array(N), cola = [];
  const meter = p => { if (!fuera[p] && !m[p]) { fuera[p] = 1; cola.push(p); } };
  for (let x = 0; x < w; x++) { meter(x); meter((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { meter(y * w); meter(y * w + w - 1); }
  while (cola.length) { const p = cola.pop(), x = p % w, y = (p / w) | 0; if (x > 0) meter(p - 1); if (x < w - 1) meter(p + 1); if (y > 0) meter(p - w); if (y < h - 1) meter(p + w); }
  for (let p = 0; p < N; p++) if (!fuera[p]) m[p] = 1;
  // pieza más grande
  const comp = new Int32Array(N).fill(-1); let mejor = -1, tamMejor = 0, id = 0;
  for (let p0 = 0; p0 < N; p0++) {
    if (!m[p0] || comp[p0] >= 0) continue;
    let t = 0; const st = [p0]; comp[p0] = id;
    while (st.length) { const p = st.pop(); t++; const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && m[q] && comp[q] < 0) { comp[q] = id; st.push(q); } }
    if (t > tamMejor) { tamMejor = t; mejor = id; } id++;
  }
  if (mejor < 0) return null;
  const frac = tamMejor / N;
  if (frac < .015 || frac > .45) return null;
  let x0 = w, y0 = h, x1 = 0, y1 = 0, toca = 0;
  for (let p = 0; p < N; p++) {
    const dentro = comp[p] === mejor; px[p * 4 + 3] = dentro ? 255 : 0;
    if (dentro) { const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) toca++; }
  }
  if (toca > 4) return null;
  a.cx.putImageData(d, 0, 0);
  const pad = 3; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = document.createElement("canvas"); out.width = cw; out.height = ch;
  const oc = out.getContext("2d"); oc.drawImage(a.cv, x0, y0, cw, ch, 0, 0, cw, ch);
  return { canvas: out, recorte: { aspecto: cw / ch } };
}

// Convierte el recorte en un mapa de relieve: la silueta da la forma y el brillo de la foto da el grabado
function relieve(cv) {
  const gw = 200, gh = Math.max(24, Math.min(300, Math.round(gw * cv.height / cv.width)));
  const t = document.createElement("canvas"); t.width = gw; t.height = gh;
  const cx = t.getContext("2d", { willReadFrequently: true }); cx.drawImage(cv, 0, 0, gw, gh);
  const d = cx.getImageData(0, 0, gw, gh).data, N = gw * gh;
  const a = new Float32Array(N), l = new Float32Array(N);
  let mn = 1, mx = 0;
  for (let p = 0; p < N; p++) { a[p] = d[p * 4 + 3] / 255; if (a[p] > .5) { l[p] = (d[p * 4] * .3 + d[p * 4 + 1] * .55 + d[p * 4 + 2] * .15) / 255; mn = Math.min(mn, l[p]); mx = Math.max(mx, l[p]); } }
  const borrar = (src, veces) => { let x = src; for (let k = 0; k < veces; k++) { const o = new Float32Array(N); for (let y = 0; y < gh; y++) for (let X = 0; X < gw; X++) { let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = X + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) { s += x[yy * gw + xx]; c++; } } o[y * gw + X] = s / c; } x = o; } return x; };
  const bisel = borrar(a, 3), lum = borrar(l.map((v, p) => a[p] > .5 ? (v - mn) / Math.max(.05, mx - mn) : 0), 1);
  const h = new Float32Array(N);
  for (let p = 0; p < N; p++) h[p] = Math.min(1, bisel[p] * 1.25) * (.45 + .55 * lum[p]);
  return { gw, gh, h, a };
}
const conRelieve = r => { if (r?.recorte) r.recorte.relieve = relieve(r.canvas); return r; };
const CACHE_HERRAJES = new Map();
export function prepararHerraje(fotos) {
  const clave = (fotos || []).join("|");
  if (!CACHE_HERRAJES.has(clave)) CACHE_HERRAJES.set(clave, procesarHerraje(fotos).then(conRelieve));
  return CACHE_HERRAJES.get(clave);
}
async function procesarHerraje(fotos) {
  const imgs = (await Promise.all(fotos.slice(0, 4).map(cargarImg))).filter(Boolean);
  if (!imgs.length) return null;
  // se prueba primero la foto con el fondo más parejo
  const an = imgs.map(i => analizar(i, 640)).sort((x, y) => x.dev - y.dev);
  for (const a of an) {
    if (a.dev > 26 || a.claro < 150) continue;   // solo fotos con fondo claro y parejo
    const r = recortarFondo(a);
    if (r) return r;
  }
  for (const i of imgs) { const r = recortarOro(analizar(i, 640)); if (r) return r; }
  // si no se pudo separar la joya: medallón con la foto
  const img = imgs[0], cv = document.createElement("canvas"); cv.width = cv.height = 512; const cx = cv.getContext("2d");
  const k = Math.max(512 / img.width, 512 / img.height) * 1.12, w = img.width * k, h = img.height * k;
  cx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
  return { canvas: cv, recorte: null };
}

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
  const subirTex = cv => {
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const cargarFoto = (fotos, alListo) => {
    const clave = (fotos || []).join("|");
    if (clave === texUrl) return; texUrl = clave; texOk = false;
    if (!fotos?.length) return;
    const usar = res => {
      if (texUrl !== clave) return;
      subirTex(res.canvas); texOk = true; alListo(res.recorte); pedir();
    };
    prepararHerraje(fotos).then(res => { if (res) usar(res); });
  };

  let g = {}, colores = { oro: [1, .78, .34], hilo: [.1, .1, .1] }, ultimo = null, recorteActual = null;
  let yaw = -.35, pitch = .42, dist = 118, auto = true, pend = true;
  const pedir = () => { pend = true; };

  function armar() {
    const cfg = ultimo; if (!cfg) return;
    const h = cfg.herraje ? { ...cfg.herraje, recorte: texOk ? recorteActual : null } : null;
    const m = construirPulsera({ ...cfg, herraje: h });
    for (const k of ["oro", "hilo", "foto", "silueta"]) { borrar(g[k]); g[k] = subir(m[k]); }
    pedir();
  }
  function actualizar(cfg) {
    ultimo = cfg;
    colores = { oro: cfg.colorOro, hilo: cfg.colorHilo };
    const clave = (cfg.herraje?.fotos || []).join("|");
    if (clave !== texUrl) { texOk = false; recorteActual = null; }
    cargarFoto(cfg.herraje?.fotos, rec => { recorteActual = rec; armar(); });
    armar();
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
    pinta(g.foto, recorteActual ? 5 : 2, colores.oro);
    pinta(g.silueta, 4, colores.oro);
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

import { useEffect, useRef, useState } from 'react';
import { BUSTE } from './buste3d.donnees';
import {
  COULEUR_COTATION,
  LIBELLES_COTATION,
  type CarteDesZones,
  type Cotation,
  type ZoneSignature,
} from '../../domain/profilSignature';

/*
  Le buste, en trois dimensions, pour l'observation du Profil Signature.

  Il n'est pas là pour faire joli : c'est l'écran qu'on tourne vers la
  cliente pendant qu'on cote ses zones, et une zone qui s'allume sur un
  visage dit en une seconde ce qu'une liste met une phrase à expliquer.
  Le buste tourne tout seul, se laisse faire tourner à la souris, et la
  zone qu'on regarde vient se présenter d'elle-même.

  DEUX PRÉCAUTIONS, parce qu'il s'agit d'un ordinateur de comptoir.

    — LA BIBLIOTHÈQUE 3D SE CHARGE ICI ET NULLE PART AILLEURS. Elle pèse
      dix fois le reste de cet écran ; en import dynamique, elle ne part
      du serveur que le jour où quelqu'un ouvre cette page. L'accueil, les
      fiches et les deux autres bilans n'en portent rien.

    — SI LA MACHINE NE SAIT PAS FAIRE DE 3D — carte graphique ancienne,
      accélération coupée dans le navigateur —, on ne laisse pas un carré
      vide devant une cliente : `onIndisponible` prévient l'écran, qui
      revient à la liste des zones. Personne ne reste bloqué.

  La géométrie vient de `buste3d.donnees.ts` ; les angles sous lesquels
  chaque zone se présente sont ici, parce que c'est de la mise en scène et
  non du métier — le questionnaire en base ne connaît pas les caméras.
*/

/** Où se trouve chaque zone sur le buste, et sous quel angle elle se regarde. */
interface MiseEnScene {
  /** De quel côté l'étiquette se pose. */
  cote: 'gauche' | 'droite';
  /** L'orientation du buste quand on demande cette zone. */
  yaw: number;
  pitch: number;
  /** Le point d'ancrage de l'étiquette, et la normale qui dit s'il est visible. */
  ancre: [number, number, number];
  normale: [number, number, number];
}

const SCENE: Record<string, MiseEnScene> = {
  ovale: { cote: 'droite', yaw: -0.5, pitch: 0.08, ancre: [5.3, -6.6, 0.9], normale: [0.7, -0.3, 0.6] },
  cou: { cote: 'gauche', yaw: 0.25, pitch: 0.12, ancre: [-1.6, -12.0, 1.2], normale: [-0.35, 0, 0.94] },
  grain: { cote: 'droite', yaw: -0.4, pitch: 0, ancre: [4.5, -0.9, 3.7], normale: [0.55, 0, 0.83] },
  yeux: { cote: 'gauche', yaw: 0.55, pitch: 0, ancre: [-5.8, 2.4, 2.2], normale: [-0.8, 0, 0.6] },
  front: { cote: 'gauche', yaw: 0, pitch: -0.05, ancre: [-1.5, 6.6, 4.9], normale: [-0.2, 0.2, 0.96] },
  sillons: { cote: 'gauche', yaw: 0.3, pitch: 0, ancre: [-3.3, -3.0, 4.25], normale: [-0.4, 0, 0.92] },
  decollete: { cote: 'droite', yaw: -0.1, pitch: 0.18, ancre: [1.8, -19.4, 4.5], normale: [0.1, 0.2, 0.97] },
};

/*
  CE QUI S'ALLUME SUR LE VISAGE, C'EST L'INTENSITÉ — pas la portée.

  Les deux informations ont chacune leur place : la portée se lit sur la
  pastille de la liste et sur le bord de l'étiquette (violet, bleu, gris),
  parce qu'elle ne change jamais pour une zone donnée. Ce qu'on cote, ce
  qu'on corrige et ce qu'on montre à la cliente, c'est la SÉVÉRITÉ : le
  visage se lit alors comme une carte, du vert au brique, et la zone la
  plus marquée saute aux yeux sans qu'on ait à lire un mot.

  Le visage lui-même étant violet pâle, une zone violette s'y perdait.
*/
const versRvb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

export default function Buste3D({
  zones,
  carte,
  focus,
  onFocus,
  onIndisponible,
}: {
  zones: ZoneSignature[];
  carte: CarteDesZones;
  /** Le code de la zone regardée, ou null. */
  focus: string | null;
  onFocus: (code: string | null) => void;
  onIndisponible: () => void;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const etiquettes = useRef<Record<string, HTMLButtonElement | null>>({});
  /** Ce que la boucle d'animation doit savoir, sans se faire reconstruire. */
  const vivant = useRef({ carte, focus, zones });
  const [pret, setPret] = useState(false);

  vivant.current = { carte, focus, zones };

  useEffect(() => {
    const cv = toile.current;
    if (!cv) return;

    let arrete = false;
    let nettoyer: (() => void) | undefined;

    (async () => {
      const THREE = await import('three');
      if (arrete) return;

      let rendu: import('three').WebGLRenderer;
      try {
        rendu = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      } catch {
        onIndisponible();
        return;
      }

      const doux = matchMedia('(prefers-reduced-motion: reduce)').matches;
      rendu.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
      cam.position.set(0, -0.55, 10.2);
      cam.lookAt(0, -0.62, 0);

      const groupe = new THREE.Group();
      scene.add(groupe);
      const pivot = new THREE.Group();
      pivot.position.set(0, -0.6, 0);
      groupe.add(pivot);
      const interne = new THREE.Group();
      interne.position.set(0, 0.6, 0);
      interne.scale.setScalar(0.1);
      pivot.add(interne);

      /** Décode un tableau d'entiers rangé en base64. */
      const dec = <T,>(b: string, T2: new (b: ArrayBuffer) => T): T => {
        const s = atob(b);
        const u = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        return new T2(u.buffer);
      };

      const B = BUSTE;
      const S = B.scale;
      const SH = B.sh;
      const V3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);

      /* Sept couleurs et sept intensités : les uniformes que la cotation fait bouger. */
      const zc = Array.from({ length: 7 }, () => new THREE.Vector3());
      const zs = new Array(7).fill(0);
      const U: Record<string, { value: unknown }> = {
        uTime: { value: 0 },
        uReveal: { value: doux ? 1 : 0 },
        uFocus: { value: -1 },
        uZC: { value: zc },
        uZS: { value: zs },
        uDark: { value: 0 },
        uSkC: { value: V3(SH.skC) },
        uSkR: { value: V3(SH.skR) },
        uNA: { value: V3(SH.nA) },
        uNB: { value: V3(SH.nB) },
        uNR: { value: SH.nR },
        uY0: { value: SH.y0 },
        uHB: { value: SH.hb },
      };

      const GVS = `attribute float aZone,aZw;varying vec3 vN,vV,vP;varying float vZone,vZw;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=-mv.xyz;vP=position;vZone=aZone;vZw=aZw;gl_Position=projectionMatrix*mv;}`;

      const GFS = `precision highp float;
uniform float uTime,uReveal,uFocus,uDark,uPart,uNR;uniform vec3 uZC[7];uniform float uZS[7];
uniform vec3 uSkC,uSkR,uNA,uNB;uniform float uY0,uHB;
varying vec3 vN,vV,vP;varying float vZone,vZw;
float ell(vec3 p,vec3 c,vec3 r){vec3 q=(p-c)/r;return dot(q,q);}
vec3 bellWD(float y){float t=clamp((uY0-y)/uHB,0.0,1.0);float e=1.0-pow(1.0-t,2.4);return vec3(4.1+13.9*e,4.1+3.8*e,-2.5-0.3*t);}
float inBell(vec3 p){if(p.y>uY0)return 2.0;vec3 w=bellWD(p.y);return (p.x*p.x)/(w.x*w.x)+((p.z-w.z)*(p.z-w.z))/(w.y*w.y);}
float inNeck(vec3 p){vec3 ab=uNB-uNA;float h=clamp(dot(p-uNA,ab)/dot(ab,ab),0.0,1.0);return length(p-uNA-ab*h)-uNR;}
void main(){
  vec3 p=vP;float keep=1.0;
  if(uPart>0.5&&uPart<1.1){float f1=smoothstep(-0.4,-2.6,p.z);float f2=smoothstep(7.2,8.8,p.y)*smoothstep(5.4,3.6,p.z);keep=max(f1,f2)*smoothstep(-6.0,-4.2,p.y);}
  else if(uPart>1.5&&uPart<2.5){float lim=-5.0-3.9*clamp((p.z+3.0)/5.0,0.0,1.0);keep=smoothstep(lim+1.0,lim-0.8,p.y);
    if(inBell(p)<0.985)discard;keep*=smoothstep(-15.0,-12.8,p.y);}
  else if(uPart>2.5){keep=smoothstep(-25.8+0.012*p.x*p.x,-24.8+0.012*p.x*p.x,p.y)*smoothstep(-13.4,-14.6,p.y);
    if(inNeck(p)<-0.05)discard;}
  vec3 N=normalize(vN),V=normalize(vV);
  if(!gl_FrontFacing)N=-N;
  float fr=pow(1.0-max(dot(N,V),0.0),1.7);
  vec3 L=normalize(vec3(0.45,0.55,0.75));float lam=max(dot(N,L),0.0);
  vec3 blue=vec3(0.56,0.72,0.95),lil=vec3(0.74,0.68,0.95),rose=vec3(0.97,0.66,0.80);
  vec3 col=mix(lil,blue,smoothstep(2.0,10.0,p.y));col=mix(col,rose,smoothstep(-6.0,-15.0,p.y));
  col=col*(0.80+0.30*lam)+pow(max(dot(N,normalize(L+V)),0.0),36.0)*0.30;
  float a=(0.12+0.62*fr);
  if(uPart<0.5) a=0.16+0.55*fr;
  if(uPart>0.5&&uPart<1.5) a=0.035+0.30*fr;
  float glow=0.0;vec3 zc=vec3(0.0);
  float zid=vZone,zw=vZw;
  if(uPart>1.5&&uPart<2.5){zid=1.0;zw=smoothstep(-0.4,0.7,(p.z-(uNA.z+(uNB.z-uNA.z)*clamp((p.y-uNA.y)/(uNB.y-uNA.y),0.0,1.0)))/uNR)*smoothstep(-9.4,-11.2,p.y)*smoothstep(-15.5,-12.5,p.y);}
  if(uPart>2.5){zid=6.0;float d=sqrt(ell(p,vec3(0.0,-19.5,4.6),vec3(8.5,3.2,5.0)));zw=clamp((1.0-d)/0.5,0.0,1.0);}
  for(int i=0;i<7;i++){ if(abs(zid-float(i))<0.5){ float f=(uFocus<-0.5||abs(uFocus-float(i))<0.5)?1.0:0.22; glow=uZS[i]*zw*f; zc=uZC[i]; } }
  glow*=0.85+0.15*sin(uTime*2.3);
  col=mix(col,zc,clamp(glow*1.45,0.0,1.0));
  col+=zc*glow*0.18;
  a+=glow*0.72;
  a*=keep*smoothstep(0.35,1.0,uReveal);
  if(a<0.004)discard;
  gl_FragColor=vec4(col,a);
}`;

      const verre = (part: number) =>
        new THREE.ShaderMaterial({
          uniforms: Object.assign({}, U, { uPart: { value: part } }),
          vertexShader: GVS,
          fragmentShader: GFS,
          transparent: true,
          depthWrite: false,
          side: THREE.FrontSide,
        });

      const marquerZones = (
        geo: import('three').BufferGeometry,
        z?: Float32Array,
        w?: Float32Array,
      ) => {
        const c = geo.attributes.position.count;
        geo.setAttribute('aZone', new THREE.BufferAttribute(z ?? new Float32Array(c).fill(7), 1));
        geo.setAttribute('aZw', new THREE.BufferAttribute(w ?? new Float32Array(c), 1));
        return geo;
      };

      const ellipsoide = (c: number[], r: number[], ws: number, hs: number) => {
        const s = new THREE.SphereGeometry(1, ws, hs);
        s.scale(r[0], r[1], r[2]);
        s.translate(c[0], c[1], c[2]);
        return marquerZones(s);
      };

      // Le visage
      const fvI = dec(B.fv, Int16Array);
      const fnI = dec(B.fn, Int8Array);
      const triI = dec(B.tri, Uint16Array);
      const vz = dec(B.vz, Uint8Array);
      const vw = dec(B.vw, Uint8Array);
      const nv = fvI.length / 3;
      const fp = new Float32Array(nv * 3);
      const fnn = new Float32Array(nv * 3);
      const fz = new Float32Array(nv);
      const fw = new Float32Array(nv);
      for (let i = 0; i < nv; i++) {
        for (let k = 0; k < 3; k++) {
          fp[i * 3 + k] = fvI[i * 3 + k] / S;
          fnn[i * 3 + k] = fnI[i * 3 + k] / 127;
        }
        fz[i] = vz[i];
        fw[i] = vw[i] / 255;
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
      fg.setAttribute('normal', new THREE.BufferAttribute(fnn, 3));
      fg.setIndex(new THREE.BufferAttribute(new Uint16Array(triI), 1));
      marquerZones(fg, fz, fw);

      const crane = new THREE.Mesh(ellipsoide(SH.skC, SH.skR, 72, 54), verre(1));
      crane.renderOrder = 0;

      // Les épaules, en cloche
      const cloche = () => {
        const R = 64;
        const C = 144;
        const pos: number[] = [];
        const idx: number[] = [];
        for (let i = 0; i <= R; i++) {
          const tt = i / R;
          const y = SH.y0 - SH.hb * tt;
          const e = 1 - Math.pow(1 - tt, 2.4);
          const W = 4.1 + 13.9 * e;
          const D = 4.1 + 3.8 * e;
          const zo = -2.5 - 0.3 * tt;
          for (let j = 0; j <= C; j++) {
            const th = -Math.PI / 2 + (j / C) * Math.PI * 2;
            pos.push(W * Math.cos(th), y, zo + D * Math.sin(th));
          }
        }
        for (let i = 0; i < R; i++)
          for (let j = 0; j < C; j++) {
            const a = i * (C + 1) + j;
            const b = a + C + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
          }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return marquerZones(g);
      };
      const epaules = new THREE.Mesh(cloche(), verre(3));
      epaules.renderOrder = 1;

      // Le cou
      const nA = V3(SH.nA);
      const nB = V3(SH.nB);
      const ng = new THREE.CylinderGeometry(SH.nR, SH.nR, nA.distanceTo(nB), 72, 24, true);
      ng.applyMatrix4(
        new THREE.Matrix4().makeRotationFromQuaternion(
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            nA.clone().sub(nB).normalize(),
          ),
        ),
      );
      const milieu = nA.clone().add(nB).multiplyScalar(0.5);
      ng.translate(milieu.x, milieu.y, milieu.z);
      marquerZones(ng);
      const cou = new THREE.Mesh(ng, verre(2));
      cou.renderOrder = 2;

      const visage = new THREE.Mesh(fg, verre(0));
      visage.renderOrder = 3;
      interne.add(crane, epaules, cou, visage);

      // Le filaire du visage
      const ed = dec(B.edges, Uint16Array);
      const lp = new Float32Array(B.ne * 6);
      const ln = new Float32Array(B.ne * 6);
      for (let i = 0; i < B.ne; i++) {
        for (let j = 0; j < 2; j++) {
          const v = ed[i * 2 + j];
          for (let k = 0; k < 3; k++) {
            lp[i * 6 + j * 3 + k] = fvI[v * 3 + k] / S;
            ln[i * 6 + j * 3 + k] = fnI[v * 3 + k] / 127;
          }
        }
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
      lg.setAttribute('normal', new THREE.BufferAttribute(ln, 3));

      const LVS = `uniform float uReveal;varying float vA;varying float vY;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vec3 nn=normalize(normalMatrix*normal);float f=dot(nn,normalize(-mv.xyz));vA=smoothstep(-0.1,0.7,f)*smoothstep(0.45,1.0,uReveal);vY=position.y;gl_Position=projectionMatrix*mv;}`;
      const LFS = `precision mediump float;uniform float uDark;varying float vA;varying float vY;void main(){vec3 c=mix(vec3(0.58,0.55,0.86),vec3(0.46,0.64,0.92),smoothstep(-4.0,6.0,vY));gl_FragColor=vec4(c,vA*mix(0.30,0.36,uDark));}`;
      const filaire = new THREE.LineSegments(
        lg,
        new THREE.ShaderMaterial({ uniforms: U, vertexShader: LVS, fragmentShader: LFS, transparent: true, depthWrite: false }),
      );
      filaire.renderOrder = 4;
      interne.add(filaire);

      // Les cheveux, tirés en chignon
      const skC = V3(SH.skC);
      const skR = V3(SH.skR);
      const bunC = new THREE.Vector3(0, -1.2, -13.9);
      const bunR = new THREE.Vector3(4.1, 3.7, 3.1);
      const HL = B.hair;
      const hp: number[] = [];
      const hn: number[] = [];
      const versDirection = (v: import('three').Vector3) =>
        new THREE.Vector3((v.x - skC.x) / skR.x, (v.y - skC.y) / skR.y, (v.z - skC.z) / skR.z).normalize();
      const dFin = versDirection(new THREE.Vector3(0, -1.0, -13.0));
      const surEllipsoide = (d: import('three').Vector3, k: number) =>
        new THREE.Vector3(skC.x + d.x * skR.x * k, skC.y + d.y * skR.y * k, skC.z + d.z * skR.z * k);
      const slerp = (a: import('three').Vector3, b: import('three').Vector3, t: number) => {
        const o = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
        if (o < 1e-4) return a.clone();
        const s = Math.sin(o);
        return a
          .clone()
          .multiplyScalar(Math.sin((1 - t) * o) / s)
          .add(b.clone().multiplyScalar(Math.sin(t * o) / s))
          .normalize();
      };
      for (let i = 0; i < HL.length / 3; i++) {
        const depart = new THREE.Vector3(HL[i * 3], HL[i * 3 + 1], HL[i * 3 + 2]);
        const dS = versDirection(depart);
        const seg = 46;
        let prec: import('three').Vector3 | null = null;
        let precN: import('three').Vector3 | null = null;
        for (let j = 0; j <= seg; j++) {
          const tt = j / seg;
          const d = slerp(dS, dFin, tt);
          const k = 1.0 + 0.055 * Math.sin(Math.PI * Math.min(1, tt * 1.15)) + 0.012 * Math.sin(tt * 9 + i * 0.7);
          const p = surEllipsoide(d, k);
          if (prec && precN) {
            hp.push(prec.x, prec.y, prec.z, p.x, p.y, p.z);
            hn.push(precN.x, precN.y, precN.z, d.x, d.y, d.z);
          }
          prec = p;
          precN = d;
        }
      }
      for (let r = 0; r < 7; r++) {
        const f = 0.35 + 0.1 * r;
        const seg = 64;
        let prec: import('three').Vector3 | null = null;
        let precN: import('three').Vector3 | null = null;
        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * Math.PI * 2 + r * 0.6;
          const d = new THREE.Vector3(
            Math.cos(a) * Math.sqrt(1 - f * f),
            Math.sin(a) * Math.sqrt(1 - f * f),
            -f,
          ).normalize();
          const p = new THREE.Vector3(
            bunC.x + d.x * bunR.x * 1.01,
            bunC.y + d.y * bunR.y * 1.01,
            bunC.z + d.z * bunR.z * 1.01,
          );
          if (prec && precN) {
            hp.push(prec.x, prec.y, prec.z, p.x, p.y, p.z);
            hn.push(precN.x, precN.y, precN.z, d.x, d.y, d.z);
          }
          prec = p;
          precN = d;
        }
      }
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
      hg.setAttribute('normal', new THREE.Float32BufferAttribute(hn, 3));
      const HFS = `precision mediump float;uniform float uDark;varying float vA;varying float vY;void main(){vec3 c=mix(vec3(0.66,0.62,0.92),vec3(0.50,0.68,0.95),smoothstep(-2.0,10.0,vY));gl_FragColor=vec4(c,vA*mix(0.42,0.5,uDark));}`;
      const cheveux = new THREE.LineSegments(
        hg,
        new THREE.ShaderMaterial({ uniforms: U, vertexShader: LVS, fragmentShader: HFS, transparent: true, depthWrite: false }),
      );
      cheveux.renderOrder = 4;
      interne.add(cheveux);
      const chignon = new THREE.Mesh(
        ellipsoide([bunC.x, bunC.y, bunC.z], [bunR.x, bunR.y, bunR.z], 48, 32),
        verre(1.2),
      );
      chignon.renderOrder = 0;
      interne.add(chignon);

      // ---------------------------------------------------------------------
      // Mouvement
      // ---------------------------------------------------------------------

      let yaw = 0;
      let pitch = 0.04;
      let cibleYaw = 0;
      let ciblePitch = 0.04;
      let saisie: { x: number; y: number; yaw: number; pitch: number } | null = null;
      let dernierGeste = -1e9;
      const t0 = performance.now();

      const auDepart = (e: PointerEvent) => {
        saisie = { x: e.clientX, y: e.clientY, yaw, pitch };
        cv.setPointerCapture(e.pointerId);
      };
      const enMouvement = (e: PointerEvent) => {
        if (!saisie) return;
        yaw = Math.max(-1.6, Math.min(1.6, saisie.yaw + (e.clientX - saisie.x) * 0.008));
        pitch = Math.max(-0.35, Math.min(0.4, saisie.pitch + (e.clientY - saisie.y) * 0.004));
        cibleYaw = yaw;
        ciblePitch = pitch;
        dernierGeste = performance.now();
      };
      const aLaFin = () => {
        saisie = null;
        dernierGeste = performance.now();
      };
      cv.addEventListener('pointerdown', auDepart);
      cv.addEventListener('pointermove', enMouvement);
      cv.addEventListener('pointerup', aLaFin);
      cv.addEventListener('pointercancel', aLaFin);

      const redimensionner = () => {
        const r = cv.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        rendu.setSize(r.width, r.height, false);
        cam.aspect = r.width / r.height;
        cam.fov = r.width / r.height < 0.75 ? 29 : 26;
        cam.updateProjectionMatrix();
      };
      const observateur = new ResizeObserver(redimensionner);
      observateur.observe(cv);
      redimensionner();

      const v3 = new THREE.Vector3();
      const n3 = new THREE.Vector3();
      /** Où se projette l'ancre d'une zone à l'écran, et si elle est tournée vers nous. */
      const projeter = (code: string) => {
        const s = SCENE[code];
        v3.set(s.ancre[0], s.ancre[1], s.ancre[2]);
        interne.localToWorld(v3);
        n3.set(s.normale[0], s.normale[1], s.normale[2]).normalize().applyQuaternion(pivot.quaternion);
        const versCam = cam.position.clone().sub(v3).normalize();
        const face = n3.dot(versCam);
        v3.project(cam);
        const r = cv.getBoundingClientRect();
        return { x: (v3.x * 0.5 + 0.5) * r.width, y: (-v3.y * 0.5 + 0.5) * r.height, face, W: r.width, H: r.height };
      };

      let image = 0;
      const dessiner = (maintenant: number) => {
        if (arrete) return;
        const { carte: c, focus: f, zones: zs2 } = vivant.current;
        const t = (maintenant - t0) / 1000;
        U.uTime.value = doux ? 0 : t;
        if (!doux) U.uReveal.value = Math.min(1, t / 2.2);

        /*
          La cotation en cours. Une zone discrète s'allume déjà franchement :
          ce qu'on veut voir, c'est QUELLES zones sont cotées, et l'échelle
          des couleurs dit ensuite à quel point.
        */
        zs2.forEach((z, i) => {
          if (i > 6) return;
          const cotation = (c[z.code] ?? 0) as Cotation;
          const col = versRvb(COULEUR_COTATION[cotation].fond);
          zc[i].set(col[0], col[1], col[2]);
          zs[i] = cotation === 0 ? 0 : 0.55 + 0.15 * cotation;
        });
        U.uFocus.value = f ? zs2.findIndex((z) => z.code === f) : -1;

        if (!saisie) {
          const inactif = maintenant - dernierGeste > 2500;
          const vise = f ? SCENE[f] : null;
          if (vise) {
            cibleYaw = vise.yaw;
            ciblePitch = vise.pitch;
          } else if (inactif && !doux) {
            cibleYaw = 0.34 * Math.sin(t * 0.22);
            ciblePitch = 0.04 + 0.025 * Math.sin(t * 0.17);
          }
          const k = doux ? 1 : 0.06;
          yaw += (cibleYaw - yaw) * k;
          pitch += (ciblePitch - pitch) * k;
        }

        pivot.rotation.set(pitch, yaw, 0);
        rendu.render(scene, cam);
        placerLesEtiquettes(t);
        image = requestAnimationFrame(dessiner);
      };

      /**
       * Les étiquettes se rangent le long des bords, sans se chevaucher, et
       * un trait courbe les relie au point qu'elles nomment. Une zone non
       * cotée ne s'affiche pas : l'écran ne montre que ce qui a été vu.
       */
      const placerLesEtiquettes = (t: number) => {
        const s = svg.current;
        const cadreEl = cadre.current;
        if (!s || !cadreEl) return;
        const { carte: c, focus: f, zones: zs2 } = vivant.current;
        const r = cv.getBoundingClientRect();
        if (r.width === 0) return;
        s.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
        /* Sous cette largeur, les étiquettes mangeraient le visage : on les range. */
        const etroit = r.width < 380;

        for (const cote of ['gauche', 'droite'] as const) {
          const visibles = zs2
            .filter((z) => SCENE[z.code]?.cote === cote && (c[z.code] ?? 0) > 0)
            .map((z) => ({ z, p: projeter(z.code) }))
            .sort((a, b) => a.p.y - b.p.y);

          const haut = 34;
          const bas = r.height - 34;
          const ecart = 42;
          const ys = visibles.map((v) => Math.max(haut, Math.min(bas, v.p.y)));
          for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + ecart);
          for (let k = ys.length - 1; k >= 0; k--) {
            if (ys[k] > bas - (ys.length - 1 - k) * ecart) ys[k] = bas - (ys.length - 1 - k) * ecart;
            if (k < ys.length - 1 && ys[k] > ys[k + 1] - ecart) ys[k] = ys[k + 1] - ecart;
          }

          visibles.forEach((v, k) => {
            const bouton = etiquettes.current[v.z.code];
            const trait = s.querySelector<SVGPathElement>(`#trait-${v.z.code}`);
            const point = s.querySelector<SVGCircleElement>(`#point-${v.z.code}`);
            if (!bouton || !trait || !point) return;

            bouton.hidden = etroit;
            const y = ys[k];
            const largeur = bouton.offsetWidth;
            const x0 = cote === 'gauche' ? 8 : r.width - 8 - largeur;
            bouton.style.transform = `translate(${x0}px, ${y - bouton.offsetHeight / 2}px)`;

            const vu = Math.max(0, Math.min(1, (v.p.face - 0.05) / 0.25));
            const attenue = f !== null && f !== v.z.code;
            const sx = cote === 'gauche' ? 8 + largeur : r.width - 8 - largeur;
            const dx = v.p.x - sx;
            trait.setAttribute(
              'd',
              `M${sx},${y} C${sx + dx * 0.55},${y} ${v.p.x - dx * 0.25},${v.p.y} ${v.p.x},${v.p.y}`,
            );
            trait.style.opacity = String((0.25 + 0.6 * vu) * (attenue ? 0.35 : 1) * (etroit ? 0 : 1));
            point.setAttribute('cx', String(v.p.x));
            point.setAttribute('cy', String(v.p.y));
            point.setAttribute('r', String(f === v.z.code ? 5.5 + 1.5 * Math.sin(t * 3) : 4.5));
            point.style.opacity = String(vu * (attenue ? 0.4 : 1));
            bouton.style.opacity = attenue ? '0.55' : '1';
          });

          /* Les zones non cotées : rien à montrer. */
          zs2
            .filter((z) => SCENE[z.code]?.cote === cote && (c[z.code] ?? 0) === 0)
            .forEach((z) => {
              const bouton = etiquettes.current[z.code];
              const trait = s.querySelector<SVGPathElement>(`#trait-${z.code}`);
              const point = s.querySelector<SVGCircleElement>(`#point-${z.code}`);
              if (bouton) bouton.hidden = true;
              if (trait) trait.style.opacity = '0';
              if (point) point.style.opacity = '0';
            });
        }
      };

      setPret(true);
      image = requestAnimationFrame(dessiner);

      nettoyer = () => {
        cancelAnimationFrame(image);
        observateur.disconnect();
        cv.removeEventListener('pointerdown', auDepart);
        cv.removeEventListener('pointermove', enMouvement);
        cv.removeEventListener('pointerup', aLaFin);
        cv.removeEventListener('pointercancel', aLaFin);
        rendu.dispose();
      };
    })().catch(() => onIndisponible());

    return () => {
      arrete = true;
      nettoyer?.();
    };
    // La scène se construit une fois ; la cotation passe par `vivant`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={cadre}
      className="relative h-full min-h-[340px] w-full overflow-hidden rounded-2xl border border-ardoise-200 bg-gradient-to-b from-white to-marine-50"
    >
      <canvas ref={toile} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />

      <svg ref={svg} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {zones.map((z) => (
          <g key={z.code}>
            <path
              id={`trait-${z.code}`}
              fill="none"
              strokeWidth="1.3"
              stroke={COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].fond}
              style={{ opacity: 0 }}
            />
            <circle
              id={`point-${z.code}`}
              r="4.5"
              strokeWidth="2"
              stroke={COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].fond}
              fill="#fff"
              style={{ opacity: 0 }}
            />
          </g>
        ))}
      </svg>

      {zones.map((z) => (
        <button
          key={z.code}
          ref={(el) => {
            etiquettes.current[z.code] = el;
          }}
          type="button"
          hidden
          onClick={() => onFocus(focus === z.code ? null : z.code)}
          style={{ borderColor: COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].fond }}
          className="absolute left-0 top-0 max-w-[46%] rounded-xl border-[1.5px] bg-white/95 px-2 py-1 text-left shadow-flottante transition-opacity"
        >
          <span className="block text-[11px] font-semibold leading-tight text-ardoise-900">
            {z.nom}
          </span>
          <span
            style={{
              background: COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].fond,
              color: COULEUR_COTATION[(carte[z.code] ?? 0) as Cotation].texte,
            }}
            className="mt-0.5 inline-block rounded-full px-1.5 py-px text-[9px] font-semibold uppercase leading-tight tracking-wide"
          >
            {LIBELLES_COTATION[(carte[z.code] ?? 0) as Cotation]}
          </span>
        </button>
      ))}

      {!pret && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ardoise-400">
          Chargement de la vue 3D…
        </p>
      )}
    </div>
  );
}

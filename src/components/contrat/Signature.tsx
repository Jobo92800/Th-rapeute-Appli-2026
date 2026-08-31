import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Eraser, Maximize2, X } from 'lucide-react';

export interface SignatureHandle {
  /** PNG en data URL, ou null si rien n'a été tracé. */
  lire: () => string | null;
  effacer: () => void;
}

interface Props {
  onChange?: (vide: boolean) => void;
}

/**
 * Zone de signature au doigt. Le mode plein écran existe parce que signer
 * dans un petit cadre sur tablette donne un gribouillis.
 */
const Signature = forwardRef<SignatureHandle, Props>(function Signature({ onChange }, ref) {
  const cadre = useRef<HTMLCanvasElement>(null);
  const plein = useRef<HTMLCanvasElement>(null);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [vide, setVide] = useState(true);

  const marquerRempli = useCallback(() => {
    setVide(false);
    onChange?.(false);
  }, [onChange]);

  const effacer = useCallback(() => {
    for (const c of [cadre.current, plein.current]) {
      if (!c) continue;
      const ctx = c.getContext('2d');
      ctx?.clearRect(0, 0, c.width, c.height);
    }
    setVide(true);
    onChange?.(true);
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    lire: () => (vide ? null : (cadre.current?.toDataURL('image/png') ?? null)),
    effacer,
  }));

  // Le dessin est identique sur les deux toiles : un seul brancheur.
  useEffect(() => {
    const cibles = [cadre.current, plein.current].filter(Boolean) as HTMLCanvasElement[];
    const nettoyages: Array<() => void> = [];

    for (const c of cibles) {
      let trace = false;
      let dernier = { x: 0, y: 0 };

      const position = (e: MouseEvent | TouchEvent) => {
        const r = c.getBoundingClientRect();
        const p = 'touches' in e ? e.touches[0] : e;
        return {
          x: ((p.clientX - r.left) / r.width) * c.width,
          y: ((p.clientY - r.top) / r.height) * c.height,
        };
      };

      const debut = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        trace = true;
        dernier = position(e);
      };

      const bouge = (e: MouseEvent | TouchEvent) => {
        if (!trace) return;
        e.preventDefault();
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const p = position(e);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(dernier.x, dernier.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        dernier = p;
        marquerRempli();
      };

      const fin = () => {
        trace = false;
      };

      c.addEventListener('mousedown', debut);
      c.addEventListener('mousemove', bouge);
      c.addEventListener('mouseup', fin);
      c.addEventListener('mouseleave', fin);
      c.addEventListener('touchstart', debut, { passive: false });
      c.addEventListener('touchmove', bouge, { passive: false });
      c.addEventListener('touchend', fin);

      nettoyages.push(() => {
        c.removeEventListener('mousedown', debut);
        c.removeEventListener('mousemove', bouge);
        c.removeEventListener('mouseup', fin);
        c.removeEventListener('mouseleave', fin);
        c.removeEventListener('touchstart', debut);
        c.removeEventListener('touchmove', bouge);
        c.removeEventListener('touchend', fin);
      });
    }

    return () => nettoyages.forEach((f) => f());
  }, [pleinEcran, marquerRempli]);

  /** À l'ouverture du plein écran, on reprend ce qui a déjà été tracé. */
  useEffect(() => {
    if (!pleinEcran) return;
    const src = cadre.current;
    const dst = plein.current;
    if (!src || !dst) return;
    const ctx = dst.getContext('2d');
    if (!ctx || vide) return;
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.drawImage(src, 0, 0, dst.width, dst.height);
  }, [pleinEcran, vide]);

  /** À la fermeture, on renvoie le tracé du plein écran vers le petit cadre. */
  function fermerPleinEcran() {
    const src = plein.current;
    const dst = cadre.current;
    if (src && dst) {
      const ctx = dst.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, dst.width, dst.height);
        ctx.drawImage(src, 0, 0, dst.width, dst.height);
      }
    }
    setPleinEcran(false);
  }

  return (
    <>
      <div className="relative">
        <canvas
          ref={cadre}
          width={640}
          height={200}
          className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-ardoise-300 bg-white"
          aria-label="Zone de signature"
        />
        {vide && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ardoise-400">
            Signature de la cliente
          </p>
        )}
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={() => setPleinEcran(true)}
            title="Signer en plein écran"
            aria-label="Signer en plein écran"
            className="rounded-lg border border-ardoise-300 bg-white p-1.5 text-ardoise-500 hover:text-ardoise-800"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={effacer}
            title="Effacer"
            aria-label="Effacer la signature"
            className="rounded-lg border border-ardoise-300 bg-white p-1.5 text-ardoise-500 hover:text-ardoise-800"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pleinEcran && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ardoise-900">
              Signature — « Lu et approuvé »
            </p>
            <div className="flex gap-2">
              <button onClick={effacer} className="bouton-discret">
                <Eraser className="h-4 w-4" />
                Effacer
              </button>
              <button onClick={fermerPleinEcran} className="bouton-principal">
                <X className="h-4 w-4" />
                Terminer
              </button>
            </div>
          </div>
          <canvas
            ref={plein}
            width={1400}
            height={700}
            className="min-h-0 w-full flex-1 touch-none rounded-xl border-2 border-dashed border-ardoise-300 bg-white"
            aria-label="Zone de signature plein écran"
          />
        </div>
      )}
    </>
  );
});

export default Signature;

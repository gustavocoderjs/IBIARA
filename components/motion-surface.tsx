'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { DishPhoto } from '@/components/dish-photo';

/** A short transition between work areas; data refreshes never replay it. */
export function MotionSurface({ activeKey, children }: { activeKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || !ref.current?.animate) return;
    const animation = ref.current.animate([
      { opacity: 0.65, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    const stop = () => animation.cancel();
    preference.addEventListener('change', stop);
    return () => { animation.cancel(); preference.removeEventListener('change', stop); };
  }, [activeKey]);
  return <div className="motion-surface" ref={ref}>{children}</div>;
}

/** Photographic planes in CSS perspective, without a render loop or WebGL. */
export function MealScene({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const preference = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
    let visible = true, frame = 0, x = 0, y = 0;
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; x = 0; y = 0;
      scene.style.removeProperty('--scene-x');
      scene.style.removeProperty('--scene-y');
      scene.style.removeProperty('--scene-scroll');
    };
    const draw = () => {
      frame = 0;
      if (!preference.matches || !visible || document.hidden) return;
      const rect = scene.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (120 - rect.top) / Math.max(rect.height, 1)));
      scene.style.setProperty('--scene-x', `${x.toFixed(2)}deg`);
      scene.style.setProperty('--scene-y', `${y.toFixed(2)}deg`);
      scene.style.setProperty('--scene-scroll', String(progress));
    };
    const schedule = () => {
      if (!frame && preference.matches && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !preference.matches) return;
      const rect = scene.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width - 0.5) * 7;
      y = ((event.clientY - rect.top) / rect.height - 0.5) * -5;
      schedule();
    };
    const leave = () => { x = 0; y = 0; schedule(); };
    const onPreference = () => { reset(); schedule(); };
    const onVisibility = () => { if (document.hidden) reset(); else schedule(); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule(); else reset();
    });
    observer.observe(scene);
    scene.addEventListener('pointermove', move);
    scene.addEventListener('pointerleave', leave);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    preference.addEventListener('change', onPreference);
    schedule();
    return () => {
      reset(); observer.disconnect();
      scene.removeEventListener('pointermove', move);
      scene.removeEventListener('pointerleave', leave);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', onVisibility);
      preference.removeEventListener('change', onPreference);
    };
  }, []);
  return <div className={`meal-scene${compact ? ' scene-compact' : ''}`} ref={ref}>
    <div className="scene-heading"><h2>Bife a cavalo.</h2><p>Vontade de repetir.</p></div>
    <div className="scene-perspective"><div className="scene-planes">
      <DishPhoto priority={!compact} className="scene-photograph" caption={false}/>
      <div className="scene-composition"><span>Bife + ovo</span><span>Arroz, feijão e batatas</span><ArrowUpRight size={18} aria-hidden="true"/></div>
    </div></div>
    <div className="scene-foot"><span><ShieldCheck size={15}/>Você define os limites.</span><small>Imagem ilustrativa · IA</small></div>
  </div>;
}

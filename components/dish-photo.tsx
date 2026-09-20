import { UtensilsCrossed } from 'lucide-react';
import { dishIllustration } from '@/lib/client/dish-illustrations';

export function DishPhoto({ dish = 'Bife a cavalo', className = '', priority = false, caption = true }: {
  dish?: string; className?: string; priority?: boolean; caption?: boolean;
}) {
  const illustration = dishIllustration(dish);
  return <figure className={`dish-photo ${className}`}>
    {illustration ? <>
      {/* Static, locally hosted responsive assets; no image proxy is needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/${illustration.slug}-1280.webp`} srcSet={`/images/${illustration.slug}-640.webp 640w, /images/${illustration.slug}-1280.webp 1280w`} sizes="(max-width: 767px) 100vw, 50vw" width={1280} height={853} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} alt={illustration.alt}/>
      {caption && <figcaption>Imagem ilustrativa · gerada por IA</figcaption>}
    </> : <div className="dish-photo-fallback"><UtensilsCrossed size={32}/><span>Fotografia do prato em breve</span></div>}
  </figure>;
}

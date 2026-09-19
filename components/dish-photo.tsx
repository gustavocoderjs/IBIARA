import { UtensilsCrossed } from 'lucide-react';

export function DishPhoto({ dish = 'Bife a cavalo', className = '', priority = false, caption = true }: {
  dish?: string; className?: string; priority?: boolean; caption?: boolean;
}) {
  const illustrations: Record<string, boolean> = { 'bife a cavalo': true };
  const illustrated = illustrations[dish.trim().toLocaleLowerCase('pt-BR')] === true;
  return <figure className={`dish-photo ${className}`}>
    {illustrated ? <>
      {/* Static, locally hosted responsive assets; no image proxy is needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/bife-a-cavalo-1280.webp" srcSet="/images/bife-a-cavalo-640.webp 640w, /images/bife-a-cavalo-1280.webp 1280w" sizes="(max-width: 767px) 100vw, 50vw" width={1280} height={853} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} alt="Imagem ilustrativa de bife a cavalo com ovo, arroz, feijão e batatas douradas"/>
      {caption && <figcaption>Imagem ilustrativa · gerada por IA</figcaption>}
    </> : <div className="dish-photo-fallback"><UtensilsCrossed size={32}/><span>Fotografia do prato em breve</span></div>}
  </figure>;
}

'use client';
import { SlidersHorizontal, ShoppingBag, Mic, Menu, Search } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import type { Role } from '@/lib/domain/types';

export function MobileNavigation({ role, view, navigate, pending }: {
  role: Role; view: string; navigate: (view: string) => void; pending: number;
}) {
  const { setOpenMobile, openMobile } = useSidebar();
  const items = role === 'merchant'
    ? [{ id: 'quick', label: 'Ajustes', icon: SlidersHorizontal }, { id: 'orders', label: 'Pedidos', icon: ShoppingBag }, { id: 'voice', label: 'Voz', icon: Mic }]
    : [{ id: 'market', label: 'Buscar', icon: Search }, { id: 'orders', label: 'Pedidos', icon: ShoppingBag }];
  return <nav className="bottom-navigation" aria-label="Navegação principal mobile">
    {items.map(item => <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
      <span className="bottom-icon"><item.icon size={21}/>{item.id === 'orders' && pending > 0 && <span className="nav-count" aria-label={`${pending} em andamento`}>{pending}</span>}</span>
      <span>{item.label}</span>
    </button>)}
    <button type="button" aria-label="Mais opções" aria-expanded={openMobile} onClick={() => setOpenMobile(true)}><Menu size={21}/><span>Mais</span></button>
  </nav>;
}

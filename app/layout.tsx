import type { Metadata, Viewport } from 'next';
import './globals.css';
import './operations.css';
import './appetite.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#bc3f25' };
export const metadata: Metadata = { title: 'i.byara · Sua cozinha, seus limites', description: 'Converse com a Byara, organize sua cozinha e acompanhe seus agentes negociando. Demonstração em sandbox.', icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { return <html lang="pt-BR"><body>{children}</body></html>; }

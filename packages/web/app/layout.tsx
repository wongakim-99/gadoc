import type { Metadata, Viewport } from 'next';
import { Geist, Noto_Sans_KR } from 'next/font/google';
import { siteConfig } from '@/src/shared/config/site';
import { DesktopRuntimeBadge } from '@/src/widgets/desktop/ui/DesktopRuntimeBadge';
import { DesktopDragBar } from '@/src/widgets/desktop/ui/DesktopDragBar';
import { DesktopNavigation } from '@/src/widgets/desktop/ui/DesktopNavigation';
import './globals.css';
import './brand.css';

const geist = Geist({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-geist',
});

const korean = Noto_Sans_KR({ subsets: ['latin'], display: 'swap', variable: '--font-korean' });

export const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: { default: `${siteConfig.name} | ${siteConfig.tagline}`, template: `%s | ${siteConfig.name}` },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    openGraph: {
        title: `가독 GaDoc | ${siteConfig.tagline}`,
        description: siteConfig.description,
        siteName: siteConfig.name,
        locale: 'ko_KR',
        type: 'website',
        images: [
            { url: '/brand/gadoc-social.png', width: 1200, height: 630, alt: 'GaDoc. Where work comes together.' },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: `GaDoc | ${siteConfig.tagline}`,
        description: siteConfig.description,
        images: ['/brand/gadoc-social.png'],
    },
    icons: {
        icon: [
            { url: '/icon.svg', type: 'image/svg+xml' },
            { url: '/brand/gadoc-icon.png', sizes: '512x512', type: 'image/png' },
        ],
        shortcut: ['/icon.svg'],
        apple: [{ url: '/brand/gadoc-apple.png', sizes: '180x180', type: 'image/png' }],
    },
};

export const viewport: Viewport = {
    themeColor: '#181b20',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko" className={`${geist.variable} ${korean.variable}`} data-scroll-behavior="smooth">
            <body>
                <DesktopNavigation />
                <DesktopDragBar />
                <DesktopRuntimeBadge />
                {children}
            </body>
        </html>
    );
}

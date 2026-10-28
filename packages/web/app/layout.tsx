import type { Metadata, Viewport } from 'next';
import { siteConfig } from '@/src/shared/config/site';
import { DesktopRuntimeBadge } from '@/src/widgets/desktop/ui/DesktopRuntimeBadge';
import { DesktopDragBar } from '@/src/widgets/desktop/ui/DesktopDragBar';
import { DesktopNavigation } from '@/src/widgets/desktop/ui/DesktopNavigation';
import './globals.css';
import './brand.css';
import './typography.css';
import './themes.css';
import { ThemeProvider } from '@/src/features/appearance/ThemePreference';

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
        <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
            <head>
                <link rel="preload" href="/fonts/gadoc-sans/GaDocSans-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
                <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('gadoc:theme');document.documentElement.dataset.theme=t==='light'?'light':t==='system'&&!matchMedia('(prefers-color-scheme: dark)').matches?'light':'dark'}catch{}" }} />
            </head>
            <body>
                <ThemeProvider>
                <DesktopNavigation />
                <DesktopDragBar />
                <DesktopRuntimeBadge />
                {children}
                </ThemeProvider>
            </body>
        </html>
    );
}

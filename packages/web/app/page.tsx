import { FeatureGrid } from '@/src/widgets/marketing/ui/FeatureGrid';
import { HeroSection } from '@/src/widgets/marketing/ui/HeroSection';
import { MarketingHeader } from '@/src/widgets/marketing/ui/MarketingHeader';
import { ProductFooter } from '@/src/widgets/marketing/ui/ProductFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default function Home() {
    return (
        <div className="gadoc-marketing">
            <a href="#main-content" className="gadoc-skip-link">
                본문으로 바로가기
            </a>
            <MarketingHeader />
            <main id="main-content">
                <HeroSection />
                <FeatureGrid />
            </main>
            <ProductFooter />
        </div>
    );
}

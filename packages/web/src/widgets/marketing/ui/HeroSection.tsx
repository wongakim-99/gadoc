import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { siteConfig } from '@/src/shared/config/site';
import { WorkspacePreview } from './WorkspacePreview';

export function HeroSection() {
    return (
        <section className="gadoc-hero gadoc-container" aria-labelledby="hero-heading">
            <div className="gadoc-hero-copy">
                <p className="gadoc-eyebrow">
                    <span className="gadoc-status-dot" />
                    가닥 GaDoc
                </p>
                <h1 id="hero-heading">
                    일의 가닥이
                    <br />
                    <span>잡히는 곳.</span>
                </h1>
                <p className="gadoc-english" lang="en">
                    {siteConfig.englishTagline}
                </p>
                <p className="gadoc-hero-description">
                    <strong>{siteConfig.badge}</strong>
                    <br />
                    흩어진 이야기가 정리되고,
                    <br className="gadoc-mobile-break" /> 함께할 일이 명확해집니다.
                </p>
                <div className="gadoc-hero-actions">
                    <Link href="/auth/register" className="gadoc-button gadoc-button-primary">
                        우리 팀의 가닥 잡기 <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                    <Link href="#workflow" className="gadoc-text-link">
                        어떻게 이어지나요? <ArrowDown size={16} aria-hidden="true" />
                    </Link>
                </div>
            </div>
            <div className="gadoc-hero-note" aria-hidden="true">
                <svg viewBox="0 0 320 230" fill="none">
                    <path d="M10 24H75C180 24 110 115 220 115H310" />
                    <path d="M10 206H75C180 206 110 115 220 115H310" />
                    <path d="M10 115H310" />
                    <circle cx="310" cy="115" r="5" />
                </svg>
                <span>
                    서로 다른 생각이
                    <br />
                    하나의 방향이 되도록.
                </span>
            </div>
            <WorkspacePreview />
        </section>
    );
}

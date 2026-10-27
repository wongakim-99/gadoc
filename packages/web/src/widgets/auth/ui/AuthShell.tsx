import Link from 'next/link';
import { siteConfig } from '@/src/shared/config/site';
import { Brand } from '@/src/shared/ui/Brand';

interface Props {
    title: string;
    description: string;
    alternateHref: string;
    alternateLabel: string;
    alternateText: string;
    children: React.ReactNode;
}

export function AuthShell({ title, description, alternateHref, alternateLabel, alternateText, children }: Props) {
    return (
        <div className="gadoc-auth">
            <header className="gadoc-auth-header">
                <Link href="/" aria-label="GaDoc 홈">
                    <Brand />
                </Link>
                <Link href="/">홈으로</Link>
            </header>
            <main className="gadoc-auth-body">
                <section className="gadoc-auth-story">
                    <p className="gadoc-eyebrow">가닥 GaDoc</p>
                    <h1>{siteConfig.headline}</h1>
                    <p className="gadoc-english" lang="en">
                        {siteConfig.englishTagline}
                    </p>
                    <p className="gadoc-auth-description">{siteConfig.authDescription}</p>
                    <p className="gadoc-auth-flow">대화를 나누고. 문서로 정리하고. 함께 실행하고.</p>
                </section>
                <section className="gadoc-auth-form" aria-labelledby="auth-heading">
                    <p className="gadoc-eyebrow">{title}</p>
                    <h2 id="auth-heading">{description}</h2>
                    {children}
                    <p className="gadoc-auth-alternate">
                        {alternateText}
                        <Link href={alternateHref}>{alternateLabel}</Link>
                    </p>
                </section>
            </main>
        </div>
    );
}

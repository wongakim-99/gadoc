import Link from 'next/link';
import { Brand } from '@/src/shared/ui/Brand';

export function MarketingHeader() {
    return (
        <header className="gadoc-header">
            <div className="gadoc-container gadoc-header-inner">
                <Link href="/" aria-label="GaDoc 홈" className="gadoc-home-link">
                    <Brand />
                </Link>
                <nav aria-label="주요 메뉴" className="gadoc-nav">
                    <Link href="/#workflow" className="gadoc-nav-detail">
                        함께 일하는 방식
                    </Link>
                    <Link href="/download" className="gadoc-nav-detail">
                        다운로드
                    </Link>
                    <Link href="/auth/login">로그인</Link>
                    <Link href="/auth/register" className="gadoc-button gadoc-button-primary">
                        시작하기
                    </Link>
                </nav>
            </div>
        </header>
    );
}

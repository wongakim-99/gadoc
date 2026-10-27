import { siteConfig } from '@/src/shared/config/site';
import { Brand } from '@/src/shared/ui/Brand';
import Link from 'next/link';

export function ProductFooter() {
    return (
        <footer className="gadoc-footer">
            <div className="gadoc-container">
                <div className="gadoc-footer-top">
                    <div>
                        <Link href="/" aria-label="GaDoc 홈">
                            <Brand />
                        </Link>
                        <p>{siteConfig.footerDescription}</p>
                    </div>
                    <nav aria-label="하단 메뉴">
                        <Link href="/download">앱 다운로드</Link>
                        <Link href="/privacy">개인정보 처리 방침</Link>
                        <a href={siteConfig.releasePage} target="_blank" rel="noreferrer">
                            릴리즈 노트
                        </a>
                    </nav>
                </div>
                <div className="gadoc-footer-business">
                    <p>상호 콜딩(Colding) · 대표 김승찬 · 사업자등록번호 457-49-00942</p>
                    <p>
                        경기도 김포시 김포한강9로75번길 66, 5층 ·{' '}
                        <a href="mailto:coldingcontact@gmail.com">coldingcontact@gmail.com</a>
                    </p>
                </div>
                <div className="gadoc-footer-bottom">
                    <span lang="en">{siteConfig.englishTagline}</span>
                    <span>&copy; {new Date().getFullYear()} Colding. All rights reserved.</span>
                </div>
            </div>
        </footer>
    );
}

import Link from 'next/link';
import { MarketingHeader } from '@/src/widgets/marketing/ui/MarketingHeader';
import { ProductFooter } from '@/src/widgets/marketing/ui/ProductFooter';
import { siteConfig } from '@/src/shared/config/site';
import { getDesktopRelease } from '@/src/features/desktop-download/api/getDesktopRelease';

export const revalidate = 300;
const packages = [
    {
        title: 'Windows',
        suffix: 'x64.exe',
        status: '권장',
        description: '설치 뒤 앱 안에서 새 버전을 바로 확인하고 내려받을 수 있습니다.',
    },
    {
        title: 'macOS Apple Silicon',
        suffix: 'arm64.dmg',
        status: '수동 설치',
        description: '현재는 새 DMG를 다시 설치하는 방식으로 운영하고 있습니다.',
    },
    {
        title: 'macOS ZIP',
        suffix: 'arm64.zip',
        status: '보조 파일',
        description: '압축형 배포 파일이 필요한 환경을 위한 보조 패키지입니다. 같은 서명·공증 기준이 적용됩니다.',
    },
];

export default async function DownloadPage() {
    const release = await getDesktopRelease();
    const macNotarized = release.verification.macos === 'notarized';
    const availablePackages = release
        ? packages.flatMap((item) => {
              const asset = release.assets.find((asset) =>
                  ['GaDoc', 'Slacord'].some((brand) => asset.name === `${brand}-${release.version}-${item.suffix}`),
              );
              return asset
                  ? [
                        {
                            ...item,
                            hint: asset.name,
                            href: asset.href,
                            sha256: asset.sha256,
                            bytes: asset.bytes,
                            status: item.suffix !== 'x64.exe' && macNotarized ? 'Apple 서명·공증' : item.status,
                        },
                    ]
                  : [];
          })
        : [];
    return (
        <div className="gadoc-marketing">
            <MarketingHeader />
            <main className="gadoc-container space-y-12 py-16">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] lg:items-end">
                    <div className="max-w-3xl">
                        <p className="marketing-kicker">Desktop Download</p>
                        <h1 className="marketing-display mt-5 text-[clamp(3rem,6vw,5.3rem)] text-white">
                            브라우저 밖에서도
                            <br />
                            <span className="text-brand-200">함께 일하는 GaDoc</span>
                        </h1>
                        <p className="marketing-lead mt-6 max-w-2xl text-[1.05rem]">
                            설치 후 로그인하면 바로 워크스페이스로 이어집니다. Windows는 앱 안에서 업데이트까지 바로
                            이어지고, macOS는 당분간 다운로드 페이지에서 새 설치 파일을 다시 받는 기준으로 운영합니다.{' '}
                            {release && (
                                <>
                                    {release.source === 'verified-fallback'
                                        ? '최근 검증된 버전은 '
                                        : '현재 공개 버전은 '}
                                    <span className="font-semibold text-white">v{release.version}</span>입니다.
                                </>
                            )}
                        </p>
                    </div>
                    <div className="marketing-card rounded-[32px] p-6 sm:p-7">
                        <p className="marketing-kicker">운영 기준</p>
                        <p className="mt-4 text-[1.4rem] font-bold tracking-[-0.04em] text-white">
                            Windows는 앱 안 업데이트, macOS는 수동 설치 기준으로 안내합니다
                        </p>
                        <p className="marketing-caption mt-4 text-sm sm:text-[0.98rem]">
                            지금은 사용자가 헷갈리지 않도록 플랫폼별로 다른 운영 기준을 분명하게 안내합니다. Windows는
                            앱 안에서 내려받고 재시작하면 되고, macOS는 최신 DMG를 다시 설치하는 흐름을 우선 사용합니다.
                        </p>
                    </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                    {availablePackages.map((item) => (
                        <article
                            key={item.title}
                            className="marketing-card rounded-[30px] p-7 transition hover:border-brand-300/40 hover:bg-bg-hover"
                        >
                            <p className="marketing-kicker text-[11px]">Installer</p>
                            <p className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-[11px] text-text-secondary">
                                {item.status}
                            </p>
                            <h2 className="mt-5 text-[2rem] font-bold tracking-[-0.05em] text-white">{item.title}</h2>
                            <p className="mt-3 font-mono text-[0.95rem] text-text-secondary">{item.hint}</p>
                            <p className="marketing-caption mt-4 text-sm">{item.description}</p>
                            {item.bytes && (
                                <p className="marketing-caption mt-3 text-xs">
                                    {Math.round(item.bytes / 1024 / 1024)} MB
                                </p>
                            )}
                            {item.sha256 && (
                                <details className="mt-4 text-xs text-text-secondary">
                                    <summary className="cursor-pointer">SHA256 무결성 확인</summary>
                                    <code className="mt-2 block break-all rounded-lg border border-border-primary p-3 font-mono">
                                        {item.sha256}
                                    </code>
                                </details>
                            )}
                            <a
                                href={item.href}
                                aria-label={`${item.title} v${release.version} 다운로드`}
                                className="mt-8 inline-flex rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white"
                            >
                                다운로드
                            </a>
                        </article>
                    ))}
                </div>
                {release.source === 'verified-fallback' && (
                    <p role="status" className="marketing-card rounded-[30px] p-7 text-white">
                        최신 릴리즈 조회가 지연되어 최근 검증된 v{release.version} 설치 파일을 제공하고 있습니다. 위
                        다운로드와 파일별 SHA256 확인은 그대로 사용할 수 있습니다.
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href={siteConfig.releasePage}
                        className="rounded-full border border-border-primary px-5 py-3 text-sm text-text-secondary transition hover:bg-bg-hover hover:text-white"
                    >
                        GitHub Releases 열기
                    </Link>
                    <a
                        href={`https://github.com/kscold/gadoc/releases/download/v${release.version}/SHA256SUMS.txt`}
                        className="rounded-full border border-border-primary px-5 py-3 text-sm text-text-secondary transition hover:bg-bg-hover"
                    >
                        SHA256 체크섬 보기
                    </a>
                    <Link
                        href="/auth/register"
                        className="rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-400"
                    >
                        웹에서 바로 시작하기
                    </Link>
                </div>
                <div className="marketing-card rounded-[30px] p-6 sm:p-7">
                    <p className="marketing-kicker text-[11px]">설치 안내</p>
                    <p className="marketing-caption mt-4 text-[1rem]">
                        {macNotarized
                            ? '이 macOS 릴리즈는 Developer ID 서명과 Apple 공증 검증을 통과했습니다.'
                            : release.verification.macos === 'unsigned'
                              ? '현재 제공 중인 macOS 설치 파일에는 아직 정식 코드 서명과 Apple 공증이 없습니다.'
                              : '현재 릴리즈의 macOS 서명·공증 근거를 확인하지 못했습니다. 공증 완료로 표시하지 않습니다.'}{' '}
                        공식 릴리즈의 파일명과 SHA256 체크섬을 확인하세요. 보안 경고를 임의로 해제하지 말고 설치가
                        차단되면 웹 버전을 이용해 주세요.
                    </p>
                    <p className="marketing-caption mt-4 text-[1rem]">
                        Windows는 앱 안에서 새 버전을 확인하고 내려받은 뒤 재시작으로 적용할 수 있습니다.
                        {release.verification.windows !== 'signed' &&
                            ' Windows 코드 서명이 확인되지 않은 파일은 SmartScreen 경고가 표시될 수 있습니다.'}
                    </p>
                    <p className="marketing-caption mt-3 text-[1rem]">
                        macOS의 첫 정식 서명 버전은 DMG를 내려받아 설치해 주세요. 이 페이지의 공증 표시는 인증서 유무가
                        아니라 해당 설치 파일의 실제 검증 기록과 일치하는 해시를 기준으로 표시합니다.
                    </p>
                </div>
            </main>
            <ProductFooter />
        </div>
    );
}

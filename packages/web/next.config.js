/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    async headers() {
        return [{ source: '/:path*', headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'" },
        ] }];
    },
    devIndicators: false,
    agentRules: false,
    transpilePackages: ['@blocknote/core', '@blocknote/react'],
    async rewrites() {
        const destination = `${process.env.INTERNAL_API_URL || 'http://127.0.0.1:8082'}/api/:path*`;

        return [
            {
                source: '/api/:path*',
                destination,
            },
        ];
    },
};

module.exports = nextConfig;

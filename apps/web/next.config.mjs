import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Embed widget assets must be CORS-loadable from the customer's domain (Webflow).
        source: '/embed/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

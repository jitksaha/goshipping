import type { APIRoute } from 'astro';
import { getSiteOrigin } from '../server/utils/domain';

export const GET: APIRoute = ({ request }) => {
  const origin = getSiteOrigin(request);
  const now = new Date().toISOString().split('T')[0];

  const routes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/services', priority: '0.9', changefreq: 'weekly' },
    { path: '/services/air-shipment', priority: '0.9', changefreq: 'weekly' },
    { path: '/services/sea-shipment', priority: '0.9', changefreq: 'weekly' },
    { path: '/services/door-to-door', priority: '0.9', changefreq: 'weekly' },
    { path: '/services/customs-clearance', priority: '0.8', changefreq: 'weekly' },
    { path: '/services/china-warehouse', priority: '0.8', changefreq: 'weekly' },
    { path: '/how-it-works', priority: '0.8', changefreq: 'monthly' },
    { path: '/quote', priority: '0.9', changefreq: 'weekly' },
    { path: '/tracking', priority: '0.8', changefreq: 'daily' },
    { path: '/about', priority: '0.7', changefreq: 'monthly' },
    { path: '/faq', priority: '0.8', changefreq: 'weekly' },
    { path: '/contact', priority: '0.7', changefreq: 'monthly' },
    { path: '/privacy', priority: '0.4', changefreq: 'yearly' },
    { path: '/terms', priority: '0.4', changefreq: 'yearly' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${origin}${r.path === '/' ? '' : r.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

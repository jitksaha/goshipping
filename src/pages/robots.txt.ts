import type { APIRoute } from 'astro';
import { getSiteOrigin } from '../server/utils/domain';

export const GET: APIRoute = ({ request }) => {
  const origin = getSiteOrigin(request);

  const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /dashboard/
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};

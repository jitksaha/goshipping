import type { APIRoute } from 'astro';
import { app } from '../../server/api/app';

export const ALL: APIRoute = async (context) => {
  return app.fetch(context.request);
};

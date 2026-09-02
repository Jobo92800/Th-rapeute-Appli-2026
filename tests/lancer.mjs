import { register } from 'node:module';
register('./resolveur.mjs', import.meta.url);
await import('./run.mts');

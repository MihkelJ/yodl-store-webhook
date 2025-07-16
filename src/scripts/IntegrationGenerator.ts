import { Integration } from 'express-zod-api';
import fs from 'fs/promises';
import { routing } from '../server.js';

const client = new Integration({
  routing,
  variant: 'client',
  serverUrl: 'https://yodl-store-webhook.fly.dev',
});

const prettierFormattedTypescriptCode = await client.printFormatted();

// Write to file
await fs.writeFile('client.ts', prettierFormattedTypescriptCode);

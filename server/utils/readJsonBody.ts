import type { IncomingMessage } from 'node:http';

export default function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer | string) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({} as T);
      try { resolve(JSON.parse(data) as T); } catch (e) { reject(e as Error); }
    });
    req.on('error', reject);
  });
}

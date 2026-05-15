import fs from 'node:fs';
import type { Config } from '@shared/config.js';

export default function readConfig(configFile: string): Config {
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : {};
  } catch {
    return {};
  }
}

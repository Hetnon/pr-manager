import fs from 'node:fs';
import type { Config } from '@shared/config.js';

export default function writeConfig(configFile: string, cfg: Config): void {
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

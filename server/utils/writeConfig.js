import fs from 'node:fs';

export default function writeConfig(configFile, cfg) {
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

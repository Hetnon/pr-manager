import fs from 'node:fs';

export default function readConfig(configFile) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : {};
  } catch {
    return {};
  }
}

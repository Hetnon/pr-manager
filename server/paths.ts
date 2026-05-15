import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PORT = 7654;
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'ui', 'public');
export const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');

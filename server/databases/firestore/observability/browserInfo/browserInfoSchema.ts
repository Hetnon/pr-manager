// @ts-nocheck
/**
 * Browser Info Document Structure
 *
 * Collection: browserInfo
 * Document ID: auto-generated
 *
 * Saved by: saveBrowserInfoToDB (called from logBrowserInfo endpoint)
 * Client caller: useAppInitialization.js -> basicFetchCall('log-browser-info', 'POST', {browserInfo, extensionConnected, device})
 * Server handler: observability.js -> logBrowserInfo adds userEmail and IP before saving
 *
 * Fields:
 * - userEmail: string - User email from session or 'unknown-user'
 * - browserInfo: object - Browser detection results from getBrowserInfo(userAgent)
 *   - name: string - Browser name ('Chrome/Brave', 'Firefox', 'Safari', 'Edge', 'Opera', 'Vivaldi', 'Unknown')
 *   - version: string - Browser version number
 *   - engine: string - Rendering engine ('Chromium', 'Gecko', 'WebKit', 'Unknown')
 *   - fullVersion: string - Full version string
 * - extensionConnected: boolean - Whether the browser extension was detected
 * - device: object - Device detection results from getDeviceInfo(userAgent)
 *   - name: string - Device name ('desktop', 'iPhone', 'Android Phone', 'iPad', etc.)
 *   - type: string - Device category ('desktop', 'mobile', 'tablet')
 *   - screen: object - { width: number, height: number, pixelRatio: number, colorDepth: number }
 *   - hardware: object - { cpuCores: number|'Unknown', memoryGB: number|'Unknown', touchPoints: number }
 *   - isTouchScreen: boolean
 *   - isOnline: boolean
 *   - platform: string - OS platform from navigator.userAgentData
 * - IP: string - Client IP address from req.ip
 * - timestamp: timestamp - Server-side timestamp (added by saveBrowserInfoToDB)
 *
 * Example:
 * {
 *   "userEmail": "user@example.com",
 *   "browserInfo": {
 *     "name": "Chrome/Brave",
 *     "version": "120.0",
 *     "engine": "Chromium",
 *     "fullVersion": "120.0.6099.109"
 *   },
 *   "extensionConnected": true,
 *   "device": {
 *     "name": "desktop",
 *     "type": "desktop",
 *     "screen": { "width": 1920, "height": 1080, "pixelRatio": 1, "colorDepth": 24 },
 *     "hardware": { "cpuCores": 8, "memoryGB": 16, "touchPoints": 0 },
 *     "isTouchScreen": false,
 *     "isOnline": true,
 *     "platform": "Windows"
 *   },
 *   "IP": "::1",
 *   "timestamp": Timestamp(2026-02-16T10:00:00Z)
 * }
 */

export const browserInfoSchema = {
    collection: 'browserInfo',
    documentIdType: 'auto',
    fields: {
        userEmail: 'string',
        browserInfo: 'object', // { name, version, engine, fullVersion }
        extensionConnected: 'boolean',
        device: 'object', // { name, type, screen, hardware, isTouchScreen, isOnline, platform }
        IP: 'string',
        timestamp: 'timestamp', // server-side, added by saveBrowserInfoToDB
    }
};

import { TEST_USERS } from './testUsers.js';

/**
 * Mock Browser Info Data
 *
 * Collection: browserInfo
 * Mirrors the real payload built by logBrowserInfo (observability.js)
 * from client data sent by useAppInitialization.js -> basicFetchCall('log-browser-info', ...)
 *
 * testMarker: true is included so the cleanup helper can query and delete
 * all test-created documents from the browserInfo collection.
 */
export const mockBrowserInfoData = [
    {
        testMarker: true,
        userEmail: TEST_USERS.ACTIVE,
        browserInfo: {
            name: 'Chrome/Brave',
            version: '120.0',
            engine: 'Chromium',
            fullVersion: '120.0.6099.109',
        },
        extensionConnected: true,
        device: {
            name: 'desktop',
            type: 'desktop',
            screen: { width: 1920, height: 1080, pixelRatio: 1, colorDepth: 24 },
            hardware: { cpuCores: 8, memoryGB: 16, touchPoints: 0 },
            isTouchScreen: false,
            isOnline: true,
            platform: 'Windows',
        },
        IP: '127.0.0.1',
    },
    {
        testMarker: true,
        userEmail: TEST_USERS.ADMIN,
        browserInfo: {
            name: 'Firefox',
            version: '121.0',
            engine: 'Gecko',
            fullVersion: '121.0',
        },
        extensionConnected: false,
        device: {
            name: 'desktop',
            type: 'desktop',
            screen: { width: 2560, height: 1440, pixelRatio: 2, colorDepth: 24 },
            hardware: { cpuCores: 12, memoryGB: 32, touchPoints: 0 },
            isTouchScreen: false,
            isOnline: true,
            platform: 'macOS',
        },
        IP: '192.168.1.10',
    },
];

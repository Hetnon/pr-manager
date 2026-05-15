/** @type {import('jest').Config} */
export default {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
    },
    moduleNameMapper: {
        // NodeNext-style imports use .js extensions even when the source is .ts;
        // strip the suffix so jest resolves the .ts file under test.
        '^(\\.{1,2}/.*)\\.js$': '$1',
        // Shared types live in a sibling folder, mirroring tsconfig "paths".
        '^@shared/(.*)\\.js$': '<rootDir>/../TypesAndInterfaces/$1.ts',
        // Shared test fixtures live at <repo>/testing/ so the same stubs can be
        // consumed by ui tests in the future.
        '^testing/(.*)$': '<rootDir>/../testing/$1',
    },
    testMatch: ['<rootDir>/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/'],
    // Run serially: every integration suite hits the same Firestore emulator
    // and seeds/tears down the same fixtures, so parallel workers race each other.
    maxWorkers: 1,
};

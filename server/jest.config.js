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
    },
    testMatch: ['<rootDir>/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/'],
    // Only run the new test files for now; older template tests reference
    // testing/mocks fixtures that don't exist in this repo.
    roots: [
        '<rootDir>/infrastructure/kms',
        '<rootDir>/auth/github',
        '<rootDir>/routes/prs',
    ],
};

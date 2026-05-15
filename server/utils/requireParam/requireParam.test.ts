import { requireParam, throwValidationError, type AppError } from './requireParam.js';

describe('requireParam', () => {
    it('does not throw when value is truthy', () => {
        expect(() => requireParam('hello', 'msg')).not.toThrow();
        expect(() => requireParam(1, 'msg')).not.toThrow();
        expect(() => requireParam(true, 'msg')).not.toThrow();
        expect(() => requireParam({}, 'msg')).not.toThrow();
    });

    it('throws with statusCode 400 when value is falsy', () => {
        const falsyValues = [null, undefined, '', 0, false];
        for (const val of falsyValues) {
            try {
                requireParam(val, 'Test error');
                throw new Error('should have thrown');
            } catch (error) {
                const appError = error as AppError;
                expect(appError.message).toBe('Test error');
                expect(appError.statusCode).toBe(400);
            }
        }
    });
});

describe('throwValidationError', () => {
    it('always throws with statusCode 400', () => {
        try {
            throwValidationError('Validation failed');
            throw new Error('should have thrown');
        } catch (error) {
            const appError = error as AppError;
            expect(appError.message).toBe('Validation failed');
            expect(appError.statusCode).toBe(400);
        }
    });
});

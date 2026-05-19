import type { Request, Response } from 'express';
import type { SessionInfo, SessionResponse } from '@shared/session.js';
import { CSRFTokenGenerator } from '../../validationMiddleware/validationMiddleware.js';

// Reports whether the caller has an active session. If yes, also returns a
// fresh CSRF token the UI echoes back in the CSRF-Token header on writes.
export async function checkUserSession(req: Request, res: Response): Promise<void> {
    const userEmail = req.session?.userEmail;
    const userStatus = req.session?.userStatus;
    const responseObject: SessionInfo = { loggedIn: !!userEmail && userStatus === 'active' };
    if (responseObject.loggedIn) {
        responseObject.token = CSRFTokenGenerator(req);
    }
    const payload: SessionResponse = { responseObject };
    res.status(200).json(payload);
}

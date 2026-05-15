// @ts-nocheck

import { removeSessionFromMap } from '../../databases/databases.js';
import { getSessionName } from '../sessionConfig/sessionConfig.js';

export async function terminateSession(req, res) {
        // Get the session attributes before destroying the session
    const cookieDomain = req.session.cookie.domain;
    const cookieSameSite = req.session.cookie.sameSite;
    const sessionId = req.session.id;
    const userEmail = req.session.userEmail;
    
    await destroySession(req);
    clearCookie(res, cookieDomain, cookieSameSite);

    if (userEmail) await removeSessionFromMap(userEmail, sessionId);
    const responseObject = { message: 'Session terminated successfully' };
    return res.status(200).json({responseObject});

}

async function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.destroy((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function clearCookie(res, cookieDomain, cookieSameSite) {
    const sessionName = getSessionName();
    res.clearCookie(sessionName, {
        path: '/',
        httpOnly: true,
        secure: true, // make sure to match the secure flag as originally set
        sameSite: cookieSameSite,
        domain: cookieDomain
    });
}
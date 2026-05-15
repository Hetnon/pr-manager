// @ts-nocheck
import { promisify } from 'node:util';
import { includeSessionInMap } from '../../databases/databases.js';

export async function includeUserInfoToSession(req, userEmail, userType, userStatus) {
    await promisify(req.session.regenerate.bind(req.session))();
    
    req.session.userEmail = userEmail;
    req.session.userType = userType;
    req.session.userStatus = userStatus;
    await promisify(req.session.save.bind(req.session))();
    await includeSessionInMap(userEmail, req.session.id);
}
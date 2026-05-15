import type { Request, Response } from 'express';
import { updateUserFields, updateUserSessions } from '../../../databases/databases.js';

export async function changeUserStatus(req: Request, res: Response): Promise<void> {
    const userEmail = req.body.userEmail as string | undefined;
    const newStatus = req.body.newStatus as string | undefined;

    if (!userEmail) {
        throw Object.assign(new Error('User email is required to change user status'), { statusCode: 400 });
    }
    if (!newStatus) {
        throw Object.assign(new Error('newStatus is required'), { statusCode: 400 });
    }

    await updateUserFields(userEmail, { userStatus: newStatus });
    await updateUserSessions(userEmail, { userStatus: newStatus });
    res.status(200).json({ message: 'User status changed' });
}

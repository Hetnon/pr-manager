import type { Request, Response } from 'express';
import { deleteUserFirestore } from '../../../databases/databases.js';

export async function deleteUser(req: Request, res: Response): Promise<void> {
    const userEmail = req.params.userEmail;
    if (!userEmail) {
        res.status(400).json({ errorMessage: 'User email is required to delete user' });
        return;
    }

    await deleteUserFirestore(userEmail);
    res.status(200).json({ message: 'User deleted' });
}

import type { Request, Response } from 'express';
import { getUsersListDB } from '../../../databases/databases.js';

export async function getUsersList(req: Request, res: Response): Promise<void> {
    const { pageNumber, usersPerPage } = req.params as Record<string, string>;
    const payload = { pageNumber: Number.parseInt(pageNumber), usersPerPage: Number.parseInt(usersPerPage) };
    const responseObject = await getUsersListDB({ payload });
    res.status(200).json({ responseObject });
}

import type { CreateUserData } from '@shared/user.js';
import { getFirestoreCollection } from '../../firebaseApis.js';
import { requireParam } from '../../../../utils/requireParam/requireParam.js';

export async function createUserDB(userData: CreateUserData): Promise<{ success: boolean; message: string }> {
    requireParam(userData?.userEmail, 'User data with userEmail is required to create a user');
    requireParam(userData?.githubLogin, 'GitHub login is required to create a user');

    const usersCollection = getFirestoreCollection('users');
    const userRef = usersCollection.doc(userData.userEmail);

    const now = new Date().toISOString();
    await userRef.create({
        userEmail: userData.userEmail,
        githubLogin: userData.githubLogin,
        githubId: userData.githubId,
        name: userData.name ?? '',
        avatarUrl: userData.avatarUrl ?? '',
        creationDate: now,
        lastLogin: now,
        userStatus: userData.userStatus ?? 'active',
        userType: userData.userType ?? 'user',
        encryptedToken: '',
        encryptedDek: '',
        kmsKeyName: '',
        tokenScopes: [],
    });
    return { success: true, message: 'User created successfully' };
}

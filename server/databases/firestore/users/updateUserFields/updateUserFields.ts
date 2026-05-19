// @ts-nocheck
import { getFirestoreCollection, FieldValue } from '../../firebaseApis.js';
import { requireParam, throwValidationError } from '../../../../utils/requireParam/requireParam.js';

export async function updateUserFields(userEmail, fields, fieldName = '', merge = false) {
    requireParam(userEmail, 'User email is required to update user document');
    requireParam(fields, 'Fields to update must be provided as an object to update user document');
    if (merge && !fieldName) throwValidationError('Field name is required when merging fields in updating user document');

    const usersCollection = getFirestoreCollection('users');
    const userRef = usersCollection.doc(userEmail);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        const newError = new Error('User document does not exist to update');
        newError.statusCode = 404;
        throw newError;
    }

    if (fieldName) {
        if (merge) {
            if (!Array.isArray(fields) && typeof fields !== 'object') throwValidationError('Fields must be an array or an object when merging fields in updating user document');
            if (Array.isArray(fields)) {
                await userRef.update({ [fieldName]: FieldValue.arrayUnion(...fields) });
            } else {
                const existingData = userDoc.data()[fieldName] || {};
                if (typeof existingData !== 'object') throwValidationError(`Existing data for field ${fieldName} is not an object, cannot merge`);
                const updatedData = { ...existingData, ...fields };
                await userRef.update({ [fieldName]: updatedData });
            }
        } else {
            await userRef.update({ [fieldName]: fields });
        }
    } else {
        await userRef.update(fields);
    }
    return { success: true, message: 'User fields updated successfully' };
}

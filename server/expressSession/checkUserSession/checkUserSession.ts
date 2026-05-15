// @ts-nocheck
import {CSRFTokenGenerator} from "../../validation_middleware/validationMiddleware.js";

export async function checkUserSession(req, res) {
    const userEmail = req.session?.userEmail;
    const userStatus = req.session?.userStatus;
    // if user is logged in return true, if not return false. 
    const responseObject = {loggedIn: !!userEmail && userStatus === 'active'}; // also check if user status is active, if not consider user as not logged in
    if(responseObject.loggedIn){
        responseObject.token = CSRFTokenGenerator(req)
    }
    return res.status(200).json({responseObject});
}


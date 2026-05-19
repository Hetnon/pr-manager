// The session payload the server returns from /api/check-user-session.
// token is the CSRF token, only present when loggedIn is true.
export interface SessionInfo {
    loggedIn: boolean;
    token?: string;
}

// All session-bearing API responses wrap their payload in responseObject.
export interface SessionResponse {
    responseObject: SessionInfo;
}

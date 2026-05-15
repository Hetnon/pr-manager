import 'express-session';

declare module 'express-session' {
    interface SessionData {
        userEmail?: string;
        userType?: string;           // 'user' | 'admin' | 'master-admin'
        userStatus?: string;         // 'active' | 'suspended' | 'deleted'
        githubLogin?: string;
        oauthState?: string;         // CSRF for the OAuth redirect round-trip
    }
}

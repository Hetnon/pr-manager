// @ts-nocheck
let _sessionName;

export function getSessionName() {
    if(!_sessionName){
        throw new Error('Session cookie name not set');
    }
    return _sessionName;
}

export function createSessionConfig(store){
    if (!process.env.SESSION_SECRET) {
        const newError = new Error('SESSION_SECRET environment variable is required');
        newError.status = 500;
        throw newError;
    }
    setSessionName(); // Ensure session name is set before creating config
    return  {
        name: getSessionName(),
        store: store,
        secret: process.env.SESSION_SECRET, 
        resave: false,
        saveUninitialized: false,
        cookie: { 
            httpOnly: true,
            path: '/',
            secure: true,
            domain: process.env.COOKIE_DOMAIN,
            maxAge : 30 * 24 * 60 * 60 * 1000,  // 30 days
            sameSite: 'strict',
        }
    };
}

function setSessionName(){
    if(!process.env.NODE_ENV){
        const newError = new Error('NODE_ENV environment variable is required to set session cookie name');
        newError.status = 500;
        throw newError;
    }
    _sessionName = process.env.NODE_ENV;
}

export function _resetSessionNameForTests() {
    _sessionName = null;
}
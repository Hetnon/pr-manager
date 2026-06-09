import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext.js';
import AuthGate from './auth/AuthGate.js';
import { RepoProvider } from './repo/RepoContext.js';
import MainPage from './MainPage.js';

// The application root: wraps the page in its provider stack (auth → repo) and
// mounts it. This file is the webpack entry point.
function Root() {
    return (
        <AuthProvider>
            <AuthGate>
                <RepoProvider>
                    <MainPage />
                </RepoProvider>
            </AuthGate>
        </AuthProvider>
    );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(<Root />);

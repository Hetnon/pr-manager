import { createRoot } from 'react-dom/client';
import MainPage from './MainPage.js';
import SessionAuthLayer from './auth/SessionAuthLayer.js';

// The application root: wraps the page in its provider stack (auth → repo) and
// mounts it. This file is the webpack entry point.
function Root() {
    return (
        <SessionAuthLayer>
            <MainPage />
        </SessionAuthLayer>
    );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(<Root />);

import { createRoot } from 'react-dom/client';
import MainPage from './MainPage.js';
import SessionAuthLayer from './SessionAuthLayer/SessionAuthLayer.js';
import UiGlobal from './UiGlobalContext.js';

// The application root: wraps the page in its provider stack (auth → repo) and
// mounts it. This file is the webpack entry point.
function Root() {
    return (
        <UiGlobal>
            <SessionAuthLayer>
                <MainPage />
            </SessionAuthLayer>
        </UiGlobal>
    );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(<Root />);

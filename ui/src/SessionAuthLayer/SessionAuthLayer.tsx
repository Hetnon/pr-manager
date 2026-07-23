
import { AuthProvider } from './AuthProvider.js';
import AuthGate from './AuthGate.js';


export default function SessionAuthLayer({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <AuthProvider>
            <AuthGate>
                {children}
            </AuthGate>
        </AuthProvider>
    );
}

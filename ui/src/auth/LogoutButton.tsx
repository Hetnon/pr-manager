import { useAuth } from './AuthContext.js';

export default function LogoutButton() {
    const { logout } = useAuth();
    return <button onClick={() => { void logout(); }}>Sign out</button>;
}

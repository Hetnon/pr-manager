import { useContext } from 'react';
import { AuthContext } from './AuthContext.js';

export default function LogoutButton() {
    const { logout } = useContext(AuthContext);
    return <button onClick={() => { void logout(); }}>Sign out</button>;
}

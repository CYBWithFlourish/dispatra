import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useAccount, useWalletClient, useSignMessage } from 'wagmi';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkSession().finally(() => setLoading(false));
  }, [checkSession]);

  const login = useCallback(async () => {
    if (!address || !walletClient) return false;
    setLoggingIn(true);
    try {
      const { nonce, statement } = await api.auth.nonce(address);
      const message = `${statement}\n\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });
      const result = await api.auth.login(address, signature);
      setUser({ address: result.address, role: result.role, kycStatus: result.kycStatus, kycLevel: result.kycLevel });
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      return false;
    } finally {
      setLoggingIn(false);
    }
  }, [address, walletClient, signMessageAsync]);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loggingIn, login, logout, isConnected }}>
      {children}
    </AuthContext.Provider>
  );
}

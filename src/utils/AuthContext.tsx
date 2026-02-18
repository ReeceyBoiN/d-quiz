import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  email: string;
  firstName?: string;
  lastName?: string;
  loginTime: Date;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isOnline: boolean;
  quizActivated: boolean;
  setQuizActivated: (activated: boolean) => void;
  networkAvailable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [quizActivated, setQuizActivated] = useState(false);
  const [networkAvailable, setNetworkAvailable] = useState(false);

  // Monitor internet connection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also check connection periodically
    const checkConnection = () => {
      setIsOnline(navigator.onLine);
    };

    const interval = setInterval(checkConnection, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Monitor network availability (WiFi/Ethernet connection on host machine)
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        // Get backend base URL from preload API (if available)
        let url = '/api/network-status';
        if (window.api?.backend?.url) {
          try {
            const backendUrl = await window.api.backend.url();
            if (backendUrl) {
              url = `${backendUrl}/api/network-status`;
              console.log('[AuthContext] Using backend URL for network check:', url);
            }
          } catch (error) {
            console.warn('[AuthContext] Failed to get backend URL from preload API, falling back to relative URL:', error);
          }
        }

        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (response.ok) {
          const data = await response.json();
          setNetworkAvailable(data.hasNetwork === true);
          console.log('[AuthContext] Network status check succeeded:', { hasNetwork: data.hasNetwork });
        } else {
          console.error('[AuthContext] network-status response not ok:', response.status, response.statusText);
          setNetworkAvailable(false);
        }
      } catch (error) {
        // Network error - assume no network
        console.error('[AuthContext] Failed to fetch network-status:', error);
        setNetworkAvailable(false);
      }
    };

    // Check immediately on mount
    checkNetworkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkNetworkStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('quiz_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser({
          ...parsedUser,
          loginTime: new Date(parsedUser.loginTime)
        });
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('quiz_user');
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Mock authentication - replace with real API call
    if (email && password) {
      const newUser: User = {
        email,
        firstName: email.split('@')[0], // Extract name from email for demo
        loginTime: new Date()
      };
      
      setUser(newUser);
      localStorage.setItem('quiz_user', JSON.stringify(newUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setQuizActivated(false);
    localStorage.removeItem('quiz_user');
  };

  const value: AuthContextType = {
    user,
    isLoggedIn: !!user,
    login,
    logout,
    isOnline,
    quizActivated,
    setQuizActivated,
    networkAvailable
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

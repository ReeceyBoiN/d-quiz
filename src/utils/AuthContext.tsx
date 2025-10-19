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
    setQuizActivated
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
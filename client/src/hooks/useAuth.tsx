import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService, AuthUser, AuthState } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { LoginData, SignupData } from '@shared/schema';

interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = AuthService.getStoredToken();
    const user = AuthService.getStoredUser();
    
    if (token && user) {
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const res = await apiRequest('POST', '/api/auth/login', data);
      return res.json();
    },
    onSuccess: (data) => {
      const { token, user } = data;
      AuthService.storeAuth(token, user);
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupData) => {
      const res = await apiRequest('POST', '/api/auth/signup', data);
      return res.json();
    },
    onSuccess: (data) => {
      const { token, user } = data;
      AuthService.storeAuth(token, user);
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
      toast({
        title: "Account created!",
        description: "Welcome to PromptLockr.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message || "Please try again.",
      });
    },
  });

  const login = async (data: LoginData) => {
    await loginMutation.mutateAsync(data);
  };

  const signup = async (data: SignupData) => {
    await signupMutation.mutateAsync(data);
  };

  const logout = () => {
    AuthService.clearAuth();
    queryClient.clear();
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

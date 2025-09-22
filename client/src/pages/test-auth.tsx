import { useState } from 'react';

export default function TestAuth() {
  const [signupData, setSignupData] = useState({ email: '', password: '' });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupResult, setSignupResult] = useState<any>(null);
  const [loginResult, setLoginResult] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  const testSignup = async () => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData),
      });
      const result = await response.json();
      setSignupResult(result);
      if (result.token) {
        setToken(result.token);
        localStorage.setItem('token', result.token);
      }
    } catch (error) {
      setSignupResult({ error: 'Network error' });
    }
  };

  const testLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });
      const result = await response.json();
      setLoginResult(result);
      if (result.token) {
        setToken(result.token);
        localStorage.setItem('token', result.token);
      }
    } catch (error) {
      setLoginResult({ error: 'Network error' });
    }
  };

  const testHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const result = await response.json();
      setHealthStatus(result);
    } catch (error) {
      setHealthStatus({ error: 'Network error' });
    }
  };

  const testProtectedRoute = async () => {
    try {
      const response = await fetch('/api/prompts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();
      console.log('Protected route result:', result);
    } catch (error) {
      console.error('Protected route error:', error);
    }
  };

  const clearToken = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <div data-testid="page-test-auth" className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Authentication Test Page</h1>
        
        {/* Health Check */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Health Check</h2>
          <button
            data-testid="button-test-health"
            onClick={testHealth}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Health Endpoint
          </button>
          {healthStatus && (
            <div data-testid="result-health" className="mt-4 p-4 bg-gray-100 rounded">
              <pre>{JSON.stringify(healthStatus, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Current Token */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Current JWT Token</h2>
          {token ? (
            <div className="space-y-2">
              <div data-testid="text-token" className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                {token}
              </div>
              <div className="space-x-2">
                <button
                  data-testid="button-test-protected"
                  onClick={testProtectedRoute}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Test Protected Route
                </button>
                <button
                  data-testid="button-clear-token"
                  onClick={clearToken}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Clear Token
                </button>
              </div>
            </div>
          ) : (
            <p data-testid="text-no-token" className="text-gray-500">No token stored</p>
          )}
        </div>

        {/* Signup Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Signup</h2>
          <div className="space-y-4">
            <input
              data-testid="input-signup-email"
              type="email"
              placeholder="Email"
              value={signupData.email}
              onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            <input
              data-testid="input-signup-password"
              type="password"
              placeholder="Password"
              value={signupData.password}
              onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            <button
              data-testid="button-test-signup"
              onClick={testSignup}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Test Signup
            </button>
          </div>
          {signupResult && (
            <div data-testid="result-signup" className="mt-4 p-4 bg-gray-100 rounded">
              <pre>{JSON.stringify(signupResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Login Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Login</h2>
          <div className="space-y-4">
            <input
              data-testid="input-login-email"
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            <input
              data-testid="input-login-password"
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            <button
              data-testid="button-test-login"
              onClick={testLogin}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Test Login
            </button>
          </div>
          {loginResult && (
            <div data-testid="result-login" className="mt-4 p-4 bg-gray-100 rounded">
              <pre>{JSON.stringify(loginResult, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
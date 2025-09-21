import { useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { GuestOnly } from '@/components/auth/AuthProvider';
import { LoginData, loginSchema } from '@shared/schema';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginData) => {
    await login(data);
  };

  return (
    <GuestOnly>
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md px-4">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L3.09 8.26L12 14L20.91 8.26L12 2Z"/>
                  <path d="M3.09 15.74L12 22L20.91 15.74L12 9.48L3.09 15.74Z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-foreground">PromptLockr</h1>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    data-testid="input-email"
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-password"
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      {...form.register('password')}
                    />
                    <Button
                      data-testid="button-toggle-password"
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <Button
                  data-testid="button-login"
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link href="/signup">
                  <span className="text-primary hover:underline cursor-pointer" data-testid="link-signup">
                    Sign up
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GuestOnly>
  );
}

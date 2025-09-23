import { useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { GuestOnly } from '@/components/auth/AuthProvider';
import { SignupData, signupSchema } from '@shared/schema';
import authBgImage from '../assets/auth-bg.jpg';

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const { signup } = useAuth();

  const form = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignupData) => {
    await signup(data);
  };

  return (
    <GuestOnly>
      <div className="flex h-screen">
        {/* Left Column - White Sidebar */}
        <div className="bg-white w-full md:w-[40%] md:max-w-[480px] flex flex-col justify-center p-12">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L3.09 8.26L12 14L20.91 8.26L12 2Z"/>
                  <path d="M3.09 15.74L12 22L20.91 15.74L12 9.48L3.09 15.74Z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">PromptLockr</h1>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-[28px] font-bold text-gray-900 text-center mb-8">Create your account</h2>
          
          {/* Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-[#374151]">Email</Label>
              <Input
                data-testid="input-email"
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className="h-12 text-base bg-white border border-[#e5e7eb] rounded-lg px-4 py-3 focus:border-[#3b82f6] focus:ring-[#3b82f6] focus:ring-1"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-[#374151]">Password</Label>
              <div className="relative">
                <Input
                  data-testid="input-password"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter your password (min. 6 characters)"
                  className="h-12 text-base bg-white border border-[#e5e7eb] rounded-lg px-4 py-3 pr-12 focus:border-[#3b82f6] focus:ring-[#3b82f6] focus:ring-1"
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
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button
              data-testid="button-signup"
              type="submit"
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          {/* Bottom Link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link href="/login">
              <span className="text-blue-600 hover:underline cursor-pointer" data-testid="link-login">
                Sign in
              </span>
            </Link>
          </div>
        </div>
        
        {/* Right Column - Background Image */}
        <div 
          className="hidden md:flex flex-1"
          style={{
            backgroundImage: `url(${authBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      </div>
    </GuestOnly>
  );
}

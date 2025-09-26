import { ArrowLeft, User, Palette, Download, Upload } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SubscriptionManager } from '@/components/ui/subscription-manager';
import { ExportManager } from '@/components/ui/export-manager';
import { ApiKeyManager } from '@/components/ui/api-key-manager';
import { RequireAuth } from '@/components/auth/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ui/theme-provider';

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const handleImportData = () => {
    // TODO: Implement import functionality in Phase 5
    console.log('Import data functionality would go here');
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link 
                  to="/dashboard" 
                  data-testid="link-back-dashboard"
                  className="flex items-center space-x-2 text-muted-foreground hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* Page Header */}
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your account preferences and application settings.
              </p>
            </div>

            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Profile Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                    {/* TODO: Post-MVP - Add profile photo upload functionality
                        - Extend user.preferences schema to include profilePhoto: string (base64)
                        - Add file input with preview
                        - Create API endpoint to update user preferences
                        - Convert uploaded image to base64 and store in preferences
                        - Display uploaded photo here instead of initial
                        - Also update profile icon in dashboard header to use photo */}
                    <span className="text-xl font-medium text-primary-foreground">
                      {user?.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{user?.email}</h3>
                    <p className="text-sm text-muted-foreground">Account email</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed at this time.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appearance Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="w-5 h-5" />
                  <span>Appearance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Switch between light and dark themes
                    </p>
                  </div>
                  <Switch
                    id="dark-mode"
                    data-testid="switch-dark-mode"
                    checked={theme === 'dark'}
                    onCheckedChange={handleThemeToggle}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Export Management Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Data Export</h2>
                <p className="text-muted-foreground">
                  Export your prompts and folders in multiple formats with job tracking.
                </p>
              </div>
              <ExportManager />
            </div>

            {/* Import Section - Placeholder for Phase 5 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Import Data</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Import prompts and folders from exported files. Coming in Phase 5.
                </p>
                <Button
                  data-testid="button-import-data"
                  variant="outline"
                  onClick={handleImportData}
                  disabled
                  className="flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Data (Coming Soon)</span>
                </Button>
              </CardContent>
            </Card>

            {/* API Keys Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Developer Tools</h2>
                <p className="text-muted-foreground">
                  Manage API keys for programmatic access to your prompts and collections.
                </p>
              </div>
              <ApiKeyManager />
            </div>

            {/* Subscription Management Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Subscription & Billing</h2>
                <p className="text-muted-foreground">
                  Manage your subscription, view usage, and billing information.
                </p>
              </div>
              <SubscriptionManager />
            </div>

            {/* Footer */}
            <div className="text-center py-8 border-t">
              <p className="text-sm text-muted-foreground">
                PromptLockr - AI Prompt Management System
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Version 1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
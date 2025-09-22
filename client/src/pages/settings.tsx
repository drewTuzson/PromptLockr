import { ArrowLeft, User, Palette, Download, Upload } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RequireAuth } from '@/components/auth/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ui/theme-provider';

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const handleExportData = () => {
    // This would typically export user data - for now just show a toast
    console.log('Export data functionality would go here');
  };

  const handleImportData = () => {
    // This would typically import user data - for now just show a toast
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
                  className="flex items-center space-x-2 text-muted-foreground hover-bg-consistent"
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
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded border-l-4 border-primary/20">
                    <strong>TODO (Post-MVP):</strong> Profile photo upload functionality<br/>
                    <span className="text-xs">Implementation requires schema updates and new API endpoints</span>
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

            {/* Data Management Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Download className="w-5 h-5" />
                  <span>Data Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-foreground">Export Your Data</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Download all your prompts and folders as a JSON file.
                    </p>
                    <Button
                      data-testid="button-export-data"
                      variant="outline"
                      onClick={handleExportData}
                      className="flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Data</span>
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium text-foreground">Import Data</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Import prompts and folders from a JSON file.
                    </p>
                    <Button
                      data-testid="button-import-data"
                      variant="outline"
                      onClick={handleImportData}
                      className="flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import Data</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
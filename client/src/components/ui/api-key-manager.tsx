import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Key, Plus, Copy, Trash2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ApiKey } from '@shared/schema';

interface ApiKeyManagerProps {
  className?: string;
}

interface CreateApiKeyData {
  name: string;
  permissions: string[];
  rateLimit: number;
  expiresAt?: string;
}

interface ApiKeyWithSecret extends ApiKey {
  key?: string; // Full API key returned only on creation
}

const permissionOptions = [
  { value: 'read', label: 'Read', description: 'View prompts and collections' },
  { value: 'write', label: 'Write', description: 'Create and modify prompts' },
  { value: 'delete', label: 'Delete', description: 'Delete prompts and collections' },
];

const rateLimitOptions = [
  { value: 100, label: '100/hour', description: 'Basic usage' },
  { value: 500, label: '500/hour', description: 'Medium usage' },
  { value: 1000, label: '1,000/hour', description: 'High usage' },
  { value: 5000, label: '5,000/hour', description: 'Enterprise usage' },
];

const getStatusBadge = (key: ApiKey) => {
  if (key.revokedAt) {
    return <Badge variant="destructive" className="flex items-center space-x-1">
      <AlertCircle className="w-3 h-3" />
      <span>Revoked</span>
    </Badge>;
  }
  
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return <Badge variant="secondary" className="flex items-center space-x-1">
      <Clock className="w-3 h-3" />
      <span>Expired</span>
    </Badge>;
  }
  
  return <Badge variant="default" className="flex items-center space-x-1">
    <CheckCircle2 className="w-3 h-3" />
    <span>Active</span>
  </Badge>;
};

const formatDate = (date: string | Date | null) => {
  if (!date) return 'Never';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString();
};

const copyToClipboard = async (text: string, toast: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  } catch (error) {
    toast({
      title: "Copy failed", 
      description: "Failed to copy to clipboard",
      variant: "destructive",
    });
  }
};

export function ApiKeyManager({ className }: ApiKeyManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState<CreateApiKeyData>({
    name: '',
    permissions: ['read'],
    rateLimit: 1000,
  });
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);
  const { toast } = useToast();

  // Fetch API keys
  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['/api/developer/keys'],
  });

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (data: CreateApiKeyData) => {
      const response = await apiRequest('POST', '/api/developer/keys', data);
      return response.json();
    },
    onSuccess: (data: ApiKeyWithSecret) => {
      queryClient.invalidateQueries({ queryKey: ['/api/developer/keys'] });
      setCreatedKey(data);
      setIsCreateDialogOpen(false);
      setNewKeyData({
        name: '',
        permissions: ['read'],
        rateLimit: 1000,
      });
      toast({
        title: "API Key Created",
        description: "Your new API key has been generated. Make sure to copy it now!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  // Revoke API key mutation
  const revokeApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiRequest('DELETE', `/api/developer/keys/${keyId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/developer/keys'] });
      toast({
        title: "API Key Revoked",
        description: "The API key has been revoked and can no longer be used",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  const handleCreateApiKey = () => {
    if (!newKeyData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for your API key",
        variant: "destructive",
      });
      return;
    }
    createApiKeyMutation.mutate(newKeyData);
  };

  const handleRevokeKey = (keyId: string, keyName: string) => {
    if (window.confirm(`Are you sure you want to revoke the API key "${keyName}"? This action cannot be undone.`)) {
      revokeApiKeyMutation.mutate(keyId);
    }
  };


  const handlePermissionChange = (permission: string, checked: boolean) => {
    const newPermissions = checked 
      ? [...newKeyData.permissions, permission]
      : newKeyData.permissions.filter(p => p !== permission);
    
    setNewKeyData({ ...newKeyData, permissions: newPermissions });
  };

  const activeKeys = apiKeys.filter(key => !key.revokedAt && (!key.expiresAt || new Date(key.expiresAt) > new Date()));
  const inactiveKeys = apiKeys.filter(key => key.revokedAt || (key.expiresAt && new Date(key.expiresAt) <= new Date()));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>API Keys</span>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-api-key">
                <Plus className="w-4 h-4 mr-2" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    id="key-name"
                    data-testid="input-key-name"
                    placeholder="My API Key"
                    value={newKeyData.name}
                    onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="space-y-2">
                    {permissionOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`perm-${option.value}`}
                          data-testid={`checkbox-${option.value}`}
                          checked={newKeyData.permissions.includes(option.value)}
                          onChange={(e) => handlePermissionChange(option.value, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`perm-${option.value}`} className="flex-1">
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate-limit">Rate Limit</Label>
                  <Select 
                    value={newKeyData.rateLimit.toString()} 
                    onValueChange={(value) => setNewKeyData({ ...newKeyData, rateLimit: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-rate-limit">
                      <SelectValue placeholder="Select rate limit" />
                    </SelectTrigger>
                    <SelectContent>
                      {rateLimitOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleCreateApiKey}
                  disabled={createApiKeyMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-create-key"
                >
                  {createApiKeyMutation.isPending ? 'Creating...' : 'Create API Key'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New Key Display */}
        {createdKey && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">API Key Created</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
              Save this key now - you won't be able to see it again!
            </p>
            <div className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 border rounded">
              <code className="flex-1 text-sm font-mono" data-testid="text-new-api-key">
                {createdKey.key}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(createdKey.key || '', toast)}
                data-testid="button-copy-new-key"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreatedKey(null)}
              className="mt-2"
              data-testid="button-dismiss-new-key"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Active Keys */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Active Keys ({activeKeys.length})</h4>
            {isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
          </div>

          {activeKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No active API keys. Create your first key to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((key) => (
                <div 
                  key={key.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`api-key-${key.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium">{key.name}</span>
                      {getStatusBadge(key)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>Key: ****{key.lastFour}</div>
                      <div>Rate limit: {key.rateLimit?.toLocaleString()}/hour</div>
                      <div>Created: {formatDate(key.createdAt)}</div>
                      {key.lastUsedAt && <div>Last used: {formatDate(key.lastUsedAt)}</div>}
                      {key.expiresAt && <div>Expires: {formatDate(key.expiresAt)}</div>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast({ title: "Key Hidden", description: "Full API keys are only shown once after creation for security", variant: "destructive" })}
                      data-testid={`button-copy-${key.id}`}
                      disabled
                    >
                      <Copy className="w-4 h-4 opacity-50" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevokeKey(key.id, key.name)}
                      disabled={revokeApiKeyMutation.isPending}
                      data-testid={`button-revoke-${key.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive Keys */}
        {inactiveKeys.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-muted-foreground">
              Inactive Keys ({inactiveKeys.length})
            </h4>
            <div className="space-y-3">
              {inactiveKeys.map((key) => (
                <div 
                  key={key.id} 
                  className="flex items-center justify-between p-4 border rounded-lg opacity-60"
                  data-testid={`inactive-key-${key.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium">{key.name}</span>
                      {getStatusBadge(key)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>Key: ****{key.lastFour}</div>
                      <div>Created: {formatDate(key.createdAt)}</div>
                      {key.revokedAt && <div>Revoked: {formatDate(key.revokedAt)}</div>}
                      {key.expiresAt && <div>Expired: {formatDate(key.expiresAt)}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Documentation */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium">API Usage</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Include your API key in the Authorization header:</p>
            <code className="block p-2 bg-muted rounded text-xs">
              Authorization: Bearer YOUR_API_KEY
            </code>
            <p>Base URL: <code>{window.location.origin}/api</code></p>
            <p>Available endpoints: GET /prompts, POST /prompts, PUT /prompts/:id, DELETE /prompts/:id</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
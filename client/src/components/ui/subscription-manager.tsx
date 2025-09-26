import { useState } from 'react';
import { Check, Crown, Users, Building, Zap, Calendar, TrendingUp } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SubscriptionTier, UserSubscription, UsageMetric } from '@shared/schema';

interface SubscriptionManagerProps {
  className?: string;
}

interface ExtendedTier extends Omit<SubscriptionTier, 'features'> {
  isPopular?: boolean;
  description?: string;
  features?: string[];
  maxFolders?: number;
  exportFormats?: string[];
}

interface ExtendedSubscription extends UserSubscription {
  billingCycle?: 'monthly' | 'yearly';
  tier?: ExtendedTier;
}

interface UsageData {
  promptsUsed: number;
  foldersUsed: number;
  exportsUsed: number;
  apiCallsUsed: number;
  storageUsed: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

const getTierIcon = (tierName: string) => {
  const iconClass = "w-5 h-5";
  switch (tierName.toLowerCase()) {
    case 'free':
      return <Zap className={iconClass} />;
    case 'pro':
      return <Crown className={iconClass} />;
    case 'team':
      return <Users className={iconClass} />;
    case 'enterprise':
      return <Building className={iconClass} />;
    default:
      return <Zap className={iconClass} />;
  }
};

const getTierColor = (tierName: string) => {
  switch (tierName.toLowerCase()) {
    case 'free':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    case 'pro':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300';
    case 'team':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300';
    case 'enterprise':
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  }
};

const formatPrice = (price: number | null, billingCycle: 'monthly' | 'yearly') => {
  if (!price || price === 0) return 'Free';
  const formattedPrice = (price / 100).toLocaleString(); // Convert from cents
  return billingCycle === 'yearly' ? `$${formattedPrice}/year` : `$${formattedPrice}/month`;
};

const calculateProgress = (used: number, limit: number | null) => {
  if (limit == null || limit === -1) return 0; // Unlimited
  return Math.min((used / limit) * 100, 100);
};

const formatLimit = (limit: number | null) => {
  if (limit == null || limit === -1) return 'Unlimited';
  return limit.toLocaleString();
};

export function SubscriptionManager({ className }: SubscriptionManagerProps) {
  const [isYearly, setIsYearly] = useState(false);
  const { toast } = useToast();

  // Fetch current subscription
  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery<ExtendedSubscription>({
    queryKey: ['/api/subscription/current'],
  });

  // Fetch available tiers
  const { data: availableTiers = [], isLoading: tiersLoading } = useQuery<ExtendedTier[]>({
    queryKey: ['/api/subscription/tiers'],
  });

  // Fetch usage metrics
  const { data: usage, isLoading: usageLoading } = useQuery<UsageData>({
    queryKey: ['/api/usage/current'],
  });

  // Upgrade/downgrade subscription mutation
  const upgradeMutation = useMutation({
    mutationFn: async ({ tierId, billingCycle }: { tierId: string; billingCycle: 'monthly' | 'yearly' }) => {
      const res = await apiRequest('POST', '/api/subscription/checkout', { tierId, billingCycle });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        // Redirect to external checkout (e.g., Stripe)
        window.location.href = data.checkoutUrl;
      } else {
        // Internal processing completed
        queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
        queryClient.invalidateQueries({ queryKey: ['/api/usage/current'] });
        toast({
          title: "Subscription Updated",
          description: "Your subscription has been updated successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    }
  });

  // Billing portal mutation
  const billingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/subscription/billing-portal', {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.portalUrl) {
        window.location.href = data.portalUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to access billing portal",
        variant: "destructive",
      });
    }
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/subscription/cancel', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/usage/current'] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled and will end at the current period end",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    }
  });

  // Handle tier upgrade/downgrade
  const handleTierChange = (tierId: string) => {
    upgradeMutation.mutate({ tierId, billingCycle: isYearly ? 'yearly' : 'monthly' });
  };

  // Calculate savings for yearly billing
  const calculateYearlySavings = (tier: ExtendedTier) => {
    const monthlyPrice = tier.priceMonthly || 0;
    const yearlyPrice = tier.priceYearly || 0;
    if (monthlyPrice === 0) return 0;
    const monthlyTotal = monthlyPrice * 12;
    const savings = monthlyTotal - yearlyPrice;
    return Math.round((savings / monthlyTotal) * 100);
  };

  const currentTier = currentSubscription?.tier;

  if (subscriptionLoading || tiersLoading || usageLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-md w-1/3"></div>
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Current Subscription Status */}
      {currentSubscription && (
        <Card data-testid="card-current-subscription">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "rounded-full p-2",
                  getTierColor(currentTier?.name || 'free')
                )}>
                  {getTierIcon(currentTier?.name || 'free')}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    Current Plan: {currentTier?.name || 'Free'}
                  </CardTitle>
                  <CardDescription>
                    {formatPrice(
                      currentSubscription.billingCycle === 'yearly' 
                        ? currentTier?.priceYearly || 0 
                        : currentTier?.priceMonthly || 0,
                      currentSubscription.billingCycle || 'monthly'
                    )}
                    {currentSubscription.status === 'trial' && (
                      <Badge className="ml-2" variant="secondary">Trial</Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}
                data-testid={`badge-status-${currentSubscription.status}`}
              >
                {currentSubscription.status}
              </Badge>
            </div>
          </CardHeader>
          
          {/* Usage Metrics */}
          {usage && (
            <CardContent className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Current Usage</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Prompts</span>
                    <span>{usage.promptsUsed} / {formatLimit(currentTier?.maxPrompts ?? null)}</span>
                  </div>
                  <Progress 
                    value={calculateProgress(usage.promptsUsed, currentTier?.maxPrompts ?? null)}
                    data-testid="progress-prompts"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Collections</span>
                    <span>{usage.foldersUsed} / {formatLimit(currentTier?.maxCollections ?? null)}</span>
                  </div>
                  <Progress 
                    value={calculateProgress(usage.foldersUsed, currentTier?.maxCollections ?? null)}
                    data-testid="progress-folders"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Exports</span>
                    <span>{usage.exportsUsed}</span>
                  </div>
                  <Progress 
                    value={calculateProgress(usage.exportsUsed, null)} // Unlimited for now
                    data-testid="progress-exports"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>API Calls</span>
                    <span>{usage.apiCallsUsed}</span>
                  </div>
                  <Progress 
                    value={calculateProgress(usage.apiCallsUsed, null)} // Unlimited for now
                    data-testid="progress-api-calls"
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Billing Toggle */}
      <div className="flex items-center justify-center space-x-4">
        <span className={cn("text-sm", !isYearly && "text-primary font-medium")}>
          Monthly
        </span>
        <Switch
          data-testid="switch-billing-cycle"
          checked={isYearly}
          onCheckedChange={setIsYearly}
        />
        <span className={cn("text-sm", isYearly && "text-primary font-medium")}>
          Yearly
        </span>
        {isYearly && (
          <Badge variant="secondary" className="ml-2">
            Save up to 20%
          </Badge>
        )}
      </div>

      {/* Subscription Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {availableTiers.map((tier) => {
          const isCurrentTier = currentTier?.id === tier.id;
          const price = isYearly ? tier.priceYearly : tier.priceMonthly;
          const savings = calculateYearlySavings(tier);
          
          return (
            <Card 
              key={tier.id}
              data-testid={`card-tier-${tier.name.toLowerCase()}`}
              className={cn(
                "relative transition-all duration-300 hover:shadow-lg",
                tier.isPopular && "ring-2 ring-primary",
                isCurrentTier && "border-primary bg-primary/5"
              )}
            >
              {tier.isPopular && (
                <Badge 
                  className="absolute -top-2 left-1/2 transform -translate-x-1/2"
                  data-testid="badge-popular"
                >
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  <div className={cn(
                    "rounded-full p-3",
                    getTierColor(tier.name)
                  )}>
                    {getTierIcon(tier.name)}
                  </div>
                </div>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description || `${tier.name} plan for your needs`}</CardDescription>
                <div className="mt-4">
                  <div className="text-3xl font-bold">
                    {formatPrice(price, isYearly ? 'yearly' : 'monthly')}
                  </div>
                  {isYearly && savings > 0 && (
                    <div className="text-sm text-green-600 font-medium">
                      Save {savings}% annually
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Features List */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Features</h4>
                  <ul className="space-y-1 text-sm">
                    {(tier.features || ['Basic features']).map((feature, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Separator />
                
                {/* Limits */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Prompts</span>
                    <span className="font-medium">{formatLimit(tier.maxPrompts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Collections</span>
                    <span className="font-medium">{formatLimit(tier.maxCollections)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Collaborators</span>
                    <span className="font-medium">{formatLimit(tier.maxCollaborators)}</span>
                  </div>
                </div>
                
                <Button
                  data-testid={`button-select-${tier.name.toLowerCase()}`}
                  className="w-full"
                  variant={isCurrentTier ? "secondary" : tier.isPopular ? "default" : "outline"}
                  disabled={isCurrentTier || upgradeMutation.isPending}
                  onClick={() => !isCurrentTier && handleTierChange(tier.id)}
                >
                  {isCurrentTier ? 'Current Plan' : (tier.priceMonthly || 0) === 0 ? 'Get Started' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Billing Information */}
      {currentSubscription && (
        <Card data-testid="card-billing-info">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Billing Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Current Period:</span>
                <div className="font-medium">
                  {new Date(currentSubscription.currentPeriodStart).toLocaleDateString()} - {' '}
                  {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Billing Cycle:</span>
                <div className="font-medium capitalize">
                  {currentSubscription.billingCycle || 'monthly'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Next Billing Date:</span>
                <div className="font-medium">
                  {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Amount:</span>
                <div className="font-medium">
                  {formatPrice(
                    currentSubscription.billingCycle === 'yearly' 
                      ? currentTier?.priceYearly || 0 
                      : currentTier?.priceMonthly || 0,
                    currentSubscription.billingCycle || 'monthly'
                  )}
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-billing-portal"
                disabled={billingMutation.isPending}
                onClick={() => billingMutation.mutate()}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-cancel-subscription"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (confirm('Are you sure you want to cancel your subscription?')) {
                    cancelMutation.mutate();
                  }
                }}
              >
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
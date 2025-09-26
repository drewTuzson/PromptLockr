import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Heart, 
  FileText, 
  Folder, 
  User,
  Share,
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { ActivityFeed as ActivityFeedType } from '@shared/schema';

interface ActivityFeedProps {
  className?: string;
  maxHeight?: string;
}

interface ActivityFeedItem extends ActivityFeedType {
  actor?: {
    id: string;
    email: string;
    username?: string;
  };
  target?: {
    id: string;
    title?: string;
    name?: string;
  };
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'created_prompt':
      return FileText;
    case 'created_collection':
      return Folder;
    case 'liked':
      return Heart;
    case 'followed':
      return User;
    case 'shared':
      return Share;
    default:
      return Activity;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'created_prompt':
      return 'text-blue-600 dark:text-blue-400';
    case 'created_collection':
      return 'text-green-600 dark:text-green-400';
    case 'liked':
      return 'text-red-600 dark:text-red-400';
    case 'followed':
      return 'text-purple-600 dark:text-purple-400';
    case 'shared':
      return 'text-orange-600 dark:text-orange-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const getActionText = (action: string, targetType?: string | null) => {
  switch (action) {
    case 'created_prompt':
      return 'created a new prompt';
    case 'created_collection':
      return 'created a new collection';
    case 'liked':
      return targetType === 'prompt' ? 'liked a prompt' : 'liked something';
    case 'followed':
      return 'followed a user';
    case 'shared':
      return targetType === 'prompt' ? 'shared a prompt' : 'shared something';
    default:
      return 'performed an action';
  }
};

const formatTimeAgo = (date: string | Date | null) => {
  if (!date) return 'Unknown time';
  
  const now = new Date();
  const activityDate = typeof date === 'string' ? new Date(date) : date;
  const diffInSeconds = Math.floor((now.getTime() - activityDate.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return activityDate.toLocaleDateString();
};

const getInitials = (email: string, username?: string) => {
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
};

export function ActivityFeed({ className, maxHeight = "400px" }: ActivityFeedProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>('all');

  // Fetch activity feed
  const { data: activities = [], isLoading, isError, error, refetch } = useQuery<ActivityFeedItem[]>({
    queryKey: ['/api/feed'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.action === filter;
  });

  const uniqueActions = Array.from(new Set(activities.map(a => a.action)));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Activity Feed</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-feed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Buttons */}
        {uniqueActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              data-testid="filter-all"
            >
              All
            </Button>
            {uniqueActions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant={filter === action ? 'default' : 'outline'}
                onClick={() => setFilter(action)}
                data-testid={`filter-${action}`}
              >
                {action.replace('_', ' ')}
              </Button>
            ))}
          </div>
        )}

        {/* Activity List */}
        <ScrollArea style={{ height: maxHeight }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8" data-testid="loading-activities">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Loading activities...</span>
            </div>
          ) : isError ? (
            <div className="text-center py-8" data-testid="status-feed-error">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load activities</p>
              <p className="text-sm text-muted-foreground mb-4">
                {(error as any)?.message || 'Unable to connect to the server'}
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-retry-feed">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p data-testid="text-no-activities">
                {activities.length === 0 ? "No activities yet. Follow some users to see their activities here!" : "No activities match your filter."}
              </p>
              {activities.length === 0 && (
                <p className="text-xs mt-2">
                  Activities from you and users you follow will appear here.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity) => {
                const ActionIcon = getActionIcon(activity.action);
                const isOwnActivity = activity.actorUserId === user?.id;

                return (
                  <div
                    key={activity.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors ${isOwnActivity ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                    data-testid={`activity-${activity.id}`}
                  >
                    {/* User Avatar */}
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(activity.actor?.email || '', activity.actor?.username)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Activity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">
                              {isOwnActivity ? 'You' : (activity.actor?.username || activity.actor?.email || 'Someone')}
                            </span>{' '}
                            <span className="text-muted-foreground">
                              {getActionText(activity.action, activity.targetType)}
                            </span>
                            {activity.target && (
                              <span className="font-medium ml-1">
                                "{activity.target.title || activity.target.name || 'Untitled'}"
                              </span>
                            )}
                          </p>
                          
                          {/* Metadata */}
                          {activity.metadata && typeof activity.metadata === 'object' && activity.metadata !== null && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {Object.entries(activity.metadata as Record<string, any>).map(([key, value]) => (
                                <span key={key} className="mr-3">
                                  {key}: {String(value)}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center space-x-2 mt-1">
                            <ActionIcon className={`w-3 h-3 ${getActionColor(activity.action)}`} />
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTimeAgo(activity.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Activity Type Badge */}
                        <Badge variant="secondary" className="shrink-0 ml-2">
                          {activity.targetType || 'general'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer Info */}
        <div className="text-center pt-2 border-t">
          <p className="text-xs text-muted-foreground" data-testid="text-activity-count">
            Showing {filteredActivities.length} of {activities.length} activities
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
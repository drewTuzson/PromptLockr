import { useState, useEffect } from 'react';
import { Bell, X, Check, Clock, User, FileText } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'system' | 'export_ready' | 'subscription';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    userId?: string;
    promptId?: string;
    exportId?: string;
    [key: string]: any;
  };
}

interface NotificationCenterProps {
  className?: string;
}

const getNotificationIcon = (type: Notification['type']) => {
  const iconClass = "w-4 h-4";
  switch (type) {
    case 'follow':
      return <User className={iconClass} />;
    case 'like':
      return <Check className={iconClass} />;
    case 'comment':
      return <FileText className={iconClass} />;
    case 'export_ready':
      return <FileText className={iconClass} />;
    case 'subscription':
      return <Clock className={iconClass} />;
    default:
      return <Bell className={iconClass} />;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'follow':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300';
    case 'like':
      return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300';
    case 'comment':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300';
    case 'export_ready':
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300';
    case 'subscription':
      return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
};

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Fetch notifications with real-time polling
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Poll every 30 seconds for real-time updates
    refetchIntervalInBackground: true,
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Mark notifications as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notificationIds })
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: "Notifications marked as read",
        description: "Your notifications have been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark notifications as read",
        variant: "destructive",
      });
    }
  });

  // Calculate unread count
  const typedNotifications = notifications as Notification[];
  const unreadCount = typedNotifications.filter((n: Notification) => !n.isRead).length;

  // Mark single notification as read
  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate([notificationId]);
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    const unreadIds = typedNotifications.filter((n: Notification) => !n.isRead).map((n: Notification) => n.id);
    if (unreadIds.length > 0) {
      markAsReadMutation.mutate(unreadIds);
    }
  };

  // Auto-refresh when notification center opens
  useEffect(() => {
    if (isOpen) {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  }, [isOpen]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="button-notifications"
          variant="ghost"
          size="sm"
          className={cn(
            "relative p-2 h-10 w-10 rounded-full hover:bg-accent hover:text-accent-foreground",
            className
          )}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              data-testid="badge-notification-count"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center bg-destructive text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 p-0"
        data-testid="dropdown-notifications"
      >
        <Card className="border-0 shadow-none">
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                data-testid="button-mark-all-read"
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAsReadMutation.isPending}
                className="text-sm"
              >
                Mark all read
              </Button>
            )}
          </div>
          
          <Separator />
          
          {/* Notifications List */}
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : typedNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications yet</p>
                  <p className="text-sm text-muted-foreground">We'll notify you when something happens</p>
                </div>
              ) : (
                <div className="divide-y">
                  {typedNotifications.map((notification: Notification) => (
                    <div
                      key={notification.id}
                      data-testid={`notification-${notification.id}`}
                      className={cn(
                        "p-4 hover:bg-accent transition-colors cursor-pointer relative",
                        !notification.isRead && "bg-accent/50"
                      )}
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Notification Icon */}
                        <div className={cn(
                          "rounded-full p-2 flex-shrink-0",
                          getNotificationColor(notification.type)
                        )}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        {/* Notification Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm line-clamp-1">
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatTimeAgo(notification.createdAt)}
                              </p>
                            </div>
                            
                            {/* Unread Indicator */}
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1 ml-2"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          
          {/* Footer */}
          {typedNotifications.length > 0 && (
            <>
              <Separator />
              <div className="p-4 pt-2">
                <Button
                  data-testid="button-view-all-notifications"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    setIsOpen(false);
                    // TODO: Navigate to full notifications page
                    toast({
                      title: "Coming Soon",
                      description: "Full notifications page will be available soon",
                    });
                  }}
                >
                  View All Notifications
                </Button>
              </div>
            </>
          )}
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
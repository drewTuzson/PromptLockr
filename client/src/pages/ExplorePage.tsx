import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobilePromptCard } from '@/components/mobile/MobilePromptCard';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Filter,
  TrendingUp,
  Clock,
  Star,
  Zap,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExplorePrompt {
  id: string;
  title: string;
  content: string;
  platform?: string;
  tags?: string[];
  isPublic: boolean;
  isFavorite?: boolean;
  likeCount: number;
  saveCount: number;
  remixCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  trendingScore?: number;
  createdAt: string;
  user: {
    id: string;
    username?: string;
    displayName?: string;
    avatar40Url?: string;
    hasCustomAvatar?: boolean;
    avatarGeneratedColor?: string;
  };
}

const TRENDING_CATEGORIES = [
  { id: 'all', label: 'All', icon: TrendingUp },
  { id: 'chatgpt', label: 'ChatGPT', icon: Zap },
  { id: 'claude', label: 'Claude', icon: Star },
  { id: 'midjourney', label: 'Midjourney', icon: Star },
  { id: 'dalle', label: 'DALL-E', icon: Star }
];

export function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('trending');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Fetch explore data
  const { data: exploreData, isLoading, refetch } = useQuery({
    queryKey: ['/api/explore', { category: selectedCategory, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/explore?${params}`);
      if (!response.ok) throw new Error('Failed to fetch explore data');
      return response.json();
    }
  });

  // Pull to refresh functionality
  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      
      currentY = e.touches[0].clientY;
      const diffY = currentY - startY;
      
      if (diffY > 0 && window.scrollY === 0) {
        e.preventDefault();
        if (diffY > 100) {
          setIsRefreshing(true);
        }
      }
    };

    const handleTouchEnd = () => {
      if (isPulling && isRefreshing) {
        refetch();
        setTimeout(() => setIsRefreshing(false), 1000);
      }
      isPulling = false;
      setIsRefreshing(false);
    };

    const options = { passive: false };
    
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove, options);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [refetch, isRefreshing]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleLike = async (promptId: string) => {
    try {
      await fetch(`/api/prompts/${promptId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to like prompt",
        variant: "destructive"
      });
    }
  };

  const handleSave = async (promptId: string) => {
    try {
      await fetch(`/api/prompts/${promptId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      });
    }
  };

  const handleShare = async (promptId: string) => {
    try {
      const prompt = exploreData?.trending?.find((p: ExplorePrompt) => p.id === promptId) ||
                   exploreData?.newest?.find((p: ExplorePrompt) => p.id === promptId) ||
                   exploreData?.popular?.find((p: ExplorePrompt) => p.id === promptId);
      
      if (prompt && navigator.share) {
        await navigator.share({
          title: prompt.title,
          text: prompt.content,
          url: `${window.location.origin}/shared/${promptId}`
        });
      }
    } catch (error) {
      // User cancelled or error occurred
    }
  };

  const renderPromptList = (prompts: ExplorePrompt[] = []) => (
    <div className="space-y-4">
      {prompts.map((prompt) => (
        <MobilePromptCard
          key={prompt.id}
          prompt={prompt}
          onLike={handleLike}
          onSave={handleSave}
          onShare={handleShare}
          className="mx-4"
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Pull to refresh indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary/90 text-white p-2 text-center">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Refreshing...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center space-x-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search prompts, users, tags..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4"
              data-testid="input-explore-search"
            />
          </div>
          <Button variant="outline" size="sm" data-testid="button-explore-filter">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Category filters */}
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {TRENDING_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="flex items-center space-x-1 whitespace-nowrap"
                data-testid={`button-explore-category-${category.id}`}
              >
                <Icon className="w-3 h-3" />
                <span>{category.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mx-4 mb-6">
            <TabsTrigger value="trending" className="flex items-center space-x-1" data-testid="tab-explore-trending">
              <TrendingUp className="w-4 h-4" />
              <span>Trending</span>
            </TabsTrigger>
            <TabsTrigger value="newest" className="flex items-center space-x-1" data-testid="tab-explore-newest">
              <Clock className="w-4 h-4" />
              <span>New</span>
            </TabsTrigger>
            <TabsTrigger value="popular" className="flex items-center space-x-1" data-testid="tab-explore-popular">
              <Star className="w-4 h-4" />
              <span>Popular</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="mt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div>
                {/* Featured trending prompt */}
                {exploreData?.trending?.[0] && (
                  <div className="mx-4 mb-6">
                    <div className="flex items-center space-x-2 mb-3">
                      <TrendingUp className="w-5 h-5 text-orange-500" />
                      <h2 className="text-lg font-semibold">🔥 Trending Now</h2>
                    </div>
                    <MobilePromptCard
                      prompt={exploreData.trending[0]}
                      onLike={handleLike}
                      onSave={handleSave}
                      onShare={handleShare}
                    />
                  </div>
                )}
                
                {/* Other trending prompts */}
                {exploreData?.trending?.length > 1 && (
                  <div>
                    <h3 className="text-md font-medium mx-4 mb-3">More Trending</h3>
                    {renderPromptList(exploreData.trending.slice(1))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="newest" className="mt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-2 mx-4 mb-4">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold">Latest Prompts</h2>
                </div>
                {renderPromptList(exploreData?.newest)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="popular" className="mt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-2 mx-4 mb-4">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-lg font-semibold">Most Popular</h2>
                </div>
                {renderPromptList(exploreData?.popular)}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Load more button */}
        {!isLoading && exploreData && (
          <div className="flex justify-center py-6">
            <Button variant="outline" className="flex items-center space-x-2" data-testid="button-explore-load-more">
              <ChevronDown className="w-4 h-4" />
              <span>Load More</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
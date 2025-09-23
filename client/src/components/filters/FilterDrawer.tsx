import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FilterIcon, XIcon, SearchIcon } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { MultiSelect } from './MultiSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PromptFilters } from '../../types/filters';

interface FilterDrawerProps {
  filters: PromptFilters;
  onFiltersChange: (filters: PromptFilters) => void;
  className?: string;
}

export function FilterDrawer({ filters, onFiltersChange, className }: FilterDrawerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [localFilters, setLocalFilters] = React.useState<PromptFilters>(filters);
  const [searchInput, setSearchInput] = React.useState(filters.search || '');

  // Update local filters when external filters change
  React.useEffect(() => {
    setLocalFilters(filters);
    setSearchInput(filters.search || '');
  }, [filters]);

  // Calculate active filter count
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (localFilters.search) count++;
    if (localFilters.platforms?.length) count++;
    if (localFilters.tags?.length) count++;
    if (localFilters.folders?.length) count++;
    if (localFilters.favoritesOnly) count++;
    if (localFilters.recentOnly) count++;
    if (localFilters.dateCreated) count++;
    if (localFilters.dateModified) count++;
    if (localFilters.lastUsed) count++;
    return count;
  }, [localFilters]);

  // Platform options
  const platformOptions = [
    { value: 'ChatGPT', label: 'ChatGPT' },
    { value: 'Claude', label: 'Claude' },
    { value: 'Midjourney', label: 'Midjourney' },
    { value: 'Gemini', label: 'Gemini' },
    { value: 'Perplexity', label: 'Perplexity' },
    { value: 'DALL-E', label: 'DALL-E' },
    { value: 'Stable Diffusion', label: 'Stable Diffusion' },
    { value: 'Leonardo AI', label: 'Leonardo AI' },
    { value: 'Custom/Other', label: 'Custom/Other' }
  ];

  // Tag options (in real app, these would come from API)
  const tagOptions = [
    { value: 'productivity', label: 'Productivity' },
    { value: 'creative', label: 'Creative' },
    { value: 'coding', label: 'Coding' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'writing', label: 'Writing' },
    { value: 'business', label: 'Business' }
  ];

  const updateLocalFilters = (updates: Partial<PromptFilters>) => {
    setLocalFilters(prev => ({ ...prev, ...updates }));
  };

  const applyFilters = () => {
    const filtersToApply = {
      ...localFilters,
      search: searchInput || undefined
    };
    onFiltersChange(filtersToApply);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setLocalFilters({});
    setSearchInput('');
    onFiltersChange({});
  };

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      updateLocalFilters({ search: searchInput || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button 
          variant="outline" 
          className={`flex items-center gap-2 ${className || ''}`}
          data-testid="button-filter-drawer"
        >
          <FilterIcon className="w-4 h-4" />
          Filter
          {activeFilterCount > 0 && (
            <Badge 
              variant="secondary" 
              className="px-2 py-0.5 text-xs rounded-full"
              data-testid="badge-active-filters"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-background shadow-xl border-l z-50 flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-card/50">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              Search & Filter
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" className="p-2">
                <XIcon className="w-4 h-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Search</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search prompts, tags, or content..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
                {searchInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchInput('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 h-auto"
                    data-testid="button-clear-search"
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Quick Filters</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.favoritesOnly || false}
                    onChange={(e) => updateLocalFilters({
                      favoritesOnly: e.target.checked || undefined
                    })}
                    className="rounded border-border"
                    data-testid="checkbox-favorites-only"
                  />
                  <span className="text-sm text-foreground">Favorites Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.recentOnly || false}
                    onChange={(e) => updateLocalFilters({
                      recentOnly: e.target.checked || undefined
                    })}
                    className="rounded border-border"
                    data-testid="checkbox-recent-only"
                  />
                  <span className="text-sm text-foreground">Recent Only</span>
                </label>
              </div>
            </div>

            {/* Platform Filter */}
            <div className="space-y-2">
              <MultiSelect
                label="Platforms"
                options={platformOptions}
                selectedValues={localFilters.platforms || []}
                onChange={(platforms) => updateLocalFilters({ platforms })}
                placeholder="Select platforms..."
              />
            </div>

            {/* Tags Filter */}
            <div className="space-y-2">
              <MultiSelect
                label="Tags"
                options={tagOptions}
                selectedValues={localFilters.tags || []}
                onChange={(tags) => updateLocalFilters({ tags })}
                placeholder="Select tags..."
              />
            </div>

            {/* Folders Filter */}
            <div className="space-y-2">
              <MultiSelect
                label="Folders"
                options={[
                  { value: 'work', label: 'Work' },
                  { value: 'personal', label: 'Personal' },
                  { value: 'projects', label: 'Projects' },
                  { value: 'archive', label: 'Archive' }
                ]}
                selectedValues={localFilters.folders || []}
                onChange={(folders) => updateLocalFilters({ folders })}
                placeholder="Select folders..."
              />
            </div>

            {/* Date Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">Date Filters</Label>
              
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Created Date</Label>
                <DateRangePicker
                  label="Created Date"
                  startDate={typeof localFilters.dateCreated?.start === 'string' ? new Date(localFilters.dateCreated.start) : localFilters.dateCreated?.start}
                  endDate={typeof localFilters.dateCreated?.end === 'string' ? new Date(localFilters.dateCreated.end) : localFilters.dateCreated?.end}
                  onDateChange={(start, end) => updateLocalFilters({
                    dateCreated: start || end ? { start: start?.toISOString(), end: end?.toISOString() } : undefined
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Modified Date</Label>
                <DateRangePicker
                  label="Modified Date"
                  startDate={typeof localFilters.dateModified?.start === 'string' ? new Date(localFilters.dateModified.start) : localFilters.dateModified?.start}
                  endDate={typeof localFilters.dateModified?.end === 'string' ? new Date(localFilters.dateModified.end) : localFilters.dateModified?.end}
                  onDateChange={(start, end) => updateLocalFilters({
                    dateModified: start || end ? { start: start?.toISOString(), end: end?.toISOString() } : undefined
                  })}
                />
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Sort By</Label>
              <select
                value={`${localFilters.sortBy || 'updatedAt'}-${localFilters.sortOrder || 'desc'}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  updateLocalFilters({ 
                    sortBy: sortBy as 'createdAt' | 'updatedAt' | 'title' | 'lastUsed', 
                    sortOrder: sortOrder as 'asc' | 'desc' 
                  });
                }}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="select-sort-by"
              >
                <option value="updatedAt-desc">Recently Modified</option>
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
                <option value="lastUsed-desc">Recently Used</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-card/50 space-y-3">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full"
              data-testid="button-clear-all-filters"
            >
              Clear All Filters
            </Button>
            <Button
              onClick={applyFilters}
              className="w-full"
              data-testid="button-apply-filters"
            >
              Apply Filters
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
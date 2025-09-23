import * as React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { SearchIcon, FilterIcon, XIcon } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { MultiSelect } from './MultiSelect';
import { PromptFilters, FILTER_PRESETS } from '../../types/filters';

interface AdvancedSearchFiltersProps {
  onFiltersChange: (filters: PromptFilters) => void;
  initialFilters?: PromptFilters;
}

export function AdvancedSearchFilters({ 
  onFiltersChange, 
  initialFilters = {} 
}: AdvancedSearchFiltersProps) {
  const [filters, setFilters] = React.useState<PromptFilters>(initialFilters);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState(filters.search || '');

  // Calculate active filter count
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.platforms?.length) count++;
    if (filters.tags?.length) count++;
    if (filters.folders?.length) count++;
    if (filters.favoritesOnly) count++;
    if (filters.recentOnly) count++;
    if (filters.dateCreated) count++;
    if (filters.dateModified) count++;
    if (filters.lastUsed) count++;
    return count;
  }, [filters]);

  // Get available options from your data
  const platformOptions = [
    { value: 'ChatGPT', label: 'ChatGPT', count: 42 },
    { value: 'Claude', label: 'Claude', count: 38 },
    { value: 'Midjourney', label: 'Midjourney', count: 15 },
    { value: 'Gemini', label: 'Gemini', count: 12 },
    { value: 'Perplexity', label: 'Perplexity', count: 8 },
    { value: 'DALL-E', label: 'DALL-E', count: 6 },
    { value: 'Custom/Other', label: 'Custom/Other', count: 5 },
  ];

  // Mock tag options - in real app you'd get these from API
  const tagOptions = [
    { value: 'productivity', label: 'Productivity', count: 25 },
    { value: 'creative', label: 'Creative', count: 18 },
    { value: 'coding', label: 'Coding', count: 22 },
    { value: 'marketing', label: 'Marketing', count: 15 },
    { value: 'analysis', label: 'Analysis', count: 12 },
  ];

  // Update filters and notify parent
  const updateFilters = (updates: Partial<PromptFilters>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        updateFilters({ search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({});
    setSearchInput('');
    onFiltersChange({});
  };

  // Apply preset
  const applyPreset = (preset: typeof FILTER_PRESETS[0]) => {
    const newFilters = { ...filters, ...preset.filters };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <div className="space-y-4 p-4 bg-white dark:bg-gray-900 rounded-lg border 
                    border-gray-200 dark:border-gray-700">
      
      {/* Search Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 
                              w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          data-testid="input-search"
          className="w-full pl-10 pr-10 py-2 border rounded-lg bg-white dark:bg-gray-800 
                   border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 
                   focus:border-transparent"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            data-testid="button-clear-search"
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <XIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Quick Presets */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            data-testid={`button-preset-${preset.id}`}
            className="px-3 py-1 text-sm border rounded-full hover:bg-gray-50 
                     dark:hover:bg-gray-800 transition-colors"
          >
            {preset.icon} {preset.name}
          </button>
        ))}
      </div>

      {/* Advanced Filters Toggle */}
      <Collapsible.Root open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between">
          <Collapsible.Trigger asChild>
            <button 
              data-testid="button-toggle-advanced-filters"
              className="flex items-center gap-2 text-sm font-medium text-blue-600 
                       hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <FilterIcon className="w-4 h-4" />
              Advanced Filters
              {activeFilterCount > 0 && (
                <span 
                  data-testid="text-active-filter-count"
                  className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 
                           text-blue-700 dark:text-blue-300 rounded-full"
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </Collapsible.Trigger>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              data-testid="button-clear-all-filters"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 
                       dark:hover:text-white"
            >
              Clear all
            </button>
          )}
        </div>

        <Collapsible.Content className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Date Filters */}
            <DateRangePicker
              label="Created Date"
              startDate={filters.dateCreated?.start instanceof Date ? filters.dateCreated.start : filters.dateCreated?.start ? new Date(filters.dateCreated.start) : undefined}
              endDate={filters.dateCreated?.end instanceof Date ? filters.dateCreated.end : filters.dateCreated?.end ? new Date(filters.dateCreated.end) : undefined}
              onDateChange={(start, end) => 
                updateFilters({ dateCreated: start || end ? { start, end } : undefined })
              }
            />

            <DateRangePicker
              label="Modified Date"
              startDate={filters.dateModified?.start instanceof Date ? filters.dateModified.start : filters.dateModified?.start ? new Date(filters.dateModified.start) : undefined}
              endDate={filters.dateModified?.end instanceof Date ? filters.dateModified.end : filters.dateModified?.end ? new Date(filters.dateModified.end) : undefined}
              onDateChange={(start, end) => 
                updateFilters({ dateModified: start || end ? { start, end } : undefined })
              }
            />

            <DateRangePicker
              label="Last Used"
              startDate={filters.lastUsed?.start instanceof Date ? filters.lastUsed.start : filters.lastUsed?.start ? new Date(filters.lastUsed.start) : undefined}
              endDate={filters.lastUsed?.end instanceof Date ? filters.lastUsed.end : filters.lastUsed?.end ? new Date(filters.lastUsed.end) : undefined}
              onDateChange={(start, end) => 
                updateFilters({ lastUsed: start || end ? { start, end } : undefined })
              }
            />

            {/* Multi-Select Filters */}
            <MultiSelect
              label="Platforms"
              options={platformOptions}
              selectedValues={filters.platforms || []}
              onChange={(platforms) => 
                updateFilters({ platforms: platforms.length > 0 ? platforms : undefined })
              }
            />

            <MultiSelect
              label="Tags"
              options={tagOptions}
              selectedValues={filters.tags || []}
              onChange={(tags) => 
                updateFilters({ tags: tags.length > 0 ? tags : undefined })
              }
            />

            {/* Boolean Filters */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick Filters
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.favoritesOnly || false}
                    onChange={(e) => updateFilters({ favoritesOnly: e.target.checked || undefined })}
                    data-testid="checkbox-favorites-only"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Favorites Only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.recentOnly || false}
                    onChange={(e) => updateFilters({ recentOnly: e.target.checked || undefined })}
                    data-testid="checkbox-recent-only"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Recent Only (7 days)</span>
                </label>
              </div>
            </div>

            {/* Sort Options */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort By
              </label>
              <select
                value={`${filters.sortBy || 'updatedAt'}-${filters.sortOrder || 'desc'}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-') as any;
                  updateFilters({ sortBy, sortOrder });
                }}
                data-testid="select-sort-by"
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 
                         border-gray-300 dark:border-gray-600"
              >
                <option value="updatedAt-desc">Recently Modified</option>
                <option value="updatedAt-asc">Oldest Modified</option>
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="lastUsed-desc">Recently Used</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                {filters.search && (
                  <span className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full 
                                 flex items-center gap-1">
                    Search: "{filters.search}"
                    <button 
                      onClick={() => updateFilters({ search: undefined })}
                      data-testid="button-remove-search-filter"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.platforms?.map(platform => (
                  <span key={platform} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 
                                                rounded-full flex items-center gap-1">
                    {platform}
                    <button 
                      onClick={() => 
                        updateFilters({ 
                          platforms: filters.platforms?.filter(p => p !== platform) 
                        })
                      }
                      data-testid={`button-remove-platform-${platform}`}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {filters.tags?.map(tag => (
                  <span key={tag} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 
                                          rounded-full flex items-center gap-1">
                    {tag}
                    <button 
                      onClick={() => 
                        updateFilters({ 
                          tags: filters.tags?.filter(t => t !== tag) 
                        })
                      }
                      data-testid={`button-remove-tag-${tag}`}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {/* Add more filter chips as needed */}
              </div>
            </div>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
// Import shared types from server
import type { PromptFilters } from '../../../shared/types/filters';

// Re-export for convenience
export type { PromptFilters };

// UI-specific filter state
export interface FilterUIState extends PromptFilters {
  isExpanded?: boolean;
  activeFilterCount?: number;
}

// Filter presets for quick access
export interface FilterPreset {
  id: string;
  name: string;
  icon?: string;
  filters: Partial<PromptFilters>;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'recent',
    name: 'Recently Used',
    icon: '🕐',
    filters: { recentOnly: true, sortBy: 'lastUsed', sortOrder: 'desc' }
  },
  {
    id: 'favorites',
    name: 'Favorites',
    icon: '⭐',
    filters: { favoritesOnly: true }
  },
  {
    id: 'this-week',
    name: 'Created This Week',
    icon: '📅',
    filters: {
      dateCreated: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    }
  }
];
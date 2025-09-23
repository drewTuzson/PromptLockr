export interface PromptFilters {
  search?: string;
  dateCreated?: {
    start?: Date | string;
    end?: Date | string;
  };
  dateModified?: {
    start?: Date | string;
    end?: Date | string;
  };
  lastUsed?: {
    start?: Date | string;
    end?: Date | string;
  };
  platforms?: string[];
  tags?: string[];
  folders?: string[];
  favoritesOnly?: boolean;
  recentOnly?: boolean;
  enhanced?: boolean;
  trashedOnly?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastUsed' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface FilterValidationResult {
  valid: boolean;
  errors?: string[];
  sanitized?: PromptFilters;
}
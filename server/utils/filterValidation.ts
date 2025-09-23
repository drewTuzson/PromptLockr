import { PromptFilters, FilterValidationResult } from '../../shared/types/filters.js';

export function validateAndSanitizeFilters(query: any): FilterValidationResult {
  const errors: string[] = [];
  const sanitized: PromptFilters = {};

  // Parse search string
  if (query.search) {
    sanitized.search = String(query.search).trim();
  }

  // Parse date ranges
  const parseDateRange = (startStr?: string, endStr?: string) => {
    const range: { start?: Date; end?: Date } = {};
    
    if (startStr) {
      const start = new Date(startStr);
      if (!isNaN(start.getTime())) {
        range.start = start;
      } else {
        errors.push(`Invalid start date: ${startStr}`);
      }
    }
    
    if (endStr) {
      const end = new Date(endStr);
      if (!isNaN(end.getTime())) {
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        range.end = end;
      } else {
        errors.push(`Invalid end date: ${endStr}`);
      }
    }
    
    return Object.keys(range).length > 0 ? range : undefined;
  };

  // Date filters
  if (query.dateCreatedStart || query.dateCreatedEnd) {
    const range = parseDateRange(query.dateCreatedStart, query.dateCreatedEnd);
    if (range) sanitized.dateCreated = range;
  }

  if (query.dateModifiedStart || query.dateModifiedEnd) {
    const range = parseDateRange(query.dateModifiedStart, query.dateModifiedEnd);
    if (range) sanitized.dateModified = range;
  }

  if (query.lastUsedStart || query.lastUsedEnd) {
    const range = parseDateRange(query.lastUsedStart, query.lastUsedEnd);
    if (range) sanitized.lastUsed = range;
  }

  // Array filters (comma-separated strings)
  if (query.platforms) {
    sanitized.platforms = String(query.platforms)
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  if (query.tags) {
    sanitized.tags = String(query.tags)
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  if (query.folders) {
    sanitized.folders = String(query.folders)
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  }

  // Boolean filters
  if (query.favoritesOnly === 'true' || query.favoritesOnly === true) {
    sanitized.favoritesOnly = true;
  }

  if (query.recentOnly === 'true' || query.recentOnly === true) {
    sanitized.recentOnly = true;
  }

  if (query.enhanced === 'true' || query.enhanced === true) {
    sanitized.enhanced = true;
  }

  if (query.trashedOnly === 'true' || query.trashedOnly === true) {
    sanitized.trashedOnly = true;
  }

  // Pagination
  if (query.limit) {
    const limit = parseInt(query.limit);
    if (!isNaN(limit) && limit > 0 && limit <= 100) {
      sanitized.limit = limit;
    } else {
      errors.push('Limit must be between 1 and 100');
    }
  }

  if (query.offset) {
    const offset = parseInt(query.offset);
    if (!isNaN(offset) && offset >= 0) {
      sanitized.offset = offset;
    } else {
      errors.push('Offset must be non-negative');
    }
  }

  // Sorting
  const validSortFields = ['createdAt', 'updatedAt', 'lastUsed', 'title'];
  if (query.sortBy && validSortFields.includes(query.sortBy)) {
    sanitized.sortBy = query.sortBy as any;
  }

  if (query.sortOrder === 'asc' || query.sortOrder === 'desc') {
    sanitized.sortOrder = query.sortOrder;
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    sanitized
  };
}
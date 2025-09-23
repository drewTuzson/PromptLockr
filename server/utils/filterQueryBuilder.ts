import { and, eq, like, gte, lte, inArray, isNull, desc, asc, sql } from 'drizzle-orm';
import { prompts } from '../../shared/schema.js';
import { PromptFilters } from '../../shared/types/filters.js';

export function buildFilterConditions(filters: PromptFilters, userId: string) {
  const conditions = [eq(prompts.userId, userId)];

  // Text search
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      sql`(${prompts.title} LIKE ${searchTerm} OR ${prompts.content} LIKE ${searchTerm} OR array_to_string(${prompts.tags}, ',') LIKE ${searchTerm})`
    );
  }

  // Date filters
  if (filters.dateCreated?.start) {
    const startDate = typeof filters.dateCreated.start === 'string' ? new Date(filters.dateCreated.start) : filters.dateCreated.start;
    conditions.push(gte(prompts.createdAt, startDate));
  }
  if (filters.dateCreated?.end) {
    const endDate = typeof filters.dateCreated.end === 'string' ? new Date(filters.dateCreated.end) : filters.dateCreated.end;
    conditions.push(lte(prompts.createdAt, endDate));
  }

  if (filters.dateModified?.start) {
    const startDate = typeof filters.dateModified.start === 'string' ? new Date(filters.dateModified.start) : filters.dateModified.start;
    conditions.push(gte(prompts.updatedAt, startDate));
  }
  if (filters.dateModified?.end) {
    const endDate = typeof filters.dateModified.end === 'string' ? new Date(filters.dateModified.end) : filters.dateModified.end;
    conditions.push(lte(prompts.updatedAt, endDate));
  }

  if (filters.lastUsed?.start) {
    const startDate = typeof filters.lastUsed.start === 'string' ? new Date(filters.lastUsed.start) : filters.lastUsed.start;
    conditions.push(gte(prompts.lastAccessed, startDate));
  }
  if (filters.lastUsed?.end) {
    const endDate = typeof filters.lastUsed.end === 'string' ? new Date(filters.lastUsed.end) : filters.lastUsed.end;
    conditions.push(lte(prompts.lastAccessed, endDate));
  }

  // Platform filter
  if (filters.platforms && filters.platforms.length > 0) {
    conditions.push(inArray(prompts.platform, filters.platforms as any));
  }

  // Folder filter
  if (filters.folders && filters.folders.length > 0) {
    conditions.push(inArray(prompts.folderId, filters.folders));
  }

  // Tags filter (PostgreSQL array contains check)
  if (filters.tags && filters.tags.length > 0) {
    const tagConditions = filters.tags.map(tag => 
      sql`${prompts.tags} @> ARRAY[${tag}]::text[]`
    );
    conditions.push(sql`(${sql.join(tagConditions, sql` OR `)})`);
  }

  // Boolean filters
  if (filters.favoritesOnly) {
    conditions.push(eq(prompts.isFavorite, true));
  }

  if (filters.recentOnly) {
    // Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    conditions.push(gte(prompts.lastAccessed, sevenDaysAgo));
  }

  // Trash filter
  if (filters.trashedOnly) {
    conditions.push(sql`${prompts.trashedAt} IS NOT NULL`);
  } else {
    conditions.push(isNull(prompts.trashedAt));
  }

  return and(...conditions);
}

export function buildOrderBy(filters: PromptFilters) {
  const field = filters.sortBy || 'updatedAt';
  const order = filters.sortOrder || 'desc';
  
  const fieldMap = {
    createdAt: prompts.createdAt,
    updatedAt: prompts.updatedAt,
    lastUsed: prompts.lastAccessed,
    title: prompts.title
  };

  const column = fieldMap[field as keyof typeof fieldMap];
  return order === 'desc' ? desc(column) : asc(column);
}
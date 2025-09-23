import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define enum for enhancement status
export const enhancementStatusEnum = pgEnum('enhancement_status', ['pending', 'success', 'failed']);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  preferences: text("preferences").$type<{
    theme: 'light' | 'dark';
    defaultPlatform?: string;
  }>(),
});

export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const prompts = pgTable("prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  platform: text("platform").$type<'ChatGPT' | 'Claude' | 'Perplexity' | 'Gemini' | 'Mistral' | 'Midjourney' | 'DALL-E' | 'Stable Diffusion' | 'Leonardo AI' | 'Llama' | 'Cohere' | 'Custom/Other'>().notNull(),
  tags: text("tags").$type<string[]>().array(),
  folderId: varchar("folder_id"),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessed: timestamp("last_accessed").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  trashedAt: timestamp("trashed_at"),
  charCount: varchar("char_count"),
  // Enhancement fields
  enhancementHistory: text("enhancement_history").default('[]'), // JSON string storing enhancement history
  enhancementCount: integer("enhancement_count").default(0),
  originalPromptId: varchar("original_prompt_id"), // Self-reference handled in relations
  isEnhanced: boolean("is_enhanced").default(false),
});

export const enhancementSessions = pgTable("enhancement_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  promptId: varchar("prompt_id").references(() => prompts.id, { onDelete: 'set null' }),
  originalContent: text("original_content").notNull(),
  enhancedContent: text("enhanced_content"),
  platform: text("platform"),
  status: enhancementStatusEnum('status').default('pending'),
  errorMessage: text("error_message"),
  apiResponseTime: integer("api_response_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  enhancementCount: integer("enhancement_count").default(0),
  windowStart: timestamp("window_start").defaultNow(),
  lastReset: timestamp("last_reset").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  passwordHash: true,
  preferences: true,
});

export const insertFolderSchema = createInsertSchema(folders).pick({
  userId: true,
  name: true,
  parentId: true,
});

export const insertPromptSchema = createInsertSchema(prompts).pick({
  userId: true,
  title: true,
  content: true,
  platform: true,
  tags: true,
  folderId: true,
  isFavorite: true,
});

export const insertEnhancementSessionSchema = createInsertSchema(enhancementSessions).pick({
  userId: true,
  promptId: true,
  originalContent: true,
  enhancedContent: true,
  platform: true,
  status: true,
});

export const insertRateLimitSchema = createInsertSchema(rateLimits).pick({
  userId: true,
  enhancementCount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type Prompt = typeof prompts.$inferSelect;
export type InsertEnhancementSession = z.infer<typeof insertEnhancementSessionSchema>;
export type EnhancementSession = typeof enhancementSessions.$inferSelect;
export type InsertRateLimit = z.infer<typeof insertRateLimitSchema>;
export type RateLimit = typeof rateLimits.$inferSelect;

// Frontend-specific schema (without userId - added by backend auth)
export const createPromptSchema = insertPromptSchema.omit({ userId: true });
export type CreatePrompt = z.infer<typeof createPromptSchema>;

export const createFolderSchema = insertFolderSchema.omit({ userId: true });
export type CreateFolder = z.infer<typeof createFolderSchema>;

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginData = z.infer<typeof loginSchema>;
export type SignupData = z.infer<typeof signupSchema>;

// Enhancement schemas
export const enhancePromptSchema = z.object({
  platform: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'academic', 'creative']).optional(),
  focus: z.enum(['clarity', 'engagement', 'specificity', 'structure']).optional(),
});

export const enhanceNewPromptSchema = z.object({
  content: z.string().min(1).max(10000), // Limit content size
  platform: z.string().optional(),
  tone: z.enum(['professional', 'casual', 'academic', 'creative']).optional(),
  focus: z.enum(['clarity', 'engagement', 'specificity', 'structure']).optional(),
});

export type EnhancePrompt = z.infer<typeof enhancePromptSchema>;
export type EnhanceNewPrompt = z.infer<typeof enhanceNewPromptSchema>;

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  folders: many(folders),
  prompts: many(prompts),
  enhancementSessions: many(enhancementSessions),
  rateLimit: one(rateLimits),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, {
    fields: [folders.userId],
    references: [users.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
  }),
  children: many(folders),
  prompts: many(prompts),
}));

export const promptsRelations = relations(prompts, ({ one, many }) => ({
  user: one(users, {
    fields: [prompts.userId],
    references: [users.id],
  }),
  folder: one(folders, {
    fields: [prompts.folderId],
    references: [folders.id],
  }),
  originalPrompt: one(prompts, {
    fields: [prompts.originalPromptId],
    references: [prompts.id],
  }),
  enhancedPrompts: many(prompts),
  enhancementSessions: many(enhancementSessions),
}));

export const enhancementSessionsRelations = relations(enhancementSessions, ({ one }) => ({
  user: one(users, {
    fields: [enhancementSessions.userId],
    references: [users.id],
  }),
  prompt: one(prompts, {
    fields: [enhancementSessions.promptId],
    references: [prompts.id],
  }),
}));

export const rateLimitsRelations = relations(rateLimits, ({ one }) => ({
  user: one(users, {
    fields: [rateLimits.userId],
    references: [users.id],
  }),
}));

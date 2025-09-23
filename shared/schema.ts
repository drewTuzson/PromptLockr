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
  userId: varchar("user_id").primaryKey(),
  enhancementCount: integer("enhancement_count").default(0),
  windowStart: timestamp("window_start").defaultNow(),
  lastReset: timestamp("last_reset").defaultNow(),
});

// Define enum for template variable types
export const variableTypeEnum = pgEnum('variable_type', ['text', 'dropdown', 'number', 'date', 'boolean']);

export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  category: text("category"),
  tags: text("tags").$type<string[]>().array().default(sql`'{}'`),
  isPublic: boolean("is_public").default(false),
  useCount: integer("use_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const templateVariables = pgTable("template_variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => templates.id, { onDelete: 'cascade' }),
  variableName: text("variable_name").notNull(),
  variableType: variableTypeEnum('variable_type').default('text'),
  required: boolean("required").default(true),
  defaultValue: text("default_value"),
  options: text("options").$type<string[]>().array(), // JSON array for dropdown options
  description: text("description"),
  minValue: integer("min_value"), // For number type
  maxValue: integer("max_value"), // For number type
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const templateUsage = pgTable("template_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => templates.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  promptId: varchar("prompt_id").references(() => prompts.id, { onDelete: 'set null' }),
  variableValues: text("variable_values").notNull(), // JSON object of variable values
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertTemplateSchema = createInsertSchema(templates).pick({
  userId: true,
  title: true,
  description: true,
  content: true,
  category: true,
  tags: true,
  isPublic: true,
});

export const insertTemplateVariableSchema = createInsertSchema(templateVariables).pick({
  templateId: true,
  variableName: true,
  variableType: true,
  required: true,
  defaultValue: true,
  options: true,
  description: true,
  minValue: true,
  maxValue: true,
  sortOrder: true,
});

export const insertTemplateUsageSchema = createInsertSchema(templateUsage).pick({
  templateId: true,
  userId: true,
  promptId: true,
  variableValues: true,
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
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertTemplateVariable = z.infer<typeof insertTemplateVariableSchema>;
export type TemplateVariable = typeof templateVariables.$inferSelect;
export type InsertTemplateUsage = z.infer<typeof insertTemplateUsageSchema>;
export type TemplateUsage = typeof templateUsage.$inferSelect;

// Frontend-specific schema (without userId - added by backend auth)
export const createPromptSchema = insertPromptSchema.omit({ userId: true });
export type CreatePrompt = z.infer<typeof createPromptSchema>;

export const createFolderSchema = insertFolderSchema.omit({ userId: true });
export type CreateFolder = z.infer<typeof createFolderSchema>;

export const createTemplateSchema = insertTemplateSchema.omit({ userId: true });
export type CreateTemplate = z.infer<typeof createTemplateSchema>;

export const createTemplateVariableSchema = insertTemplateVariableSchema.omit({ templateId: true });
export type CreateTemplateVariable = z.infer<typeof createTemplateVariableSchema>;

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

// Template processing schemas
export const instantiateTemplateSchema = z.object({
  templateId: z.string(),
  variableValues: z.record(z.any()),
  targetFolder: z.string().optional(),
  title: z.string().optional(),
});

export type InstantiateTemplate = z.infer<typeof instantiateTemplateSchema>;

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  folders: many(folders),
  prompts: many(prompts),
  enhancementSessions: many(enhancementSessions),
  rateLimit: one(rateLimits),
  templates: many(templates),
  templateUsage: many(templateUsage),
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

export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(users, {
    fields: [templates.userId],
    references: [users.id],
  }),
  variables: many(templateVariables),
  usage: many(templateUsage),
}));

export const templateVariablesRelations = relations(templateVariables, ({ one }) => ({
  template: one(templates, {
    fields: [templateVariables.templateId],
    references: [templates.id],
  }),
}));

export const templateUsageRelations = relations(templateUsage, ({ one }) => ({
  template: one(templates, {
    fields: [templateUsage.templateId],
    references: [templates.id],
  }),
  user: one(users, {
    fields: [templateUsage.userId],
    references: [users.id],
  }),
  prompt: one(prompts, {
    fields: [templateUsage.promptId],
    references: [prompts.id],
  }),
}));

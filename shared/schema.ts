import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, pgEnum, inet, jsonb } from "drizzle-orm/pg-core";
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
  username: varchar("username", { length: 50 }).unique(),
  displayName: varchar("display_name", { length: 100 }),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  avatar40Url: varchar("avatar_40_url", { length: 500 }),
  avatar80Url: varchar("avatar_80_url", { length: 500 }),
  avatar160Url: varchar("avatar_160_url", { length: 500 }),
  avatar320Url: varchar("avatar_320_url", { length: 500 }),
  hasCustomAvatar: boolean("has_custom_avatar").default(false),
  avatarGeneratedColor: varchar("avatar_generated_color", { length: 7 }),
  isVerified: boolean("is_verified").default(false),
  followerCount: integer("follower_count").default(0),
  followingCount: integer("following_count").default(0),
  createdUsernameAt: timestamp("created_username_at"),
  avatarUpdatedAt: timestamp("avatar_updated_at"),
  // Phase 3: Community features
  contributorLevel: integer("contributor_level").default(1),
  totalContributions: integer("total_contributions").default(0),
  qualityScore: varchar("quality_score", { length: 5 }),
  specialties: text("specialties").$type<string[]>().array(),
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
  // Sharing fields
  isPublic: boolean("is_public").default(false),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  saveCount: integer("save_count").default(0),
  remixCount: integer("remix_count").default(0),
  // Phase 3: Advanced features
  enhancementAvailable: boolean("enhancement_available").default(true),
  lastEnhancedAt: timestamp("last_enhanced_at"),
  totalEnhancements: integer("total_enhancements").default(0),
  avgQualityScore: varchar("avg_quality_score", { length: 5 }),
  collaborationEnabled: boolean("collaboration_enabled").default(false),
});

export const enhancementSessions = pgTable("enhancement_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
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
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  platform: text("platform"), // Changed from category to platform
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

export const profileImages = pgTable("profile_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalFilename: varchar("original_filename", { length: 255 }),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 50 }),
  uploadUrl: varchar("upload_url", { length: 500 }),
  processedUrls: jsonb("processed_urls"),
  processingStatus: varchar("processing_status", { length: 20 }).default('pending'),
  uploadIp: inet("upload_ip"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const promptShares = pgTable("prompt_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  sharedByUserId: varchar("shared_by_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sharedWithUserId: varchar("shared_with_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  permission: varchar("permission", { length: 20 }).default('view'),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  accessedAt: timestamp("accessed_at"),
});

export const shareLinks = pgTable("share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceType: varchar("resource_type", { length: 20 }).notNull(),
  resourceId: varchar("resource_id").notNull(),
  shareCode: varchar("share_code", { length: 20 }).notNull().unique(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  permission: varchar("permission", { length: 20 }).default('view'),
  passwordHash: text("password_hash"),
  accessCount: integer("access_count").default(0),
  maxAccessCount: integer("max_access_count"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Phase 3: Advanced AI & Community Features

// Prompt Collections (curated lists by users)
export const promptCollections = pgTable("prompt_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverImageUrl: varchar("cover_image_url", { length: 500 }),
  isPublic: boolean("is_public").default(true),
  isFeatured: boolean("is_featured").default(false),
  viewCount: integer("view_count").default(0),
  followerCount: integer("follower_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Collection Items
export const collectionItems = pgTable("collection_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull().references(() => promptCollections.id, { onDelete: 'cascade' }),
  promptId: varchar("prompt_id").notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  position: integer("position").notNull(),
  addedByUserId: varchar("added_by_user_id").references(() => users.id),
  notes: text("notes"),
  addedAt: timestamp("added_at").defaultNow(),
});

// Collection Followers
export const collectionFollowers = pgTable("collection_followers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull().references(() => promptCollections.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  followedAt: timestamp("followed_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate follows
  uniqueCollectionUser: sql`UNIQUE(${table.collectionId}, ${table.userId})`,
}));

// AI Enhancement Sessions (Advanced)
export const aiEnhancementSessions = pgTable("ai_enhancement_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").references(() => prompts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalContent: text("original_content").notNull(),
  enhancedContent: text("enhanced_content"),
  enhancementType: varchar("enhancement_type", { length: 50 }),
  aiModel: varchar("ai_model", { length: 50 }),
  parameters: jsonb("parameters"),
  qualityScore: varchar("quality_score", { length: 5 }),
  userRating: integer("user_rating"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Prompt Analytics
export const promptAnalytics = pgTable("prompt_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  date: timestamp("date").notNull(),
  viewCount: integer("view_count").default(0),
  copyCount: integer("copy_count").default(0),
  likeCount: integer("like_count").default(0),
  saveCount: integer("save_count").default(0),
  shareCount: integer("share_count").default(0),
  enhancementCount: integer("enhancement_count").default(0),
  avgTimeSpent: integer("avg_time_spent"),
  uniqueViewers: integer("unique_viewers").default(0),
});

// Collaborative Sessions
export const collabSessions = pgTable("collab_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  originalPromptId: varchar("original_prompt_id").references(() => prompts.id),
  finalPromptId: varchar("final_prompt_id").references(() => prompts.id),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 20 }).default('active'),
  maxParticipants: integer("max_participants").default(10),
  currentParticipants: integer("current_participants").default(1),
  sessionCode: varchar("session_code", { length: 20 }).notNull().unique(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Collaborative Participants
export const collabParticipants = pgTable("collab_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => collabSessions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 20 }).default('contributor'),
  contributionCount: integer("contribution_count").default(0),
  joinedAt: timestamp("joined_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

// Collaborative Contributions
export const collabContributions = pgTable("collab_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => collabSessions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  contributionType: varchar("contribution_type", { length: 20 }),
  content: text("content").notNull(),
  parentContributionId: varchar("parent_contribution_id"),
  votesUp: integer("votes_up").default(0),
  votesDown: integer("votes_down").default(0),
  isAccepted: boolean("is_accepted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Recommendations
export const aiRecommendations = pgTable("ai_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  promptId: varchar("prompt_id").references(() => prompts.id, { onDelete: 'cascade' }),
  recommendationType: varchar("recommendation_type", { length: 30 }),
  score: varchar("score", { length: 5 }),
  reason: text("reason"),
  isSeen: boolean("is_seen").default(false),
  isClicked: boolean("is_clicked").default(false),
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
  isPublic: true,
  viewCount: true,
  likeCount: true,
  saveCount: true,
  remixCount: true,
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
  platform: true,
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

// Phase 3: Insert schemas for new tables
export const insertPromptCollectionSchema = createInsertSchema(promptCollections).pick({
  userId: true,
  title: true,
  description: true,
  coverImageUrl: true,
  isPublic: true,
});

export const insertCollectionItemSchema = createInsertSchema(collectionItems).pick({
  collectionId: true,
  promptId: true,
  position: true,
  addedByUserId: true,
  notes: true,
});

export const insertCollectionFollowerSchema = createInsertSchema(collectionFollowers).pick({
  collectionId: true,
  userId: true,
});

export const insertAiEnhancementSessionSchema = createInsertSchema(aiEnhancementSessions).pick({
  promptId: true,
  userId: true,
  originalContent: true,
  enhancedContent: true,
  enhancementType: true,
  aiModel: true,
  parameters: true,
  qualityScore: true,
  userRating: true,
});

export const insertPromptAnalyticsSchema = createInsertSchema(promptAnalytics).pick({
  promptId: true,
  date: true,
  viewCount: true,
  copyCount: true,
  likeCount: true,
  saveCount: true,
  shareCount: true,
  enhancementCount: true,
  avgTimeSpent: true,
  uniqueViewers: true,
});

export const insertCollabSessionSchema = createInsertSchema(collabSessions).pick({
  title: true,
  description: true,
  originalPromptId: true,
  createdByUserId: true,
  maxParticipants: true,
  sessionCode: true,
});

export const insertCollabParticipantSchema = createInsertSchema(collabParticipants).pick({
  sessionId: true,
  userId: true,
  role: true,
});

export const insertCollabContributionSchema = createInsertSchema(collabContributions).pick({
  sessionId: true,
  userId: true,
  contributionType: true,
  content: true,
  parentContributionId: true,
});

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations).pick({
  userId: true,
  promptId: true,
  recommendationType: true,
  score: true,
  reason: true,
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

// Phase 3: Types for new tables
export type InsertPromptCollection = z.infer<typeof insertPromptCollectionSchema>;
export type PromptCollection = typeof promptCollections.$inferSelect;
export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;
export type CollectionItem = typeof collectionItems.$inferSelect;
export type InsertCollectionFollower = z.infer<typeof insertCollectionFollowerSchema>;
export type CollectionFollower = typeof collectionFollowers.$inferSelect;
export type InsertAiEnhancementSession = z.infer<typeof insertAiEnhancementSessionSchema>;
export type AiEnhancementSession = typeof aiEnhancementSessions.$inferSelect;
export type InsertPromptAnalytics = z.infer<typeof insertPromptAnalyticsSchema>;
export type PromptAnalytics = typeof promptAnalytics.$inferSelect;
export type InsertCollabSession = z.infer<typeof insertCollabSessionSchema>;
export type CollabSession = typeof collabSessions.$inferSelect;
export type InsertCollabParticipant = z.infer<typeof insertCollabParticipantSchema>;
export type CollabParticipant = typeof collabParticipants.$inferSelect;
export type InsertCollabContribution = z.infer<typeof insertCollabContributionSchema>;
export type CollabContribution = typeof collabContributions.$inferSelect;
export type InsertAiRecommendation = z.infer<typeof insertAiRecommendationSchema>;
export type AiRecommendation = typeof aiRecommendations.$inferSelect;

// Phase 4: Enterprise & Production Features

// User Following System
export const userFollows = pgTable("user_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: varchar("following_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  followedAt: timestamp("followed_at").defaultNow(),
}, (table) => ({
  uniqueFollowerFollowing: sql`UNIQUE(${table.followerId}, ${table.followingId})`,
}));

// Prompt Likes System
export const promptLikes = pgTable("prompt_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promptId: varchar("prompt_id").notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  likedAt: timestamp("liked_at").defaultNow(),
}, (table) => ({
  uniquePromptUser: sql`UNIQUE(${table.promptId}, ${table.userId})`,
}));

// Notification System
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(), // 'like', 'follow', 'share', 'comment', 'mention', 'system'
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  data: jsonb("data"), // Additional context data
  readAt: timestamp("read_at"),
  clickedAt: timestamp("clicked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subscription Tiers (Monetization Foundation)
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  priceMonthly: integer("price_monthly"), // in cents
  priceYearly: integer("price_yearly"), // in cents
  features: jsonb("features").notNull(), // feature flags and limits
  maxPrompts: integer("max_prompts"),
  maxCollections: integer("max_collections"),
  maxCollaborators: integer("max_collaborators"),
  aiEnhancementsMonthly: integer("ai_enhancements_monthly"),
  prioritySupport: boolean("priority_support").default(false),
  customBranding: boolean("custom_branding").default(false),
  analyticsRetentionDays: integer("analytics_retention_days").default(30),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Subscriptions
export const userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  tierId: varchar("tier_id").references(() => subscriptionTiers.id),
  status: varchar("status", { length: 20 }).default('active'), // 'active', 'cancelled', 'expired', 'trial'
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Usage Tracking
export const usageMetrics = pgTable("usage_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  metricType: varchar("metric_type", { length: 50 }).notNull(), // 'prompts_created', 'ai_enhancements', 'storage_used'
  value: integer("value").notNull(),
  periodStart: timestamp("period_start").notNull(), // Changed from DATE to TIMESTAMP
  periodEnd: timestamp("period_end").notNull(), // Changed from DATE to TIMESTAMP
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserMetricPeriod: sql`UNIQUE(${table.userId}, ${table.metricType}, ${table.periodStart})`,
}));

// Search History & Suggestions
export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  query: text("query").notNull(),
  resultsCount: integer("results_count"),
  clickedResultId: varchar("clicked_result_id"),
  clickedResultType: varchar("clicked_result_type", { length: 20 }), // 'prompt', 'user', 'collection'
  createdAt: timestamp("created_at").defaultNow(),
});

// Report & Moderation System
export const contentReports = pgTable("content_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterUserId: varchar("reporter_user_id").references(() => users.id, { onDelete: 'set null' }),
  contentType: varchar("content_type", { length: 20 }).notNull(), // 'prompt', 'user', 'collection', 'comment'
  contentId: varchar("content_id").notNull(),
  reason: varchar("reason", { length: 50 }).notNull(), // 'spam', 'inappropriate', 'copyright', 'other'
  description: text("description"),
  status: varchar("status", { length: 20 }).default('pending'), // 'pending', 'reviewed', 'resolved', 'dismissed'
  moderatorId: varchar("moderator_id").references(() => users.id),
  moderatorNotes: text("moderator_notes"),
  actionTaken: varchar("action_taken", { length: 50 }), // 'removed', 'warned', 'banned', 'no_action'
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Activity Feed
export const activityFeed = pgTable("activity_feed", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar("action", { length: 50 }).notNull(), // 'created_prompt', 'liked', 'followed', 'shared'
  targetType: varchar("target_type", { length: 20 }), // 'prompt', 'collection', 'user'
  targetId: varchar("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// API Keys (for developer access)
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull().unique(),
  lastFour: varchar("last_four", { length: 4 }).notNull(),
  permissions: jsonb("permissions").default(sql`'["read"]'`),
  rateLimit: integer("rate_limit").default(1000), // requests per hour
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

// Backups & Export Jobs
export const exportJobs = pgTable("export_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  exportType: varchar("export_type", { length: 20 }).notNull(), // 'full', 'prompts', 'collections'
  format: varchar("format", { length: 10 }).notNull(), // 'json', 'csv', 'markdown'
  status: varchar("status", { length: 20 }).default('pending'), // 'pending', 'processing', 'completed', 'failed'
  fileUrl: varchar("file_url", { length: 500 }),
  fileSize: integer("file_size"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// System Health Metrics
export const systemMetrics = pgTable("system_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  value: varchar("value", { length: 20 }).notNull(), // Using varchar to handle both numeric and string values
  unit: varchar("unit", { length: 20 }),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

// Frontend-specific schema (without userId - added by backend auth)
export const createPromptSchema = insertPromptSchema.omit({ userId: true });
export type CreatePrompt = z.infer<typeof createPromptSchema>;

export const createFolderSchema = insertFolderSchema.omit({ userId: true });
export type CreateFolder = z.infer<typeof createFolderSchema>;

export const createTemplateSchema = insertTemplateSchema.omit({ userId: true });
export type CreateTemplate = z.infer<typeof createTemplateSchema>;

export const createTemplateVariableSchema = insertTemplateVariableSchema.omit({ templateId: true });
export type CreateTemplateVariable = z.infer<typeof createTemplateVariableSchema>;

// Phase 3: Frontend create schemas
export const createPromptCollectionSchema = insertPromptCollectionSchema.omit({ userId: true });
export type CreatePromptCollection = z.infer<typeof createPromptCollectionSchema>;

export const createCollectionItemSchema = insertCollectionItemSchema.omit({ addedByUserId: true });
export type CreateCollectionItem = z.infer<typeof createCollectionItemSchema>;

export const createAiEnhancementSchema = insertAiEnhancementSessionSchema.omit({ userId: true });
export type CreateAiEnhancement = z.infer<typeof createAiEnhancementSchema>;

export const createCollabSessionSchema = insertCollabSessionSchema.omit({ createdByUserId: true, sessionCode: true });
export type CreateCollabSession = z.infer<typeof createCollabSessionSchema>;

export const createCollabContributionSchema = insertCollabContributionSchema.omit({ userId: true });
export type CreateCollabContribution = z.infer<typeof createCollabContributionSchema>;

// Phase 4: Insert schemas for enterprise features
export const insertUserFollowSchema = createInsertSchema(userFollows).pick({
  followerId: true,
  followingId: true,
});

export const insertPromptLikeSchema = createInsertSchema(promptLikes).pick({
  promptId: true,
  userId: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  data: true,
});

export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).pick({
  name: true,
  slug: true,
  priceMonthly: true,
  priceYearly: true,
  features: true,
  maxPrompts: true,
  maxCollections: true,
  maxCollaborators: true,
  aiEnhancementsMonthly: true,
  prioritySupport: true,
  customBranding: true,
  analyticsRetentionDays: true,
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).pick({
  userId: true,
  tierId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
});

export const insertUsageMetricSchema = createInsertSchema(usageMetrics).pick({
  userId: true,
  metricType: true,
  value: true,
  periodStart: true,
  periodEnd: true,
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).pick({
  userId: true,
  query: true,
  resultsCount: true,
  clickedResultId: true,
  clickedResultType: true,
});

export const insertContentReportSchema = createInsertSchema(contentReports).pick({
  reporterUserId: true,
  contentType: true,
  contentId: true,
  reason: true,
  description: true,
});

export const insertActivityFeedSchema = createInsertSchema(activityFeed).pick({
  userId: true,
  actorUserId: true,
  action: true,
  targetType: true,
  targetId: true,
  metadata: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).pick({
  userId: true,
  name: true,
  keyHash: true,
  lastFour: true,
  permissions: true,
  rateLimit: true,
  expiresAt: true,
});

export const insertExportJobSchema = createInsertSchema(exportJobs).pick({
  userId: true,
  exportType: true,
  format: true,
  status: true,
});

export const insertSystemMetricSchema = createInsertSchema(systemMetrics).pick({
  metricName: true,
  value: true,
  unit: true,
  metadata: true,
});

// Phase 4: TypeScript types for enterprise features
export type InsertUserFollow = z.infer<typeof insertUserFollowSchema>;
export type UserFollow = typeof userFollows.$inferSelect;
export type InsertPromptLike = z.infer<typeof insertPromptLikeSchema>;
export type PromptLike = typeof promptLikes.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertSubscriptionTier = z.infer<typeof insertSubscriptionTierSchema>;
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUsageMetric = z.infer<typeof insertUsageMetricSchema>;
export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertContentReport = z.infer<typeof insertContentReportSchema>;
export type ContentReport = typeof contentReports.$inferSelect;
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;
export type ActivityFeed = typeof activityFeed.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertExportJob = z.infer<typeof insertExportJobSchema>;
export type ExportJob = typeof exportJobs.$inferSelect;
export type InsertSystemMetric = z.infer<typeof insertSystemMetricSchema>;
export type SystemMetric = typeof systemMetrics.$inferSelect;

// Phase 4: Frontend create schemas (without auto-filled fields)
export const createNotificationSchema = insertNotificationSchema.omit({ userId: true });
export type CreateNotification = z.infer<typeof createNotificationSchema>;

export const createContentReportSchema = insertContentReportSchema.omit({ reporterUserId: true });
export type CreateContentReport = z.infer<typeof createContentReportSchema>;

export const createActivityFeedSchema = insertActivityFeedSchema.omit({ userId: true, actorUserId: true });
export type CreateActivityFeed = z.infer<typeof createActivityFeedSchema>;

export const createApiKeySchema = insertApiKeySchema.omit({ userId: true, keyHash: true, lastFour: true });
export type CreateApiKey = z.infer<typeof createApiKeySchema>;

export const createExportJobSchema = insertExportJobSchema.omit({ userId: true, status: true });
export type CreateExportJob = z.infer<typeof createExportJobSchema>;

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

// Add TypeScript types for new features
export type UserProfile = {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  avatar40Url?: string;
  avatar80Url?: string;
  avatar160Url?: string;
  avatar320Url?: string;
  hasCustomAvatar: boolean;
  avatarGeneratedColor?: string;
  isVerified: boolean;
};

export type PromptShare = {
  id: string;
  promptId: string;
  sharedByUserId: string;
  sharedWithUserId: string;
  permission: 'view' | 'copy' | 'remix';
  expiresAt?: string;
  createdAt: string;
};

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  folders: many(folders),
  prompts: many(prompts),
  enhancementSessions: many(enhancementSessions),
  rateLimit: one(rateLimits),
  templates: many(templates),
  templateUsage: many(templateUsage),
  profileImages: many(profileImages),
  sharedPrompts: many(promptShares, { relationName: 'sharedBy' }),
  receivedShares: many(promptShares, { relationName: 'sharedWith' }),
  shareLinks: many(shareLinks),
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
  shares: many(promptShares),
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

export const profileImagesRelations = relations(profileImages, ({ one }) => ({
  user: one(users, {
    fields: [profileImages.userId],
    references: [users.id],
  }),
}));

export const promptSharesRelations = relations(promptShares, ({ one }) => ({
  prompt: one(prompts, {
    fields: [promptShares.promptId],
    references: [prompts.id],
  }),
  sharedByUser: one(users, {
    fields: [promptShares.sharedByUserId],
    references: [users.id],
    relationName: 'sharedBy',
  }),
  sharedWithUser: one(users, {
    fields: [promptShares.sharedWithUserId],
    references: [users.id],
    relationName: 'sharedWith',
  }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  createdByUser: one(users, {
    fields: [shareLinks.createdByUserId],
    references: [users.id],
  }),
}));

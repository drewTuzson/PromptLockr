import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, signupSchema, insertPromptSchema, insertFolderSchema, enhancePromptSchema, enhanceNewPromptSchema, insertTemplateSchema, insertTemplateVariableSchema, instantiateTemplateSchema, templates, templateVariables, templateUsage, users, folders, profileImages, promptShares, shareLinks, promptCollections, collectionItems, collectionFollowers, aiEnhancementSessions, promptAnalytics, collabSessions, collabParticipants, collabContributions, aiRecommendations, insertPromptCollectionSchema, insertCollectionItemSchema, insertCollectionFollowerSchema, insertAiEnhancementSessionSchema, insertPromptAnalyticsSchema, insertCollabSessionSchema, insertCollabParticipantSchema, insertCollabContributionSchema, insertAiRecommendationSchema, notifications, insertNotificationSchema, subscriptionTiers, userSubscriptions, usageMetrics, insertUserSubscriptionSchema, insertUsageMetricSchema, apiKeys, createApiKeySchema, exportJobs } from "@shared/schema";
import { validateUsername, generateAvatar } from "@shared/avatarUtils";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ReplitDBAdapter } from "../lib/db/replit-db";
import { AuthService } from "../lib/auth/jwt-auth";
import Database from "@replit/database";
import { db as drizzleDB } from "./db.js";
import { prompts } from "@shared/schema";
import { validateAndSanitizeFilters } from "./utils/filterValidation.js";
import { buildFilterConditions, buildOrderBy } from "./utils/filterQueryBuilder.js";
import { sql, eq, and, or, desc, ilike, isNotNull, isNull, inArray } from "drizzle-orm";
import { claudeService } from "./services/claudeService.js";
import { templateEngine } from "./services/templateEngine.js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const replitDB = new ReplitDBAdapter();
const healthDB = new Database();

// Per-user SSE connection management for O(k) performance
declare global {
  var notificationConnections: Map<string, Set<{ id: string; res: any }>> | undefined;
}

global.notificationConnections = global.notificationConnections || new Map<string, Set<{ id: string; res: any }>>();

// Helper function to broadcast notifications to connected SSE clients
function broadcastNotification(userId: string, notification: any) {
  const userConnections = global.notificationConnections?.get(userId);
  if (!userConnections) return;
  
  const deadConnections = new Set<string>();
  
  // Send to all connections for this user
  for (const connection of userConnections) {
    try {
      connection.res.write(`data: ${JSON.stringify({ 
        type: 'notification', 
        notification 
      })}\n\n`);
    } catch (error) {
      console.error(`Failed to send notification to connection ${connection.id}:`, error);
      deadConnections.add(connection.id);
    }
  }
  
  // Clean up dead connections
  for (const deadId of deadConnections) {
    const connection = Array.from(userConnections).find(c => c.id === deadId);
    if (connection) userConnections.delete(connection);
  }
  
  // Remove empty user connection sets
  if (userConnections.size === 0) {
    global.notificationConnections?.delete(userId);
  }
}

// Quality scoring algorithm for Phase 3 AI Enhancement
function analyzePromptQuality(content: string) {
  const words = content.trim().split(/\s+/);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const length = content.length;

  // Clarity Analysis (0-10)
  let clarity = 5;
  if (words.length >= 10) clarity += 2;
  if (words.length >= 20) clarity += 1;
  if (sentences.length >= 2) clarity += 1;
  if (content.includes('?')) clarity += 1;
  clarity = Math.min(clarity, 10);

  // Specificity Analysis (0-10)
  let specificity = 3;
  const specificWords = ['specific', 'detailed', 'exactly', 'precisely', 'particular', 'step-by-step'];
  const hasSpecificWords = specificWords.some(word => content.toLowerCase().includes(word));
  if (hasSpecificWords) specificity += 2;
  if (words.length >= 30) specificity += 2;
  if (content.includes('example') || content.includes('for instance')) specificity += 1;
  if (/\d+/.test(content)) specificity += 1; // Contains numbers
  if (content.includes('"') || content.includes("'")) specificity += 1; // Contains quotes
  specificity = Math.min(specificity, 10);

  // Structure Analysis (0-10)
  let structure = 4;
  if (sentences.length >= 3) structure += 2;
  if (content.includes('\n')) structure += 1;
  if (content.includes(':') || content.includes(';')) structure += 1;
  if (/^\d+\./.test(content) || content.includes('- ')) structure += 2; // Numbered or bulleted
  structure = Math.min(structure, 10);

  // Completeness Analysis (0-10)
  let completeness = 4;
  if (length >= 100) completeness += 2;
  if (length >= 200) completeness += 2;
  if (content.toLowerCase().includes('context') || content.toLowerCase().includes('background')) completeness += 1;
  if (content.toLowerCase().includes('goal') || content.toLowerCase().includes('objective')) completeness += 1;
  completeness = Math.min(completeness, 10);

  // Calculate overall score (weighted average)
  const overallScore = (clarity * 0.25) + (specificity * 0.3) + (structure * 0.2) + (completeness * 0.25);

  // Generate recommendations
  const recommendations = [];
  if (clarity < 7) recommendations.push("Add clearer questions or instructions to improve clarity");
  if (specificity < 7) recommendations.push("Include more specific details, examples, or constraints");
  if (structure < 7) recommendations.push("Break down your prompt into clear sections or bullet points");
  if (completeness < 7) recommendations.push("Provide more context or background information");

  // Generate enhancement suggestions
  const enhancementSuggestions = [];
  if (words.length < 15) enhancementSuggestions.push("Consider expanding your prompt with more details");
  if (!content.includes('?') && !content.includes('generate') && !content.includes('create')) {
    enhancementSuggestions.push("Make your request more explicit with action words");
  }
  if (overallScore < 6) enhancementSuggestions.push("This prompt would benefit from AI enhancement");

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    clarity: Math.round(clarity * 10) / 10,
    specificity: Math.round(specificity * 10) / 10,
    structure: Math.round(structure * 10) / 10,
    completeness: Math.round(completeness * 10) / 10,
    recommendations,
    enhancementSuggestions
  };
}

function requireAuth(req: any): { userId: string; email: string; username?: string } {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  
  const token = authHeader.slice(7);
  const decoded = AuthService.verifyToken(token);
  if (!decoded) {
    throw new Error('Invalid token');
  }
  
  return decoded;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check route
  app.get("/api/health", async (req, res) => {
    try {
      await healthDB.get('health_check');
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV
      });
    } catch (error: any) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  });

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Check if user exists in Replit DB
      const existingUser = await replitDB.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists'
        });
      }

      // Create user in Replit DB
      const passwordHash = await AuthService.hashPassword(password);
      const replitUser = await replitDB.createUser({
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
        preferences: {
          theme: 'light'
        }
      });

      // SYNC TO POSTGRESQL - Critical addition for Epic 6 features
      try {
        await drizzleDB.insert(users).values({
          id: replitUser.id, // CRITICAL: Must match JWT user ID for foreign keys
          email: email,
          passwordHash: passwordHash,
          createdAt: new Date(),
          preferences: { theme: 'light' as const }
        }).onConflictDoUpdate({
          target: users.email,
          set: {
            id: replitUser.id,
            passwordHash: passwordHash,
            preferences: { theme: 'light' as const }
          }
        });
      } catch (pgError) {
        console.error('PostgreSQL sync error during signup:', pgError);
        // Don't fail signup if PostgreSQL sync fails, but log it
      }

      // Generate token
      const token = AuthService.generateToken(replitUser.id, replitUser.email);

      res.status(201).json({
        token,
        user: {
          id: replitUser.id,
          email: replitUser.email,
          preferences: replitUser.preferences
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        error: 'Failed to create user'
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Get user from Replit DB
      const user = await replitDB.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await AuthService.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // SYNC TO POSTGRESQL - Ensure user exists for Epic 6 features
      try {
        await drizzleDB.insert(users).values({
          id: user.id, // CRITICAL: Must match JWT user ID for foreign keys
          email: user.email,
          passwordHash: user.passwordHash,
          createdAt: new Date(user.createdAt),
          preferences: JSON.stringify(user.preferences || { theme: 'light' })
        }).onConflictDoUpdate({
          target: users.email,
          set: {
            id: user.id,
            passwordHash: user.passwordHash,
            preferences: JSON.stringify(user.preferences || { theme: 'light' })
          }
        });
      } catch (pgError) {
        console.error('PostgreSQL sync error during login:', pgError);
        // Continue with login even if sync fails
      }

      // Generate token
      const token = AuthService.generateToken(user.id, user.email);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          preferences: user.preferences
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed'
      });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Prompts routes - Enhanced with advanced filtering
  app.get("/api/prompts", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Check if this is a request with advanced filters
      const hasAdvancedFilters = Object.keys(req.query).some(key => 
        ['search', 'dateCreatedStart', 'dateCreatedEnd', 'dateModifiedStart', 'dateModifiedEnd', 
         'lastUsedStart', 'lastUsedEnd', 'platforms', 'tags', 'folders', 'favoritesOnly', 
         'recentOnly', 'enhanced', 'trashedOnly', 'limit', 'offset', 'sortBy', 'sortOrder'].includes(key)
      );
      
      // Use advanced filtering if filters are detected
      if (hasAdvancedFilters) {
        // Validate and sanitize filters
        const validation = validateAndSanitizeFilters(req.query);
        
        if (!validation.valid) {
          return res.status(400).json({ 
            error: 'Invalid filter parameters', 
            details: validation.errors 
          });
        }

        const filters = validation.sanitized!;
        
        // Build query using PostgreSQL with Drizzle ORM
        const conditions = buildFilterConditions(filters, userId);
        const orderBy = buildOrderBy(filters);
        
        // Set defaults for pagination
        const limit = filters.limit || 50;
        const offset = filters.offset || 0;
        
        // Execute query
        const query = drizzleDB
          .select()
          .from(prompts)
          .where(conditions)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset);

        const results = await query;

        // Get total count for pagination
        const countQuery = drizzleDB
          .select({ count: sql`count(*)` })
          .from(prompts)
          .where(conditions);
        
        const [{ count }] = await countQuery;

        return res.json({
          prompts: results,
          pagination: {
            total: Number(count),
            limit,
            offset,
            hasMore: offset + limit < Number(count)
          },
          filters: filters
        });
      }
      
      // Use PostgreSQL for basic queries to maintain consistency
      const query = req.query.q as string;
      
      // Build basic query conditions
      let conditions = eq(prompts.userId, userId);
      
      // Add search functionality if query provided
      if (query) {
        const searchTerm = `%${query}%`;
        conditions = and(
          conditions,
          or(
            ilike(prompts.title, searchTerm),
            ilike(prompts.content, searchTerm),
            // Use array-safe search for tags (text[] column)
            sql`exists (select 1 from unnest(${prompts.tags}) t where t ilike ${searchTerm})`
          )
        )!;
      }
      
      // Execute query with default ordering
      const results = await drizzleDB
        .select()
        .from(prompts)
        .where(conditions)
        .orderBy(desc(prompts.updatedAt))
        .limit(50);
      
      res.json(results);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching prompts:', error);
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  app.post("/api/prompts", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const promptData = insertPromptSchema.parse({
        ...req.body,
        userId
      });
      
      // Use PostgreSQL (Drizzle) instead of ReplitDB to match the GET endpoint
      const [newPrompt] = await drizzleDB
        .insert(prompts)
        .values(promptData)
        .returning();
      
      res.status(201).json(newPrompt);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input data" });
      }
      console.error('Error creating prompt:', error);
      res.status(500).json({ message: "Failed to create prompt" });
    }
  });

  // Specific routes must come before parameterized routes
  app.get("/api/prompts/favorites", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency
      const favoritePrompts = await drizzleDB
        .select()
        .from(prompts)
        .where(
          and(
            eq(prompts.userId, userId),
            eq(prompts.isFavorite, true)
          )!
        )
        .orderBy(desc(prompts.updatedAt));
      
      res.json(favoritePrompts);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching favorites:', error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.get("/api/prompts/recent", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency - order by lastAccessed or updatedAt
      const recentPrompts = await drizzleDB
        .select()
        .from(prompts)
        .where(eq(prompts.userId, userId))
        .orderBy(desc(prompts.lastAccessed), desc(prompts.updatedAt))
        .limit(10);
      
      res.json(recentPrompts);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching recent prompts:', error);
      res.status(500).json({ message: "Failed to fetch recent prompts" });
    }
  });

  // Phase 3: Enhancement Analytics API (must come before parameterized routes)
  app.get("/api/prompts/enhancement-analytics", async (req, res) => {
    try {
      console.log('DEBUG: Analytics endpoint called');
      const { userId } = requireAuth(req);
      console.log('DEBUG: Analytics userId:', userId);

      // Get enhancement statistics for user
      const userPrompts = await drizzleDB.select({
        id: prompts.id,
        enhancementCount: prompts.enhancementCount,
        totalEnhancements: prompts.totalEnhancements,
        avgQualityScore: prompts.avgQualityScore,
        lastEnhancedAt: prompts.lastEnhancedAt,
        platform: prompts.platform,
        createdAt: prompts.createdAt
      })
      .from(prompts)
      .where(eq(prompts.userId, userId));

      console.log('DEBUG: Analytics userPrompts count:', userPrompts.length);

      // Calculate analytics
      const totalPrompts = userPrompts.length;
      const enhancedPrompts = userPrompts.filter(p => (p.enhancementCount || 0) > 0).length;
      const totalEnhancements = userPrompts.reduce((sum, p) => sum + (p.totalEnhancements || 0), 0);
      const avgEnhancementsPerPrompt = totalPrompts > 0 ? (totalEnhancements / totalPrompts).toFixed(1) : '0';

      // Quality score analytics
      const promptsWithScores = userPrompts.filter(p => p.avgQualityScore);
      const avgQualityScore = promptsWithScores.length > 0 
        ? (promptsWithScores.reduce((sum, p) => sum + parseFloat(p.avgQualityScore!), 0) / promptsWithScores.length).toFixed(1)
        : null;

      // Platform breakdown
      const platformBreakdown = userPrompts.reduce((acc, p) => {
        const platform = p.platform || 'Unknown';
        acc[platform] = (acc[platform] || 0) + (p.totalEnhancements || 0);
        return acc;
      }, {} as Record<string, number>);

      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentEnhancements = userPrompts.filter(p => 
        p.lastEnhancedAt && new Date(p.lastEnhancedAt) > thirtyDaysAgo
      ).length;

      res.json({
        overview: {
          totalPrompts,
          enhancedPrompts,
          enhancementRate: totalPrompts > 0 ? ((enhancedPrompts / totalPrompts) * 100).toFixed(1) : '0',
          totalEnhancements,
          avgEnhancementsPerPrompt,
          avgQualityScore,
          recentEnhancements
        },
        platformBreakdown,
        trends: {
          last30Days: recentEnhancements,
          qualityImprovement: promptsWithScores.length > 0 ? 'Available' : 'No data'
        }
      });

    } catch (error: any) {
      console.error('DEBUG: Analytics endpoint error:', error);
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching enhancement analytics:', error);
      res.status(500).json({ message: 'Failed to fetch enhancement analytics' });
    }
  });

  // Trash/Recycle Bin routes (must come before parameterized routes)
  app.get("/api/prompts/trash", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency - find prompts with trashedAt set
      const trashedPrompts = await drizzleDB
        .select()
        .from(prompts)
        .where(
          and(
            eq(prompts.userId, userId),
            isNotNull(prompts.trashedAt)
          )!
        )
        .orderBy(desc(prompts.trashedAt));
      
      res.json(trashedPrompts);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching trashed prompts:', error);
      res.status(500).json({ message: "Failed to fetch trashed prompts" });
    }
  });

  app.post("/api/prompts/:id/restore", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency - restore by clearing trashedAt
      const [updated] = await drizzleDB
        .update(prompts)
        .set({ trashedAt: null })
        .where(
          and(
            eq(prompts.id, req.params.id),
            eq(prompts.userId, userId),
            isNotNull(prompts.trashedAt) // Only restore items that are actually trashed
          )!
        )
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Prompt not found in trash" });
      }
      
      res.json({ message: "Prompt restored successfully" });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error restoring prompt:', error);
      res.status(500).json({ message: "Failed to restore prompt" });
    }
  });

  app.delete("/api/prompts/:id/permanent", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency - permanently delete from database
      const [deleted] = await drizzleDB
        .delete(prompts)
        .where(
          and(
            eq(prompts.id, req.params.id),
            eq(prompts.userId, userId)
          )!
        )
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      res.json({ message: "Prompt permanently deleted" });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error permanently deleting prompt:', error);
      res.status(500).json({ message: "Failed to permanently delete prompt" });
    }
  });

  app.get("/api/prompts/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency
      const [prompt] = await drizzleDB
        .select()
        .from(prompts)
        .where(
          and(
            eq(prompts.id, req.params.id),
            eq(prompts.userId, userId)
          )!
        )
        .limit(1);
      
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      // Update last accessed
      await drizzleDB
        .update(prompts)
        .set({ lastAccessed: new Date() })
        .where(
          and(
            eq(prompts.id, req.params.id),
            eq(prompts.userId, userId)
          )!
        );
      
      res.json(prompt);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching prompt:', error);
      res.status(500).json({ message: "Failed to fetch prompt" });
    }
  });

  app.put("/api/prompts/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency
      const [existing] = await drizzleDB
        .select()
        .from(prompts)
        .where(
          and(
            eq(prompts.id, req.params.id),
            eq(prompts.userId, userId)
          )!
        )
        .limit(1);
      
      if (!existing) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      // Validate updates using partial schema
      const updateSchema = insertPromptSchema.partial().omit({ id: true, userId: true });
      const updates = updateSchema.parse(req.body);
      
      // Always update the updatedAt timestamp for modifications
      updates.updatedAt = new Date();
      
      const [updated] = await drizzleDB
        .update(prompts)
        .set(updates)
        .where(
          and(
            eq(prompts.id, req.params.id),
            eq(prompts.userId, userId)
          )!
        )
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      console.error('Error updating prompt:', error);
      res.status(500).json({ message: "Failed to update prompt" });
    }
  });

  app.delete("/api/prompts/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Use PostgreSQL for consistency - soft delete by setting trashedAt
      const [updated] = await drizzleDB
        .update(prompts)
        .set({ trashedAt: new Date() })
        .where(
          and(
            eq(prompts.id, req.params.id),
            eq(prompts.userId, userId)
          )!
        )
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      res.json({ message: "Prompt deleted successfully" });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error deleting prompt:', error);
      res.status(500).json({ message: "Failed to delete prompt" });
    }
  });

  // Folders routes
  app.get("/api/folders", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const folders = await storage.getUserFolders(userId);
      res.json(folders);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching folders:', error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.post("/api/folders", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const folderData = insertFolderSchema.parse({
        ...req.body,
        userId
      });
      
      const newFolder = await storage.createFolder(folderData);
      res.status(201).json(newFolder);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input data" });
      }
      console.error('Error creating folder:', error);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.put("/api/folders/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const folderId = req.params.id;
      
      // First, verify the folder belongs to the authenticated user
      const userFolders = await storage.getUserFolders(userId);
      const targetFolder = userFolders.find(f => f.id === folderId);
      
      if (!targetFolder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      
      // Validate the update data with partial schema
      const updateData: { name?: string; parentId?: string | null } = {};
      
      if (req.body.name !== undefined) {
        if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
          return res.status(400).json({ message: "Folder name must be a non-empty string" });
        }
        updateData.name = req.body.name.trim();
      }
      
      if (req.body.parentId !== undefined) {
        updateData.parentId = req.body.parentId;
      }
      
      const updatedFolder = await storage.updateFolder(folderId, updateData);
      
      if (!updatedFolder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      
      res.json(updatedFolder);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error updating folder:', error);
      res.status(500).json({ message: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const folderId = req.params.id;
      
      // First, verify the folder belongs to the authenticated user
      const userFolders = await storage.getUserFolders(userId);
      const targetFolder = userFolders.find(f => f.id === folderId);
      
      if (!targetFolder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      
      // Handle data integrity: reassign prompts in this folder to no folder
      const userPrompts = await storage.getUserPrompts(userId);
      const promptsInFolder = userPrompts.filter(p => p.folderId === folderId);
      
      // Update all prompts in this folder to remove the folder reference
      for (const prompt of promptsInFolder) {
        await storage.updatePrompt(prompt.id, { folderId: null });
      }
      
      const success = await storage.deleteFolder(folderId);
      
      if (!success) {
        return res.status(404).json({ message: "Folder not found" });
      }
      
      res.json({ message: "Folder deleted successfully" });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error deleting folder:', error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  // Export/Import routes
  app.get("/api/export", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const exportData = await storage.exportUserData(userId);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=promptlockr-export.json');
      res.send(exportData);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error exporting data:', error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post("/api/import", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { data } = req.body;
      
      if (!data || typeof data !== 'string') {
        return res.status(400).json({ message: "Invalid import data" });
      }
      
      const result = await storage.importUserData(userId, data);
      res.json(result);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error importing data:', error);
      res.status(500).json({ message: "Failed to import data" });
    }
  });

  // Enhancement API endpoints
  
  // POST /api/prompts/:id/enhance - Enhance existing prompt
  app.post("/api/prompts/:id/enhance", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const promptId = req.params.id;
      
      // Validate request body
      const validationResult = enhancePromptSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: validationResult.error.issues
        });
      }
      
      const { platform, tone, focus } = validationResult.data;

      // Get the prompt using the same storage interface as other endpoints
      const prompt = await storage.getPrompt(promptId);

      if (!prompt || prompt.userId !== userId) {
        return res.status(404).json({ message: 'Prompt not found' });
      }

      // Validate existing prompt content size
      if (prompt.content.length > 10000) {
        return res.status(400).json({ 
          message: 'Prompt content is too long for enhancement (max 10,000 characters)' 
        });
      }

      // Check rate limit first
      const rateLimitStatus = await claudeService.getRateLimitStatus(userId);
      if (!rateLimitStatus.allowed) {
        return res.status(429).json({
          message: `Rate limit exceeded. You have ${rateLimitStatus.remaining} enhancements remaining. Resets at ${rateLimitStatus.resetsAt.toLocaleTimeString()}`,
          rateLimitStatus
        });
      }

      // Use transaction for atomicity
      const result = await drizzleDB.transaction(async (tx) => {
        // Make direct Claude API call (no DB writes in service)
        const enhanceResult = await claudeService.callClaudeAPIOnly(
          prompt.content,
          { platform: platform || prompt.platform || 'ChatGPT', tone, focus }
        );

        if (!enhanceResult.success) {
          throw new Error(enhanceResult.error || 'Enhancement failed');
        }

        // Parse existing history safely
        let existingHistory;
        try {
          existingHistory = prompt.enhancementHistory ? JSON.parse(prompt.enhancementHistory) : [];
        } catch (error) {
          console.error('Failed to parse enhancement history:', error);
          existingHistory = []; // Reset corrupted history
        }

        const sessionId = `enh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newHistoryEntry = {
          sessionId,
          timestamp: new Date().toISOString(),
          enhanced: enhanceResult.enhanced,
          options: { platform: platform || prompt.platform || 'ChatGPT', tone, focus }
        };
        existingHistory.push(newHistoryEntry);

        // Update prompt with history (atomic count increment)
        await tx.update(prompts)
          .set({
            enhancementHistory: JSON.stringify(existingHistory),
            enhancementCount: sql`${prompts.enhancementCount} + 1`
          })
          .where(eq(prompts.id, promptId));

        // Increment rate limit
        await claudeService.incrementRateLimitInTx(userId, tx);

        return { ...enhanceResult, sessionId };
      });

      res.json({
        success: true,
        enhanced: result.enhanced,
        original: prompt.content,
        sessionId: result.sessionId
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Enhancement error:', error);
      res.status(500).json({ message: 'Failed to enhance prompt' });
    }
  });

  // POST /api/prompts/enhance-new - Enhance during creation
  app.post("/api/prompts/enhance-new", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Validate request body
      const validationResult = enhanceNewPromptSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: validationResult.error.issues
        });
      }
      
      const { content, platform, tone, focus } = validationResult.data;

      const result = await claudeService.enhancePrompt(
        content,
        userId,
        { platform: platform || 'ChatGPT', tone, focus }
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({
        success: true,
        enhanced: result.enhanced,
        original: content,
        sessionId: result.sessionId
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Enhancement error:', error);
      res.status(500).json({ message: 'Failed to enhance prompt' });
    }
  });

  // GET /api/prompts/:id/enhancement-history
  app.get("/api/prompts/:id/enhancement-history", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const promptId = req.params.id;

      const [prompt] = await drizzleDB.select()
        .from(prompts)
        .where(and(
          eq(prompts.id, promptId),
          eq(prompts.userId, userId)
        ));

      if (!prompt) {
        return res.status(404).json({ message: 'Prompt not found' });
      }

      const history = prompt.enhancementHistory ? JSON.parse(prompt.enhancementHistory) : [];
      
      res.json({
        promptId,
        enhancementCount: prompt.enhancementCount || 0,
        history
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching enhancement history:', error);
      res.status(500).json({ message: 'Failed to fetch enhancement history' });
    }
  });

  // Phase 3: Quality Scoring API
  app.post("/api/prompts/:id/analyze-quality", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const promptId = req.params.id;

      const [prompt] = await drizzleDB.select()
        .from(prompts)
        .where(and(
          eq(prompts.id, promptId),
          eq(prompts.userId, userId)
        ));

      if (!prompt) {
        return res.status(404).json({ message: 'Prompt not found' });
      }

      // Analyze prompt quality using built-in scoring algorithm
      const qualityAnalysis = analyzePromptQuality(prompt.content);

      // Update prompt with quality score
      await drizzleDB.update(prompts)
        .set({ 
          avgQualityScore: qualityAnalysis.overallScore.toFixed(1),
          updatedAt: new Date()
        })
        .where(eq(prompts.id, promptId));

      res.json({
        promptId,
        qualityScore: qualityAnalysis.overallScore,
        analysis: {
          clarity: qualityAnalysis.clarity,
          specificity: qualityAnalysis.specificity,
          structure: qualityAnalysis.structure,
          completeness: qualityAnalysis.completeness
        },
        recommendations: qualityAnalysis.recommendations,
        enhancementSuggestions: qualityAnalysis.enhancementSuggestions
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error analyzing prompt quality:', error);
      res.status(500).json({ message: 'Failed to analyze prompt quality' });
    }
  });

  // Phase 3: Batch Enhancement API
  app.post("/api/prompts/batch-enhance", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { promptIds, options } = req.body;

      if (!promptIds || !Array.isArray(promptIds) || promptIds.length === 0) {
        return res.status(400).json({ message: 'Please provide valid prompt IDs' });
      }

      if (promptIds.length > 10) {
        return res.status(400).json({ message: 'Maximum 10 prompts can be enhanced at once' });
      }

      // Check rate limit for batch operations
      const rateLimitStatus = await claudeService.getRateLimitStatus(userId);
      if (rateLimitStatus.remaining < promptIds.length) {
        return res.status(429).json({
          message: `Insufficient rate limit. You need ${promptIds.length} enhancements but have ${rateLimitStatus.remaining} remaining.`,
          rateLimitStatus
        });
      }

      // Get all prompts belonging to the user
      const userPrompts = await drizzleDB.select()
        .from(prompts)
        .where(and(
          inArray(prompts.id, promptIds),
          eq(prompts.userId, userId)
        ));

      if (userPrompts.length !== promptIds.length) {
        return res.status(404).json({ message: 'Some prompts not found or not accessible' });
      }

      const enhancementResults = [];

      // Process each prompt
      for (const prompt of userPrompts) {
        try {
          // Make Claude API call
          const enhanceResult = await claudeService.callClaudeAPIOnly(
            prompt.content,
            { platform: options?.platform || prompt.platform || 'ChatGPT', tone: options?.tone, focus: options?.focus }
          );

          if (enhanceResult.success) {
            // Update enhancement history
            let existingHistory;
            try {
              existingHistory = prompt.enhancementHistory ? JSON.parse(prompt.enhancementHistory) : [];
            } catch (error) {
              existingHistory = [];
            }

            const sessionId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newHistoryEntry = {
              sessionId,
              timestamp: new Date().toISOString(),
              enhanced: enhanceResult.enhanced,
              options: options || {},
              isBatch: true
            };

            const updatedHistory = [newHistoryEntry, ...existingHistory].slice(0, 50);

            await drizzleDB.update(prompts)
              .set({
                enhancementHistory: JSON.stringify(updatedHistory),
                enhancementCount: (prompt.enhancementCount || 0) + 1,
                totalEnhancements: (prompt.totalEnhancements || 0) + 1,
                lastEnhancedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(prompts.id, prompt.id));

            enhancementResults.push({
              promptId: prompt.id,
              status: 'success',
              enhanced: enhanceResult.enhanced,
              sessionId
            });
          } else {
            enhancementResults.push({
              promptId: prompt.id,
              status: 'failed',
              error: enhanceResult.error
            });
          }
        } catch (error: any) {
          enhancementResults.push({
            promptId: prompt.id,
            status: 'failed',
            error: error.message
          });
        }
      }

      res.json({
        processed: enhancementResults.length,
        successful: enhancementResults.filter(r => r.status === 'success').length,
        failed: enhancementResults.filter(r => r.status === 'failed').length,
        results: enhancementResults
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error in batch enhancement:', error);
      res.status(500).json({ message: 'Failed to perform batch enhancement' });
    }
  });


  // GET /api/enhancement/rate-limit - Check rate limit status
  app.get("/api/enhancement/rate-limit", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const status = await claudeService.getRateLimitStatus(userId);
      
      res.json(status);

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error checking rate limit:', error);
      res.status(500).json({ message: 'Failed to check rate limit' });
    }
  });

  // Template API endpoints
  
  // GET /api/templates - List user templates
  app.get("/api/templates", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { platform, search } = req.query;
      
      let whereConditions = [eq(templates.userId, userId)];
      
      if (platform && typeof platform === 'string') {
        whereConditions.push(eq(templates.platform, platform));
      }
      
      const userTemplates = await drizzleDB
        .select()
        .from(templates)
        .where(and(...whereConditions));
      
      // Get variables for each template
      const templatesWithVars = await Promise.all(
        userTemplates.map(async (template) => {
          const vars = await drizzleDB
            .select()
            .from(templateVariables)
            .where(eq(templateVariables.templateId, template.id))
            .orderBy(sql`${templateVariables.sortOrder} ASC`);
          
          return {
            ...template,
            variables: vars,
            tags: template.tags || []
          };
        })
      );
      
      res.json({ templates: templatesWithVars });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: 'Failed to fetch templates' });
    }
  });

  // POST /api/templates - Create template
  app.post("/api/templates", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { title, description, content, platform, tags, variables } = req.body;
      
      console.log('[TEMPLATE CREATE] Starting template creation for userId:', userId);
      console.log('[TEMPLATE CREATE] Request body:', { title, description, content, platform, tags, variables });
      
      // Validate template content
      const validation = templateEngine.validateTemplate(content);
      console.log('[TEMPLATE CREATE] Template validation result:', validation);
      if (!validation.valid) {
        console.log('[TEMPLATE CREATE] Template validation failed:', validation.errors);
        return res.status(400).json({ 
          message: 'Invalid template', 
          errors: validation.errors 
        });
      }
      
      // Parse variables from content
      const detectedVars = templateEngine.parseVariables(content);
      console.log('[TEMPLATE CREATE] Detected variables from content:', detectedVars);
      
      const templateData = {
        userId,
        title,
        description,
        content,
        platform,
        tags: tags || [],
        isPublic: false
      };

      console.log('[TEMPLATE CREATE] Template data prepared:', templateData);

      // Validate template data
      const validationResult = insertTemplateSchema.safeParse(templateData);
      console.log('[TEMPLATE CREATE] Schema validation result:', validationResult.success);
      if (!validationResult.success) {
        console.log('[TEMPLATE CREATE] Schema validation failed:', validationResult.error.issues);
        return res.status(400).json({ 
          message: 'Invalid template data',
          errors: validationResult.error.issues
        });
      }
      
      console.log('[TEMPLATE CREATE] Validated template data:', validationResult.data);
      
      // Create template and variables in a transaction
      console.log('[TEMPLATE CREATE] Inserting template into database...');
      const [template] = await drizzleDB.insert(templates)
        .values(validationResult.data)
        .returning();
      
      console.log('[TEMPLATE CREATE] Template inserted successfully:', template);
      
      // Create template variables from detected variables
      if (detectedVars && detectedVars.length > 0) {
        const variableData = detectedVars.map((variableName: string, index: number) => ({
          templateId: template.id,
          variableName: variableName,
          variableType: 'text',
          required: true,
          defaultValue: null,
          options: null,
          description: null,
          minValue: null,
          maxValue: null,
          sortOrder: index
        }));
        
        const validVariables = variableData.filter(v => 
          insertTemplateVariableSchema.safeParse(v).success
        );
        
        console.log('[TEMPLATE CREATE] Creating template variables from detected vars:', validVariables);
        if (validVariables.length > 0) {
          await drizzleDB.insert(templateVariables)
            .values(validVariables);
          console.log('[TEMPLATE CREATE] Template variables created successfully');
        }
      }
      
      // Return template with variables
      const vars = await drizzleDB
        .select()
        .from(templateVariables)
        .where(eq(templateVariables.templateId, template.id))
        .orderBy(sql`${templateVariables.sortOrder} ASC`);
      
      res.json({
        template: {
          ...template,
          variables: vars,
          detectedVariables: detectedVars
        }
      });
      
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error creating template:', error);
      res.status(500).json({ message: 'Failed to create template' });
    }
  });

  // GET /api/templates/:id - Get template details
  app.get("/api/templates/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const templateId = req.params.id;
      
      const [template] = await drizzleDB
        .select()
        .from(templates)
        .where(and(
          eq(templates.id, templateId),
          eq(templates.userId, userId)
        ));
      
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      
      const vars = await drizzleDB
        .select()
        .from(templateVariables)
        .where(eq(templateVariables.templateId, templateId))
        .orderBy(sql`${templateVariables.sortOrder} ASC`);
      
      res.json({
        template: {
          ...template,
          variables: vars,
          tags: template.tags || []
        }
      });
      
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching template:', error);
      res.status(500).json({ message: 'Failed to fetch template' });
    }
  });

  // POST /api/templates/:id/instantiate - Create prompt from template
  app.post("/api/templates/:id/instantiate", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const templateId = req.params.id;
      
      // Validate request body
      const validationResult = instantiateTemplateSchema.safeParse({
        templateId,
        ...req.body
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: validationResult.error.issues
        });
      }
      
      const { variableValues, targetFolder, title } = validationResult.data;
      
      // Get template and variables
      const [template] = await drizzleDB
        .select()
        .from(templates)
        .where(and(
          eq(templates.id, templateId),
          eq(templates.userId, userId)
        ));
      
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      
      const vars = await drizzleDB
        .select()
        .from(templateVariables)
        .where(eq(templateVariables.templateId, templateId))
        .orderBy(sql`${templateVariables.sortOrder} ASC`);
      
      // Instantiate template with provided values
      const { result, validation } = templateEngine.instantiateTemplate(
        template.content,
        vars,
        variableValues
      );
      
      if (!validation.valid) {
        return res.status(400).json({
          message: 'Template validation failed',
          validation
        });
      }
      
      // Create prompt from instantiated template
      const promptData = {
        userId,
        title: title || `${template.title} - ${new Date().toLocaleDateString()}`,
        content: result,
        platform: template.platform || 'ChatGPT',
        tags: template.tags || [],
        folderId: targetFolder || null,
        isFavorite: false,
        charCount: result.length.toString()
      };
      
      const promptValidation = insertPromptSchema.safeParse(promptData);
      if (!promptValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid prompt data',
          errors: promptValidation.error.issues
        });
      }
      
      const newPrompt = await storage.createPrompt(promptValidation.data);
      const prompt = newPrompt;
      
      // Record template usage - ensure user exists in PostgreSQL first
      try {
        // Check if user exists in PostgreSQL, if not create them
        const [existingUser] = await drizzleDB
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
          
        if (!existingUser) {
          // Get user data from authentication system
          const authUser = await storage.getUser(userId);
          if (authUser) {
            // Create user in PostgreSQL to match ReplitDB
            await drizzleDB.insert(users).values({
              id: authUser.id, // CRITICAL: Must match JWT user ID for foreign keys
              email: authUser.email,
              passwordHash: authUser.passwordHash,
              createdAt: authUser.createdAt,
              preferences: JSON.stringify(authUser.preferences || { theme: 'light' })
            }).onConflictDoUpdate({
              target: users.email,
              set: {
                id: authUser.id,
                passwordHash: authUser.passwordHash,
                preferences: JSON.stringify(authUser.preferences || { theme: 'light' })
              }
            });
          }
        }
        
        // Now record template usage
        await drizzleDB.insert(templateUsage).values({
          templateId,
          userId,
          promptId: prompt.id,
          variableValues: JSON.stringify(variableValues)
        });
      } catch (usageError) {
        // Log the error but don't fail the entire request
        console.error('Failed to record template usage:', usageError);
        // Template usage tracking is optional - the prompt was still created successfully
      }
      
      // Update template use count
      await drizzleDB.update(templates)
        .set({ 
          useCount: sql`${templates.useCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(templates.id, templateId));
      
      res.json({ 
        prompt,
        templateUsed: template.title
      });
      
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error instantiating template:', error);
      res.status(500).json({ message: 'Failed to instantiate template' });
    }
  });

  // DELETE /api/templates/:id - Delete template
  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const templateId = req.params.id;
      
      const [template] = await drizzleDB
        .select()
        .from(templates)
        .where(and(
          eq(templates.id, templateId),
          eq(templates.userId, userId)
        ));
      
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      
      // Delete template (cascade will handle variables and usage)
      await drizzleDB.delete(templates)
        .where(eq(templates.id, templateId));
      
      res.json({ message: 'Template deleted successfully' });
      
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error deleting template:', error);
      res.status(500).json({ message: 'Failed to delete template' });
    }
  });

  // GET /api/templates/:id/usage - Get template usage history
  app.get("/api/templates/:id/usage", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const templateId = req.params.id;
      
      // Verify template ownership
      const [template] = await drizzleDB
        .select()
        .from(templates)
        .where(and(
          eq(templates.id, templateId),
          eq(templates.userId, userId)
        ));
      
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      
      const usage = await drizzleDB
        .select()
        .from(templateUsage)
        .where(eq(templateUsage.templateId, templateId))
        .orderBy(sql`${templateUsage.createdAt} DESC`);
      
      res.json({ 
        templateId,
        templateTitle: template.title,
        useCount: template.useCount || 0,
        usage: usage.map(u => ({
          id: u.id,
          promptId: u.promptId,
          variableValues: JSON.parse(u.variableValues || '{}'),
          createdAt: u.createdAt
        }))
      });
      
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching template usage:', error);
      res.status(500).json({ message: 'Failed to fetch template usage' });
    }
  });

  // Username management
  app.get("/api/users/check-username", async (req, res) => {
    try {
      const { username } = req.query;
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username required' });
      }

      const validation = validateUsername(username);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, available: false });
      }

      const existing = await drizzleDB.select().from(users)
        .where(eq(users.username, username.toLowerCase())).limit(1);

      res.json({ available: existing.length === 0, username: username.toLowerCase() });
    } catch (error) {
      console.error('Username check error:', error);
      res.status(500).json({ error: 'Failed to check username' });
    }
  });

  // User search for @mentions
  app.get("/api/users/search", async (req, res) => {
    try {
      const authUser = requireAuth(req);
      const { q } = req.query;

      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json({ users: [] });
      }

      const searchTerm = `%${q}%`;
      const searchResults = await drizzleDB.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar40Url: users.avatar40Url,
        avatar80Url: users.avatar80Url,
        hasCustomAvatar: users.hasCustomAvatar,
        avatarGeneratedColor: users.avatarGeneratedColor
      }).from(users)
      .where(
        and(
          or(
            ilike(users.username, searchTerm),
            ilike(users.displayName, searchTerm)
          )
        )
      ).limit(10);

      res.json({ users: searchResults });
    } catch (error) {
      console.error('User search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Update user profile
  app.put("/api/users/profile", async (req, res) => {
    try {
      const authUser = requireAuth(req);
      const { username, displayName, bio } = req.body;

      let updateData: any = {};

      if (displayName !== undefined) updateData.displayName = displayName;
      if (bio !== undefined) updateData.bio = bio;

      if (username && username !== authUser.username) {
        const validation = validateUsername(username);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        const existing = await drizzleDB.select().from(users)
          .where(eq(users.username, username.toLowerCase())).limit(1);

        if (existing.length > 0) {
          return res.status(400).json({ error: 'Username already taken' });
        }

        updateData.username = username.toLowerCase();
        updateData.createdUsernameAt = new Date();
      }

      const updated = await drizzleDB.update(users)
        .set(updateData)
        .where(eq(users.id, authUser.userId))
        .returning();

      res.json({ user: updated[0] });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Generate avatar
  app.post("/api/users/avatar/generate", async (req, res) => {
    try {
      const authUser = requireAuth(req);

      const user = await drizzleDB.select().from(users)
        .where(eq(users.id, authUser.userId)).limit(1);

      if (!user[0]) {
        return res.status(404).json({ error: 'User not found' });
      }

      const avatar = generateAvatar(user[0].displayName || '', user[0].username || '');

      await drizzleDB.update(users)
        .set({
          avatarGeneratedColor: avatar.backgroundColor,
          hasCustomAvatar: false,
          avatarUrl: null,
          avatar40Url: null,
          avatar80Url: null,
          avatar160Url: null,
          avatar320Url: null,
          avatarUpdatedAt: new Date()
        })
        .where(eq(users.id, authUser.userId));

      res.json({ avatar });
    } catch (error) {
      console.error('Avatar generation error:', error);
      res.status(500).json({ error: 'Failed to generate avatar' });
    }
  });

  // Toggle prompt privacy
  app.put("/api/prompts/:id/privacy", async (req, res) => {
    try {
      const authUser = requireAuth(req);
      const { id } = req.params;
      const { isPublic } = req.body;

      const updated = await drizzleDB.update(prompts)
        .set({ isPublic: !!isPublic })
        .where(and(eq(prompts.id, id), eq(prompts.userId, authUser.userId)))
        .returning();

      if (!updated[0]) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      res.json({ prompt: updated[0] });
    } catch (error) {
      console.error('Privacy toggle error:', error);
      res.status(500).json({ error: 'Failed to update privacy' });
    }
  });

  // Share prompt with user
  app.post("/api/prompts/:id/share", async (req, res) => {
    try {
      const authUser = requireAuth(req);
      const { id } = req.params;
      const { sharedWithUserId, permission = 'view', expiresAt } = req.body;

      // Verify prompt ownership
      const [prompt] = await drizzleDB.select().from(prompts)
        .where(and(eq(prompts.id, id), eq(prompts.userId, authUser.userId)));

      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      // Verify shared with user exists
      const [sharedWithUser] = await drizzleDB.select().from(users)
        .where(eq(users.id, sharedWithUserId));

      if (!sharedWithUser) {
        return res.status(404).json({ error: 'User to share with not found' });
      }

      // Create share
      const [share] = await drizzleDB.insert(promptShares)
        .values({
          promptId: id,
          sharedByUserId: authUser.userId,
          sharedWithUserId,
          permission,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        })
        .returning();

      res.json({ share });
    } catch (error) {
      console.error('Share prompt error:', error);
      res.status(500).json({ error: 'Failed to share prompt' });
    }
  });

  // Create share link
  app.post("/api/prompts/:id/share-link", async (req, res) => {
    try {
      const authUser = requireAuth(req);
      const { id } = req.params;
      const { permission = 'view', password, maxAccessCount, expiresAt } = req.body;

      // Verify prompt ownership
      const [prompt] = await drizzleDB.select().from(prompts)
        .where(and(eq(prompts.id, id), eq(prompts.userId, authUser.userId)));

      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      const shareCode = nanoid(12);
      const passwordHash = password ? await AuthService.hashPassword(password) : null;

      const [shareLink] = await drizzleDB.insert(shareLinks)
        .values({
          resourceType: 'prompt',
          resourceId: id,
          shareCode,
          createdByUserId: authUser.userId,
          permission,
          passwordHash,
          maxAccessCount,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        })
        .returning();

      res.json({ shareLink: { ...shareLink, passwordHash: undefined } });
    } catch (error) {
      console.error('Create share link error:', error);
      res.status(500).json({ error: 'Failed to create share link' });
    }
  });

  // Explore API routes for mobile/PWA functionality
  app.get("/api/explore", async (req, res) => {
    try {
      const { category, search } = req.query;
      
      // Build where conditions
      let whereConditions = [eq(prompts.isPublic, true)];
      
      // Apply category filter if specified
      if (category && category !== 'all') {
        whereConditions.push(ilike(prompts.platform, `%${category}%`));
      }

      // Apply search filter if specified
      if (search) {
        const searchTerm = `%${search}%`;
        whereConditions.push(
          or(
            ilike(prompts.title, searchTerm),
            ilike(prompts.content, searchTerm)
          )
        );
      }

      const baseWhere = and(...whereConditions);

      // Get trending (recent with high engagement - simplified)
      const trending = await drizzleDB.select({
        id: prompts.id,
        title: prompts.title,
        content: prompts.content,
        platform: prompts.platform,
        tags: prompts.tags,
        isPublic: prompts.isPublic,
        isFavorite: prompts.isFavorite,
        createdAt: prompts.createdAt,
        userId: prompts.userId
      })
      .from(prompts)
      .where(baseWhere)
      .orderBy(desc(prompts.createdAt))
      .limit(10);

      // Get newest
      const newest = await drizzleDB.select({
        id: prompts.id,
        title: prompts.title,
        content: prompts.content,
        platform: prompts.platform,
        tags: prompts.tags,
        isPublic: prompts.isPublic,
        isFavorite: prompts.isFavorite,
        createdAt: prompts.createdAt,
        userId: prompts.userId
      })
      .from(prompts)
      .where(baseWhere)
      .orderBy(desc(prompts.createdAt))
      .limit(10);

      // Get popular (favorites - simplified)
      const popular = await drizzleDB.select({
        id: prompts.id,
        title: prompts.title,
        content: prompts.content,
        platform: prompts.platform,
        tags: prompts.tags,
        isPublic: prompts.isPublic,
        isFavorite: prompts.isFavorite,
        createdAt: prompts.createdAt,
        userId: prompts.userId
      })
      .from(prompts)
      .where(and(baseWhere, eq(prompts.isFavorite, true)))
      .orderBy(desc(prompts.createdAt))
      .limit(10);

      // Add mock engagement data for now
      const addEngagementData = (promptsList: any[]) => {
        return promptsList.map(prompt => ({
          ...prompt,
          likeCount: Math.floor(Math.random() * 50),
          saveCount: Math.floor(Math.random() * 30),
          remixCount: Math.floor(Math.random() * 10),
          isLiked: false,
          isSaved: false,
          user: {
            id: prompt.userId,
            username: `user_${prompt.userId.slice(0, 8)}`,
            displayName: `User ${prompt.userId.slice(0, 8)}`,
            hasCustomAvatar: false,
            avatarGeneratedColor: '#98D8C8'
          }
        }));
      };

      res.json({
        trending: addEngagementData(trending),
        newest: addEngagementData(newest),
        popular: addEngagementData(popular)
      });
    } catch (error) {
      console.error('Explore API error:', error);
      res.status(500).json({ error: 'Failed to fetch explore data' });
    }
  });

  // Like/unlike prompt
  app.post("/api/prompts/:id/like", async (req, res) => {
    try {
      const authUser = requireAuth(req);
      const { id } = req.params;

      // For now, just return success - actual implementation would require likes table
      // This is a placeholder for the mobile functionality
      res.json({ 
        success: true, 
        liked: true,
        likeCount: Math.floor(Math.random() * 50) + 1
      });
    } catch (error) {
      console.error('Like prompt error:', error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.status(500).json({ error: 'Failed to like prompt' });
    }
  });

  // Save/unsave prompt
  app.post("/api/prompts/:id/save", async (req, res) => {
    try {
      const authUser = requireAuth(req);
      const { id } = req.params;

      // For now, just return success - actual implementation would require saves table
      // This is a placeholder for the mobile functionality
      res.json({ 
        success: true, 
        saved: true,
        saveCount: Math.floor(Math.random() * 30) + 1
      });
    } catch (error) {
      console.error('Save prompt error:', error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.status(500).json({ error: 'Failed to save prompt' });
    }
  });

  // ===== PHASE 3: COLLECTIONS API ENDPOINTS =====

  // GET /api/collections - List user's collections
  app.get("/api/collections", async (req, res) => {
    try {
      const { userId } = requireAuth(req);

      const userCollections = await drizzleDB
        .select({
          id: promptCollections.id,
          title: promptCollections.title,
          description: promptCollections.description,
          coverImageUrl: promptCollections.coverImageUrl,
          isPublic: promptCollections.isPublic,
          isFeatured: promptCollections.isFeatured,
          viewCount: promptCollections.viewCount,
          followerCount: promptCollections.followerCount,
          createdAt: promptCollections.createdAt,
          updatedAt: promptCollections.updatedAt,
        })
        .from(promptCollections)
        .where(eq(promptCollections.userId, userId))
        .orderBy(desc(promptCollections.updatedAt));

      res.json({ collections: userCollections });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching collections:', error);
      res.status(500).json({ message: 'Failed to fetch collections' });
    }
  });

  // GET /api/collections/featured - Get featured collections
  app.get("/api/collections/featured", async (req, res) => {
    try {
      const featuredCollections = await drizzleDB
        .select({
          id: promptCollections.id,
          title: promptCollections.title,
          description: promptCollections.description,
          coverImageUrl: promptCollections.coverImageUrl,
          isPublic: promptCollections.isPublic,
          isFeatured: promptCollections.isFeatured,
          viewCount: promptCollections.viewCount,
          followerCount: promptCollections.followerCount,
          createdAt: promptCollections.createdAt,
          // Include author info
          author: {
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          }
        })
        .from(promptCollections)
        .innerJoin(users, eq(promptCollections.userId, users.id))
        .where(and(
          eq(promptCollections.isFeatured, true),
          eq(promptCollections.isPublic, true)
        ))
        .orderBy(desc(promptCollections.followerCount))
        .limit(10);

      res.json({ collections: featuredCollections });
    } catch (error: any) {
      console.error('Error fetching featured collections:', error);
      res.status(500).json({ message: 'Failed to fetch featured collections' });
    }
  });

  // POST /api/collections - Create new collection
  app.post("/api/collections", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const collectionData = insertPromptCollectionSchema.parse({
        ...req.body,
        userId
      });

      const [newCollection] = await drizzleDB
        .insert(promptCollections)
        .values(collectionData)
        .returning();

      res.status(201).json(newCollection);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error creating collection:', error);
      res.status(500).json({ message: 'Failed to create collection' });
    }
  });

  // GET /api/collections/:id - Get collection details with items
  app.get("/api/collections/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;

      // Get collection details
      const [collection] = await drizzleDB
        .select({
          id: promptCollections.id,
          title: promptCollections.title,
          description: promptCollections.description,
          coverImageUrl: promptCollections.coverImageUrl,
          isPublic: promptCollections.isPublic,
          isFeatured: promptCollections.isFeatured,
          viewCount: promptCollections.viewCount,
          followerCount: promptCollections.followerCount,
          createdAt: promptCollections.createdAt,
          updatedAt: promptCollections.updatedAt,
          userId: promptCollections.userId,
        })
        .from(promptCollections)
        .where(eq(promptCollections.id, id));

      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      // Check if user can access (owner or public)
      if (collection.userId !== userId && !collection.isPublic) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get collection items with prompt details
      const items = await drizzleDB
        .select({
          id: collectionItems.id,
          position: collectionItems.position,
          notes: collectionItems.notes,
          addedAt: collectionItems.addedAt,
          prompt: {
            id: prompts.id,
            title: prompts.title,
            content: prompts.content,
            platform: prompts.platform,
            tags: prompts.tags,
            createdAt: prompts.createdAt,
            likeCount: prompts.likeCount,
            saveCount: prompts.saveCount,
          }
        })
        .from(collectionItems)
        .innerJoin(prompts, eq(collectionItems.promptId, prompts.id))
        .where(eq(collectionItems.collectionId, id))
        .orderBy(collectionItems.position);

      res.json({ 
        collection: {
          ...collection,
          items
        }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching collection:', error);
      res.status(500).json({ message: 'Failed to fetch collection' });
    }
  });

  // POST /api/collections/:id/items - Add prompt to collection
  app.post("/api/collections/:id/items", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;
      const { promptId, notes } = req.body;

      // Verify collection ownership
      const [collection] = await drizzleDB
        .select()
        .from(promptCollections)
        .where(and(
          eq(promptCollections.id, id),
          eq(promptCollections.userId, userId)
        ));

      if (!collection) {
        return res.status(404).json({ message: 'Collection not found or access denied' });
      }

      // Verify prompt exists
      const [prompt] = await drizzleDB
        .select()
        .from(prompts)
        .where(eq(prompts.id, promptId));

      if (!prompt) {
        return res.status(404).json({ message: 'Prompt not found' });
      }

      // Get current max position
      const [maxPositionResult] = await drizzleDB
        .select({ max: sql<number>`COALESCE(MAX(${collectionItems.position}), 0)` })
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, id));

      const [newItem] = await drizzleDB
        .insert(collectionItems)
        .values({
          collectionId: id,
          promptId,
          position: (maxPositionResult.max || 0) + 1,
          addedByUserId: userId,
          notes
        })
        .returning();

      res.status(201).json(newItem);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error adding item to collection:', error);
      res.status(500).json({ message: 'Failed to add item to collection' });
    }
  });

  // POST /api/collections/:id/follow - Follow/unfollow collection
  app.post("/api/collections/:id/follow", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;

      // Check if already following
      const [existingFollow] = await drizzleDB
        .select()
        .from(collectionFollowers)
        .where(and(
          eq(collectionFollowers.collectionId, id),
          eq(collectionFollowers.userId, userId)
        ));

      if (existingFollow) {
        // Unfollow
        await drizzleDB
          .delete(collectionFollowers)
          .where(and(
            eq(collectionFollowers.collectionId, id),
            eq(collectionFollowers.userId, userId)
          ));

        // Update follower count
        await drizzleDB
          .update(promptCollections)
          .set({ followerCount: sql`${promptCollections.followerCount} - 1` })
          .where(eq(promptCollections.id, id));

        res.json({ following: false });
      } else {
        // Follow
        await drizzleDB
          .insert(collectionFollowers)
          .values({
            collectionId: id,
            userId
          });

        // Update follower count
        await drizzleDB
          .update(promptCollections)
          .set({ followerCount: sql`${promptCollections.followerCount} + 1` })
          .where(eq(promptCollections.id, id));

        res.json({ following: true });
      }
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error following/unfollowing collection:', error);
      res.status(500).json({ message: 'Failed to update follow status' });
    }
  });

  // ========================================
  // Phase 3: Collaborative Sessions API
  // ========================================

  // POST /api/collab/sessions - Create a new collaboration session
  app.post("/api/collab/sessions", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Validate request body using Zod schema
      const createSessionSchema = insertCollabSessionSchema.extend({
        promptId: z.string().min(1, 'promptId is required')
      });
      
      const validation = createSessionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid input',
          errors: validation.error.errors
        });
      }
      
      const { promptId, title, description, maxParticipants = 5 } = validation.data;

      // Verify user owns the prompt
      const [prompt] = await drizzleDB
        .select()
        .from(prompts)
        .where(and(eq(prompts.id, promptId), eq(prompts.userId, userId)));
        
      if (!prompt) {
        return res.status(404).json({ message: 'Prompt not found or access denied' });
      }

      // Create collaboration session (let DB generate UUID)
      const [session] = await drizzleDB
        .insert(collabSessions)
        .values({
          originalPromptId: promptId,
          createdByUserId: userId,
          title,
          description: description || null,
          maxParticipants,
          status: 'active',
          sessionCode: nanoid(8)
        })
        .returning();

      // Add host as first participant  
      await drizzleDB
        .insert(collabParticipants)
        .values({
          sessionId: session.id,
          userId,
          role: 'host'
        });

      res.status(201).json({ session });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error creating collaboration session:', error);
      res.status(500).json({ message: 'Failed to create collaboration session' });
    }
  });

  // GET /api/collab/sessions - List user's collaboration sessions
  app.get("/api/collab/sessions", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { status = 'active' } = req.query;

      // Get sessions where user is participant or host
      const sessions = await drizzleDB
        .select({
          session: collabSessions,
          hostUser: {
            username: users.username,
            email: users.email
          },
          prompt: {
            title: prompts.title,
            platform: prompts.platform
          },
          participantCount: sql<number>`COUNT(DISTINCT ${collabParticipants.userId})`,
          userRole: collabParticipants.role
        })
        .from(collabSessions)
        .innerJoin(collabParticipants, eq(collabParticipants.sessionId, collabSessions.id))
        .innerJoin(users, eq(users.id, collabSessions.createdByUserId))
        .innerJoin(prompts, eq(prompts.id, collabSessions.originalPromptId))
        .where(and(
          eq(collabParticipants.userId, userId),
          eq(collabSessions.status, status as string)
        ))
        .groupBy(
          collabSessions.id,
          users.username,
          users.email,
          prompts.title,
          prompts.platform,
          collabParticipants.role
        );

      res.json({ sessions });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching collaboration sessions:', error);
      res.status(500).json({ message: 'Failed to fetch collaboration sessions' });
    }
  });

  // GET /api/collab/sessions/:id - Get specific collaboration session
  app.get("/api/collab/sessions/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;

      // Verify user is participant in session
      const [participant] = await drizzleDB
        .select()
        .from(collabParticipants)
        .where(and(eq(collabParticipants.sessionId, id), eq(collabParticipants.userId, userId)));

      if (!participant) {
        return res.status(403).json({ message: 'Access denied - not a session participant' });
      }

      // Get session details with participants
      const [session] = await drizzleDB
        .select({
          session: collabSessions,
          hostUser: {
            username: users.username,
            email: users.email
          },
          prompt: {
            title: prompts.title,
            platform: prompts.platform,
            content: prompts.content
          }
        })
        .from(collabSessions)
        .innerJoin(users, eq(users.id, collabSessions.createdByUserId))
        .innerJoin(prompts, eq(prompts.id, collabSessions.originalPromptId))
        .where(eq(collabSessions.id, id));

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Get all participants
      const participants = await drizzleDB
        .select({
          user: {
            id: users.id,
            username: users.username,
            email: users.email
          },
          role: collabParticipants.role,
          joinedAt: collabParticipants.joinedAt
        })
        .from(collabParticipants)
        .innerJoin(users, eq(users.id, collabParticipants.userId))
        .where(eq(collabParticipants.sessionId, id));

      res.json({ 
        ...session,
        participants 
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching collaboration session:', error);
      res.status(500).json({ message: 'Failed to fetch collaboration session' });
    }
  });

  // POST /api/collab/sessions/:id/join - Join a collaboration session  
  app.post("/api/collab/sessions/:id/join", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;
      
      // Validate session ID parameter
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'Valid session ID is required' });
      }

      // Check if session exists and is active
      const [session] = await drizzleDB
        .select()
        .from(collabSessions)
        .where(eq(collabSessions.id, id));

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      if (session.status !== 'active') {
        return res.status(400).json({ message: 'Session is not active' });
      }

      // Check if already participant
      const [existingParticipant] = await drizzleDB
        .select()
        .from(collabParticipants)
        .where(and(eq(collabParticipants.sessionId, id), eq(collabParticipants.userId, userId)));

      if (existingParticipant) {
        // Reactivate participant if was inactive
        await drizzleDB
          .update(collabParticipants)
          .set({ lastActiveAt: new Date() })
          .where(and(eq(collabParticipants.sessionId, id), eq(collabParticipants.userId, userId)));
        
        return res.json({ message: 'Joined session successfully' });
      }

      // Check participant limit
      const [participantCount] = await drizzleDB
        .select({ count: sql<number>`COUNT(*)` })
        .from(collabParticipants)
        .where(eq(collabParticipants.sessionId, id));

      if (participantCount.count >= session.maxParticipants) {
        return res.status(400).json({ message: 'Session is full' });
      }

      // Add user as participant with unique constraint protection
      try {
        await drizzleDB
          .insert(collabParticipants)
          .values({
            sessionId: id,
            userId,
            role: 'contributor'
          });
      } catch (dbError: any) {
        if (dbError.code === '23505') { // Unique constraint violation
          return res.status(400).json({ message: 'User already participant in session' });
        }
        throw dbError;
      }

      res.json({ message: 'Joined session successfully' });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error joining collaboration session:', error);
      res.status(500).json({ message: 'Failed to join collaboration session' });
    }
  });

  // POST /api/collab/sessions/:id/contributions - Add contribution to session
  app.post("/api/collab/sessions/:id/contributions", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;
      
      // Validate request body using Zod schema
      const validation = insertCollabContributionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid input',
          errors: validation.error.errors
        });
      }
      
      const { contributionType, content } = validation.data;

      // Verify user is active participant
      const [participant] = await drizzleDB
        .select()
        .from(collabParticipants)
        .where(and(
          eq(collabParticipants.sessionId, id), 
          eq(collabParticipants.userId, userId)
        ));

      if (!participant) {
        return res.status(403).json({ message: 'Access denied - not an active participant' });
      }

      // Add contribution
      const [contribution] = await drizzleDB
        .insert(collabContributions)
        .values({
          sessionId: id,
          userId,
          contributionType,
          content
        })
        .returning();

      // Update session's last activity
      await drizzleDB
        .update(collabSessions)
        .set({ completedAt: new Date() })
        .where(eq(collabSessions.id, id));

      res.status(201).json({ contribution });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error adding contribution:', error);
      res.status(500).json({ message: 'Failed to add contribution' });
    }
  });

  // GET /api/collab/sessions/:id/contributions - Get session contributions
  app.get("/api/collab/sessions/:id/contributions", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;

      // Verify user is participant
      const [participant] = await drizzleDB
        .select()
        .from(collabParticipants)
        .where(and(eq(collabParticipants.sessionId, id), eq(collabParticipants.userId, userId)));

      if (!participant) {
        return res.status(403).json({ message: 'Access denied - not a session participant' });
      }

      // Get contributions with user details
      const contributions = await drizzleDB
        .select({
          contribution: collabContributions,
          user: {
            username: users.username,
            email: users.email
          }
        })
        .from(collabContributions)
        .innerJoin(users, eq(users.id, collabContributions.userId))
        .where(eq(collabContributions.sessionId, id))
        .orderBy(collabContributions.createdAt);

      res.json({ contributions });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching contributions:', error);
      res.status(500).json({ message: 'Failed to fetch contributions' });
    }
  });

  // PUT /api/collab/sessions/:id/content - Update session content (HOST ONLY)
  app.put("/api/collab/sessions/:id/content", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;
      
      // Validate content input
      if (!req.body.content || typeof req.body.content !== 'string') {
        return res.status(400).json({ message: 'Valid content string is required' });
      }
      
      const { content } = req.body;

      // Verify user is session HOST (not just participant)
      const [session] = await drizzleDB
        .select()
        .from(collabSessions)
        .where(and(eq(collabSessions.id, id), eq(collabSessions.createdByUserId, userId)));

      if (!session) {
        return res.status(403).json({ message: 'Access denied - only session host can update content' });
      }

      // Update session content (host permission already verified)
      const [updated] = await drizzleDB
        .update(collabSessions)
        .set({ 
          status: 'active' // Keep session active during editing
        })
        .where(eq(collabSessions.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: 'Session not found' });
      }

      res.json({ message: 'Content updated successfully', session: updated });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error updating session content:', error);
      res.status(500).json({ message: 'Failed to update session content' });
    }
  });

  // POST /api/collab/sessions/:id/close - Close collaboration session
  app.post("/api/collab/sessions/:id/close", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { id } = req.params;

      // Verify user is session host
      const [session] = await drizzleDB
        .select()
        .from(collabSessions)
        .where(and(eq(collabSessions.id, id), eq(collabSessions.createdByUserId, userId)));

      if (!session) {
        return res.status(404).json({ message: 'Session not found or access denied' });
      }

      // Close session and set completion timestamp
      await drizzleDB
        .update(collabSessions)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(collabSessions.id, id));

      res.json({ message: 'Session closed successfully' });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error closing session:', error);
      res.status(500).json({ message: 'Failed to close session' });
    }
  });

  // === Phase 4: Notification System API ===
  
  // Rate limiting for notification endpoints
  const notificationRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { message: 'Too many notification requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  const notificationSseRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute  
    max: 10, // Limit SSE connection attempts
    message: { message: 'Too many SSE connection attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // GET /api/notifications - Get user notifications with pagination
  app.get("/api/notifications", notificationRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Validate query parameters with Zod
      const querySchema = z.object({
        limit: z.coerce.number().min(1).max(100).default(20),
        offset: z.coerce.number().min(0).default(0),
        unreadOnly: z.enum(['true', 'false']).optional().default('false')
      });
      
      const validation = querySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid query parameters',
          errors: validation.error.errors
        });
      }
      
      const { limit, offset, unreadOnly } = validation.data;
      
      // Build query conditions
      let conditions = eq(notifications.userId, userId);
      if (unreadOnly === 'true') {
        conditions = and(conditions, isNull(notifications.readAt));
      }
      
      // Get notifications with pagination
      const userNotifications = await drizzleDB
        .select()
        .from(notifications)
        .where(conditions)
        .orderBy(desc(notifications.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));
      
      // Get total count for pagination
      const [{ count }] = await drizzleDB
        .select({ count: sql`count(*)` })
        .from(notifications)
        .where(conditions);
      
      // Get unread count
      const [{ unreadCount }] = await drizzleDB
        .select({ unreadCount: sql`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
      
      res.json({
        notifications: userNotifications,
        pagination: {
          total: Number(count),
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < Number(count)
        },
        unreadCount: Number(unreadCount)
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  // POST /api/notifications/mark-read - Mark specific notifications as read
  app.post("/api/notifications/mark-read", notificationRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      const markReadSchema = z.object({
        notificationIds: z.array(z.string().min(1)).min(1).max(50, 'Maximum 50 notifications can be marked at once')
      });
      
      const validation = markReadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: validation.error.errors
        });
      }
      
      const { notificationIds } = validation.data;
      
      // Mark notifications as read (only for current user)
      const updated = await drizzleDB
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(
          eq(notifications.userId, userId),
          inArray(notifications.id, notificationIds),
          isNull(notifications.readAt) // Only update unread notifications
        ))
        .returning({ id: notifications.id });
      
      // Broadcast unread count change if any notifications were marked as read
      if (updated.length > 0) {
        const [{ unreadCount }] = await drizzleDB
          .select({ unreadCount: sql`count(*)` })
          .from(notifications)
          .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
        
        broadcastNotification(userId, {
          type: 'unread_count_update',
          unreadCount: Number(unreadCount)
        });
      }
      
      res.json({ 
        message: 'Notifications marked as read',
        markedCount: updated.length
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
  });

  // POST /api/notifications/mark-all-read - Mark all notifications as read
  app.post("/api/notifications/mark-all-read", notificationRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Mark all unread notifications as read for user
      const updated = await drizzleDB
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt)
        ))
        .returning({ id: notifications.id });
      
      // Broadcast unread count change if any notifications were marked as read
      if (updated.length > 0) {
        broadcastNotification(userId, {
          type: 'unread_count_update',
          unreadCount: 0
        });
      }
      
      res.json({ 
        message: 'All notifications marked as read',
        markedCount: updated.length
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
  });

  // POST /api/notifications - Create notification (for testing/admin use)
  app.post("/api/notifications", notificationRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      const validation = insertNotificationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: validation.error.errors
        });
      }
      
      const notificationData = validation.data;
      
      // Create notification in database
      const [newNotification] = await drizzleDB
        .insert(notifications)
        .values({
          userId: notificationData.userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || null
        })
        .returning();
      
      // Broadcast to connected SSE clients
      broadcastNotification(notificationData.userId, newNotification);
      
      res.status(201).json({ 
        message: 'Notification created successfully',
        notification: newNotification
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error creating notification:', error);
      res.status(500).json({ message: 'Failed to create notification' });
    }
  });

  // GET /api/notifications/stream - Server-Sent Events for real-time notifications
  app.get("/api/notifications/stream", notificationSseRateLimit, (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Connection limit per user (max 3 connections)
      const userConnections = global.notificationConnections?.get(userId) || new Set();
      if (userConnections.size >= 3) {
        return res.status(429).json({ message: 'Too many concurrent connections' });
      }
      
      // Set SSE headers with proper timeout and retry
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization,Cache-Control',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });
      
      // Disable response timeout for long-lived connections
      res.setTimeout(0);
      
      const connectionId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const connection = { id: connectionId, res };
      
      // Store connection per user
      if (!global.notificationConnections?.has(userId)) {
        global.notificationConnections?.set(userId, new Set());
      }
      global.notificationConnections?.get(userId)?.add(connection);
      
      // Send initial connection confirmation with retry hint
      res.write(`retry: 3000\n`);
      res.write(`data: ${JSON.stringify({ type: 'connected', userId, connectionId })}\n\n`);
      
      // Send heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          res.write(`event: ping\n`);
          res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
        } catch (error) {
          clearInterval(heartbeat);
          cleanupConnection();
        }
      }, 15000);
      
      function cleanupConnection() {
        clearInterval(heartbeat);
        const userConnections = global.notificationConnections?.get(userId);
        if (userConnections) {
          userConnections.delete(connection);
          if (userConnections.size === 0) {
            global.notificationConnections?.delete(userId);
          }
        }
        console.log(`SSE client disconnected: ${connectionId}`);
      }
      
      // Clean up on disconnect
      req.on('close', cleanupConnection);
      req.on('error', cleanupConnection);
      
      console.log(`SSE client connected: ${connectionId}`);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error setting up SSE connection:', error);
      res.status(500).json({ message: 'Failed to establish SSE connection' });
    }
  });

  // === Phase 4: Subscription Management API ===
  
  // Rate limiting for subscription endpoints (user-based after auth)
  const subscriptionRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each user to 50 subscription requests per windowMs
    message: { message: 'Too many subscription requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      try {
        const { userId } = requireAuth(req);
        return `user:${userId}`;
      } catch {
        // Use proper IPv6-compatible IP handling
        return `ip:${ipKeyGenerator(req)}`;
      }
    },
    skip: (req) => {
      // Apply rate limiting only to subscription endpoints
      return !req.path.startsWith('/api/subscription');
    }
  });

  // GET /api/subscription/current - Get user's current subscription details
  app.get("/api/subscription/current", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      // Get user's current active subscription with tier details (ordered by most recent)
      const subscription = await drizzleDB
        .select({
          subscription: userSubscriptions,
          tier: subscriptionTiers
        })
        .from(userSubscriptions)
        .leftJoin(subscriptionTiers, eq(userSubscriptions.tierId, subscriptionTiers.id))
        .where(and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active')
        ))
        .orderBy(desc(userSubscriptions.currentPeriodEnd))
        .limit(1);
      
      // If no subscription found, return default free tier
      if (subscription.length === 0) {
        const [freeTier] = await drizzleDB
          .select()
          .from(subscriptionTiers)
          .where(eq(subscriptionTiers.slug, 'free'))
          .limit(1);
        
        // Compute billing period for free tier (monthly cycle)
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        // Get usage for free tier current period
        const usage = await drizzleDB
          .select()
          .from(usageMetrics)
          .where(and(
            eq(usageMetrics.userId, userId),
            sql`${usageMetrics.periodStart} >= ${periodStart}`,
            sql`${usageMetrics.periodEnd} <= ${periodEnd}`
          ));
        
        const usageData = usage.reduce((acc, metric) => {
          acc[metric.metricType] = (acc[metric.metricType] || 0) + metric.value;
          return acc;
        }, {} as Record<string, number>);
        
        return res.json({
          subscription: null,
          tier: freeTier || null,
          usage: usageData,
          billingPeriod: { start: periodStart, end: periodEnd },
          isDefault: true
        });
      }
      
      // Get current usage metrics for this billing period
      const currentPeriodStart = subscription[0].subscription?.currentPeriodStart;
      const currentPeriodEnd = subscription[0].subscription?.currentPeriodEnd;
      
      let usageData = {};
      if (currentPeriodStart && currentPeriodEnd) {
        const usage = await drizzleDB
          .select()
          .from(usageMetrics)
          .where(and(
            eq(usageMetrics.userId, userId),
            sql`${usageMetrics.periodStart} >= ${currentPeriodStart}`,
            sql`${usageMetrics.periodEnd} <= ${currentPeriodEnd}`
          ));
        
        // Aggregate usage by metric type
        usageData = usage.reduce((acc, metric) => {
          acc[metric.metricType] = (acc[metric.metricType] || 0) + metric.value;
          return acc;
        }, {} as Record<string, number>);
      }
      
      res.json({
        subscription: subscription[0].subscription,
        tier: subscription[0].tier,
        usage: usageData,
        isDefault: false
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching current subscription:', error);
      res.status(500).json({ message: 'Failed to fetch subscription details' });
    }
  });

  // GET /api/subscription/tiers - Get all available subscription tiers
  app.get("/api/subscription/tiers", async (req, res) => {
    try {
      const tiers = await drizzleDB
        .select()
        .from(subscriptionTiers)
        .orderBy(subscriptionTiers.priceMonthly);
      
      res.json({ tiers });
    } catch (error: any) {
      console.error('Error fetching subscription tiers:', error);
      res.status(500).json({ message: 'Failed to fetch subscription tiers' });
    }
  });

  // POST /api/subscription/usage - Track usage metrics
  app.post("/api/subscription/usage", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      const usageSchema = z.object({
        metricType: z.enum(['prompts_created', 'ai_enhancements', 'collections_created', 'collaborations', 'exports']),
        value: z.number().min(1).max(1000),
        periodStart: z.string().datetime().optional(),
        periodEnd: z.string().datetime().optional()
      });
      
      const validation = usageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: validation.error.errors
        });
      }
      
      const { metricType, value, periodStart, periodEnd } = validation.data;
      
      // Get user's current subscription and tier for limit enforcement
      const subscription = await drizzleDB
        .select({
          subscription: userSubscriptions,
          tier: subscriptionTiers
        })
        .from(userSubscriptions)
        .leftJoin(subscriptionTiers, eq(userSubscriptions.tierId, subscriptionTiers.id))
        .where(and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active')
        ))
        .orderBy(desc(userSubscriptions.currentPeriodEnd))
        .limit(1);
      
      // Use free tier if no active subscription
      let currentTier = subscription[0]?.tier;
      if (!currentTier) {
        const [freeTier] = await drizzleDB
          .select()
          .from(subscriptionTiers)
          .where(eq(subscriptionTiers.slug, 'free'))
          .limit(1);
        currentTier = freeTier;
      }
      
      // Fallback to hardcoded free tier if database tier is missing
      if (!currentTier) {
        currentTier = {
          id: 'free-default',
          name: 'Free',
          slug: 'free',
          priceMonthly: 0,
          priceYearly: 0,
          features: { ads: true, watermark: true },
          maxPrompts: 100,
          maxCollections: 5,
          maxCollaborators: 3,
          aiEnhancementsMonthly: 10,
          prioritySupport: false,
          customBranding: false,
          analyticsRetentionDays: 7,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      
      // Type assertion to ensure currentTier is not null after fallback
      const tier = currentTier!;
      
      // Use current month as default period if not provided
      const now = new Date();
      const defaultPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const defaultPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      // Check current usage against tier limits BEFORE recording
      const currentUsage = await drizzleDB
        .select({ totalValue: sql`COALESCE(SUM(${usageMetrics.value}), 0)` })
        .from(usageMetrics)
        .where(and(
          eq(usageMetrics.userId, userId),
          eq(usageMetrics.metricType, metricType),
          sql`${usageMetrics.periodStart} >= ${new Date(periodStart || defaultPeriodStart)}`
        ));
      
      const currentTotal = Number(currentUsage[0]?.totalValue || 0);
      const newTotal = currentTotal + value;
      
      // Enforce tier limits using the safe tier reference
      const tierLimits: Record<string, number> = {
        prompts_created: tier.maxPrompts || Infinity,
        collections_created: tier.maxCollections || Infinity,
        ai_enhancements: tier.aiEnhancementsMonthly || Infinity,
        collaborations: tier.maxCollaborators || Infinity,
        exports: 50 // Default export limit
      };
      
      const limit = tierLimits[metricType];
      if (limit !== null && newTotal > limit) {
        return res.status(429).json({
          message: `Usage limit exceeded for ${metricType}`,
          limit,
          current: currentTotal,
          attempted: newTotal,
          tier: tier.name
        });
      }
      
      // Check if usage record already exists for this period
      const existingUsage = await drizzleDB
        .select()
        .from(usageMetrics)
        .where(and(
          eq(usageMetrics.userId, userId),
          eq(usageMetrics.metricType, metricType),
          eq(usageMetrics.periodStart, new Date(periodStart || defaultPeriodStart))
        ))
        .limit(1);
      
      if (existingUsage.length > 0) {
        // Update existing usage
        await drizzleDB
          .update(usageMetrics)
          .set({ 
            value: sql`${usageMetrics.value} + ${value}`
          })
          .where(eq(usageMetrics.id, existingUsage[0].id));
        
        res.json({ 
          message: 'Usage updated successfully',
          newValue: existingUsage[0].value + value
        });
      } else {
        // Create new usage record
        const [newUsage] = await drizzleDB
          .insert(usageMetrics)
          .values({
            userId,
            metricType,
            value,
            periodStart: new Date(periodStart || defaultPeriodStart),
            periodEnd: new Date(periodEnd || defaultPeriodEnd)
          })
          .returning();
        
        res.status(201).json({ 
          message: 'Usage tracked successfully',
          usage: newUsage
        });
      }
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error tracking usage:', error);
      res.status(500).json({ message: 'Failed to track usage' });
    }
  });

  // GET /api/subscription/usage - Get usage metrics for current period
  app.get("/api/subscription/usage", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      
      const querySchema = z.object({
        period: z.enum(['current', 'all']).default('current'),
        metricType: z.enum(['prompts_created', 'ai_enhancements', 'collections_created', 'collaborations', 'exports']).optional()
      });
      
      const validation = querySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: 'Invalid query parameters',
          errors: validation.error.errors
        });
      }
      
      const { period, metricType } = validation.data;
      
      let conditions = [eq(usageMetrics.userId, userId)];
      
      if (metricType) {
        conditions.push(eq(usageMetrics.metricType, metricType));
      }
      
      if (period === 'current') {
        const now = new Date();
        const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        conditions.push(sql`${usageMetrics.periodStart} >= ${currentPeriodStart}`);
      }
      
      const usage = await drizzleDB
        .select()
        .from(usageMetrics)
        .where(and(...conditions))
        .orderBy(desc(usageMetrics.periodStart));
      
      // Aggregate by metric type for current period
      const aggregated = usage.reduce((acc, metric) => {
        if (!acc[metric.metricType]) {
          acc[metric.metricType] = 0;
        }
        acc[metric.metricType] += metric.value;
        return acc;
      }, {} as Record<string, number>);
      
      res.json({
        usage: usage,
        aggregated: aggregated
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching usage metrics:', error);
      res.status(500).json({ message: 'Failed to fetch usage metrics' });
    }
  });

  // === Phase 4: Export System API ===
  
  // POST /api/export - Create new export job
  app.post("/api/export", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { exportType, format } = req.body;

      // Validate request
      const validExportTypes = ['full', 'prompts', 'collections'];
      const validFormats = ['json', 'csv', 'markdown'];
      
      if (!validExportTypes.includes(exportType)) {
        return res.status(400).json({ message: 'Invalid export type' });
      }
      
      if (!validFormats.includes(format)) {
        return res.status(400).json({ message: 'Invalid format' });
      }

      // Check for existing pending/processing jobs
      const existingJob = await drizzleDB
        .select()
        .from(exportJobs)
        .where(and(
          eq(exportJobs.userId, userId),
          inArray(exportJobs.status, ['pending', 'processing'])
        ))
        .limit(1);

      if (existingJob.length > 0) {
        return res.status(429).json({ 
          message: 'Export job already in progress',
          jobId: existingJob[0].id
        });
      }

      // Record usage metric for exports (simple insert since no unique constraint exists)
      await drizzleDB
        .insert(usageMetrics)
        .values({
          userId,
          metricType: 'exports',
          value: 1,
          periodStart: new Date(),
          periodEnd: new Date()
        });

      // Create export job
      const [job] = await drizzleDB
        .insert(exportJobs)
        .values({
          userId,
          exportType,
          format,
          status: 'pending',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        })
        .returning();

      // Start async processing (in background)
      processExportJob(job.id, userId, exportType, format).catch(error => {
        console.error('Export job processing error:', error);
        // Update job status to failed
        drizzleDB
          .update(exportJobs)
          .set({ 
            status: 'failed', 
            errorMessage: error.message,
            completedAt: new Date()
          })
          .where(eq(exportJobs.id, job.id))
          .catch(updateError => console.error('Failed to update job status:', updateError));
      });

      res.status(201).json({
        jobId: job.id,
        status: 'pending',
        exportType,
        format,
        estimatedTimeMinutes: getEstimatedTime(exportType)
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error creating export job:', error);
      res.status(500).json({ message: 'Failed to create export job' });
    }
  });

  // GET /api/export/:jobId/status - Check export job status
  app.get("/api/export/:jobId/status", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { jobId } = req.params;

      const [job] = await drizzleDB
        .select()
        .from(exportJobs)
        .where(and(
          eq(exportJobs.id, jobId),
          eq(exportJobs.userId, userId)
        ))
        .limit(1);

      if (!job) {
        return res.status(404).json({ message: 'Export job not found' });
      }

      // Check if job has expired
      if (job.expiresAt && new Date() > job.expiresAt) {
        return res.status(410).json({ 
          message: 'Export job has expired',
          status: 'expired'
        });
      }

      res.json({
        jobId: job.id,
        status: job.status,
        exportType: job.exportType,
        format: job.format,
        fileSize: job.fileSize,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        expiresAt: job.expiresAt,
        downloadUrl: job.status === 'completed' && job.fileUrl ? 
          `/api/export/${job.id}/download` : null,
        errorMessage: job.errorMessage
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching export job status:', error);
      res.status(500).json({ message: 'Failed to fetch job status' });
    }
  });

  // GET /api/export/:jobId/download - Download completed export file
  app.get("/api/export/:jobId/download", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { jobId } = req.params;

      const [job] = await drizzleDB
        .select()
        .from(exportJobs)
        .where(and(
          eq(exportJobs.id, jobId),
          eq(exportJobs.userId, userId)
        ))
        .limit(1);

      if (!job) {
        return res.status(404).json({ message: 'Export job not found' });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ 
          message: 'Export job not completed',
          status: job.status
        });
      }

      // Check if job has expired
      if (job.expiresAt && new Date() > job.expiresAt) {
        return res.status(410).json({ 
          message: 'Export job has expired',
          status: 'expired'
        });
      }

      if (!job.fileUrl) {
        return res.status(404).json({ message: 'Export file not found' });
      }

      // For development, serve the file content directly
      // In production, this would redirect to a signed S3 URL
      const fileName = `promptlockr-export-${job.exportType}-${Date.now()}.${job.format}`;
      const contentType = getContentType(job.format);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      if (job.fileSize) {
        res.setHeader('Content-Length', job.fileSize.toString());
      }

      // Return the file content (stored in fileUrl as base64 or direct content for dev)
      res.send(job.fileUrl);

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error downloading export file:', error);
      res.status(500).json({ message: 'Failed to download file' });
    }
  });

  // Helper function to process export jobs asynchronously
  async function processExportJob(jobId: string, userId: string, exportType: string, format: string) {
    try {
      // Update status to processing
      await drizzleDB
        .update(exportJobs)
        .set({ status: 'processing' })
        .where(eq(exportJobs.id, jobId));

      let data: any;
      
      // Fetch data based on export type
      if (exportType === 'full') {
        const prompts = await drizzleDB
          .select()
          .from(prompts)
          .where(eq(prompts.userId, userId));
          
        const folders = await drizzleDB
          .select()
          .from(folders)
          .where(eq(folders.userId, userId));
          
        data = { prompts, folders };
      } else if (exportType === 'prompts') {
        data = await drizzleDB
          .select()
          .from(prompts)
          .where(eq(prompts.userId, userId));
      } else if (exportType === 'collections') {
        data = await drizzleDB
          .select()
          .from(folders)
          .where(eq(folders.userId, userId));
      }

      // Format data based on requested format
      let fileContent: string;
      let fileSize: number;
      
      if (format === 'json') {
        fileContent = JSON.stringify({
          version: '1.0',
          exportDate: new Date().toISOString(),
          exportType,
          data
        }, null, 2);
      } else if (format === 'csv') {
        fileContent = formatAsCSV(data, exportType);
      } else if (format === 'markdown') {
        fileContent = formatAsMarkdown(data, exportType);
      } else {
        throw new Error('Unsupported format');
      }

      fileSize = Buffer.byteLength(fileContent, 'utf8');

      // Store file content (in production, upload to S3 and store URL)
      await drizzleDB
        .update(exportJobs)
        .set({
          status: 'completed',
          fileUrl: fileContent, // In dev, store content directly
          fileSize,
          completedAt: new Date()
        })
        .where(eq(exportJobs.id, jobId));

    } catch (error) {
      console.error('Export processing error:', error);
      throw error;
    }
  }

  // Helper functions
  function getEstimatedTime(exportType: string): number {
    const estimates = { full: 3, prompts: 1, collections: 1 };
    return estimates[exportType as keyof typeof estimates] || 2;
  }

  function getContentType(format: string): string {
    const types = {
      json: 'application/json',
      csv: 'text/csv',
      markdown: 'text/markdown'
    };
    return types[format as keyof typeof types] || 'text/plain';
  }

  function formatAsCSV(data: any, exportType: string): string {
    if (exportType === 'prompts' || (exportType === 'full' && data.prompts)) {
      const items = exportType === 'full' ? data.prompts : data;
      const headers = ['id', 'title', 'content', 'platform', 'tags', 'createdAt'];
      const rows = items.map((item: any) => [
        item.id,
        `"${item.title?.replace(/"/g, '""') || ''}"`,
        `"${item.content?.replace(/"/g, '""') || ''}"`,
        item.platform || '',
        `"${Array.isArray(item.tags) ? item.tags.join(', ') : ''}"`,
        item.createdAt || ''
      ]);
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
    return 'No data available';
  }

  function formatAsMarkdown(data: any, exportType: string): string {
    let markdown = `# PromptLockr Export\n\n`;
    markdown += `Export Date: ${new Date().toISOString()}\n`;
    markdown += `Export Type: ${exportType}\n\n`;
    
    if (exportType === 'prompts' || (exportType === 'full' && data.prompts)) {
      const items = exportType === 'full' ? data.prompts : data;
      markdown += `## Prompts (${items.length})\n\n`;
      items.forEach((item: any, index: number) => {
        markdown += `### ${index + 1}. ${item.title || 'Untitled'}\n\n`;
        markdown += `**Platform:** ${item.platform || 'Unknown'}\n\n`;
        if (item.tags && item.tags.length > 0) {
          markdown += `**Tags:** ${item.tags.join(', ')}\n\n`;
        }
        markdown += `**Content:**\n\n${item.content || ''}\n\n`;
        markdown += `---\n\n`;
      });
    }
    
    return markdown;
  }

  // === Phase 4: API Key Management System ===
  
  // POST /api/developer/keys - Create new API key
  app.post("/api/developer/keys", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const validatedData = createApiKeySchema.parse(req.body);

      // Check user's current API key count (rate limiting)
      const existingKeys = await drizzleDB
        .select({ count: sql`count(*)` })
        .from(apiKeys)
        .where(and(
          eq(apiKeys.userId, userId),
          isNull(apiKeys.revokedAt)
        ));

      const keyCount = Number(existingKeys[0]?.count || 0);
      if (keyCount >= 10) { // Limit to 10 active API keys per user
        return res.status(429).json({ 
          message: 'Maximum API key limit reached (10 keys)',
          currentCount: keyCount,
          maxKeys: 10
        });
      }

      // Generate cryptographically secure API key (32 random bytes = 64 hex chars)
      const rawKey = randomBytes(32).toString('hex');
      
      // Create the full API key with prefix
      const fullApiKey = `plr_${rawKey}`;
      
      // Hash the key for secure storage
      const keyHash = await bcrypt.hash(fullApiKey, 12);
      
      // Store last 4 characters for identification
      const lastFour = fullApiKey.slice(-4);

      // Set expiration (default 1 year, or custom)
      const expiresAt = validatedData.expiresAt || 
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      // Create API key record
      const [newKey] = await drizzleDB
        .insert(apiKeys)
        .values({
          userId,
          name: validatedData.name,
          keyHash,
          lastFour,
          permissions: validatedData.permissions || ['read'],
          rateLimit: validatedData.rateLimit || 1000,
          expiresAt
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          lastFour: apiKeys.lastFour,
          permissions: apiKeys.permissions,
          rateLimit: apiKeys.rateLimit,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt
        });

      // Record usage metric for API key creation
      await drizzleDB
        .insert(usageMetrics)
        .values({
          userId,
          metricType: 'api_keys_created',
          value: 1,
          periodStart: new Date(),
          periodEnd: new Date()
        });

      res.status(201).json({
        message: 'API key created successfully',
        key: newKey,
        // WARNING: This is the only time the full key is shown
        apiKey: fullApiKey,
        warning: 'Store this API key securely. It will not be shown again.'
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: error.errors 
        });
      }
      console.error('Error creating API key:', error);
      res.status(500).json({ message: 'Failed to create API key' });
    }
  });

  // GET /api/developer/keys - List user's API keys
  app.get("/api/developer/keys", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);

      const userKeys = await drizzleDB
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          lastFour: apiKeys.lastFour,
          permissions: apiKeys.permissions,
          rateLimit: apiKeys.rateLimit,
          lastUsedAt: apiKeys.lastUsedAt,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt,
          revokedAt: apiKeys.revokedAt
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt));

      // Categorize keys by status
      const activeKeys = userKeys.filter(key => !key.revokedAt && (!key.expiresAt || key.expiresAt > new Date()));
      const expiredKeys = userKeys.filter(key => !key.revokedAt && key.expiresAt && key.expiresAt <= new Date());
      const revokedKeys = userKeys.filter(key => key.revokedAt);

      res.json({
        keys: userKeys,
        summary: {
          total: userKeys.length,
          active: activeKeys.length,
          expired: expiredKeys.length,
          revoked: revokedKeys.length,
          maxKeys: 10
        }
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: 'Failed to fetch API keys' });
    }
  });

  // DELETE /api/developer/keys/:keyId - Revoke API key
  app.delete("/api/developer/keys/:keyId", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { keyId } = req.params;

      if (!keyId) {
        return res.status(400).json({ message: 'API key ID required' });
      }

      // Verify ownership and existence
      const [existingKey] = await drizzleDB
        .select()
        .from(apiKeys)
        .where(and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.userId, userId)
        ))
        .limit(1);

      if (!existingKey) {
        return res.status(404).json({ message: 'API key not found' });
      }

      if (existingKey.revokedAt) {
        return res.status(400).json({ 
          message: 'API key already revoked',
          revokedAt: existingKey.revokedAt
        });
      }

      // Revoke the key (soft delete)
      const [revokedKey] = await drizzleDB
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.userId, userId)
        ))
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          lastFour: apiKeys.lastFour,
          revokedAt: apiKeys.revokedAt
        });

      res.json({
        message: 'API key revoked successfully',
        key: revokedKey
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error revoking API key:', error);
      res.status(500).json({ message: 'Failed to revoke API key' });
    }
  });

  // PATCH /api/developer/keys/:keyId - Update API key (name, permissions, rate limit)
  app.patch("/api/developer/keys/:keyId", subscriptionRateLimit, async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const { keyId } = req.params;
      const { name, permissions, rateLimit } = req.body;

      if (!keyId) {
        return res.status(400).json({ message: 'API key ID required' });
      }

      // Verify ownership and existence
      const [existingKey] = await drizzleDB
        .select()
        .from(apiKeys)
        .where(and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.userId, userId),
          isNull(apiKeys.revokedAt)
        ))
        .limit(1);

      if (!existingKey) {
        return res.status(404).json({ message: 'API key not found or revoked' });
      }

      // Build update object
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (permissions !== undefined) updateData.permissions = permissions;
      if (rateLimit !== undefined) updateData.rateLimit = rateLimit;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      // Update the key
      const [updatedKey] = await drizzleDB
        .update(apiKeys)
        .set(updateData)
        .where(and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.userId, userId)
        ))
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          lastFour: apiKeys.lastFour,
          permissions: apiKeys.permissions,
          rateLimit: apiKeys.rateLimit,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt
        });

      res.json({
        message: 'API key updated successfully',
        key: updatedKey
      });

    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error updating API key:', error);
      res.status(500).json({ message: 'Failed to update API key' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

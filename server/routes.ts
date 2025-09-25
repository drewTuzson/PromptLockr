import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, signupSchema, insertPromptSchema, insertFolderSchema, enhancePromptSchema, enhanceNewPromptSchema, insertTemplateSchema, insertTemplateVariableSchema, instantiateTemplateSchema, templates, templateVariables, templateUsage, users, folders, profileImages, promptShares, shareLinks, promptCollections, collectionItems, collectionFollowers, aiEnhancementSessions, promptAnalytics, collabSessions, collabParticipants, collabContributions, aiRecommendations, insertPromptCollectionSchema, insertCollectionItemSchema, insertCollectionFollowerSchema, insertAiEnhancementSessionSchema, insertPromptAnalyticsSchema, insertCollabSessionSchema, insertCollabParticipantSchema, insertCollabContributionSchema, insertAiRecommendationSchema } from "@shared/schema";
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
import { sql, eq, and, or, desc, ilike, isNotNull, isNull } from "drizzle-orm";
import { claudeService } from "./services/claudeService.js";
import { templateEngine } from "./services/templateEngine.js";

const replitDB = new ReplitDBAdapter();
const healthDB = new Database();

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
          preferences: JSON.stringify({ theme: 'light' })
        }).onConflictDoUpdate({
          target: users.email,
          set: {
            id: replitUser.id,
            passwordHash: passwordHash,
            preferences: JSON.stringify({ theme: 'light' })
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

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, signupSchema, insertPromptSchema, insertFolderSchema, enhancePromptSchema, enhanceNewPromptSchema, insertTemplateSchema, insertTemplateVariableSchema, instantiateTemplateSchema, templates, templateVariables, templateUsage } from "@shared/schema";
import { z } from "zod";
import { ReplitDBAdapter } from "../lib/db/replit-db";
import { AuthService } from "../lib/auth/jwt-auth";
import Database from "@replit/database";
import { db as drizzleDB } from "./db.js";
import { prompts } from "@shared/schema";
import { validateAndSanitizeFilters } from "./utils/filterValidation.js";
import { buildFilterConditions, buildOrderBy } from "./utils/filterQueryBuilder.js";
import { sql, eq, and } from "drizzle-orm";
import { claudeService } from "./services/claudeService.js";
import { templateEngine } from "./services/templateEngine.js";

const replitDB = new ReplitDBAdapter();
const healthDB = new Database();

function requireAuth(req: any): { userId: string; email: string } {
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

      // Check if user exists
      const existingUser = await replitDB.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists'
        });
      }

      // Create user
      const passwordHash = await AuthService.hashPassword(password);
      const user = await replitDB.createUser({
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
        preferences: {
          theme: 'light'
        }
      });

      // Generate token
      const token = AuthService.generateToken(user.id, user.email);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          preferences: user.preferences
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

      // Find user
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
        error: 'Failed to login'
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
      
      // Backward compatibility: Use existing storage interface for basic queries
      const query = req.query.q as string;
      let promptsResult;
      if (query) {
        promptsResult = await storage.searchPrompts(userId, query);
      } else {
        promptsResult = await storage.getUserPrompts(userId);
      }
      
      res.json(promptsResult);
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
      
      const newPrompt = await storage.createPrompt(promptData);
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
      const prompts = await storage.getFavoritePrompts(userId);
      res.json(prompts);
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
      const prompts = await storage.getRecentPrompts(userId);
      res.json(prompts);
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
      console.log('Fetching trashed prompts for user:', userId);
      const trashedPrompts = await storage.getTrashedPrompts(userId);
      console.log('Found trashed prompts:', trashedPrompts.length);
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
      const existing = await storage.getPrompt(req.params.id);
      
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      const success = await storage.restorePrompt(req.params.id);
      if (success) {
        res.json({ message: "Prompt restored successfully" });
      } else {
        res.status(500).json({ message: "Failed to restore prompt" });
      }
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
      const existing = await storage.getPrompt(req.params.id);
      
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      const success = await storage.permanentlyDeletePrompt(req.params.id);
      if (success) {
        res.json({ message: "Prompt permanently deleted" });
      } else {
        res.status(500).json({ message: "Failed to permanently delete prompt" });
      }
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
      const prompt = await storage.getPrompt(req.params.id);
      
      if (!prompt || prompt.userId !== userId) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      // Update last accessed
      await storage.updatePrompt(req.params.id, { lastAccessed: new Date() });
      
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
      const existing = await storage.getPrompt(req.params.id);
      
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      const updates = req.body;
      delete updates.userId; // Prevent userId changes
      delete updates.id; // Prevent id changes
      
      // Always update the updatedAt timestamp for modifications
      updates.updatedAt = new Date();
      
      const updated = await storage.updatePrompt(req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        return res.status(401).json({ message: error.message });
      }
      console.error('Error updating prompt:', error);
      res.status(500).json({ message: "Failed to update prompt" });
    }
  });

  app.delete("/api/prompts/:id", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      console.log('Deleting prompt:', req.params.id, 'for user:', userId);
      const existing = await storage.getPrompt(req.params.id);
      
      if (!existing || existing.userId !== userId) {
        console.log('Prompt not found or not owned by user');
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      console.log('Moving prompt to trash:', existing.title);
      await storage.deletePrompt(req.params.id);
      console.log('Prompt moved to trash successfully');
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
      const { category, search } = req.query;
      
      let whereConditions = [eq(templates.userId, userId)];
      
      if (category && typeof category === 'string') {
        whereConditions.push(eq(templates.category, category));
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
      const { title, description, content, category, tags, variables } = req.body;
      
      // Validate template content
      const validation = templateEngine.validateTemplate(content);
      if (!validation.valid) {
        return res.status(400).json({ 
          message: 'Invalid template', 
          errors: validation.errors 
        });
      }
      
      // Parse variables from content
      const detectedVars = templateEngine.parseVariables(content);
      
      const templateData = {
        userId,
        title,
        description,
        content,
        category,
        tags: tags || [],
        isPublic: false
      };

      // Validate template data
      const validationResult = insertTemplateSchema.safeParse(templateData);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid template data',
          errors: validationResult.error.issues
        });
      }
      
      // Create template and variables in a transaction
      const [template] = await drizzleDB.insert(templates)
        .values(validationResult.data)
        .returning();
      
      // Create template variables if provided
      if (variables && Array.isArray(variables)) {
        const variableData = variables.map((variable: any, index: number) => ({
          templateId: template.id,
          variableName: variable.variableName,
          variableType: variable.variableType || 'text',
          required: variable.required !== false,
          defaultValue: variable.defaultValue,
          options: variable.options,
          description: variable.description,
          minValue: variable.minValue,
          maxValue: variable.maxValue,
          sortOrder: variable.sortOrder || index
        }));
        
        const validVariables = variableData.filter(v => 
          insertTemplateVariableSchema.safeParse(v).success
        );
        
        if (validVariables.length > 0) {
          await drizzleDB.insert(templateVariables)
            .values(validVariables);
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
        platform: 'ChatGPT' as const,
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
      
      // Record template usage
      await drizzleDB.insert(templateUsage).values({
        templateId,
        userId,
        promptId: prompt.id,
        variableValues: JSON.stringify(variableValues)
      });
      
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

  const httpServer = createServer(app);
  return httpServer;
}

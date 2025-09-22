import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, signupSchema, insertPromptSchema, insertFolderSchema } from "@shared/schema";
import { z } from "zod";
import { ReplitDBAdapter } from "../lib/db/replit-db";
import { AuthService } from "../lib/auth/jwt-auth";
import Database from "@replit/database";

const db = new ReplitDBAdapter();
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
      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists'
        });
      }

      // Create user
      const passwordHash = await AuthService.hashPassword(password);
      const user = await db.createUser({
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
      const user = await db.getUserByEmail(email);
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

  // Prompts routes
  app.get("/api/prompts", async (req, res) => {
    try {
      const { userId } = requireAuth(req);
      const query = req.query.q as string;
      
      let prompts;
      if (query) {
        prompts = await storage.searchPrompts(userId, query);
      } else {
        prompts = await storage.getUserPrompts(userId);
      }
      
      res.json(prompts);
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
      const existing = await storage.getPrompt(req.params.id);
      
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      
      await storage.deletePrompt(req.params.id);
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

  const httpServer = createServer(app);
  return httpServer;
}

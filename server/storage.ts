import { type User, type InsertUser, type Folder, type InsertFolder, type Prompt, type InsertPrompt } from "@shared/schema";
import { ReplitDBAdapter } from "../lib/db/replit-db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || 'fallback-dev-secret';

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Auth operations
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateToken(userId: string, email: string): string;
  verifyToken(token: string): { userId: string; email: string } | null;
  
  // Folder operations
  getFolder(id: string): Promise<Folder | undefined>;
  getUserFolders(userId: string): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: string, updates: Partial<Folder>): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<boolean>;
  
  // Prompt operations
  getPrompt(id: string): Promise<Prompt | undefined>;
  getUserPrompts(userId: string, limit?: number): Promise<Prompt[]>;
  createPrompt(prompt: InsertPrompt): Promise<Prompt>;
  updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt | undefined>;
  deletePrompt(id: string): Promise<boolean>;
  searchPrompts(userId: string, query: string): Promise<Prompt[]>;
  getFavoritePrompts(userId: string): Promise<Prompt[]>;
  getRecentPrompts(userId: string, limit?: number): Promise<Prompt[]>;
  
  // Export/Import
  exportUserData(userId: string): Promise<string>;
  importUserData(userId: string, data: string): Promise<{ promptsImported: number; foldersImported: number }>;
}

export class ReplitStorage implements IStorage {
  private replitDB = new ReplitDBAdapter();
  // Auth operations
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
  }

  verifyToken(token: string): { userId: string; email: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return null;
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const user = await this.replitDB.getUserById(id);
    if (!user) return undefined;
    
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      preferences: user.preferences,
      createdAt: new Date(user.createdAt),

    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await this.replitDB.getUserByEmail(email);
    if (!user) return undefined;
    
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      preferences: user.preferences,
      createdAt: new Date(user.createdAt),

    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = await this.replitDB.createUser({
      email: insertUser.email,
      passwordHash: insertUser.passwordHash,
      preferences: insertUser.preferences || { theme: 'light' as const },
      createdAt: new Date().toISOString()
    });
    
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      preferences: user.preferences,
      createdAt: new Date(user.createdAt),
    };
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    // Note: ReplitDBAdapter doesn't have updateUser method in the guide
    // For now, we'll return the existing user without updates
    return this.getUser(id);
  }

  // Folder operations
  async getFolder(id: string): Promise<Folder | undefined> {
    // Note: ReplitDBAdapter doesn't have getFolder by id, need to implement search
    // For now, return undefined
    return undefined;
  }

  async getUserFolders(userId: string): Promise<Folder[]> {
    const folders = await this.replitDB.getUserFolders(userId);
    return folders.map(f => ({
      id: f.id,
      userId: f.userId,
      name: f.name,
      parentId: f.parentId || null,
      createdAt: new Date(f.createdAt),
    }));
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const folder = await this.replitDB.createFolder({
      userId: insertFolder.userId,
      name: insertFolder.name,
      parentId: insertFolder.parentId || undefined,
      promptCount: 0,
      createdAt: new Date().toISOString()
    });
    
    return {
      id: folder.id,
      userId: folder.userId,
      name: folder.name,
      parentId: folder.parentId || null,
      createdAt: new Date(folder.createdAt)
    };
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    // Note: ReplitDBAdapter doesn't have updateFolder method
    // For now, return undefined
    return undefined;
  }

  async deleteFolder(id: string): Promise<boolean> {
    // Note: ReplitDBAdapter doesn't have deleteFolder method
    // For now, return false
    return false;
  }

  // Internal map to track prompt userId for operations that need it
  private promptUserMap = new Map<string, string>();

  // Prompt operations  
  async getPrompt(id: string): Promise<Prompt | undefined> {
    const userId = this.promptUserMap.get(id);
    if (!userId) return undefined;
    
    const prompt = await this.replitDB.getPrompt(userId, id);
    if (!prompt) return undefined;
    
    return this.convertPromptFromReplit(prompt);
  }

  async getUserPrompts(userId: string, limit = 50): Promise<Prompt[]> {
    const prompts = await this.replitDB.getUserPrompts(userId, limit);
    // Store mappings for future operations
    prompts.forEach(p => this.promptUserMap.set(p.id, p.userId));
    return prompts.map(p => this.convertPromptFromReplit(p));
  }

  async createPrompt(insertPrompt: InsertPrompt): Promise<Prompt> {
    const prompt = await this.replitDB.createPrompt({
      userId: insertPrompt.userId,
      title: insertPrompt.title,
      content: insertPrompt.content,
      platform: insertPrompt.platform as 'ChatGPT' | 'Claude' | 'Midjourney' | 'DALL-E' | 'Other',
      tags: (insertPrompt.tags || []) as string[],
      folderId: insertPrompt.folderId || undefined,
      isFavorite: insertPrompt.isFavorite || false,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      charCount: insertPrompt.content.length
    });
    
    // Store mapping
    this.promptUserMap.set(prompt.id, prompt.userId);
    return this.convertPromptFromReplit(prompt);
  }

  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt | undefined> {
    const userId = this.promptUserMap.get(id);
    if (!userId) return undefined;
    
    const prompt = await this.replitDB.updatePrompt(userId, id, {
      title: updates.title,
      content: updates.content,
      platform: updates.platform as 'ChatGPT' | 'Claude' | 'Midjourney' | 'DALL-E' | 'Other' | undefined,
      tags: updates.tags ? (updates.tags as string[]) : undefined,
      folderId: updates.folderId || undefined,
      isFavorite: updates.isFavorite ?? undefined,
      lastAccessed: new Date().toISOString(),
      ...(updates.content && { charCount: updates.content.length })
    });
    
    if (!prompt) return undefined;
    return this.convertPromptFromReplit(prompt);
  }

  async deletePrompt(id: string): Promise<boolean> {
    const userId = this.promptUserMap.get(id);
    if (!userId) return false;
    
    const result = await this.replitDB.deletePrompt(userId, id);
    if (result) {
      this.promptUserMap.delete(id);
    }
    return result;
  }

  async searchPrompts(userId: string, query: string): Promise<Prompt[]> {
    const prompts = await this.replitDB.searchPrompts(userId, query);
    // Store mappings for future operations
    prompts.forEach(p => this.promptUserMap.set(p.id, p.userId));
    return prompts.map(p => this.convertPromptFromReplit(p));
  }

  async getFavoritePrompts(userId: string): Promise<Prompt[]> {
    const allPrompts = await this.replitDB.getUserPrompts(userId, 1000);
    const favorites = allPrompts.filter(p => p.isFavorite);
    // Store mappings for future operations
    favorites.forEach(p => this.promptUserMap.set(p.id, p.userId));
    return favorites.map(p => this.convertPromptFromReplit(p));
  }

  async getRecentPrompts(userId: string, limit = 10): Promise<Prompt[]> {
    const prompts = await this.replitDB.getUserPrompts(userId, limit);
    // Store mappings for future operations
    prompts.forEach(p => this.promptUserMap.set(p.id, p.userId));
    return prompts.map(p => this.convertPromptFromReplit(p));
  }

  private convertPromptFromReplit(prompt: any): Prompt {
    return {
      id: prompt.id,
      userId: prompt.userId,
      title: prompt.title,
      content: prompt.content,
      platform: prompt.platform,
      tags: prompt.tags,
      folderId: prompt.folderId || null,
      isFavorite: prompt.isFavorite,
      charCount: prompt.charCount.toString(),
      createdAt: new Date(prompt.createdAt),
      lastAccessed: new Date(prompt.lastAccessed)
    };
  }

  // Export/Import operations
  async exportUserData(userId: string): Promise<string> {
    return this.replitDB.exportUserData(userId);
  }

  async importUserData(userId: string, data: string): Promise<{ promptsImported: number; foldersImported: number }> {
    return this.replitDB.importUserData(userId, data);
  }
}

export const storage = new ReplitStorage();
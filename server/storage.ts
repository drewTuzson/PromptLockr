import { type User, type InsertUser, type Folder, type InsertFolder, type Prompt, type InsertPrompt } from "@shared/schema";
import { randomUUID } from "crypto";
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private folders: Map<string, Folder>;
  private prompts: Map<string, Prompt>;
  private usersByEmail: Map<string, string>; // email -> userId

  constructor() {
    this.users = new Map();
    this.folders = new Map();
    this.prompts = new Map();
    this.usersByEmail = new Map();
  }

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
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const userId = this.usersByEmail.get(email);
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      passwordHash: insertUser.passwordHash,
      createdAt: new Date(),
      preferences: insertUser.preferences ? {
        theme: (insertUser.preferences.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
        defaultPlatform: typeof insertUser.preferences.defaultPlatform === 'string' 
          ? insertUser.preferences.defaultPlatform 
          : undefined
      } : { theme: 'light' as const }
    };
    this.users.set(id, user);
    this.usersByEmail.set(user.email, id);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  // Folder operations
  async getFolder(id: string): Promise<Folder | undefined> {
    return this.folders.get(id);
  }

  async getUserFolders(userId: string): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(folder => folder.userId === userId);
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const id = randomUUID();
    const folder: Folder = {
      id,
      userId: insertFolder.userId,
      name: insertFolder.name,
      parentId: insertFolder.parentId || null,
      createdAt: new Date()
    };
    this.folders.set(id, folder);
    return folder;
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    const existing = this.folders.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.folders.set(id, updated);
    return updated;
  }

  async deleteFolder(id: string): Promise<boolean> {
    return this.folders.delete(id);
  }

  // Prompt operations
  async getPrompt(id: string): Promise<Prompt | undefined> {
    return this.prompts.get(id);
  }

  async getUserPrompts(userId: string, limit = 50): Promise<Prompt[]> {
    const userPrompts = Array.from(this.prompts.values())
      .filter(prompt => prompt.userId === userId)
      .sort((a, b) => new Date(b.lastAccessed!).getTime() - new Date(a.lastAccessed!).getTime())
      .slice(0, limit);
    
    return userPrompts;
  }

  async createPrompt(insertPrompt: InsertPrompt): Promise<Prompt> {
    const id = randomUUID();
    const now = new Date();
    const prompt: Prompt = {
      id,
      userId: insertPrompt.userId,
      title: insertPrompt.title,
      content: insertPrompt.content,
      platform: insertPrompt.platform as 'ChatGPT' | 'Claude' | 'Midjourney' | 'DALL-E' | 'Other',
      tags: insertPrompt.tags || [],
      folderId: insertPrompt.folderId || null,
      isFavorite: insertPrompt.isFavorite || false,
      createdAt: now,
      lastAccessed: now,
      charCount: insertPrompt.content.length.toString()
    };
    this.prompts.set(id, prompt);
    return prompt;
  }

  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt | undefined> {
    const existing = this.prompts.get(id);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      ...updates, 
      lastAccessed: new Date(),
      charCount: updates.content ? updates.content.length.toString() : existing.charCount
    };
    this.prompts.set(id, updated);
    return updated;
  }

  async deletePrompt(id: string): Promise<boolean> {
    return this.prompts.delete(id);
  }

  async searchPrompts(userId: string, query: string): Promise<Prompt[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.prompts.values())
      .filter(prompt => 
        prompt.userId === userId && (
          prompt.title.toLowerCase().includes(lowerQuery) ||
          prompt.content.toLowerCase().includes(lowerQuery) ||
          prompt.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        )
      )
      .sort((a, b) => new Date(b.lastAccessed!).getTime() - new Date(a.lastAccessed!).getTime());
  }

  async getFavoritePrompts(userId: string): Promise<Prompt[]> {
    return Array.from(this.prompts.values())
      .filter(prompt => prompt.userId === userId && prompt.isFavorite)
      .sort((a, b) => new Date(b.lastAccessed!).getTime() - new Date(a.lastAccessed!).getTime());
  }

  async getRecentPrompts(userId: string, limit = 10): Promise<Prompt[]> {
    return Array.from(this.prompts.values())
      .filter(prompt => prompt.userId === userId)
      .sort((a, b) => new Date(b.lastAccessed!).getTime() - new Date(a.lastAccessed!).getTime())
      .slice(0, limit);
  }

  async exportUserData(userId: string): Promise<string> {
    const prompts = await this.getUserPrompts(userId, 1000);
    const folders = await this.getUserFolders(userId);
    
    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      prompts,
      folders,
      tags: Array.from(new Set(prompts.flatMap(p => p.tags || [])))
    }, null, 2);
  }

  async importUserData(userId: string, data: string): Promise<{ promptsImported: number; foldersImported: number }> {
    const parsed = JSON.parse(data);
    let promptsImported = 0;
    let foldersImported = 0;

    // Import folders first
    for (const folder of parsed.folders || []) {
      await this.createFolder({
        userId,
        name: folder.name,
        parentId: folder.parentId
      });
      foldersImported++;
    }

    // Import prompts
    for (const prompt of parsed.prompts || []) {
      await this.createPrompt({
        userId,
        title: prompt.title,
        content: prompt.content,
        platform: prompt.platform,
        tags: prompt.tags,
        folderId: prompt.folderId,
        isFavorite: prompt.isFavorite
      });
      promptsImported++;
    }

    return { promptsImported, foldersImported };
  }
}

export const storage = new MemStorage();

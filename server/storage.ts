import { type User, type InsertUser, type Folder, type InsertFolder, type Prompt, type InsertPrompt, users, folders, prompts } from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, desc, and } from "drizzle-orm";
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

export class DatabaseStorage implements IStorage {
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  // Folder operations
  async getFolder(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder || undefined;
  }

  async getUserFolders(userId: string): Promise<Folder[]> {
    return db.select().from(folders).where(eq(folders.userId, userId)).orderBy(folders.name);
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const [folder] = await db.insert(folders).values(insertFolder).returning();
    return folder;
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    const [updated] = await db.update(folders).set(updates).where(eq(folders.id, id)).returning();
    return updated || undefined;
  }

  async deleteFolder(id: string): Promise<boolean> {
    const result = await db.delete(folders).where(eq(folders.id, id));
    return result.rowCount > 0;
  }

  // Prompt operations
  async getPrompt(id: string): Promise<Prompt | undefined> {
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id));
    return prompt || undefined;
  }

  async getUserPrompts(userId: string, limit = 50): Promise<Prompt[]> {
    return db.select().from(prompts)
      .where(eq(prompts.userId, userId))
      .orderBy(desc(prompts.lastAccessed))
      .limit(limit);
  }

  async createPrompt(insertPrompt: InsertPrompt): Promise<Prompt> {
    const promptData = {
      ...insertPrompt,
      charCount: insertPrompt.content.length.toString(),
      isFavorite: insertPrompt.isFavorite || false,
    };
    const [prompt] = await db.insert(prompts).values(promptData).returning();
    return prompt;
  }

  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt | undefined> {
    const updateData = {
      ...updates,
      lastAccessed: new Date(),
      ...(updates.content && { charCount: updates.content.length.toString() })
    };
    const [updated] = await db.update(prompts).set(updateData).where(eq(prompts.id, id)).returning();
    return updated || undefined;
  }

  async deletePrompt(id: string): Promise<boolean> {
    const result = await db.delete(prompts).where(eq(prompts.id, id));
    return result.rowCount > 0;
  }

  async searchPrompts(userId: string, query: string): Promise<Prompt[]> {
    return db.select().from(prompts)
      .where(
        and(
          eq(prompts.userId, userId),
          or(
            ilike(prompts.title, `%${query}%`),
            ilike(prompts.content, `%${query}%`)
          )
        )
      )
      .orderBy(desc(prompts.lastAccessed));
  }

  async getFavoritePrompts(userId: string): Promise<Prompt[]> {
    return db.select().from(prompts)
      .where(
        and(
          eq(prompts.userId, userId),
          eq(prompts.isFavorite, true)
        )
      )
      .orderBy(desc(prompts.lastAccessed));
  }

  async getRecentPrompts(userId: string, limit = 10): Promise<Prompt[]> {
    return db.select().from(prompts)
      .where(eq(prompts.userId, userId))
      .orderBy(desc(prompts.lastAccessed))
      .limit(limit);
  }

  // Export/Import operations
  async exportUserData(userId: string): Promise<string> {
    const userPrompts = await this.getUserPrompts(userId, 1000);
    const userFolders = await this.getUserFolders(userId);
    
    const exportData = {
      prompts: userPrompts.map(p => ({
        title: p.title,
        content: p.content,
        platform: p.platform,
        tags: p.tags || [],
        isFavorite: p.isFavorite
      })),
      folders: userFolders.map(f => ({
        name: f.name,
        parentId: f.parentId
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  async importUserData(userId: string, data: string): Promise<{ promptsImported: number; foldersImported: number }> {
    try {
      const parsedData = JSON.parse(data);
      let promptsImported = 0;
      let foldersImported = 0;

      // Import folders first
      if (parsedData.folders && Array.isArray(parsedData.folders)) {
        for (const folderData of parsedData.folders) {
          try {
            await this.createFolder({
              userId,
              name: folderData.name,
              parentId: folderData.parentId || null
            });
            foldersImported++;
          } catch (error) {
            console.error('Error importing folder:', error);
          }
        }
      }

      // Import prompts
      if (parsedData.prompts && Array.isArray(parsedData.prompts)) {
        for (const promptData of parsedData.prompts) {
          try {
            await this.createPrompt({
              userId,
              title: promptData.title,
              content: promptData.content,
              platform: promptData.platform,
              tags: promptData.tags || [],
              isFavorite: promptData.isFavorite || false,
              folderId: null // Don't link to folders for now
            });
            promptsImported++;
          } catch (error) {
            console.error('Error importing prompt:', error);
          }
        }
      }

      return { promptsImported, foldersImported };
    } catch (error) {
      console.error('Error parsing import data:', error);
      throw new Error('Invalid import data format');
    }
  }
}

export const storage = new DatabaseStorage();
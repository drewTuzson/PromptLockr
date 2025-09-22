import Database from "@replit/database";

const db = new Database();

// User data structure with key pattern: user:{email}
interface UserDB {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  preferences: {
    theme: 'light' | 'dark';
    defaultPlatform?: string;
  };
}

// Prompt data structure with key pattern: prompt:{userId}:{promptId}
interface PromptDB {
  id: string;
  userId: string;
  title: string;
  content: string;
  platform: 'ChatGPT' | 'Claude' | 'Midjourney' | 'DALL-E' | 'Other';
  tags: string[];
  folderId?: string;
  isFavorite: boolean;
  createdAt: string;
  lastAccessed: string;
  charCount: number;
}

// Folder structure with key pattern: folder:{userId}:{folderId}
interface FolderDB {
  id: string;
  userId: string;
  name: string;
  parentId?: string;
  promptCount: number;
  createdAt: string;
}

export class ReplitDBAdapter {
  // User operations
  async createUser(userData: Omit<UserDB, 'id'>): Promise<UserDB> {
    const id = crypto.randomUUID();
    const user = { id, ...userData };
    await db.set(`user:${userData.email}`, JSON.stringify(user));
    await db.set(`user:id:${id}`, userData.email);
    return user;
  }

  async getUserByEmail(email: string): Promise<UserDB | null> {
    try {
      const userData = await db.get(`user:${email}`);
      
      // Check if userData is null or undefined
      if (!userData) return null;
      
      // Check if Replit Database returned an error object
      if (typeof userData === 'object' && 'ok' in userData && userData.ok === false) {
        return null;
      }
      
      // Handle Replit Database wrapped response format
      let jsonString;
      if (typeof userData === 'object' && 'ok' in userData && userData.ok === true && 'value' in userData) {
        jsonString = userData.value as string;
      } else if (typeof userData === 'string') {
        jsonString = userData;
      } else {
        // Direct object return (fallback)
        return userData as UserDB;
      }
      
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  async getUserById(id: string): Promise<UserDB | null> {
    try {
      const emailData = await db.get(`user:id:${id}`);
      if (!emailData) return null;
      
      // Check if Replit Database returned an error object
      if (typeof emailData === 'object' && 'ok' in emailData && emailData.ok === false) {
        return null;
      }
      
      // Handle Replit Database wrapped response format
      let emailString;
      if (typeof emailData === 'object' && 'ok' in emailData && emailData.ok === true && 'value' in emailData) {
        emailString = emailData.value as string;
      } else if (typeof emailData === 'string') {
        emailString = emailData;
      } else {
        // Direct return (fallback)
        emailString = emailData as string;
      }
      
      return this.getUserByEmail(emailString);
    } catch (error) {
      console.error('Error getting user by id:', error);
      return null;
    }
  }

  // Prompt operations with pagination support
  async createPrompt(promptData: Omit<PromptDB, 'id'>): Promise<PromptDB> {
    const id = crypto.randomUUID();
    const prompt = { id, ...promptData };
    await db.set(`prompt:${promptData.userId}:${id}`, JSON.stringify(prompt));
    return prompt;
  }

  async getPrompt(userId: string, promptId: string): Promise<PromptDB | null> {
    try {
      const data = await db.get(`prompt:${userId}:${promptId}`);
      if (!data) return null;
      
      // Check if Replit Database returned an error object
      if (typeof data === 'object' && 'ok' in data && data.ok === false) {
        return null;
      }
      
      // Handle Replit Database wrapped response format
      let jsonString;
      if (typeof data === 'object' && 'ok' in data && data.ok === true && 'value' in data) {
        jsonString = data.value as string;
      } else if (typeof data === 'string') {
        jsonString = data;
      } else {
        // Direct object return (fallback)
        return data as PromptDB;
      }
      
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error getting prompt:', error);
      return null;
    }
  }

  async updatePrompt(userId: string, promptId: string, updates: Partial<PromptDB>): Promise<PromptDB | null> {
    const existing = await this.getPrompt(userId, promptId);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates, lastAccessed: new Date().toISOString() };
    await db.set(`prompt:${userId}:${promptId}`, JSON.stringify(updated));
    return updated;
  }

  async deletePrompt(userId: string, promptId: string): Promise<boolean> {
    await db.delete(`prompt:${userId}:${promptId}`);
    return true;
  }

  async getUserPrompts(userId: string, limit = 50): Promise<PromptDB[]> {
    try {
      const keysResponse = await db.list(`prompt:${userId}:`);
      const prompts: PromptDB[] = [];
      
      // Handle Replit Database wrapped response format for list
      let keyArray: string[] = [];
      if (typeof keysResponse === 'object' && 'ok' in keysResponse && keysResponse.ok === true && 'value' in keysResponse) {
        keyArray = keysResponse.value as string[];
      } else if (Array.isArray(keysResponse)) {
        keyArray = keysResponse;
      } else {
        console.log('Unexpected keys response format:', keysResponse);
        return [];
      }
      
      for (const key of keyArray.slice(0, limit)) {
        const data = await db.get(key);
        if (data && !(typeof data === 'object' && 'ok' in data && data.ok === false)) {
          // Handle Replit Database wrapped response format
          let jsonString;
          if (typeof data === 'object' && 'ok' in data && data.ok === true && 'value' in data) {
            jsonString = data.value as string;
            prompts.push(JSON.parse(jsonString));
          } else if (typeof data === 'string') {
            prompts.push(JSON.parse(data));
          } else {
            // Direct object return (fallback)
            prompts.push(data as PromptDB);
          }
        }
      }
      
      return prompts.sort((a, b) => 
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
      );
    } catch (error) {
      console.error('Error getting user prompts:', error);
      return [];
    }
  }

  // Search implementation for MVP (client-side filtering)
  async searchPrompts(userId: string, query: string): Promise<PromptDB[]> {
    const allPrompts = await this.getUserPrompts(userId, 1000);
    const lowerQuery = query.toLowerCase();
    
    return allPrompts.filter(prompt => 
      prompt.title.toLowerCase().includes(lowerQuery) ||
      prompt.content.toLowerCase().includes(lowerQuery) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // Folder operations
  async createFolder(folderData: Omit<FolderDB, 'id'>): Promise<FolderDB> {
    const id = crypto.randomUUID();
    const folder = { id, ...folderData };
    await db.set(`folder:${folderData.userId}:${id}`, JSON.stringify(folder));
    return folder;
  }

  async getUserFolders(userId: string): Promise<FolderDB[]> {
    try {
      const keysResponse = await db.list(`folder:${userId}:`);
      const folders: FolderDB[] = [];
      
      // Handle Replit Database wrapped response format for list
      let keyArray: string[] = [];
      if (typeof keysResponse === 'object' && 'ok' in keysResponse && keysResponse.ok === true && 'value' in keysResponse) {
        keyArray = keysResponse.value as string[];
      } else if (Array.isArray(keysResponse)) {
        keyArray = keysResponse;
      } else {
        console.log('Unexpected keys response format:', keysResponse);
        return [];
      }
      
      for (const key of keyArray) {
        const data = await db.get(key);
        if (data && !(typeof data === 'object' && 'ok' in data && data.ok === false)) {
          // Handle Replit Database wrapped response format
          let jsonString;
          if (typeof data === 'object' && 'ok' in data && data.ok === true && 'value' in data) {
            jsonString = data.value as string;
            folders.push(JSON.parse(jsonString));
          } else if (typeof data === 'string') {
            folders.push(JSON.parse(data));
          } else {
            // Direct object return (fallback)
            folders.push(data as FolderDB);
          }
        }
      }
      
      return folders;
    } catch (error) {
      console.error('Error getting user folders:', error);
      return [];
    }
  }

  // Export functionality
  async exportUserData(userId: string): Promise<string> {
    const prompts = await this.getUserPrompts(userId, 1000);
    const folders = await this.getUserFolders(userId);
    
    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      prompts,
      folders,
      tags: Array.from(new Set(prompts.flatMap(p => p.tags)))
    }, null, 2);
  }

  // Import functionality
  async importUserData(userId: string, data: string): Promise<{ promptsImported: number; foldersImported: number }> {
    const parsed = JSON.parse(data);
    let promptsImported = 0;
    let foldersImported = 0;

    // Import folders first
    for (const folder of parsed.folders || []) {
      await this.createFolder({
        ...folder,
        userId,
        id: undefined // Generate new ID
      });
      foldersImported++;
    }

    // Import prompts
    for (const prompt of parsed.prompts || []) {
      await this.createPrompt({
        ...prompt,
        userId,
        id: undefined // Generate new ID
      });
      promptsImported++;
    }

    return { promptsImported, foldersImported };
  }
}
# PromptLockr Replit Development Guide

## Project Overview

PromptLockr is a full-stack AI prompt management system built as a monolithic Next.js application optimized for Replit deployment. It helps AI power users organize prompts across multiple platforms (ChatGPT, Claude, Midjourney, DALL-E) with a "personal command center" interface inspired by Coinbase's clean aesthetic.

## Quick Start

### 1. Initial Replit Setup

Create a new Repl using the **Next.js** template with TypeScript, then run:

```bash
# Install required dependencies
npm install @heroicons/react lucide-react jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
npm install @replit/database

# Install additional UI dependencies
npm install clsx tailwind-merge
```

### 2. Environment Configuration

Add these secrets in the Replit Secrets tab:

```env
JWT_SECRET=<generate-secure-random-string>
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-repl-name.repl.co
```

### 3. Replit Configuration Files

Create `.replit`:

```toml
run = "npm run dev"
entrypoint = "app/page.tsx"

[nix]
channel = "stable-22_11"

[env]
NEXT_TELEMETRY_DISABLED = "1"

[packager]
language = "nodejs"

[packager.features]
enabledForHosting = true
```

Create `replit.nix`:

```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.replitPackages.jest
  ];
}
```

## Project Structure

```
promptlockr/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── signup/route.ts
│   │   │   └── logout/route.ts
│   │   ├── prompts/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── search/route.ts
│   │   │   └── export/route.ts
│   │   ├── folders/
│   │   │   └── route.ts
│   │   └── health/route.ts
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── dashboard/
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── PromptGrid.tsx
│   │   ├── PromptCard.tsx
│   │   ├── PromptDetail.tsx
│   │   ├── SearchBar.tsx
│   │   └── FolderTree.tsx
│   ├── ui/
│   │   ├── CopyButton.tsx
│   │   ├── TagChip.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── EmptyState.tsx
│   └── modals/
│       ├── CreatePromptModal.tsx
│       └── ImportExportModal.tsx
├── lib/
│   ├── db/
│   │   └── replit-db.ts
│   ├── auth/
│   │   └── jwt-auth.ts
│   └── utils/
│       ├── clipboard.ts
│       ├── search.ts
│       ├── export.ts
│       └── performance.ts
├── hooks/
│   └── useMediaQuery.ts
├── styles/
│   └── globals.css
└── public/
    └── platform-icons/
        ├── chatgpt.svg
        ├── claude.svg
        ├── midjourney.svg
        └── dalle.svg
```

## Core Implementation

### Database Layer (`lib/db/replit-db.ts`)

```typescript
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
    const userData = await db.get(`user:${email}`);
    return userData ? JSON.parse(userData as string) : null;
  }

  async getUserById(id: string): Promise<UserDB | null> {
    const email = await db.get(`user:id:${id}`);
    if (!email) return null;
    return this.getUserByEmail(email as string);
  }

  // Prompt operations with pagination support
  async createPrompt(promptData: Omit<PromptDB, 'id'>): Promise<PromptDB> {
    const id = crypto.randomUUID();
    const prompt = { id, ...promptData };
    await db.set(`prompt:${promptData.userId}:${id}`, JSON.stringify(prompt));
    return prompt;
  }

  async getPrompt(userId: string, promptId: string): Promise<PromptDB | null> {
    const data = await db.get(`prompt:${userId}:${promptId}`);
    return data ? JSON.parse(data as string) : null;
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
    const keys = await db.list(`prompt:${userId}:`);
    const prompts: PromptDB[] = [];
    
    for (const key of keys.slice(0, limit)) {
      const data = await db.get(key);
      if (data) prompts.push(JSON.parse(data as string));
    }
    
    return prompts.sort((a, b) => 
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    );
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
    const keys = await db.list(`folder:${userId}:`);
    const folders: FolderDB[] = [];
    
    for (const key of keys) {
      const data = await db.get(key);
      if (data) folders.push(JSON.parse(data as string));
    }
    
    return folders;
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
      tags: [...new Set(prompts.flatMap(p => p.tags))]
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
```

### Authentication System (`lib/auth/jwt-auth.ts`)

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  static verifyToken(token: string): { userId: string; email: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return null;
    }
  }
}

// Middleware for protected routes
export function withAuth(handler: any) {
  return async (req: any, res: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    return handler(req, res);
  };
}
```

### API Routes

#### Health Check (`app/api/health/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import Database from "@replit/database";

export async function GET() {
  try {
    const db = new Database();
    await db.get('health_check');
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    );
  }
}
```

#### Authentication Routes (`app/api/auth/signup/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ReplitDBAdapter } from '@/lib/db/replit-db';
import { AuthService } from '@/lib/auth/jwt-auth';

const db = new ReplitDBAdapter();

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
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

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        preferences: user.preferences
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

#### Prompts API (`app/api/prompts/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ReplitDBAdapter } from '@/lib/db/replit-db';
import { AuthService } from '@/lib/auth/jwt-auth';

const db = new ReplitDBAdapter();

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get search query if provided
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    let prompts;
    if (query) {
      prompts = await db.searchPrompts(decoded.userId, query);
    } else {
      prompts = await db.getUserPrompts(decoded.userId);
    }

    return NextResponse.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    
    const newPrompt = await db.createPrompt({
      userId: decoded.userId,
      title: body.title,
      content: body.content,
      platform: body.platform || 'ChatGPT',
      tags: body.tags || [],
      folderId: body.folderId,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      charCount: body.content.length
    });
    
    return NextResponse.json(newPrompt, { status: 201 });
  } catch (error) {
    console.error('Error creating prompt:', error);
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}
```

### Utility Functions

#### Clipboard Utility (`lib/utils/clipboard.ts`)

```typescript
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers or non-secure contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export function showCopySuccess() {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse';
  toast.textContent = 'Copied to clipboard!';
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
```

#### Performance Utilities (`lib/utils/performance.ts`)

```typescript
// Cache management for Replit's environment
export class CacheManager {
  private static cache = new Map<string, { value: any; expiry: number }>();
  
  static set(key: string, value: any, ttl = 5 * 60 * 1000) { // 5 minutes default
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }
  
  static get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  static clear() {
    this.cache.clear();
  }
}

// Debounce for search
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Local storage wrapper with fallback
export class LocalStorage {
  static setItem(key: string, value: any): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('LocalStorage setItem failed:', error);
    }
  }
  
  static getItem(key: string): any {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
    } catch (error) {
      console.error('LocalStorage getItem failed:', error);
      return null;
    }
  }
  
  static removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('LocalStorage removeItem failed:', error);
    }
  }
}
```

### Custom Hooks

#### Media Query Hook (`hooks/useMediaQuery.ts`)

```typescript
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}
```

### Tailwind Configuration (`tailwind.config.js`)

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0052FF',
        secondary: '#1B1B1E',
        accent: '#00D395',
        warning: '#F5A623',
        error: '#DF5060',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.3s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-scale': 'pulseScale 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseScale: {
          '0%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
```

## Testing

### Unit Test Example (`__tests__/utils/clipboard.test.ts`)

```typescript
import { copyToClipboard } from '@/lib/utils/clipboard';

describe('Clipboard functionality', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(() => Promise.resolve()),
      },
    });
  });

  test('copies text to clipboard successfully', async () => {
    const text = 'Test prompt content';
    const result = await copyToClipboard(text);
    
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
  });

  test('falls back to execCommand when clipboard API unavailable', async () => {
    // Remove clipboard API
    Object.assign(navigator, { clipboard: undefined });
    
    // Mock execCommand
    document.execCommand = jest.fn(() => true);
    
    const text = 'Test prompt content';
    const result = await copyToClipboard(text);
    
    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});
```

### API Integration Test (`__tests__/api/prompts.test.ts`)

```typescript
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/prompts/route';

describe('Prompts API', () => {
  const mockToken = 'valid-jwt-token';
  
  beforeEach(() => {
    // Mock auth verification
    jest.spyOn(AuthService, 'verifyToken').mockReturnValue({
      userId: 'test-user-id',
      email: 'test@example.com'
    });
  });

  test('GET /api/prompts returns user prompts', async () => {
    const request = new NextRequest('http://localhost/api/prompts', {
      headers: {
        'Authorization': `Bearer ${mockToken}`
      }
    });
    
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST /api/prompts creates new prompt', async () => {
    const promptData = {
      title: 'Test Prompt',
      content: 'This is a test prompt content',
      platform: 'ChatGPT',
      tags: ['test', 'example']
    };
    
    const request = new NextRequest('http://localhost/api/prompts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(promptData)
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(201);
    expect(data.title).toBe(promptData.title);
    expect(data.content).toBe(promptData.content);
  });
});
```

## Deployment Checklist

- [ ] **Environment Setup**
  - [ ] JWT_SECRET configured in Replit Secrets
  - [ ] NODE_ENV set to production
  - [ ] Custom domain configured (if available)

- [ ] **Core Features**
  - [ ] User authentication (signup/login/logout)
  - [ ] Prompt CRUD operations
  - [ ] Folder management
  - [ ] Tag system
  - [ ] Search functionality (< 500ms)
  - [ ] Copy-to-clipboard across browsers
  - [ ] Dark mode toggle
  - [ ] Mobile responsive design

- [ ] **Data Management**
  - [ ] Export functionality (JSON)
  - [ ] Import functionality
  - [ ] Data persistence in Replit DB
  - [ ] Recent prompts tracking

- [ ] **Performance**
  - [ ] Page load < 2 seconds
  - [ ] Search results < 500ms
  - [ ] Smooth animations (60fps)
  - [ ] Offline capability for cached prompts

- [ ] **Production Readiness**
  - [ ] Health check endpoint working
  - [ ] Error boundaries implemented
  - [ ] Loading states for all operations
  - [ ] User-friendly error messages
  - [ ] Basic analytics setup

## Post-MVP Enhancements

### Phase 1: Performance & Scale (Months 1-2)
- Migrate to PostgreSQL when approaching 500 users
- Implement server-side search with indexing
- Add Redis caching layer
- Set up CDN for static assets

### Phase 2: Advanced Features (Months 3-4)
- Collaborative prompt sharing
- Version history for prompts
- Advanced bulk operations
- AI-powered prompt suggestions
- Template marketplace

### Phase 3: Enterprise Features (Months 5-6)
- Team workspaces
- SSO integration
- Advanced analytics dashboard
- API access for developers
- White-label options

## Troubleshooting

### Common Issues

#### 1. Clipboard API Not Working
```javascript
// Ensure HTTPS or localhost
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.warn('Clipboard API requires secure context');
  // Use fallback method
}
```

#### 2. Replit DB Connection Issues
```javascript
// Add retry logic for database operations
async function retryDBOperation(operation: Function, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

#### 3. Dark Mode Flashing
```javascript
// Add to app/layout.tsx before body renders
<script dangerouslySetInnerHTML={{
  __html: `
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.add(theme);
  `
}} />
```

## Support & Resources

- **Replit Documentation**: https://docs.replit.com
- **Next.js Documentation**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Heroicons**: https://heroicons.com

## License

MIT License - Feel free to use this code for your PromptLockr implementation.

---

**Ready to build!** Save this file as `REPLIT_GUIDE.md` in your Replit project root and reference it throughout development.
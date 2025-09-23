import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { enhancementSessions, rateLimits } from '@shared/schema';

interface EnhancementOptions {
  platform?: string;
  tone?: 'professional' | 'casual' | 'academic' | 'creative';
  focus?: 'clarity' | 'engagement' | 'specificity' | 'structure';
}

interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetsAt: Date;
  limit: number;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  id: string;
  model: string;
  role: 'assistant';
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence: null | string;
  type: 'message';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeEnhancementService {
  private rateLimitWindow = 60 * 60 * 1000; // 1 hour in milliseconds
  private freeUserLimit = parseInt(process.env.ENHANCEMENT_RATE_LIMIT_FREE || '10');
  private premiumUserLimit = parseInt(process.env.ENHANCEMENT_RATE_LIMIT_PREMIUM || '100');
  private initialized = false;

  constructor() {
    // Lazy initialization - API key checked on first use
  }

  private ensureInitialized() {
    if (!this.initialized) {
      if (!process.env.CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY is not configured');
      }
      this.initialized = true;
    }
  }

  async enhancePrompt(
    originalPrompt: string, 
    userId: string,
    options: EnhancementOptions = {}
  ): Promise<{
    success: boolean;
    enhanced?: string;
    error?: string;
    sessionId?: string;
  }> {
    // Ensure service is initialized
    this.ensureInitialized();
    
    // Check rate limit
    const rateLimit = await this.checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. You have ${rateLimit.remaining} enhancements remaining. Resets at ${rateLimit.resetsAt.toLocaleTimeString()}`
      };
    }

    // Create enhancement session
    const sessionId = `enh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(enhancementSessions).values({
      id: sessionId,
      userId: userId,
      originalContent: originalPrompt,
      platform: options.platform,
      status: 'pending',
    });

    try {
      const startTime = Date.now();
      
      // Build enhancement prompt
      const systemPrompt = this.buildSystemPrompt(options);
      
      // Call Claude API directly using fetch
      const enhancedContent = await this.callClaudeAPI(systemPrompt, originalPrompt);
      
      const responseTime = Date.now() - startTime;

      // Update session with success
      await db.update(enhancementSessions)
        .set({
          enhancedContent: enhancedContent,
          status: 'success',
          apiResponseTime: responseTime
        })
        .where(eq(enhancementSessions.id, sessionId));

      // Increment rate limit counter
      await this.incrementRateLimit(userId);

      return {
        success: true,
        enhanced: enhancedContent,
        sessionId
      };

    } catch (error: any) {
      console.error('Claude API error:', error);
      
      // Update session with failure
      await db.update(enhancementSessions)
        .set({
          status: 'failed',
          errorMessage: error.message
        })
        .where(eq(enhancementSessions.id, sessionId));

      return {
        success: false,
        error: 'Failed to enhance prompt. Please try again.',
        sessionId
      };
    }
  }

  private async callClaudeAPI(systemPrompt: string, originalPrompt: string): Promise<string> {
    const requestBody = {
      model: 'claude-3-haiku-20240307', // Using Haiku for cost efficiency
      max_tokens: 1024,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Please optimize this AI prompt for maximum effectiveness:\n\n${originalPrompt}\n\nProvide only the optimized prompt without explanations.`
        }
      ]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as ClaudeResponse;
    
    if (!data.content || data.content.length === 0) {
      throw new Error('No content received from Claude API');
    }

    return data.content[0].text;
  }

  private buildSystemPrompt(options: EnhancementOptions): string {
    let systemPrompt = `You are an expert AI prompt engineer. Your task is to optimize prompts for maximum effectiveness.

OPTIMIZATION REQUIREMENTS:
- Maintain the original intent and purpose
- Improve clarity and specificity
- Add appropriate structure for better AI comprehension
- Include relevant context or constraints where helpful
- Ensure actionable outputs
- Remove ambiguity and redundancy`;

    if (options.platform) {
      systemPrompt += `\n- Optimize specifically for ${options.platform}`;
    }

    if (options.tone) {
      const toneMap = {
        professional: 'formal and business-appropriate',
        casual: 'friendly and conversational',
        academic: 'scholarly and precise',
        creative: 'imaginative and engaging'
      };
      systemPrompt += `\n- Use a ${toneMap[options.tone]} tone`;
    }

    if (options.focus) {
      const focusMap = {
        clarity: 'crystal-clear instructions and expectations',
        engagement: 'compelling and attention-grabbing language',
        specificity: 'detailed requirements and constraints',
        structure: 'well-organized sections and formatting'
      };
      systemPrompt += `\n- Focus on ${focusMap[options.focus]}`;
    }

    return systemPrompt;
  }

  async checkRateLimit(userId: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = new Date(now - this.rateLimitWindow);

    // Get or create rate limit record
    let rateLimitRecord = await db.select()
      .from(rateLimits)
      .where(eq(rateLimits.userId, userId))
      .then(results => results[0]);

    if (!rateLimitRecord || !rateLimitRecord.windowStart || rateLimitRecord.windowStart < windowStart) {
      // Create new window or reset expired window
      const newRecord = {
        userId: userId,
        enhancementCount: 0,
        windowStart: new Date(now),
        lastReset: new Date(now)
      };

      await db.insert(rateLimits)
        .values(newRecord)
        .onConflictDoUpdate({
          target: rateLimits.userId,
          set: newRecord
        });
      
      rateLimitRecord = newRecord;
    }

    // Check user tier (simplified - you'd check actual subscription)
    const limit = this.freeUserLimit; // TODO: Check user subscription
    const enhancementCount = rateLimitRecord.enhancementCount || 0;
    const remaining = Math.max(0, limit - enhancementCount);
    const windowStartTime = rateLimitRecord.windowStart?.getTime() || Date.now();
    const resetsAt = new Date(windowStartTime + this.rateLimitWindow);

    return {
      allowed: remaining > 0,
      remaining,
      resetsAt,
      limit
    };
  }

  async incrementRateLimit(userId: string): Promise<void> {
    await db.update(rateLimits)
      .set({
        enhancementCount: sql`enhancement_count + 1`
      })
      .where(eq(rateLimits.userId, userId));
  }

  async getRateLimitStatus(userId: string): Promise<RateLimitInfo> {
    // Note: Rate limit check doesn't need API key, so no ensureInitialized() call needed
    return this.checkRateLimit(userId);
  }

  // New method for API-only calls (no DB writes)
  async callClaudeAPIOnly(
    originalPrompt: string,
    options: EnhancementOptions = {}
  ): Promise<{
    success: boolean;
    enhanced?: string;
    error?: string;
  }> {
    this.ensureInitialized();
    
    try {
      const systemPrompt = this.buildSystemPrompt(options);
      const enhancedContent = await this.callClaudeAPI(systemPrompt, originalPrompt);
      
      return {
        success: true,
        enhanced: enhancedContent
      };
    } catch (error: any) {
      console.error('Claude API error:', error);
      
      // Map API key errors to appropriate status
      if (error.message === 'CLAUDE_API_KEY is not configured') {
        return {
          success: false,
          error: 'Enhancement service is not configured'
        };
      }
      
      return {
        success: false,
        error: 'Failed to enhance prompt. Please try again.'
      };
    }
  }

  // New method for transaction-aware rate limit increment
  async incrementRateLimitInTx(userId: string, tx: any): Promise<void> {
    await tx.update(rateLimits)
      .set({
        enhancementCount: sql`${rateLimits.enhancementCount} + 1`
      })
      .where(eq(rateLimits.userId, userId));
  }
}

// Export singleton instance
export const claudeService = new ClaudeEnhancementService();
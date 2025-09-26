import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { contentReports, prompts, users } from '@shared/schema';

interface ModerationFlags {
  isSpam: boolean;
  isInappropriate: boolean;
  hasCopyright: boolean;
  hasPersonalInfo: boolean;
  confidence: number;
  reasons: string[];
}

interface ContentAnalysis {
  flags: ModerationFlags;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'approve' | 'review' | 'reject';
}

export class ModerationService {
  private static spamKeywords = [
    'click here', 'free money', 'make money fast', 'guaranteed', 'risk free',
    'special promotion', 'limited time', 'act now', 'urgent', 'congratulations',
    'winner', 'selected', 'claim now', 'no strings attached', 'bonus'
  ];

  private static inappropriateKeywords = [
    // Violence
    'kill', 'murder', 'violence', 'harm', 'hurt', 'weapon', 'bomb', 'attack',
    // Hate speech indicators (basic detection)
    'hate', 'racist', 'discrimination', 'bigot',
    // Adult content indicators
    'explicit', 'nsfw', 'adult content'
  ];

  private static copyrightIndicators = [
    '©', 'copyright', 'all rights reserved', 'proprietary', 'confidential',
    'trade secret', 'trademarked', 'patented', 'licensed content'
  ];

  private static personalInfoPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
    /\b\d{3}-\d{3}-\d{4}\b/, // Phone pattern
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email pattern
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card pattern
    /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|place|pl)\b/i // Address pattern
  ];

  /**
   * Analyze content for moderation flags
   */
  static analyzeContent(content: string, title?: string): ContentAnalysis {
    const fullText = `${title || ''} ${content}`.toLowerCase().trim();
    const flags: ModerationFlags = {
      isSpam: false,
      isInappropriate: false,
      hasCopyright: false,
      hasPersonalInfo: false,
      confidence: 0,
      reasons: []
    };

    // Spam detection
    const spamScore = this.calculateSpamScore(fullText);
    if (spamScore > 0.3) {
      flags.isSpam = true;
      flags.reasons.push(`Spam indicators detected (${Math.round(spamScore * 100)}% confidence)`);
    }

    // Inappropriate content detection
    const inappropriateScore = this.calculateInappropriateScore(fullText);
    if (inappropriateScore > 0.2) {
      flags.isInappropriate = true;
      flags.reasons.push(`Inappropriate content detected (${Math.round(inappropriateScore * 100)}% confidence)`);
    }

    // Copyright detection
    if (this.detectCopyrightContent(fullText)) {
      flags.hasCopyright = true;
      flags.reasons.push('Potential copyright content detected');
    }

    // Personal information detection
    if (this.detectPersonalInfo(content)) {
      flags.hasPersonalInfo = true;
      flags.reasons.push('Personal information detected');
    }

    // Calculate overall confidence
    flags.confidence = Math.max(spamScore, inappropriateScore);

    // Determine risk level and recommendation
    const riskLevel = this.calculateRiskLevel(flags);
    const recommendation = this.getRecommendation(flags, riskLevel);

    return {
      flags,
      riskLevel,
      recommendation
    };
  }

  /**
   * Calculate spam score based on keyword density and patterns
   */
  private static calculateSpamScore(text: string): number {
    let score = 0;
    const words = text.split(/\s+/);
    const totalWords = words.length;

    // Check for spam keywords
    let spamKeywordCount = 0;
    for (const keyword of this.spamKeywords) {
      if (text.includes(keyword)) {
        spamKeywordCount++;
      }
    }

    // Spam keyword density
    if (spamKeywordCount > 0) {
      score += (spamKeywordCount / this.spamKeywords.length) * 0.4;
    }

    // Excessive caps (more than 30% of text) - note: text is already processed
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.3) {
      score += 0.2;
    }

    // Excessive punctuation (!!!!, ????)
    const excessivePuncMatch = text.match(/[!?]{3,}/g);
    if (excessivePuncMatch) {
      score += 0.15;
    }

    // Repetitive words
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      if (word.length > 3) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }

    const maxFreq = Math.max(...Array.from(wordFreq.values()));
    const repetitiveRatio = maxFreq / totalWords;
    if (repetitiveRatio > 0.1) {
      score += repetitiveRatio * 0.3;
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate inappropriate content score
   */
  private static calculateInappropriateScore(text: string): number {
    let score = 0;

    // Check for inappropriate keywords
    let inappropriateCount = 0;
    for (const keyword of this.inappropriateKeywords) {
      if (text.includes(keyword)) {
        inappropriateCount++;
      }
    }

    if (inappropriateCount > 0) {
      score += (inappropriateCount / this.inappropriateKeywords.length) * 0.6;
    }

    // Check for excessive profanity patterns (basic detection)
    const profanityPattern = /\b[a-z]*[*@#$%][a-z]*\b/gi;
    const profanityMatches = text.match(profanityPattern) || [];
    if (profanityMatches.length > 0) {
      score += Math.min(profanityMatches.length * 0.1, 0.3);
    }

    return Math.min(score, 1);
  }

  /**
   * Detect potential copyright content
   */
  private static detectCopyrightContent(text: string): boolean {
    for (const indicator of this.copyrightIndicators) {
      if (text.includes(indicator.toLowerCase())) {
        return true;
      }
    }

    // Check for long identical passages (potential copying)
    const sentences = text.split(/[.!?]+/);
    const longSentences = sentences.filter(s => s.trim().length > 100);
    
    // If more than 50% of content is very long sentences, might be copied
    return longSentences.length > sentences.length * 0.5;
  }

  /**
   * Detect personal information in content
   */
  private static detectPersonalInfo(content: string): boolean {
    for (const pattern of this.personalInfoPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate overall risk level
   */
  private static calculateRiskLevel(flags: ModerationFlags): 'low' | 'medium' | 'high' {
    const flagCount = Object.values(flags).filter(f => typeof f === 'boolean' && f).length;
    
    if (flags.isInappropriate || flags.confidence > 0.7) {
      return 'high';
    } else if (flagCount >= 2 || flags.confidence > 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get moderation recommendation
   */
  private static getRecommendation(flags: ModerationFlags, riskLevel: 'low' | 'medium' | 'high'): 'approve' | 'review' | 'reject' {
    if (riskLevel === 'high') {
      return 'reject';
    } else if (riskLevel === 'medium' || flags.hasPersonalInfo) {
      return 'review';
    } else {
      return 'approve';
    }
  }

  /**
   * Auto-moderate prompt content
   */
  static async moderatePrompt(promptId: string, userId: string): Promise<{
    approved: boolean;
    flags: ModerationFlags;
    requiresReview: boolean;
  }> {
    try {
      // Get prompt content
      const prompt = await db
        .select()
        .from(prompts)
        .where(eq(prompts.id, promptId))
        .limit(1);

      if (!prompt.length) {
        throw new Error('Prompt not found');
      }

      const analysis = this.analyzeContent(prompt[0].content, prompt[0].title);
      
      const result = {
        approved: analysis.recommendation === 'approve',
        flags: analysis.flags,
        requiresReview: analysis.recommendation === 'review'
      };

      // Log moderation action if flagged
      if (analysis.flags.reasons.length > 0) {
        console.log(`Moderation flags for prompt ${promptId}:`, analysis.flags.reasons);
      }

      return result;
    } catch (error) {
      console.error('Moderation error:', error);
      // Default to requiring review on errors
      return {
        approved: false,
        flags: {
          isSpam: false,
          isInappropriate: false,
          hasCopyright: false,
          hasPersonalInfo: false,
          confidence: 0,
          reasons: ['Moderation system error - requires manual review']
        },
        requiresReview: true
      };
    }
  }

  /**
   * Process content report
   */
  static async processContentReport(
    reportId: string,
    moderatorAction: 'approve' | 'remove' | 'restrict',
    moderatorNotes?: string
  ): Promise<boolean> {
    try {
      // Update report with moderator decision
      await db
        .update(contentReports)
        .set({
          status: moderatorAction === 'approve' ? 'resolved' : 'action_taken',
          resolvedAt: new Date(),
          moderatorNotes: moderatorNotes || null
        })
        .where(eq(contentReports.id, reportId));

      // If content should be removed, handle the content
      if (moderatorAction === 'remove') {
        // This would integrate with your content removal logic
        // For now, just log the action
        console.log(`Content removal requested for report ${reportId}`);
      }

      return true;
    } catch (error) {
      console.error('Error processing content report:', error);
      return false;
    }
  }

  /**
   * Get moderation statistics
   */
  static async getModerationStats(days: number = 30): Promise<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    flaggedContent: number;
    topReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const reports = await db
        .select({
          id: contentReports.id,
          status: contentReports.status,
          reason: contentReports.reason,
          createdAt: contentReports.createdAt
        })
        .from(contentReports)
        .where(sql`${contentReports.createdAt} >= ${since.toISOString()}`)
        .orderBy(desc(contentReports.createdAt));

      const totalReports = reports.length;
      const pendingReports = reports.filter(r => r.status === 'pending').length;
      const resolvedReports = reports.filter(r => r.status !== 'pending').length;

      // Count by reason
      const reasonCounts = new Map<string, number>();
      for (const report of reports) {
        const count = reasonCounts.get(report.reason) || 0;
        reasonCounts.set(report.reason, count + 1);
      }

      const topReasons = Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalReports,
        pendingReports,
        resolvedReports,
        flaggedContent: totalReports, // Simplified
        topReasons
      };
    } catch (error) {
      console.error('Error getting moderation stats:', error);
      return {
        totalReports: 0,
        pendingReports: 0,
        resolvedReports: 0,
        flaggedContent: 0,
        topReasons: []
      };
    }
  }
}
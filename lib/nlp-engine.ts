import { sql } from './db';

// Types for NLP analysis results
export interface NLPAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // 0-1
  intent: string;
  intentConfidence: number; // 0-1
  keywords: string[];
  priceSensitivity?: 'high' | 'medium' | 'low';
  hasImage: boolean;
}

export interface CustomerIntent {
  type: 'buying' | 'inquiry' | 'browsing' | 'complaint' | 'support' | 'unknown';
  confidence: number;
}

// Jewelry-specific keywords and patterns
const JEWELRY_KEYWORDS = {
  products: ['ring', 'ghantan', 'necklace', 'bracelet', 'earring', 'anklet', 'pendant', 'bangle', 'chain', 'gemstone', 'diamond', 'gold', 'silver', 'platinum'],
  buying: ['interested', 'want', 'need', 'looking for', 'can you show', 'how much', 'price', 'cost', 'buy', 'purchase', 'order', 'available', 'do you have', 'what\'s the price', 'interested in'],
  inquiry: ['tell me', 'what is', 'how', 'explain', 'details', 'information', 'more about', 'specifications', 'material', 'size', 'design'],
  browsing: ['just looking', 'show me', 'what do you have', 'options', 'varieties', 'collection', 'catalog'],
  complaint: ['problem', 'issue', 'broken', 'damaged', 'defective', 'not working', 'unhappy', 'disappointed', 'wrong', 'mistake', 'refund', 'return'],
  support: ['help', 'assist', 'need help', 'support', 'question', 'issue', 'problem', 'delivery', 'payment'],
  price: ['expensive', 'cheap', 'affordable', 'cost', 'price', 'budget', 'discount', 'offer', 'deal', 'discount code', 'coupon'],
};

// Positive sentiment indicators
const POSITIVE_WORDS = [
  'great', 'amazing', 'awesome', 'excellent', 'perfect', 'beautiful', 'stunning',
  'love', 'adore', 'wonderful', 'fantastic', 'good', 'nice', 'lovely', 'gorgeous',
  'thanks', 'thank you', 'appreciate', 'happy', 'satisfied', 'impressed'
];

// Negative sentiment indicators
const NEGATIVE_WORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'disappointed', 'poor',
  'broken', 'damaged', 'issue', 'problem', 'worse', 'worst', 'angry', 'upset',
  'scam', 'fraud', 'don\'t like', 'not good', 'not satisfied', 'refund'
];

/**
 * Analyze message content for sentiment, intent, and keywords
 */
export async function analyzeMessage(
  content: string,
  hasImage: boolean = false
): Promise<NLPAnalysisResult> {
  const lowerContent = content.toLowerCase();

  // 1. Sentiment Analysis
  const { sentiment, sentimentScore } = analyzeSentiment(lowerContent);

  // 2. Intent Classification
  const { intent, confidence: intentConfidence } = classifyIntent(lowerContent);

  // 3. Keyword Extraction
  const keywords = extractKeywords(lowerContent);

  // 4. Price Sensitivity Detection
  const priceSensitivity = detectPriceSensitivity(lowerContent);

  return {
    sentiment,
    sentimentScore,
    intent,
    intentConfidence,
    keywords,
    priceSensitivity,
    hasImage,
  };
}

/**
 * Analyze sentiment of text
 */
function analyzeSentiment(text: string): { sentiment: 'positive' | 'neutral' | 'negative'; sentimentScore: number } {
  let positiveScore = 0;
  let negativeScore = 0;

  // Count positive words
  POSITIVE_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex) || [];
    positiveScore += matches.length;
  });

  // Count negative words
  NEGATIVE_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text.match(regex) || [];
    negativeScore += matches.length;
  });

  // Calculate sentiment
  const totalScore = positiveScore + negativeScore;
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  let sentimentScore = 0.5;

  if (totalScore > 0) {
    sentimentScore = positiveScore / totalScore;
    if (sentimentScore >= 0.7) {
      sentiment = 'positive';
    } else if (sentimentScore <= 0.3) {
      sentiment = 'negative';
    }
  }

  // Round to 2 decimals
  sentimentScore = Math.round(sentimentScore * 100) / 100;

  return { sentiment, sentimentScore };
}

/**
 * Classify customer intent from message
 */
function classifyIntent(text: string): { intent: string; confidence: number } {
  let intents: { type: string; score: number }[] = [];

  // Check for buying intent
  const buyingMatches = JEWELRY_KEYWORDS.buying.filter(keyword =>
    text.includes(keyword)
  ).length;
  if (buyingMatches > 0) {
    intents.push({ type: 'buying', score: Math.min(0.5 + buyingMatches * 0.15, 1) });
  }

  // Check for inquiry intent
  const inquiryMatches = JEWELRY_KEYWORDS.inquiry.filter(keyword =>
    text.includes(keyword)
  ).length;
  if (inquiryMatches > 0) {
    intents.push({ type: 'inquiry', score: Math.min(0.4 + inquiryMatches * 0.15, 1) });
  }

  // Check for browsing intent
  const browsingMatches = JEWELRY_KEYWORDS.browsing.filter(keyword =>
    text.includes(keyword)
  ).length;
  if (browsingMatches > 0) {
    intents.push({ type: 'browsing', score: Math.min(0.3 + browsingMatches * 0.2, 1) });
  }

  // Check for complaint intent
  const complaintMatches = JEWELRY_KEYWORDS.complaint.filter(keyword =>
    text.includes(keyword)
  ).length;
  if (complaintMatches > 0) {
    intents.push({ type: 'complaint', score: Math.min(0.6 + complaintMatches * 0.15, 1) });
  }

  // Check for support intent
  const supportMatches = JEWELRY_KEYWORDS.support.filter(keyword =>
    text.includes(keyword)
  ).length;
  if (supportMatches > 0) {
    intents.push({ type: 'support', score: Math.min(0.4 + supportMatches * 0.15, 1) });
  }

  // Sort by confidence and return top intent
  intents.sort((a, b) => b.score - a.score);
  
  if (intents.length > 0) {
    const topIntent = intents[0];
    return { intent: topIntent.type, confidence: Math.round(topIntent.score * 100) / 100 };
  }

  return { intent: 'unknown', confidence: 0 };
}

/**
 * Extract keywords from message
 */
function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();

  // Extract all jewelry-related keywords
  Object.values(JEWELRY_KEYWORDS).forEach(keywordList => {
    keywordList.forEach(keyword => {
      if (text.includes(keyword)) {
        keywords.add(keyword);
      }
    });
  });

  // Extract additional keywords (words longer than 3 chars, not common words)
  const commonWords = new Set([
    'and', 'the', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'let', 'put', 'say', 'she', 'too', 'use'
  ]);

  const words = text.split(/\s+/).filter(word => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    return clean.length > 3 && !commonWords.has(clean);
  });

  words.forEach(word => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    if (clean.length > 3) {
      keywords.add(clean);
    }
  });

  return Array.from(keywords).slice(0, 10); // Return top 10 keywords
}

/**
 * Detect price sensitivity from message
 */
function detectPriceSensitivity(text: string): 'high' | 'medium' | 'low' {
  const priceKeywords = JEWELRY_KEYWORDS.price;
  const matches = priceKeywords.filter(keyword => text.includes(keyword)).length;

  if (matches >= 3) return 'high';
  if (matches >= 2) return 'medium';
  return 'low';
}

/**
 * Update message with NLP analysis in database
 */
export async function updateMessageWithAnalysis(
  messageId: string,
  analysis: NLPAnalysisResult
): Promise<void> {
  try {
    await sql`
      UPDATE messages
      SET
        sentiment = ${analysis.sentiment},
        sentiment_score = ${analysis.sentimentScore},
        intent = ${analysis.intent},
        intent_confidence = ${analysis.intentConfidence},
        keywords = ${analysis.keywords},
        has_image = ${analysis.hasImage}
      WHERE id = ${messageId}
    `;
  } catch (error) {
    console.error('[NLP] Failed to update message with analysis:', error);
  }
}

/**
 * Detect customer segment based on conversation history
 */
export async function detectCustomerSegment(
  workspaceId: string,
  customerId: string
): Promise<'new' | 'returning' | 'hot' | 'warm' | 'cold' | 'ghost'> {
  try {
    // Get customer message history
    const messages = await sql`
      SELECT
        m.sentiment,
        m.intent,
        m.sent_at,
        COUNT(*) as total_messages,
        AVG(CASE WHEN m.sentiment = 'positive' THEN 1 WHEN m.sentiment = 'negative' THEN 0 ELSE 0.5 END) as avg_sentiment
      FROM messages m
      WHERE m.workspace_id = ${workspaceId} AND m.customer_id = ${customerId}
      GROUP BY m.customer_id
      LIMIT 1
    `;

    if (messages.length === 0) {
      return 'new';
    }

    const data = messages[0];
    const msgCount = data.total_messages || 0;
    const avgSentiment = data.avg_sentiment || 0.5;
    const latestMessage = data.sent_at;

    // Calculate days since last contact
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(latestMessage).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Segment logic
    if (daysSinceContact > 30) {
      return 'ghost'; // No contact for 30+ days
    }

    if (msgCount === 1) {
      return 'new'; // First message only
    }

    if (avgSentiment > 0.7 && msgCount >= 3 && daysSinceContact < 7) {
      return 'hot'; // High sentiment, multiple messages, recent
    }

    if (avgSentiment > 0.5 && msgCount >= 2 && daysSinceContact < 14) {
      return 'warm'; // Medium/positive sentiment, active
    }

    if (daysSinceContact > 14) {
      return 'cold'; // Inactive for 2+ weeks
    }

    return 'returning'; // Active with neutral sentiment
  } catch (error) {
    console.error('[NLP] Failed to detect customer segment:', error);
    return 'new';
  }
}

/**
 * Update keyword frequency tracking
 */
export async function updateKeywordFrequency(
  workspaceId: string,
  keywords: string[],
  sentiment: string
): Promise<void> {
  try {
    for (const keyword of keywords) {
      await sql`
        INSERT INTO keyword_frequency (workspace_id, keyword, frequency, sentiment, last_seen)
        VALUES (${workspaceId}, ${keyword}, 1, ${sentiment}, NOW())
        ON CONFLICT (workspace_id, keyword)
        DO UPDATE SET
          frequency = frequency + 1,
          sentiment = ${sentiment},
          last_seen = NOW()
      `;
    }
  } catch (error) {
    console.error('[NLP] Failed to update keyword frequency:', error);
  }
}

/**
 * Extract product mentions from message
 */
export function extractProductMentions(text: string): string[] {
  const products = new Set<string>();
  const lowerText = text.toLowerCase();

  JEWELRY_KEYWORDS.products.forEach(product => {
    if (lowerText.includes(product)) {
      products.add(product);
    }
  });

  return Array.from(products);
}

/**
 * Generate customer conversation summary
 */
export async function generateCustomerSummary(
  customerId: string
): Promise<string> {
  try {
    const messages = await sql`
      SELECT
        COUNT(*) as total_messages,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
        AVG(CASE WHEN sentiment = 'positive' THEN 1 WHEN sentiment = 'negative' THEN 0 ELSE 0.5 END) as avg_sentiment,
        STRING_AGG(DISTINCT intent, ', ') as intents,
        STRING_AGG(DISTINCT keyword, ', ') as top_keywords
      FROM (
        SELECT *, UNNEST(keywords) as keyword
        FROM messages
        WHERE customer_id = ${customerId}
        ORDER BY sent_at DESC
        LIMIT 50
      ) m
    `;

    if (messages.length === 0) {
      return 'No conversation history';
    }

    const data = messages[0];
    const sentiment = data.avg_sentiment > 0.6 ? 'positive' : data.avg_sentiment < 0.4 ? 'negative' : 'neutral';

    return `Customer has ${data.total_messages} messages (${data.inbound} inbound, ${data.outbound} outbound). ` +
           `Overall sentiment is ${sentiment}. Interested in: ${data.intents || 'unknown'}. ` +
           `Key topics: ${data.top_keywords || 'general inquiry'}.`;
  } catch (error) {
    console.error('[NLP] Failed to generate summary:', error);
    return 'Unable to generate summary';
  }
}

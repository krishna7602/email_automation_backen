const logger = require('../utils/logger');

class EmailParser {
  analyzeContent(text) {
    if (!text) {
      return {
        wordCount: 0,
        hasUrls: false,
        urls: [],
        emailAddresses: [],
        phoneNumbers: [],
        keywords: []
      };
    }

    try {
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urls = text.match(urlRegex) || [];
      
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      const emailAddresses = text.match(emailRegex) || [];
      
      const phoneRegex = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
      const phoneNumbers = text.match(phoneRegex) || [];
      
      const keywords = this.extractKeywords(text);

      return {
        wordCount,
        hasUrls: urls.length > 0,
        urls,
        emailAddresses,
        phoneNumbers,
        keywords
      };
    } catch (error) {
      logger.error('Error analyzing email content:', error);
      return null;
    }
  }

  extractKeywords(text, topN = 10) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has'
    ]);

    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordFreq = {};
    
    words.forEach(word => {
      if (!stopWords.has(word) && word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word, count]) => ({ word, count }));
  }

  extractSenderName(email) {
    if (!email) return 'Unknown';
    const name = email.split('@')[0].replace(/[._]/g, ' ');
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  determinePriority(subject, body) {
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'immediately'];
    const text = (subject + ' ' + body).toLowerCase();
    return urgentKeywords.some(k => text.includes(k)) ? 'high' : 'normal';
  }
}

module.exports = new EmailParser();
export interface ContractClause {
  type: 'compensation' | 'duties' | 'compliance' | 'termination' | 'restrictive_covenants' | 'other';
  text: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface ClassifiedContract {
  clauses: ContractClause[];
  summary: {
    compensation: string[];
    duties: string[];
    compliance: string[];
    termination: string[];
    restrictiveCovenants: string[];
  };
}

const COMPENSATION_KEYWORDS = ['salary', 'wage', 'compensation', 'bonus', 'benefits', '401k', 'retirement'];
const DUTIES_KEYWORDS = ['duties', 'responsibilities', 'shall', 'must', 'required to'];
const COMPLIANCE_KEYWORDS = ['compliance', 'regulatory', 'hipaa', 'osha', 'accreditation', 'certification'];
const TERMINATION_KEYWORDS = ['termination', 'terminate', 'end', 'expiration', 'notice period'];
const RESTRICTIVE_KEYWORDS = ['non-compete', 'non-solicit', 'confidentiality', 'restrictive', 'covenant'];

/**
 * Classify contract clauses
 */
export function classifyContractClauses(text: string): ClassifiedContract {
  const clauses: ContractClause[] = [];
  const lowerText = text.toLowerCase();

  // Simple keyword-based classification (in production, would use NLP/ML)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const lowerSentence = sentence.toLowerCase();
    let type: ContractClause['type'] = 'other';
    let confidence = 0.5;

    // Check for compensation
    if (COMPENSATION_KEYWORDS.some(kw => lowerSentence.includes(kw))) {
      type = 'compensation';
      confidence = 0.8;
    }
    // Check for duties
    else if (DUTIES_KEYWORDS.some(kw => lowerSentence.includes(kw))) {
      type = 'duties';
      confidence = 0.75;
    }
    // Check for compliance
    else if (COMPLIANCE_KEYWORDS.some(kw => lowerSentence.includes(kw))) {
      type = 'compliance';
      confidence = 0.8;
    }
    // Check for termination
    else if (TERMINATION_KEYWORDS.some(kw => lowerSentence.includes(kw))) {
      type = 'termination';
      confidence = 0.75;
    }
    // Check for restrictive covenants
    else if (RESTRICTIVE_KEYWORDS.some(kw => lowerSentence.includes(kw))) {
      type = 'restrictive_covenants';
      confidence = 0.85;
    }

    if (type !== 'other') {
      const startIndex = text.indexOf(sentence);
      clauses.push({
        type,
        text: sentence.trim(),
        confidence,
        startIndex,
        endIndex: startIndex + sentence.length,
      });
    }
  }

  // Build summary
  const summary = {
    compensation: clauses.filter(c => c.type === 'compensation').map(c => c.text),
    duties: clauses.filter(c => c.type === 'duties').map(c => c.text),
    compliance: clauses.filter(c => c.type === 'compliance').map(c => c.text),
    termination: clauses.filter(c => c.type === 'termination').map(c => c.text),
    restrictiveCovenants: clauses.filter(c => c.type === 'restrictive_covenants').map(c => c.text),
  };

  return {
    clauses,
    summary,
  };
}


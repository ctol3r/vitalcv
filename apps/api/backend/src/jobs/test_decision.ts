import { evaluateDecision } from '../services/decision/decisionEngine';

const macie = {
  npi: '1003000126',
  progress: {
    identity: 'complete',
    sanctions: 'pending', // non-critical gap
    licensure: 'complete',
    enrollment: 'complete'
  } as any,
  blockers: []
};

const decision = evaluateDecision(macie);
console.log('Macie Decision:');
console.log(JSON.stringify(decision, null, 2));

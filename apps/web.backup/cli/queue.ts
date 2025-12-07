import { triggerSafetySweep } from './commands/triggerSafety.js';
import { runMobilityEvaluation } from './commands/mobilityEval.js';

export async function runQueueCommand(command: string | undefined, argv: string[]): Promise<void> {
  switch (command) {
    case 'trigger-safety':
      await triggerSafetySweep(argv);
      return;
    case 'mobility-eval':
      await runMobilityEvaluation(argv);
      return;
    default:
      throw new Error('Supported queue commands: trigger-safety, mobility-eval');
  }
}
import { triggerSafetySweep } from './commands/triggerSafety.js';
import { runMobilityEvaluation } from './commands/mobilityEval.js';

export async function runQueueCommand(command: string | undefined, argv: string[]): Promise<void> {
  switch (command) {
    case 'trigger-safety':
      await triggerSafetySweep(argv);
      return;
    case 'mobility-eval':
      await runMobilityEvaluation(argv);
      return;
    default:
      throw new Error('Supported queue commands: trigger-safety, mobility-eval');
  }
}


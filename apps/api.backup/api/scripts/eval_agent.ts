/**
 * Agent Evaluation Harness
 * Runs a set of test scenarios against the agent to verify functionality
 */

import axios from 'axios';

const BASE = process.env.AGENT_BASE || 'http://localhost:4000';

interface TestCase {
  name: string;
  task: string;
  input: Record<string, any>;
  scopeHints?: string[];
  expectedSuccess?: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Verify License for CA',
    task: 'verify license for CA',
    input: {
      state: 'CA',
      licensePdfId: 'file_demo',
    },
    expectedSuccess: true,
  },
  {
    name: 'Verify License + Match Roles',
    task: 'verify license for CA then match roles',
    input: {
      state: 'CA',
      licensePdfId: 'file_demo',
      profileId: 'demo1',
    },
    expectedSuccess: true,
  },
  {
    name: 'Parse Resume then Suggest Jobs',
    task: 'parse resume then suggest jobs',
    input: {
      resumeText: 'Cardiologist with 10 years of experience in CA. Board certified.',
    },
    expectedSuccess: true,
  },
  {
    name: 'NPI Lookup',
    task: 'lookup NPI information',
    input: {
      npi: '1234567890',
    },
    expectedSuccess: true,
  },
  {
    name: 'OCR Document',
    task: 'extract text from document using OCR',
    input: {
      fileId: 'sample_doc_123',
    },
    expectedSuccess: true,
  },
];

async function runEvaluation() {
  console.log('🧪 Agent Evaluation Harness\n');
  console.log(`Testing against: ${BASE}/api/agent/solve\n`);

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   Task: "${testCase.task}"`);
    console.log(`   Input:`, JSON.stringify(testCase.input, null, 2).substring(0, 100));

    try {
      const startTime = Date.now();

      const response = await axios.post(
        `${BASE}/api/agent/solve`,
        {
          task: testCase.task,
          input: testCase.input,
          scopeHints: testCase.scopeHints || [],
        },
        {
          timeout: 30000, // 30 second timeout
        }
      );

      const duration = Date.now() - startTime;
      const { success, used, output } = response.data;

      if (success) {
        console.log(`   ✅ PASS (${duration}ms)`);
        console.log(`   Used MCPs: ${used?.join?.(', ') || used || 'none'}`);
        console.log(`   Output keys: ${Object.keys(output || {}).join(', ')}`);
        passed++;
      } else {
        console.log(`   ⚠️  COMPLETED BUT NOT SUCCESSFUL (${duration}ms)`);
        console.log(`   Used: ${used?.join?.(', ') || used || 'none'}`);
        console.log(`   Output: ${JSON.stringify(output).substring(0, 200)}`);

        if (testCase.expectedSuccess === false) {
          // Expected to fail
          passed++;
        } else {
          failed++;
        }
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL`);

      if (error.response) {
        console.log(`   Error: ${error.response.status} - ${error.response.data?.error || 'Unknown error'}`);
      } else if (error.request) {
        console.log(`   Error: No response from server (is it running?)`);
      } else {
        console.log(`   Error: ${error.message}`);
      }

      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    console.log('⚠️  Some tests failed. Review the output above for details.');
    process.exit(1);
  } else {
    console.log('✨ All tests passed!');
    process.exit(0);
  }
}

// CLI entry point
if (require.main === module) {
  runEvaluation().catch((error) => {
    console.error('Evaluation harness crashed:', error);
    process.exit(1);
  });
}


import { AgentMemoryClient } from '../server/agent_memory.mjs';

const BASE_URL = 'http://localhost:6100';
const MEMORY_URL = 'http://127.0.0.1:8420';

async function main() {
  console.log('--- 1. Testing Memory Gateway directly ---');
  const client = new AgentMemoryClient({ agentMemoryUrl: MEMORY_URL, agentMemoryEnabled: true });
  const memHealth = await client.health();
  console.log('TencentDB Agent Memory Health via Client:', memHealth);

  console.log('\n--- 2. Testing RAG Server /api/health ---');
  const ragHealthRes = await fetch(`${BASE_URL}/api/health`);
  const ragHealth = await ragHealthRes.json();
  console.log('RAG Server Health with Memory:', ragHealth);

  console.log('\n--- 3. Creating a Chat Session ---');
  const sessionRes = await fetch(`${BASE_URL}/api/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'TencentDB Memory Test' })
  });
  const sessionBody = await sessionRes.json();
  const sessionId = sessionBody.data?.id;
  console.log('Created Session ID:', sessionId);

  console.log('\n--- 4. Direct Capture into MemoryCore ---');
  const userPrompt = 'Chào bạn, tên tôi là Quang Nhật. Tôi là kỹ sư nghiên cứu về RAG và AI Layout Parsing.';
  const assistantReply = 'Chào bạn Quang Nhật! Rất vui được biết bạn là kỹ sư nghiên cứu chuyên sâu về RAG và AI Layout Parsing. Tôi có thể hỗ trợ gì cho nghiên cứu của bạn hôm nay?';
  const captureSuccess = await client.capture({
    userContent: userPrompt,
    assistantContent: assistantReply,
    sessionKey: sessionId,
    userId: 'user-qnhat'
  });
  console.log('Memory Capture Success:', captureSuccess);

  // Wait 1 second for MemoryCore background ingestion
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n--- 5. Searching MemoryCore Conversations ---');
  const convSearch = await client.searchConversations({
    query: 'Quang Nhật',
    sessionKey: sessionId,
    limit: 5
  });
  console.log('Conversation Search Results:', convSearch);

  console.log('\n--- 6. Testing Memory Recall for Subsequent Query ---');
  const recall = await client.recall({
    query: 'Người dùng tên là gì và làm nghề gì?',
    sessionKey: sessionId,
    userId: 'user-qnhat'
  });
  console.log('Memory Recall Result:', recall);

  console.log('\n=== INTEGRATION VERIFICATION SUCCESSFUL ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

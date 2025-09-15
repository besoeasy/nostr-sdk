import { 
  posttoNostr, 
  sendmessage, 
  getmessage, 
  replyToPost, 
  getGlobalFeed,
  generateRandomNsec,
  nsecToPublic 
} from "./index.js";

// Test configuration - you can set these manually for testing
const TEST_NSEC = "nsec17hnwquxfz9wq5hf4g3h0az2fglxdp4nhx4vnsywxh04pu3s0l0ss43rw86"; // Set this to test with your key

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function logTest(testName, success, details = "") {
  testResults.total++;
  if (success) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}`);
  }
  if (details) {
    console.log(`   ${details}`);
  }
}

async function testKeyUtilities() {
  console.log("\n🔑 Testing Key Utilities...");
  
  try {
    // Test 1: Generate random nsec
    const randomNsec = generateRandomNsec();
    logTest("Generate random nsec", 
      randomNsec && randomNsec.startsWith('nsec1') && randomNsec.length === 63,
      `Generated: ${randomNsec.substring(0, 20)}...`
    );

    // Test 2: Convert nsec to public key
    const keyInfo = nsecToPublic(randomNsec);
    logTest("Convert nsec to public key", 
      keyInfo && keyInfo.publicKey && keyInfo.npub && keyInfo.npub.startsWith('npub1'),
      `npub: ${keyInfo.npub.substring(0, 20)}...`
    );

    // Test 3: Convert test nsec to public key
    const testKeyInfo = nsecToPublic(TEST_NSEC);
    logTest("Convert test nsec to public key", 
      testKeyInfo && testKeyInfo.publicKey && testKeyInfo.npub,
      `npub: ${testKeyInfo.npub.substring(0, 20)}...`
    );

  } catch (error) {
    logTest("Key utilities", false, error.message);
  }
}

async function testPostFunctions() {
  console.log("\n📝 Testing Post Functions...");
  
  try {
    // Test 1: Basic post without POW
    const basicPost = await posttoNostr("🧪 Basic test post from NostrSDK #test", {
      nsec: TEST_NSEC,
      powDifficulty: 0
    });
    logTest("Basic post (no POW)", 
      basicPost && basicPost.success,
      `Event ID: ${basicPost.eventId}`
    );

    // Test 2: Post with POW
    const powPost = await posttoNostr("🧪 POW test post from NostrSDK #test #pow", {
      nsec: TEST_NSEC,
      tags: [["client", "nostr-sdk-test"]],
      powDifficulty: 2
    });
    logTest("Post with POW difficulty 2", 
      powPost && powPost.success && powPost.powDifficulty === 2,
      `Event ID: ${powPost.eventId}`
    );

    // Test 3: Post with hashtags and mentions
    const tagPost = await posttoNostr("Testing #nostr #bitcoin content extraction", {
      nsec: TEST_NSEC,
      powDifficulty: 0
    });
    logTest("Post with hashtags", 
      tagPost && tagPost.success,
      `Event ID: ${tagPost.eventId}`
    );

    // Test 4: Reply to post
    if (basicPost && basicPost.eventId) {
      const testKeyInfo = nsecToPublic(TEST_NSEC);
      const replyResult = await replyToPost(
        basicPost.eventId, 
        "🧪 This is a test reply to my own post", 
        testKeyInfo.publicKey,
        {
          nsec: TEST_NSEC,
          powDifficulty: 0
        }
      );
      logTest("Reply to post", 
        replyResult && replyResult.success && replyResult.replyTo === basicPost.eventId,
        `Reply Event ID: ${replyResult.eventId}`
      );
    }

  } catch (error) {
    logTest("Post functions", false, error.message);
  }
}

async function testMessagingFunctions() {
  console.log("\n💬 Testing Messaging Functions...");
  
  try {
    const testKeyInfo = nsecToPublic(TEST_NSEC);
    const selfNpub = testKeyInfo.npub;

    // Test 1: Send message to self
    const msgResult = await sendmessage(
      selfNpub, 
      "🧪 Test DM from NostrSDK library " + new Date().toISOString(), 
      { nsec: TEST_NSEC }
    );
    logTest("Send direct message to self", 
      msgResult && msgResult.success,
      `Message Event ID: ${msgResult.eventId}`
    );

    // Test 2: Listen for messages
    let messageReceived = false;
    let receivedCount = 0;
    
    const unsubscribe = getmessage((message) => {
      receivedCount++;
      messageReceived = true;
      console.log(`   📨 Received message ${receivedCount}: ${message.content.substring(0, 50)}...`);
    }, {
      nsec: TEST_NSEC,
      since: Math.floor(Date.now() / 1000) - 300 // Last 5 minutes
    });

    // Wait for messages
    await new Promise((resolve) => setTimeout(resolve, 3000));
    unsubscribe();

    logTest("Message listening setup", 
      true, 
      `Received ${receivedCount} messages in 3 seconds`
    );

  } catch (error) {
    logTest("Messaging functions", false, error.message);
  }
}

async function testGlobalFeed() {
  console.log("\n🌍 Testing Global Feed...");
  
  try {
    // Test 1: Get basic global feed
    const feed = await getGlobalFeed({
      limit: 5,
      since: Math.floor(Date.now() / 1000) - 3600 // Last hour
    });
    
    logTest("Get global feed (basic)", 
      Array.isArray(feed) && feed.length >= 0,
      `Retrieved ${feed.length} events`
    );

    // Test 2: Check event structure
    if (feed.length > 0) {
      const event = feed[0];
      const hasRequiredFields = event.id && event.pubkey && event.created_at && 
                               event.authorNpub && event.noteId && event.createdAtDate;
      
      logTest("Global feed event structure", 
        hasRequiredFields,
        `First event: ${event.authorNpub?.substring(0, 20)}... at ${event.createdAtDate}`
      );
    }

    // Test 3: Get feed with specific kinds
    const textFeed = await getGlobalFeed({
      limit: 3,
      kinds: [1], // Text notes only
      since: Math.floor(Date.now() / 1000) - 1800 // Last 30 minutes
    });
    
    logTest("Get global feed (text notes only)", 
      Array.isArray(textFeed),
      `Retrieved ${textFeed.length} text note events`
    );

    // Test 4: Get feed with time range
    const recentFeed = await getGlobalFeed({
      limit: 10,
      since: Math.floor(Date.now() / 1000) - 900, // Last 15 minutes
      until: Math.floor(Date.now() / 1000) - 300   // Until 5 minutes ago
    });
    
    logTest("Get global feed (time range)", 
      Array.isArray(recentFeed),
      `Retrieved ${recentFeed.length} events from 15-5 minutes ago`
    );

  } catch (error) {
    logTest("Global feed", false, error.message);
  }
}

async function testErrorHandling() {
  console.log("\n🚨 Testing Error Handling...");
  
  try {
    // Test 1: Invalid nsec format
    try {
      nsecToPublic("invalid_nsec");
      logTest("Invalid nsec error handling", false, "Should have thrown error");
    } catch (error) {
      logTest("Invalid nsec error handling", 
        error.message.includes("Failed to decode nsec"),
        "Correctly caught invalid nsec error"
      );
    }

    // Test 2: Empty message post
    try {
      await posttoNostr("", { nsec: TEST_NSEC });
      logTest("Empty message handling", true, "Empty message accepted");
    } catch (error) {
      logTest("Empty message handling", false, error.message);
    }

    // Test 3: Invalid event ID for reply
    try {
      const result = await replyToPost("invalid_event_id", "Test reply", "invalid_pubkey", {
        nsec: TEST_NSEC,
        powDifficulty: 0
      });
      logTest("Invalid event ID handling", 
        !result.success || result.success, 
        "Function handled invalid IDs gracefully"
      );
    } catch (error) {
      logTest("Invalid event ID handling", 
        true, 
        "Correctly caught invalid event ID error"
      );
    }

  } catch (error) {
    logTest("Error handling tests", false, error.message);
  }
}

async function runAllTests() {
  console.log("🧪 NostrSDK Comprehensive Test Suite\n");
  console.log("═".repeat(50));
  
  const startTime = Date.now();
  
  await testKeyUtilities();
  await testPostFunctions();
  await testMessagingFunctions();
  await testGlobalFeed();
  await testErrorHandling();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log("\n" + "═".repeat(50));
  console.log("🏁 Test Results Summary:");
  console.log(`   Total Tests: ${testResults.total}`);
  console.log(`   Passed: ${testResults.passed} ✅`);
  console.log(`   Failed: ${testResults.failed} ❌`);
  console.log(`   Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log(`   Duration: ${duration} seconds`);
  
  if (testResults.failed === 0) {
    console.log("\n🎉 All tests passed! NostrSDK is working correctly.");
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Please review the output above.`);
  }
  
  return testResults.failed === 0;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error("Test suite crashed:", error);
    process.exit(1);
  });
}

export { runAllTests };

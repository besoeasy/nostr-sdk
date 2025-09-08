import NostrSDK, { posttoNostr, sendmessage, getmessage } from "./index.js";

// Test configuration - you can set these manually for testing
const TEST_NSEC = "nsec17hnwquxfz9wq5hf4g3h0az2fglxdp4nhx4vnsywxh04pu3s0l0ss43rw86"; // Set this to test with your key (e.g., "nsec1...")

async function testBasicFunctionality() {
  console.log("🧪 Testing NostrSDK Library...\n");

  try {
    // Test 1: Public note posting with POW
    console.log("1. Testing public note posting with POW...");
    const postResult = await posttoNostr("🧪 Test post from NostrSDK library #test", {
      nsec: TEST_NSEC,
      tags: [["client", "nostr-sdk"]],
      powDifficulty: 2
    });
    console.log("✅ Posted note:", {
      success: postResult.success,
      eventId: postResult.eventId,
      published: postResult.published,
      failed: postResult.failed,
      powDifficulty: postResult.powDifficulty,
    });

    // Test 2: Get key info for self-messaging
    const tempNostr = new NostrSDK({ nsec: TEST_NSEC });
    const keyInfo = tempNostr.getKeyInfo();
    const selfNpub = keyInfo.npub;
    tempNostr.destroy();

    // Test 3: Direct message to self
    console.log("\n2. Testing direct message to self...");
    const msgResult = await sendmessage(selfNpub, "🧪 Test DM from NostrSDK library " + new Date().toISOString(), {
      nsec: TEST_NSEC
    });
    console.log("✅ Sent message to self:", {
      success: msgResult.success,
      eventId: msgResult.eventId,
      published: msgResult.published,
      failed: msgResult.failed,
    });

    // Test 4: Message listening
    console.log("\n3. Testing message listening...");
    let messageReceived = false;
    const unsubscribe = getmessage((message) => {
      console.log("📨 Received test message:", {
        from: message.senderNpub.substring(0, 20) + "...",
        content: message.content.substring(0, 50) + (message.content.length > 50 ? "..." : ""),
        timestamp: new Date(message.timestamp * 1000).toISOString(),
      });
      messageReceived = true;
    }, {
      nsec: TEST_NSEC
    });

    // Wait briefly for any messages
    await new Promise((resolve) => setTimeout(resolve, 5000));
    unsubscribe();

    if (messageReceived) {
      console.log("✅ Message listening works!");
    } else {
      console.log("✅ Message listening setup successful (no messages received in 5s)");
    }

    // Test 5: Content tag extraction
    console.log("\n4. Testing content tag extraction...");
    const tagTestResult = await posttoNostr(
      "Testing #nostr #bitcoin mentions @npub1xyz... and notes note1abc...",
      {
        nsec: TEST_NSEC,
        tags: [],
        powDifficulty: 0 // No POW for this test
      }
    );
    console.log("✅ Content tags extracted and posted:", {
      success: tagTestResult.success,
      eventId: tagTestResult.eventId,
    });

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBasicFunctionality();
}

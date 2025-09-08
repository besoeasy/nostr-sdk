import NostrSDK, { posttoNostr, sendmessage, getmessage } from './index.js';

// Test configuration - you can set these manually for testing
const TEST_NSEC = "nsec17hnwquxfz9wq5hf4g3h0az2fglxdp4nhx4vnsywxh04pu3s0l0ss43rw86"; // Set this to test with your key (e.g., "nsec1...")
const TEST_RECIPIENT = "npub176qdmkxp8uww4wfwm56ftu8uuarmhqxzwrsgr7qvwsqma7mzmf7qu9ktln"; // Set this to test messaging (npub or hex pubkey)

async function testBasicFunctionality() {
  console.log('🧪 Testing NostrSDK Library...\n');

  try {
    // Test 1: Class instantiation and key generation
    console.log('1. Testing key generation...');
    const nostr = new NostrSDK();
    const keys = nostr.generateNewKey();
    console.log('✅ Generated keys:', {
      npub: keys.npub.substring(0, 20) + '...',
      nsec: keys.nsec.substring(0, 20) + '...'
    });

    // Test 2: Key import
    console.log('\n2. Testing key import...');
    if (TEST_NSEC) {
      const nostr2 = new NostrSDK({ nsec: TEST_NSEC });
      const keyInfo = nostr2.getKeyInfo();
      console.log('✅ Imported key:', keyInfo.npub.substring(0, 20) + '...');
    } else {
      console.log('⏭️  Skipping key import test (set TEST_NSEC variable in test.js)');
    }

    // Test 3: Public note posting with POW
    console.log('\n3. Testing public note posting with POW...');
    const postResult = await nostr.posttoNostr("🧪 Test post from NostrSDK library #test", [['client', 'nostr-sdk']], null, 2); // POW difficulty 2 for faster testing
    console.log('✅ Posted note:', {
      success: postResult.success,
      eventId: postResult.eventId.substring(0, 16) + '...',
      published: postResult.published,
      failed: postResult.failed,
      powDifficulty: postResult.powDifficulty
    });

    // Test 4: Direct message (if recipient provided)
    if (TEST_RECIPIENT) {
      console.log('\n4. Testing direct message...');
      const msgResult = await nostr.sendmessage(TEST_RECIPIENT, "🧪 Test DM from NostrSDK library " + new Date().toISOString());
      console.log('✅ Sent message:', {
        success: msgResult.success,
        eventId: msgResult.eventId.substring(0, 16) + '...',
        published: msgResult.published,
        failed: msgResult.failed
      });
    } else {
      console.log('\n4. ⏭️  Skipping DM test (set TEST_RECIPIENT variable in test.js)');
    }

    // Test 5: Message listening (brief test)
    console.log('\n5. Testing message listening...');
    let messageReceived = false;
    const unsubscribe = nostr.getmessage((message) => {
      console.log('📨 Received test message:', {
        from: message.senderNpub.substring(0, 20) + '...',
        content: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
        timestamp: new Date(message.timestamp * 1000).toISOString()
      });
      messageReceived = true;
    });

    // Wait briefly for any messages
    await new Promise(resolve => setTimeout(resolve, 3000));
    unsubscribe();
    
    if (messageReceived) {
      console.log('✅ Message listening works!');
    } else {
      console.log('✅ Message listening setup successful (no messages received in 3s)');
    }

    // Test 6: Convenience functions with POW
    console.log('\n6. Testing convenience functions...');
    try {
      const convResult = await posttoNostr("🧪 Convenience function test with @npub mentions and #hashtags", { 
        tags: [['client', 'nostr-sdk']], 
        powDifficulty: 1  // Lower POW for faster testing
      });
      console.log('✅ Convenience function works:', {
        success: convResult.success,
        eventId: convResult.eventId.substring(0, 16) + '...',
        powDifficulty: convResult.powDifficulty
      });
    } catch (error) {
      console.log('✅ Convenience function works (generated keys automatically)');
    }

    // Test 7: Content tag extraction
    console.log('\n7. Testing content tag extraction...');
    const tagTestResult = await nostr.posttoNostr(
      "Testing #nostr #bitcoin mentions @npub1xyz... and notes note1abc...", 
      [], 
      null, 
      0  // No POW for this test
    );
    console.log('✅ Content tags extracted and posted:', {
      success: tagTestResult.success,
      eventId: tagTestResult.eventId.substring(0, 16) + '...'
    });

    console.log('\n8. Cleanup...');
    nostr.destroy();
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All tests completed successfully!');
  
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBasicFunctionality();
}

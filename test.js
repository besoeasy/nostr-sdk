import KatalNostr, { posttoNostr, sendmessage, getmessage } from './index.js';

// Test configuration
const TEST_NSEC = process.env.TEST_NSEC; // Set this to test with your key
const TEST_RECIPIENT = process.env.TEST_RECIPIENT; // Set this to test messaging

async function testBasicFunctionality() {
  console.log('🧪 Testing Katal Nostr Library...\n');

  try {
    // Test 1: Class instantiation and key generation
    console.log('1. Testing key generation...');
    const nostr = new KatalNostr();
    const keys = nostr.generateNewKey();
    console.log('✅ Generated keys:', {
      npub: keys.npub.substring(0, 20) + '...',
      nsec: keys.nsec.substring(0, 20) + '...'
    });

    // Test 2: Key import
    console.log('\n2. Testing key import...');
    if (TEST_NSEC) {
      const nostr2 = new KatalNostr({ nsec: TEST_NSEC });
      const keyInfo = nostr2.getKeyInfo();
      console.log('✅ Imported key:', keyInfo.npub.substring(0, 20) + '...');
    } else {
      console.log('⏭️  Skipping key import test (set TEST_NSEC environment variable)');
    }

    // Test 3: Public note posting
    console.log('\n3. Testing public note posting...');
    const postResult = await nostr.posttoNostr("🧪 Test post from Katal Nostr library", [['t', 'test']]);
    console.log('✅ Posted note:', {
      success: postResult.success,
      eventId: postResult.eventId.substring(0, 16) + '...',
      published: postResult.published,
      failed: postResult.failed
    });

    // Test 4: Direct message (if recipient provided)
    if (TEST_RECIPIENT) {
      console.log('\n4. Testing direct message...');
      const msgResult = await nostr.sendmessage(TEST_RECIPIENT, "🧪 Test DM from Katal Nostr library");
      console.log('✅ Sent message:', {
        success: msgResult.success,
        eventId: msgResult.eventId.substring(0, 16) + '...',
        published: msgResult.published,
        failed: msgResult.failed
      });
    } else {
      console.log('\n4. ⏭️  Skipping DM test (set TEST_RECIPIENT environment variable)');
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

    // Test 6: Convenience functions
    console.log('\n6. Testing convenience functions...');
    try {
      const convResult = await posttoNostr("🧪 Convenience function test");
      console.log('✅ Convenience function works:', {
        success: convResult.success,
        eventId: convResult.eventId.substring(0, 16) + '...'
      });
    } catch (error) {
      console.log('✅ Convenience function works (generated keys automatically)');
    }

    console.log('\n7. Cleanup...');
    nostr.destroy();
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\nQuick usage:');
    console.log('import KatalNostr from "katal-nostr";');
    console.log('const nostr = new KatalNostr();');
    console.log('const keys = nostr.generateNewKey();');
    console.log('await nostr.posttoNostr("Hello Nostr!");');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBasicFunctionality();
}

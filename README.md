# nostr-sdk

A minimal Node.js SDK for interacting with the Nostr protocol.

## Installation

```bash
npm install nostr-sdk
```

## Usage

```js
const nostr = require("nostr-sdk");
```

## API

### Top-level Functions

- **posttoNostr(message, options = {})**

  - Post a public note to Nostr.
  - `message`: The text to post.
  - `options`: `{ tags, relays, powDifficulty, privateKey/nsec }`
  - Returns: Result object with status and event ID.

- **getmessage(onMessage, options = {})**

  - Listen for direct messages sent to your account (NIP-4).
  - `onMessage`: Callback for each received message.
  - `options`: `{ relays, privateKey/nsec, since }`
  - Returns: Unsubscribe function.

- **sendmessage(recipientPubkey, message, options = {})**

  - Send an encrypted direct message to a user (NIP-4).
  - `recipientPubkey`: Recipient's public key (hex or npub).
  - `message`: The message to send.
  - `options`: `{ relays, privateKey/nsec }`
  - Returns: Result object with status and event ID.

- **getMessageNIP17(onMessage, options = {})**

  - Listen for NIP-17 gift-wrapped messages (modern, more private).
  - NIP-17 provides sealed sender and better metadata protection.
  - `onMessage`: Callback for each received message.
  - `options`: `{ relays, privateKey/nsec, since }`
  - Returns: Unsubscribe function.

- **sendMessageNIP17(recipientPubkey, message, options = {})**

  - Send a gift-wrapped message using NIP-17 (modern, more private).
  - NIP-17 uses ephemeral keys and sealed sender for better privacy.
  - `recipientPubkey`: Recipient's public key (hex or npub).
  - `message`: The message to send.
  - `options`: `{ relays, privateKey/nsec }`
  - Returns: Result object with status and event ID.

- **replyToPost(eventId, message, authorPubkey, options = {})**

  - Reply to a specific post by its event ID.
  - `eventId`: The event ID to reply to (hex or note format).
  - `message`: The reply message.
  - `authorPubkey`: The public key of the original post author (hex or npub format).
  - `options`: `{ tags, relays, powDifficulty, privateKey/nsec }`
  - Returns: Result object with status and event ID.

- **getGlobalFeed(options = {})**
  - Get recent posts from the global Nostr feed.
  - `options`: `{ limit, since, until, kinds, authors, relays }`
  - Returns: Promise resolving to array of events with additional fields (authorNpub, noteId, createdAtDate)

### Key Utilities

- **generateRandomNsec()**

  - Generate a random private key in nsec format.
  - Returns: String (nsec1...)

- **nsecToPublic(nsec)**
  - Convert an nsec private key to public key formats.
  - `nsec`: Private key in nsec1... format.
  - Returns: Object with `{ publicKey, npub }`

## NIP-4 vs NIP-17: Which Should You Use?

### NIP-4 (Legacy Encrypted DMs)
- ✅ Widely supported across Nostr clients
- ❌ Less private (sender/receiver metadata visible)
- ❌ Uses older encryption (NIP-04)
- Use for: Compatibility with older clients

### NIP-17 (Modern Gift Wrapped Messages)
- ✅ Better privacy with sealed sender
- ✅ Metadata protection through gift wrapping
- ✅ Uses modern NIP-44 encryption
- ✅ Ephemeral keys for each message
- ⚠️ Newer standard, may not be supported by all clients yet
- Use for: Maximum privacy in modern applications

**Recommendation**: Use NIP-17 (`sendMessageNIP17` / `getMessageNIP17`) for new applications. Keep NIP-4 support for backward compatibility.

## Quick Example: NIP-17 Messages

```js
import { NostrSDK } from 'nostr-sdk';

const client = new NostrSDK({
  nsec: 'nsec1...your-private-key',
});

// Send a private gift-wrapped message
await client.sendMessageNIP17(
  'npub1...recipient',
  'This is a private NIP-17 message!'
);

// Listen for incoming NIP-17 messages
const unsubscribe = client.getMessageNIP17(async (message) => {
  console.log('From:', message.senderNpub);
  console.log('Message:', message.content);
});

// Clean up when done
// unsubscribe();
// client.destroy();
```

See [example-nip17.js](example-nip17.js) for more examples.

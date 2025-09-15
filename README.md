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

  - Listen for direct messages sent to your account.
  - `onMessage`: Callback for each received message.
  - `options`: `{ relays, privateKey/nsec, since }`
  - Returns: Unsubscribe function.

- **sendmessage(recipientPubkey, message, options = {})**

  - Send an encrypted direct message to a user.
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

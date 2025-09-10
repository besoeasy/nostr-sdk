# nostr-sdk

A minimal Node.js SDK for interacting with the Nostr protocol.

## Installation

```bash
npm install nostr-sdk
```

## Usage

```js
const nostr = require("nostr-sdk");
// ... use nostr-sdk functions here
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

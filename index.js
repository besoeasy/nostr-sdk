import { SimplePool, nip19, getPublicKey, finalizeEvent, nip04, nip44, nip17, generateSecretKey, getEventHash } from "nostr-tools";

/**
 * Default Nostr relays for maximum reach
 */
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr.oxtr.dev",
  "wss://relay.nostr.band",
  "wss://nostr.wine",
  "wss://relay.primal.net",
  "wss://nostr.mom",
  "wss://relay.nostr.info",
  "wss://nostr-relay.wlvs.space",
  "wss://relay.current.fyi",
  "wss://brb.io",
  "wss://nostr.fmt.wiz.biz",
];

/**
 * Extract content tags from a message
 * @param {string} content - Message content
 * @returns {Object} Extracted tags
 */
function extractContentTags(content) {
  // More comprehensive patterns
  const hashtagPattern = /#([a-zA-Z0-9_]+)/g;
  const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
  const mentionPattern = /@(npub[a-zA-Z0-9]{59})/g;
  const notePattern = /(nostr:)?(note[a-zA-Z0-9]{59})/g;

  const hashtags = [...(content.match(hashtagPattern) || [])].map((tag) => tag.slice(1).toLowerCase());

  const links = content.match(urlPattern) || [];

  const mentions = [];
  const mentionMatches = content.match(mentionPattern) || [];
  for (const match of mentionMatches) {
    const npub = match.replace("@", "");
    if (npub.length === 63) {
      // Valid npub length
      mentions.push(npub);
    }
  }

  const notes = [...(content.match(notePattern) || [])].map((note) => note.replace("nostr:", ""));

  return { hashtags, links, mentions, notes };
}

/**
 * Calculates Proof of Work for an event with yielding to prevent blocking
 * @param {Object} event - Nostr event object
 * @param {number} difficulty - POW difficulty level
 * @returns {Promise<Object>} Event with POW nonce
 */
async function calculatePow(event, difficulty) {
  if (difficulty === 0) return event;

  let nonce = 0;
  let hash;
  const startTime = Date.now();
  const targetPrefix = "0".repeat(difficulty);

  // Create a copy to avoid mutating the original
  const workEvent = { ...event, tags: [...event.tags] };

  do {
    // Yield control every 1000 iterations or after 10ms
    if (nonce % 1000 === 0 && Date.now() - startTime > 10) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Remove existing nonce tags
    workEvent.tags = workEvent.tags.filter((tag) => tag[0] !== "nonce");
    workEvent.tags.push(["nonce", String(nonce), String(difficulty)]);
    hash = getEventHash(workEvent);
    nonce++;

    // Safety check to prevent infinite loops
    if (nonce > 10000000) {
      throw new Error(`POW calculation exceeded maximum attempts for difficulty ${difficulty}`);
    }
  } while (!hash.startsWith(targetPrefix));

  return workEvent;
}

/**
 * NostrSDK Client
 */
class NostrSDK {
  constructor(options = {}) {
    this.relays = options.relays || DEFAULT_RELAYS;
    this.pool = new SimplePool();
    this.privateKey = null;
    this.publicKey = null;
    this.processedmsgs = [];
    this.maxStoredEvents = 1000;

    // Initialize keys if provided
    if (options.privateKey) {
      this.setPrivateKey(options.privateKey);
    } else if (options.nsec) {
      this.setPrivateKeyFromNsec(options.nsec);
    }
  }

  /**
   * Set private key from hex string
   * @param {string} hexKey - 64-character hex string
   */
  setPrivateKey(hexKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      throw new Error("Invalid private key format. Must be 64-character hex string.");
    }

    // Convert hex string to Uint8Array
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hexKey.substr(i * 2, 2), 16);
    }

    this.privateKey = bytes;
    this.publicKey = getPublicKey(this.privateKey);
  }

  /**
   * Set private key from nsec format
   * @param {string} nsec - nsec1... format private key
   */
  setPrivateKeyFromNsec(nsec) {
    try {
      const decoded = nip19.decode(nsec);
      if (decoded && decoded.type === "nsec") {
        this.privateKey = new Uint8Array(decoded.data);
        this.publicKey = getPublicKey(this.privateKey);
      } else {
        throw new Error("Invalid nsec format");
      }
    } catch (e) {
      throw new Error(`Failed to decode nsec: ${e.message}`);
    }
  }

  /**
   * Generate a new random private key
   */
  generateNewKey() {
    this.privateKey = generateSecretKey();
    this.publicKey = getPublicKey(this.privateKey);
    return {
      privateKey: Array.from(this.privateKey)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      publicKey: this.publicKey,
      nsec: nip19.nsecEncode(this.privateKey),
      npub: nip19.npubEncode(this.publicKey),
    };
  }

  /**
   * Get current key information
   */
  getKeyInfo() {
    if (!this.privateKey || !this.publicKey) {
      throw new Error("No keys set. Use setPrivateKey, setPrivateKeyFromNsec, or generateNewKey first.");
    }

    return {
      privateKey: Array.from(this.privateKey)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      publicKey: this.publicKey,
      nsec: nip19.nsecEncode(this.privateKey),
      npub: nip19.npubEncode(this.publicKey),
    };
  }

  /**
   * Post a public note to Nostr
   * @param {string} message - The message to post
   * @param {Array} tags - Optional tags array
   * @param {Array} relays - Optional relay list (uses default if not provided)
   * @param {number} powDifficulty - POW difficulty level (default: 4)
   * @returns {Promise<Object>} - Result object with success status and event ID
   */
  async posttoNostr(message, tags = [], relays = null, powDifficulty = 4) {
    if (!this.privateKey) {
      throw new Error("Private key not set. Use setPrivateKey, setPrivateKeyFromNsec, or generateNewKey first.");
    }

    const targetRelays = relays || this.relays;

    // Extract content tags from the message
    const contentTags = extractContentTags(message);

    // Convert extracted tags to nostr format
    const autoTags = [];

    // Add hashtags as 't' tags
    contentTags.hashtags.forEach((hashtag) => {
      autoTags.push(["t", hashtag]);
    });

    // Add mentions as 'p' tags
    contentTags.mentions.forEach((mention) => {
      try {
        const decoded = nip19.decode(mention);
        if (decoded.type === "npub") {
          autoTags.push(["p", decoded.data]);
        }
      } catch (e) {
        // Skip invalid npubs
      }
    });

    // Add note references as 'e' tags
    contentTags.notes.forEach((note) => {
      try {
        const decoded = nip19.decode(note);
        if (decoded.type === "note") {
          autoTags.push(["e", decoded.data]);
        }
      } catch (e) {
        // Skip invalid notes
      }
    });

    // Combine manual tags with auto-extracted tags
    const allTags = [...tags, ...autoTags];

    try {
      let unsignedEvent = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: allTags,
        content: message,
        pubkey: this.publicKey,
      };

      // Calculate POW if difficulty > 0
      if (powDifficulty > 0) {
        console.log(`Calculating POW with difficulty ${powDifficulty}...`);
        const startTime = Date.now();
        unsignedEvent = await calculatePow(unsignedEvent, powDifficulty);
        const powTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`POW calculated in ${powTime} seconds`);
      }

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, this.privateKey);

      // Publish to relays
      const publishPromises = this.pool.publish(targetRelays, signedEvent);
      const results = await Promise.allSettled(publishPromises);

      let successful = 0;
      let failed = 0;
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successful++;
        } else {
          failed++;
          errors.push(`${targetRelays[index]}: ${result.reason}`);
        }
      });

      return {
        success: successful > 0,
        eventId: signedEvent.id,
        published: successful,
        failed: failed,
        totalRelays: targetRelays.length,
        powDifficulty: powDifficulty,
        errors: errors,
      };
    } catch (error) {
      throw new Error(`Failed to post to Nostr: ${error.message}`);
    }
  }

  /**
   * Reply to a specific post by its event ID
   * @param {string} eventId - The event ID to reply to (hex or note format)
   * @param {string} message - The reply message
   * @param {string} authorPubkey - The public key of the original post author (hex or npub format)
   * @param {Array} tags - Optional additional tags
   * @param {Array} relays - Optional relay list (uses default if not provided)
   * @param {number} powDifficulty - POW difficulty level (default: 4)
   * @returns {Promise<Object>} - Result object with success status and event ID
   */
  async replyToPost(eventId, message, authorPubkey, tags = [], relays = null, powDifficulty = 4) {
    if (!this.privateKey) {
      throw new Error("Private key not set. Use setPrivateKey, setPrivateKeyFromNsec, or generateNewKey first.");
    }

    // Convert note format to event ID if needed
    let targetEventId = eventId;
    if (eventId.startsWith("note")) {
      try {
        const decoded = nip19.decode(eventId);
        if (decoded && decoded.type === "note") {
          targetEventId = decoded.data;
        }
      } catch (e) {
        throw new Error(`Invalid note format: ${e.message}`);
      }
    }

    // Convert npub to pubkey if needed
    let targetPubkey = authorPubkey;
    if (authorPubkey.startsWith("npub")) {
      try {
        const decoded = nip19.decode(authorPubkey);
        if (decoded && decoded.type === "npub") {
          targetPubkey = decoded.data;
        }
      } catch (e) {
        throw new Error(`Invalid npub format: ${e.message}`);
      }
    }

    const targetRelays = relays || this.relays;

    // Extract content tags from the message
    const contentTags = extractContentTags(message);

    // Convert extracted tags to nostr format
    const autoTags = [];

    // Add hashtags as 't' tags
    contentTags.hashtags.forEach((hashtag) => {
      autoTags.push(["t", hashtag]);
    });

    // Add mentions as 'p' tags
    contentTags.mentions.forEach((mention) => {
      try {
        const decoded = nip19.decode(mention);
        if (decoded.type === "npub") {
          autoTags.push(["p", decoded.data]);
        }
      } catch (e) {
        // Skip invalid npubs
      }
    });

    // Add note references as 'e' tags
    contentTags.notes.forEach((note) => {
      try {
        const decoded = nip19.decode(note);
        if (decoded.type === "note") {
          autoTags.push(["e", decoded.data]);
        }
      } catch (e) {
        // Skip invalid notes
      }
    });

    // Add reply tags according to NIP-10
    const replyTags = [
      ["e", targetEventId, "", "reply"], // The event being replied to
      ["p", targetPubkey], // The author of the original post
    ];

    // Combine all tags
    const allTags = [...tags, ...autoTags, ...replyTags];

    try {
      let unsignedEvent = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: allTags,
        content: message,
        pubkey: this.publicKey,
      };

      // Calculate POW if difficulty > 0
      if (powDifficulty > 0) {
        console.log(`Calculating POW with difficulty ${powDifficulty}...`);
        const startTime = Date.now();
        unsignedEvent = await calculatePow(unsignedEvent, powDifficulty);
        const powTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`POW calculated in ${powTime} seconds`);
      }

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, this.privateKey);

      // Publish to relays
      const publishPromises = this.pool.publish(targetRelays, signedEvent);
      const results = await Promise.allSettled(publishPromises);

      let successful = 0;
      let failed = 0;
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successful++;
        } else {
          failed++;
          errors.push(`${targetRelays[index]}: ${result.reason}`);
        }
      });

      return {
        success: successful > 0,
        eventId: signedEvent.id,
        published: successful,
        failed: failed,
        totalRelays: targetRelays.length,
        powDifficulty: powDifficulty,
        replyTo: targetEventId,
        errors: errors,
      };
    } catch (error) {
      throw new Error(`Failed to reply to post: ${error.message}`);
    }
  }

  /**
   * Listen for direct messages sent to this account
   * @param {Function} onMessage - Callback function for received messages
   * @param {Object} options - Options for message filtering
   * @returns {Function} - Unsubscribe function
   */
  getmessage(onMessage, options = {}) {
    if (!this.privateKey || !this.publicKey) {
      throw new Error("Keys not set. Use setPrivateKey, setPrivateKeyFromNsec, or generateNewKey first.");
    }

    const {
      since = Math.floor(Date.now() / 1000) - 100, // Last 100 seconds by default
      relays = null,
    } = options;

    const targetRelays = relays || this.relays;
    const maxAgeMs = 100 * 1000; // 100 seconds in milliseconds

    const filter = {
      kinds: [4],
      "#p": [this.publicKey],
      since: since,
    };

    const sub = this.pool.subscribe(targetRelays, filter, {
      onevent: async (event) => {
        try {
          const sender = event.pubkey;
          const encrypted = event.content;

          // Skip messages older than 100 seconds
          const ageMs = Date.now() - event.created_at * 1000;
          if (ageMs > maxAgeMs) {
            return;
          }

          // Skip already processed events
          if (this.processedmsgs.includes(event.id)) {
            return;
          }

          // Add to processed messages and maintain array size
          this.processedmsgs.push(event.id);
          if (this.processedmsgs.length > this.maxStoredEvents) {
            this.processedmsgs.shift(); // Remove oldest entry
          }

          // Decrypt message
          let decrypted;
          try {
            decrypted = await nip04.decrypt(this.privateKey, sender, encrypted);
          } catch (e) {
            console.warn(`Failed to decrypt message from ${sender}: ${e.message}`);
            return;
          }

          const messageData = {
            id: event.id,
            sender: sender,
            senderNpub: nip19.npubEncode(sender),
            content: decrypted.trim(),
            timestamp: event.created_at,
            event: event,
          };

          // Call the callback
          await onMessage(messageData);
        } catch (error) {
          console.error("Error handling message event:", error);
        }
      },
      oneose: () => {
        console.log("Subscription established to relays");
      },
      onclose: (reason) => {
        console.warn("Subscription closed:", reason);
      },
    });

    // Return unsubscribe function
    return () => {
      if (sub && sub.close) {
        sub.close();
      }
    };
  }

  /**
   * Send an encrypted direct message to a specific user
   * @param {string} recipientPubkey - Public key of the recipient (hex format)
   * @param {string} message - Message to send
   * @param {Array} relays - Optional relay list (uses default if not provided)
   * @returns {Promise<Object>} - Result object with success status
   */
  async sendmessage(recipientPubkey, message, relays = null) {
    if (!this.privateKey) {
      throw new Error("Private key not set. Use setPrivateKey, setPrivateKeyFromNsec, or generateNewKey first.");
    }

    // Convert npub to pubkey if needed
    let targetPubkey = recipientPubkey;
    if (recipientPubkey.startsWith("npub")) {
      try {
        const decoded = nip19.decode(recipientPubkey);
        if (decoded && decoded.type === "npub") {
          targetPubkey = decoded.data;
        }
      } catch (e) {
        throw new Error(`Invalid npub format: ${e.message}`);
      }
    }

    const targetRelays = relays || this.relays;

    try {
      // Encrypt the message
      const encrypted = await nip04.encrypt(this.privateKey, targetPubkey, message);

      const unsignedEvent = {
        kind: 4, // Encrypted Direct Message
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", targetPubkey]],
        content: encrypted,
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, this.privateKey);

      // Publish to relays
      const publishPromises = this.pool.publish(targetRelays, signedEvent);
      const results = await Promise.allSettled(publishPromises);

      let successful = 0;
      let failed = 0;
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successful++;
        } else {
          failed++;
          errors.push(`${targetRelays[index]}: ${result.reason}`);
        }
      });

      return {
        success: successful > 0,
        eventId: signedEvent.id,
        published: successful,
        failed: failed,
        totalRelays: targetRelays.length,
        errors: errors,
      };
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Send an encrypted direct message using NIP-17 (gift wrap)
   * NIP-17 provides better privacy with sealed sender and ephemeral keys
   * @param {string} recipientPubkey - Public key of the recipient (hex format)
   * @param {string} message - Message to send
   * @param {Array} relays - Optional relay list (uses default if not provided)
   * @returns {Promise<Object>} - Result object with success status
   */
  async sendMessageNIP17(recipientPubkey, message, relays = null) {
    if (!this.privateKey) {
      throw new Error("Private key not set. Use setPrivateKey, setPrivateKeyFromNsec, or generateNewKey first.");
    }

    // Convert npub to pubkey if needed
    let targetPubkey = recipientPubkey;
    if (recipientPubkey.startsWith("npub")) {
      try {
        const decoded = nip19.decode(recipientPubkey);
        if (decoded && decoded.type === "npub") {
          targetPubkey = decoded.data;
        }
      } catch (e) {
        throw new Error(`Invalid npub format: ${e.message}`);
      }
    }

    const targetRelays = relays || this.relays;

    try {
      // Create a recipient object for NIP-17
      const recipient = {
        publicKey: targetPubkey,
      };

      // Wrap the message using NIP-17 gift wrap
      // This creates a kind 1059 event with sealed sender
      const giftWrappedEvent = nip17.wrapEvent(this.privateKey, recipient, message);

      // Publish to relays
      const publishPromises = this.pool.publish(targetRelays, giftWrappedEvent);
      const results = await Promise.allSettled(publishPromises);

      let successful = 0;
      let failed = 0;
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successful++;
        } else {
          failed++;
          errors.push(`${targetRelays[index]}: ${result.reason}`);
        }
      });

      return {
        success: successful > 0,
        eventId: giftWrappedEvent.id,
        published: successful,
        failed: failed,
        totalRelays: targetRelays.length,
        nip: 17,
        errors: errors,
      };
    } catch (error) {
      throw new Error(`Failed to send NIP-17 message: ${error.message}`);
    }
  }

  /**
   * Listen for NIP-17 gift-wrapped messages (kind 1059)
   * @param {Function} onMessage - Callback function for received messages
   * @param {Object} options - Options for message filtering
   * @returns {Function} - Unsubscribe function
   */
  getMessageNIP17(onMessage, options = {}) {
    if (!this.privateKey || !this.publicKey) {
      throw new Error("Keys not set. Use setPrivateKey, setPrivateKeyFromNsec, or generateNewKey first.");
    }

    const {
      since = Math.floor(Date.now() / 1000) - 100, // Last 100 seconds by default
      relays = null,
    } = options;

    const targetRelays = relays || this.relays;
    const maxAgeMs = 100 * 1000; // 100 seconds in milliseconds

    const filter = {
      kinds: [1059], // Gift wrap events
      "#p": [this.publicKey],
      since: since,
    };

    const sub = this.pool.subscribe(targetRelays, filter, {
      onevent: async (event) => {
        try {
          // Skip messages older than 100 seconds
          const ageMs = Date.now() - event.created_at * 1000;
          if (ageMs > maxAgeMs) {
            return;
          }

          // Skip already processed events
          if (this.processedmsgs.includes(event.id)) {
            return;
          }

          // Add to processed messages and maintain array size
          this.processedmsgs.push(event.id);
          if (this.processedmsgs.length > this.maxStoredEvents) {
            this.processedmsgs.shift(); // Remove oldest entry
          }

          // Unwrap the gift-wrapped event
          let unwrapped;
          try {
            unwrapped = nip17.unwrapEvent(event, this.privateKey);
          } catch (e) {
            console.warn(`Failed to unwrap NIP-17 message: ${e.message}`);
            return;
          }

          const messageData = {
            id: unwrapped.id,
            sender: unwrapped.pubkey,
            senderNpub: nip19.npubEncode(unwrapped.pubkey),
            content: unwrapped.content.trim(),
            timestamp: unwrapped.created_at,
            event: unwrapped,
            wrappedEventId: event.id,
            nip: 17,
          };

          // Call the callback
          await onMessage(messageData);
        } catch (error) {
          console.error("Error handling NIP-17 message event:", error);
        }
      },
      oneose: () => {
        console.log("NIP-17 subscription established to relays");
      },
      onclose: (reason) => {
        console.warn("NIP-17 subscription closed:", reason);
      },
    });

    // Return unsubscribe function
    return () => {
      if (sub && sub.close) {
        sub.close();
      }
    };
  }

  /**
   * Get global feed from Nostr relays
   * @param {Object} options - Options for feed filtering
   * @returns {Promise<Array>} - Array of events
   */
  async getGlobalFeed(options = {}) {
    const {
      limit = 50,
      since = Math.floor(Date.now() / 1000) - (3600), // Last hour by default
      until = null,
      kinds = [1], // Text notes by default
      authors = null,
      relays = null
    } = options;

    const targetRelays = relays || this.relays;
    const events = [];
    const seenEventIds = new Set();

    const filter = {
      kinds: kinds,
      limit: limit,
      since: since
    };

    if (until) {
      filter.until = until;
    }

    if (authors && authors.length > 0) {
      filter.authors = authors;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (sub && sub.close) {
          sub.close();
        }
        resolve(events);
      }, 5000); // 5 second timeout

      const sub = this.pool.subscribe(targetRelays, filter, {
        onevent: (event) => {
          // Avoid duplicates
          if (!seenEventIds.has(event.id)) {
            seenEventIds.add(event.id);
            
            // Add decoded formats for convenience
            const eventData = {
              ...event,
              authorNpub: nip19.npubEncode(event.pubkey),
              noteId: nip19.noteEncode(event.id),
              createdAtDate: new Date(event.created_at * 1000)
            };
            
            events.push(eventData);
          }
        },
        oneose: () => {
          // End of stored events - sort by creation time (newest first) and close
          events.sort((a, b) => b.created_at - a.created_at);
          
          clearTimeout(timeout);
          if (sub && sub.close) {
            sub.close();
          }
          resolve(events);
        },
        onclose: (reason) => {
          clearTimeout(timeout);
          console.warn("Global feed subscription closed:", reason);
          resolve(events);
        },
      });
    });
  }

  /**
   * Close all connections and cleanup
   */
  destroy() {
    if (this.pool) {
      this.pool.destroy();
    }
    this.processedmsgs = [];
  }
}

// Key generation and conversion utilities
export function generateRandomNsec() {
  const privateKey = generateSecretKey();
  return nip19.nsecEncode(privateKey);
}

export function nsecToPublic(nsec) {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded && decoded.type === "nsec") {
      const privateKey = new Uint8Array(decoded.data);
      const publicKey = getPublicKey(privateKey);
      return {
        publicKey: publicKey,
        npub: nip19.npubEncode(publicKey),
      };
    } else {
      throw new Error("Invalid nsec format");
    }
  } catch (e) {
    throw new Error(`Failed to decode nsec: ${e.message}`);
  }
}

// Convenience functions for quick usage
export async function posttoNostr(message, options = {}) {
  const client = new NostrSDK(options);
  if (!client.privateKey) {
    const keys = client.generateNewKey();
    console.log("Generated new keys:", keys);
  }
  return await client.posttoNostr(message, options.tags, options.relays, options.powDifficulty);
}

export function getmessage(onMessage, options = {}) {
  const client = new NostrSDK(options);
  if (!client.privateKey) {
    throw new Error("Private key required for receiving messages. Set via options.privateKey, options.nsec, or environment variables.");
  }
  return client.getmessage(onMessage, options);
}

export async function sendmessage(recipientPubkey, message, options = {}) {
  const client = new NostrSDK(options);
  if (!client.privateKey) {
    const keys = client.generateNewKey();
    console.log("Generated new keys:", keys);
  }
  return await client.sendmessage(recipientPubkey, message, options.relays);
}

export async function sendMessageNIP17(recipientPubkey, message, options = {}) {
  const client = new NostrSDK(options);
  if (!client.privateKey) {
    const keys = client.generateNewKey();
    console.log("Generated new keys:", keys);
  }
  return await client.sendMessageNIP17(recipientPubkey, message, options.relays);
}

export function getMessageNIP17(onMessage, options = {}) {
  const client = new NostrSDK(options);
  if (!client.privateKey) {
    throw new Error("Private key required for receiving NIP-17 messages. Set via options.privateKey, options.nsec, or environment variables.");
  }
  return client.getMessageNIP17(onMessage, options);
}

export async function replyToPost(eventId, message, authorPubkey, options = {}) {
  const client = new NostrSDK(options);
  if (!client.privateKey) {
    const keys = client.generateNewKey();
    console.log("Generated new keys:", keys);
  }
  return await client.replyToPost(eventId, message, authorPubkey, options.tags, options.relays, options.powDifficulty);
}

export async function getGlobalFeed(options = {}) {
  const client = new NostrSDK(options);
  return await client.getGlobalFeed(options);
}


# VIP List Chat Documentation

## Overview

The VIP List mod includes a chat feature that allows players to send encrypted messages to each other. The chat system uses:
- **End-to-end encryption** for message privacy
- **Username encryption** for additional privacy protection
- **Read status encryption** for message read status privacy
- **Username hashing** for secure Firebase paths
- **Event-driven updates** for real-time message delivery
- **Chat requests and privileges** for access control
- **Message filtering** to control who can message you
- **Replay link support** for sharing board configurations

The Firebase Realtime Database is already configured and ready to use. You just need to enable the chat feature in Mod Settings.

### Firebase Database
- **Database URL**: `https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app`
- **Database Type**: Realtime Database
- **Status**: Pre-configured and ready to use

## Getting Started

### Enable Chat Feature

1. **Open Mod Settings**
   - Access the Mod Settings from the game interface

2. **Enable VIP List Chat**
   - Find the "Enable VIP List Chat" option
   - Toggle it to `true` or `enabled`
   - Your chat status will automatically sync to Firebase

3. **Configure Message Filter (Optional)**
   - Choose who can message you:
     - `'all'` (default): Receive messages from everyone
     - `'friends'`: Only receive messages from players in your VIP list
   - Set via `vipListMessageFilter` in Mod Settings

That's it! The chat feature is now enabled and ready to use.

### Verify Chat is Working

1. **Check browser console** (F12)
   - Look for: `[VIP List] Chat enabled status synced to Firebase: true`
   - If you see 401 errors, the Firebase rules may need adjustment (contact mod developer)

2. **Test chat functionality**
   - Try requesting chat with another player
   - Send a test message
   - Verify messages are received

## How It Works

The chat system uses Firebase Realtime Database with the following structure:

- **`/messages`**: Stores encrypted chat messages between players (usernames are hashed in paths and encrypted in message bodies)
- **`/chat-enabled`**: Tracks which players have chat enabled in their mod settings (usernames are hashed in paths)
- **`/chat-requests`**: Stores pending chat privilege requests (usernames are hashed in paths and encrypted in request bodies)
- **`/chat-privileges`**: Stores granted chat privileges between players
- **`/blocked-players`**: Stores blocked players list (prevents blocked players from messaging or requesting chat)

All data is stored in Firebase and synchronized across all players using the mod. Usernames are protected through encryption and hashing for enhanced privacy.

## Troubleshooting

### 401 Unauthorized Errors

If you see 401 errors in the browser console, it means the Firebase security rules are blocking access. This is a server-side configuration issue that needs to be fixed by the mod developer.

**What to do:**
1. **Report the issue** to the mod developer
2. **Check browser console** (F12) for error messages
3. **Note the specific error** - it will help identify which Firebase path is blocked

**Common causes:**
- Firebase security rules not properly configured
- Database access restrictions
- Network/firewall blocking Firebase requests

### Other Common Issues

#### Chat Not Working
- **Check if chat is enabled** in Mod Settings
- **Verify browser console** for error messages
- **Try refreshing the page** (hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`)

#### Messages Not Received
- **Check message filter setting** - if set to `'friends'`, you'll only receive messages from VIP list players
- **Verify recipient has chat enabled** in their Mod Settings
- **Check if you have chat privileges** with the sender (may need to accept a chat request)

#### Chat Requests Not Working
- **Ensure both players have chat enabled** in Mod Settings
- **Check if player is blocked** - blocked players cannot send requests
- **Verify Firebase rules** allow chat-requests access (contact mod developer if 401 errors)

### Common Error Codes

- **401 Unauthorized**: Firebase security rules are blocking access (contact mod developer)
- **403 Forbidden**: Database access issue (contact mod developer)
- **404 Not Found**: Database path doesn't exist (usually temporary, should resolve automatically)

## Chat Features

### Chat Requests
- Players must request chat privileges before messaging new players
- Recipients can accept or decline requests
- TestPlayer auto-accepts requests for testing purposes
- Requests are checked frequently (every 1 second) when a panel is open with a pending request

### Chat Privileges
- Once granted, privileges work both ways
- Privileges persist until manually revoked
- Players can see their chat history even after closing the panel

### Blocking Players
- Players can block other players to prevent them from messaging or requesting chat
- Blocked players cannot send messages or request chat privileges
- Block/unblock option available in the VIP list dropdown menu and chat panel header
- Blocking is one-way (if Player A blocks Player B, Player B cannot message Player A, but Player A can still message Player B if they have privileges)

### Message Encryption
- All messages are encrypted end-to-end using AES-GCM encryption
- Only the sender and recipient can decrypt messages
- Messages are stored encrypted in Firebase
- Encryption key is derived from both player names using PBKDF2

### Read Status Encryption
- Message read status (read/unread) is encrypted using AES-GCM encryption
- Only the sender and recipient can decrypt read status
- Read status is stored encrypted in Firebase
- Uses a separate encryption key derived from both player names using PBKDF2 with a different salt
- Backward compatible with unencrypted read status values

### Username Encryption & Hashing
- **Username Hashing**: Usernames in Firebase database paths are hashed using SHA-256 (one-way, deterministic)
  - Firebase paths use hashed usernames instead of plain text (e.g., `/messages/{hashed-username}/`)
  - This prevents username exposure in database paths while maintaining functionality
  - Hashes are deterministic - the same username always produces the same hash
  
- **Username Encryption**: Usernames in message and request bodies are encrypted using AES-GCM
  - The `from` and `to` fields in messages and requests are encrypted before storage
  - Encryption key is derived from both player names using PBKDF2 with a separate salt
  - Only the sender and recipient can decrypt usernames
  
- **Hash Hints**: Messages and requests include a hash hint (`fromHash`) for efficient sender identification
  - Allows quick matching without trying to decrypt all possible senders
  - Hash hints are one-way - cannot be reversed to reveal the original username
  
- **Backward Compatibility**: The system supports both encrypted and unencrypted data
  - New messages/requests use encryption automatically
  - Old unencrypted data continues to work seamlessly
  - Functions try both hashed and non-hashed paths when reading data

### Message Filtering
- **Filter Options**: Available in Mod Settings
  - `'all'` (default): Receive messages from everyone
  - `'friends'`: Only receive messages from players in your VIP list
- Filter is applied to incoming messages and notifications
- Configure via `vipListMessageFilter` in Mod Settings

### Replay Links
- Messages can contain replay links in the format: `$replay({"region":"RegionName","map":"MapName"})`
- Replay links are automatically detected and converted to clickable links
- Clicking a replay link copies the replay code to clipboard
- Useful for sharing board configurations with other players

### Minimized Chats
- Chat panels can be minimized to a sidebar
- Minimized chats show player name and unread message count badge
- Click minimized chat to restore the full panel
- Minimized chats persist across page refreshes (saved to localStorage)
- Close button (✕) appears on hover to remove minimized chat
- Sidebar automatically positions next to the main game content area

### Message Length Limit
- Maximum message length: **500 characters**
- Character counter shows current length and limit
- Messages exceeding the limit cannot be sent
- Counter turns red when approaching/exceeding limit

## Configuration Options

The chat feature can be configured in Mod Settings:

### Enable VIP List Chat
- **Setting**: `enableVipListChat`
- **Type**: Boolean (true/false)
- **Default**: `false`
- **Description**: Enable or disable the chat feature
- **When enabled**: Your chat status is synced to Firebase so other players know you're available

### Message Filter
- **Setting**: `vipListMessageFilter`
- **Type**: String
- **Options**: 
  - `'all'` (default): Receive messages from everyone
  - `'friends'`: Only receive messages from players in your VIP list
- **Description**: Control who can send you messages
- **Note**: Filter is applied to incoming messages and notifications

## Message Delivery System

### Event-Driven Updates (Primary)
- Uses **EventSource** (Server-Sent Events) for real-time message delivery
- Automatically receives new messages as they arrive
- More efficient than polling (no constant requests)
- Falls back to polling if EventSource fails

### Polling (Fallback)
- Used when EventSource is unavailable or fails
- Checks for new messages every **5 seconds**
- Automatically switches to polling when chat panels are open (for more frequent updates)
- Switches back to event-driven when no panels are open (for efficiency)

### Update Frequency
- **No panels open**: Event-driven (real-time via EventSource)
- **Panels open**: Polling every 5 seconds (more frequent updates for active conversations)
- **Pending requests**: Checked every 1 second for accepted requests

## Security Features

### Encryption & Hashing Overview

The chat system implements multiple layers of security to protect user privacy:

1. **Message Text Encryption**
   - All message content is encrypted using AES-GCM
   - Encryption keys are derived from both player names using PBKDF2
   - Messages are stored encrypted in Firebase and only decrypted by the recipient

2. **Read Status Encryption**
   - Message read status (read/unread) is encrypted using AES-GCM
   - Uses a separate encryption key derived from both player names using PBKDF2 with a different salt
   - Read status is stored encrypted in Firebase and only decrypted by the recipient
   - Backward compatible with unencrypted read status values

3. **Username Hashing (Database Paths)**
   - Usernames in Firebase paths are hashed using SHA-256
   - This prevents username exposure in database structure
   - Hashes are deterministic (same username = same hash) for consistency
   - Example: `/messages/a1b2c3d4.../` instead of `/messages/PlayerName/`

4. **Username Encryption (Message Bodies)**
   - Usernames in message and request bodies are encrypted using AES-GCM
   - Separate encryption keys are used for usernames vs message text vs read status
   - Only the sender and recipient can decrypt usernames
   - Includes hash hints for efficient decryption without brute-force attempts

5. **Backward Compatibility**
   - System automatically detects and handles both encrypted and unencrypted data
   - Functions try both hashed and non-hashed paths when reading
   - Existing unencrypted data continues to work without issues
   - New data automatically uses the latest encryption

### Privacy Benefits

- **Reduced Username Exposure**: Usernames are hashed in database paths, making them less visible
- **End-to-End Encryption**: Message content, usernames, and read status are all encrypted
- **No Server-Side Decryption**: Firebase never sees plain text usernames, messages, or read status
- **Deterministic Operations**: Same usernames produce same hashes/keys for consistency
- **Separate Encryption Keys**: Different keys for messages, usernames, and read status provide additional security

## Additional Notes

- The Firebase database is pre-configured and ready to use - no setup required
- Chat panels are draggable and resizable
- Panel positions are saved and restored on page refresh
- Unread message counts are displayed in badges on the VIP List menu item and minimized chats
- Chat sidebar automatically repositions when window is resized
- Conversation history persists and can be deleted via the delete button in chat panel header
- All messages, usernames, and read status are encrypted end-to-end for privacy
- Usernames are hashed in database paths for additional privacy protection
- Separate encryption keys are used for messages, usernames, and read status


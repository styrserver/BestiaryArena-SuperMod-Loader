# Firebase Best Runs API Documentation

## Overview

The Firebase Best Runs API allows you to fetch and decrypt best runs data from Firebase without requiring the mod to be installed. This makes it possible to:

- Access runs from any device or browser
- Build custom tools and leaderboards
- Share runs with players who don't have the mod
- Integrate with other systems

The data is encrypted client-side using a password, so only those with the password can decrypt and view the actual run data.

## Firebase Endpoint Structure

### Base URL
```
https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app
```

### Path Format
```
/best-runs/{hashedPlayerName}.json
```

### Full URL Example
```
https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app/best-runs/a1b2c3d4e5f6...json
```

The `hashedPlayerName` is a SHA-256 hash of the player's name (lowercase).

## Username Hashing

Player names are hashed using SHA-256 before being used as Firebase keys. This provides privacy and ensures consistent key formatting.

### Method
- **Algorithm**: SHA-256
- **Input**: Player name (converted to lowercase)
- **Output**: Hexadecimal string (64 characters)

### JavaScript Example
```javascript
async function hashUsername(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(username.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Usage
const hashedName = await hashUsername('PlayerName');
// Returns: "a1b2c3d4e5f6..."
```

## Data Structure

### Encrypted Format (from Firebase)
```json
{
  "encrypted": "base64-encoded-encrypted-data",
  "lastUpdated": 1234567890,
  "version": "1.0"
}
```

### Decrypted Format
```json
{
  "runs": {
    "map_forest": {
      "speedrun": [
        {
          "time": 1234,
          "date": "2024-01-10",
          "mapName": "Forest",
          "replayLink": "$replay({\"region\":\"Forest Region\",\"map\":\"Forest\",\"floor\":0,\"board\":[{\"tile\":1,\"monster\":{\"name\":\"monstername\",\"level\":50,\"hp\":20,\"ad\":20,\"ap\":20,\"armor\":20,\"magicResist\":20},\"equipment\":{\"name\":\"equipmentname\",\"stat\":\"ap\",\"tier\":5}}],\"seed\":1234567890})"
        }
      ],
      "rank": [
        {
          "points": 1500,
          "time": 1234,
          "date": "2024-01-10",
          "mapName": "Forest",
          "replayLink": "$replay({\"region\":\"Forest Region\",\"map\":\"Forest\",\"floor\":0,\"board\":[{\"tile\":1,\"monster\":{\"name\":\"monstername\",\"level\":50,\"hp\":20,\"ad\":20,\"ap\":20,\"armor\":20,\"magicResist\":20},\"equipment\":{\"name\":\"equipmentname\",\"stat\":\"ap\",\"tier\":5}}],\"seed\":1234567890})"
        }
      ],
      "floor": [
        {
          "floor": 5,
          "floorTicks": 1000,
          "date": "2024-01-10",
          "mapName": "Forest",
          "replayLink": "$replay({\"region\":\"Forest Region\",\"map\":\"Forest\",\"floor\":5,\"board\":[{\"tile\":1,\"monster\":{\"name\":\"monstername\",\"level\":50,\"hp\":20,\"ad\":20,\"ap\":20,\"armor\":20,\"magicResist\":20},\"equipment\":{\"name\":\"equipmentname\",\"stat\":\"ap\",\"tier\":5}}],\"seed\":1234567890})"
        }
      ]
    }
  },
  "metadata": {
    "totalRuns": 10,
    "totalMaps": 5
  },
  "playerName": "PlayerName",
  "uploadedAt": 1234567890
}
```

**Note**: 
- Runs are stored sorted by region and map order (matching Cyclopedia's display order), not alphabetically.
- The `replayLink` field contains the pre-generated `$replay(...)` string with all replay information (region, map, floor, board, seed). This eliminates the need to store separate `setup`, `seed`, `regionName`, `floor`, or `mapId` fields.
- The `replayLink` is generated during upload and can be used directly without regeneration.
- **Simplified Structure**: The data structure has been optimized to store only essential fields. The `replayLink` contains all information needed for replay, so separate fields like `setup`, `seed`, `regionName`, `floor`, and `mapId` are no longer stored separately.

## Encryption Details

The data is encrypted using AES-GCM with a key derived from the password using PBKDF2.

### Encryption Parameters
- **Algorithm**: AES-GCM
- **Key Derivation**: PBKDF2 with SHA-256
- **Iterations**: 100,000
- **Salt**: `"firebase-runs-salt"` (UTF-8 encoded)
- **Key Length**: 256 bits
- **IV Length**: 12 bytes (prepended to encrypted data)

### Encryption Process
1. Derive encryption key from password using PBKDF2
2. Generate random 12-byte IV
3. Encrypt data using AES-GCM
4. Prepend IV to encrypted data
5. Encode as base64

### Decryption Process
1. Decode base64 to get combined IV + encrypted data
2. Extract IV (first 12 bytes) and encrypted data (remaining bytes)
3. Derive encryption key from password using PBKDF2
4. Decrypt using AES-GCM
5. Parse JSON

## Code Examples

### Complete Standalone Example

```javascript
// Firebase configuration
const FIREBASE_URL = 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app';

// Hash username
async function hashUsername(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(username.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Derive encryption key
async function deriveEncryptionKey(password) {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = encoder.encode('firebase-runs-salt');
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  return key;
}

// Decrypt runs data
async function decryptRunsData(encryptedText, password) {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      return null;
    }
    
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    if (combined.length < 13) {
      return null;
    }
    
    const key = await deriveEncryptionKey(password);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decrypted);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error decrypting:', error);
    return null;
  }
}

// Fetch and decrypt runs
async function fetchPlayerRuns(playerName, password) {
  try {
    // Hash username
    const hashedName = await hashUsername(playerName);
    
    // Fetch encrypted data
    const response = await fetch(`${FIREBASE_URL}/best-runs/${hashedName}.json`);
    if (!response.ok) {
      if (response.status === 404) {
        console.log('No runs found for this player');
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const encryptedData = await response.json();
    if (!encryptedData || !encryptedData.encrypted) {
      console.log('No encrypted data found');
      return null;
    }
    
    // Decrypt
    const decryptedData = await decryptRunsData(encryptedData.encrypted, password);
    return decryptedData;
  } catch (error) {
    console.error('Error fetching runs:', error);
    return null;
  }
}

// Usage
const runs = await fetchPlayerRuns('PlayerName', 'password123');
if (runs) {
  console.log('Runs:', runs);
  console.log('Speedrun runs:', runs.runs.map_forest?.speedrun);
} else {
  console.log('Failed to fetch or decrypt runs');
}
```

### Using $replay Links

The `replayLink` field is pre-generated during upload and contains the complete `$replay(...)` string. You can use it directly without any processing:

```javascript
// The replayLink is already stored in the run data
const run = runs.runs.map_forest.speedrun[0];
console.log(run.replayLink);
// Output: $replay({"region":"Forest Region","map":"Forest","floor":0,"board":[{"tile":1,"monster":{"name":"monstername","level":50,"hp":20,"ad":20,"ap":20,"armor":20,"magicResist":20},"equipment":{"name":"equipmentname","stat":"ap","tier":5}}],"seed":1234567890})

// Use it directly in your output
console.log(run.replayLink);
```

**Note**: The `replayLink` is generated during upload, so you don't need to generate it yourself. All replay information (region, map, floor, board, seed) is contained within the `$replay(...)` string.

## Usage Examples

### Browser Console

1. Open browser console (F12)
2. Paste the complete example code above
3. Run:
```javascript
const runs = await fetchPlayerRuns('PlayerName', 'password123');
console.log(runs);
```

### Simple HTML Page

Create an HTML file with the code above and add a simple UI:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Fetch Best Runs</title>
</head>
<body>
  <h1>Fetch Best Runs</h1>
  <input type="text" id="playerName" placeholder="Player Name">
  <input type="password" id="password" placeholder="Password">
  <button onclick="fetchRuns()">Fetch Runs</button>
  <pre id="output"></pre>
  
  <script>
    // Paste all the functions from the complete example above
    
    async function fetchRuns() {
      const playerName = document.getElementById('playerName').value;
      const password = document.getElementById('password').value;
      const output = document.getElementById('output');
      
      output.textContent = 'Fetching...';
      const runs = await fetchPlayerRuns(playerName, password);
      
      if (runs) {
        output.textContent = JSON.stringify(runs, null, 2);
      } else {
        output.textContent = 'Failed to fetch or decrypt runs';
      }
    }
  </script>
</body>
</html>
```

## Troubleshooting

### Common Errors

#### "No runs found for this player"
- The player hasn't uploaded any runs yet
- The player name is incorrect
- Check Firebase directly: `https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app/best-runs/{hashedName}.json`

#### "Failed to decrypt"
- Wrong password
- Data corruption
- Encryption method mismatch (check that you're using the correct salt and iterations)

#### "HTTP 404"
- No data exists for this player
- Username hash is incorrect

#### "HTTP 403" or "HTTP 401"
- Firebase rules may need adjustment
- Contact mod developer if this persists

### Verifying Data Exists

Check if data exists in Firebase:
```javascript
const hashedName = await hashUsername('PlayerName');
const response = await fetch(`https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app/best-runs/${hashedName}.json`);
const data = await response.json();
console.log(data);
```

If you see `{encrypted: "...", lastUpdated: ..., version: "1.0"}`, the data exists and you just need the correct password.

### Password Issues

- Passwords are case-sensitive
- Make sure there are no extra spaces
- The password must match exactly what was used to encrypt

### Network Errors

- Check internet connection
- Firebase may be temporarily unavailable
- Check browser console for CORS errors (shouldn't happen with Firebase REST API)

## Security Notes

- The password is never sent to Firebase - only encrypted data is stored
- Public read access is acceptable because data is encrypted
- Only those with the password can decrypt and view runs
- The encryption key is derived from the password using PBKDF2 (100,000 iterations)
- Use a strong password for better security

## API Reference

### Functions

#### `hashUsername(username)`
Hashes a player name for use as a Firebase key.

**Parameters:**
- `username` (string): Player name

**Returns:** Promise<string> - Hexadecimal hash

#### `deriveEncryptionKey(password)`
Derives an AES-GCM key from a password.

**Parameters:**
- `password` (string): Encryption password

**Returns:** Promise<CryptoKey> - Encryption key

#### `decryptRunsData(encryptedText, password)`
Decrypts encrypted runs data.

**Parameters:**
- `encryptedText` (string): Base64-encoded encrypted data
- `password` (string): Encryption password

**Returns:** Promise<Object|null> - Decrypted runs data or null on error

#### `fetchPlayerRuns(playerName, password)`
Fetches and decrypts runs from Firebase.

**Parameters:**
- `playerName` (string): Player name
- `password` (string): Encryption password

**Returns:** Promise<Object|null> - Decrypted runs data or null on error

#### `generateReplayLink(runData)`
Generates a $replay link from run data.

**Parameters:**
- `runData` (Object): Run data object

**Returns:** string|null - $replay link string or null on error

## Getting Started

### Prerequisites
Make sure to have **Node.js** and **npm** installed on your machine before running the commands below. This is a **TypeScript** project built with **React** and **Vite**, so TypeScript compilation is handled automatically during development and build processes.

### Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Alatharee21/ask_for_fund
cd ask_for_fund
npm install
```

### Development
Start the development server:
```bash
npm start
```
The app will be available at `http://localhost:3000`.

### Production Build
To build the app for production:
```bash
npm run build
```
The optimized build will be output to the `build` directory. You can then deploy the contents of the `build` directory to your hosting provider.

### Troubleshooting
If you encounter any issues during installation or running the app, please check the error messages in the terminal for more details. You can also refer to the [official React documentation](https://reactjs.org/docs/getting-started.html) for additional troubleshooting information.

## Integration Guides

### Tatum API Integration

I used Tatum API for blockchain interactions. Here's how I integrated it:

1. **Sign up** for a Tatum account at https://tatum.io/
2. **Create an API key** in the Tatum dashboard
3. **Set up environment variables** to store your Tatum API key securely (create a `.env` file in the root):
   ```env
   VITE_TATUM_API_KEY=your_api_key_here
   ```
4. **Import the API key** in your code and use it to make API calls to Tatum for blockchain interactions (fetch account balances, send transactions, interact with smart contracts on supported blockchain networks)
5. **Configure Vite proxy** in `vite.config.ts` to avoid CORS issues during development:
   ```javascript
   export default defineConfig({
     server: {
       proxy: {
         '/api': {
           target: 'https://api.tatum.io/v3',
           changeOrigin: true,
           rewrite: (path) => path.replace(/^\/api/, ''),
         },
       },
     },
   });
   ```

### Walrus Blob Storage Integration

I used Walrus for decentralized blob storage to store grant memos on-chain. Here's how it's implemented across the project:

1. **Setup**: Installed Walrus SDK and configured publisher/aggregator services using `suiup install walrus`

2. **Request Grant Page** (`RequestPage.tsx`):
   - Users fill in grant details (title, description, requested amount, links)
   - When submitting, the grant memo is serialized and uploaded to Walrus
   - The returned `blobId` is stored on-chain in the GrantRequest smart contract
   - The blob storage ensures immutable, decentralized access to grant details

3. **Fund Vault Page** (`FundVaultPage.tsx`):
   - Displays funded grants and their associated Walrus blob storage references
   - Retrieves grant memos from Walrus using stored `blobId` values
   - Users can view complete grant information directly from decentralized storage without relying on centralized servers

4. **Helper Functions** (in SDK):
   - `uploadGrantMemo()`: Uploads grant data to Walrus and returns blob ID for on-chain storage
   - `fetchGrantMemo()`: Retrieves grant data from Walrus by blob ID
   - `blobIdToBytes()`: Converts blob ID format for Move smart contract compatibility

#### Walrus Configuration

Configure the Walrus publisher and aggregator endpoints in `vite.config.ts`:

```javascript
const WALRUS_PUBLISHER  = "/walrus-publisher";
const WALRUS_AGGREGATOR = "/walrus-aggregator";

// Storage epochs — how long the blob is retained on Walrus
// 1 epoch ≈ 1 week on testnet. Use 52 for ~1 year.
const WALRUS_EPOCHS = 52;
```

#### Walrus Helper Functions

Here are the TypeScript interfaces and functions for uploading and retrieving grant memos from Walrus:

```typescript
export interface GrantMemo {
  applicant: string;
  title: string;
  description: string;
  requestedSui: number;
  links?: string[];
  timestamp: number;
}

export interface WalrusUploadResult {
  blobId: string;           // 32-byte hex string — stored on-chain
  blobObjectId?: string;    // Sui object ID of the Walrus blob (if new)
  alreadyCertified: boolean;
}

/**
 * Upload a grant memo to Walrus.
 * Returns the blob_id to be stored on-chain in the GrantRequest.
 */
export async function uploadGrantMemo(memo: GrantMemo): Promise<WalrusUploadResult> {
  const payload = JSON.stringify(memo);

  const response = await fetch(
    `${WALRUS_PUBLISHER}/v1/store?epochs=${WALRUS_EPOCHS}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }
  );

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Walrus returns either newlyCreated or alreadyCertified
  if (result.newlyCreated) {
    return {
      blobId: result.newlyCreated.blobObject.blobId,
      blobObjectId: result.newlyCreated.blobObject.id,
      alreadyCertified: false,
    };
  } else if (result.alreadyCertified) {
    return {
      blobId: result.alreadyCertified.blobId,
      alreadyCertified: true,
    };
  }

  throw new Error("Unexpected Walrus response: " + JSON.stringify(result));
}

/**
 * Fetch and parse a grant memo from Walrus by blob_id.
 */
export async function fetchGrantMemo(blobId: string): Promise<GrantMemo> {
  const response = await fetch(`${WALRUS_AGGREGATOR}/v1/${blobId}`);

  if (!response.ok) {
    throw new Error(`Walrus fetch failed: ${response.status}`);
  }

  return response.json() as Promise<GrantMemo>;
}

/**
 * Convert a Walrus blob_id string to the 32-byte vector<u8> Move expects.
 */
export function blobIdToBytes(blobId: string): number[] {
  // Walrus blob IDs are base64url encoded 32-byte values
  const base64 = blobId.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Array.from(binary, (c) => c.charCodeAt(0));
}
```
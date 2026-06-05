import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// 2. Generate the formatted network configuration mapping
/*const { networkConfig } = createNetworkConfig({
  mainnet: { url: 'https://fullnode.mainnet.sui.io:443', network: 'mainnet' },
  testnet: { url: 'https://fullnode.testnet.sui.io:443', network: 'testnet' },
  devnet: { url: 'https://fullnode.devnet.sui.io:443', network: 'devnet' },
});*/

import { SuiJsonRpcClient, JsonRpcHTTPTransport } from "@mysten/sui/jsonRpc";

const TATUM_API_KEY = import.meta.env.VITE_TATUM_API_KEY as string;

const suiTatumClient = new SuiJsonRpcClient({
  transport: new JsonRpcHTTPTransport({
    url: TATUM_API_KEY
      ? "/sui-rpc"
      : "https://fullnode.testnet.sui.io",
    rpc: {
      headers: {
        "x-api-key": TATUM_API_KEY || "",
      },
    },
  }),
  network: "testnet",
});

const networks = {
  testnet: suiTatumClient,
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

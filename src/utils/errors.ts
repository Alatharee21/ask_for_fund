
export function parseError(message: string): string {
  if (message.includes("abort code: 1") && message.includes("submit_prediction"))
    return "You have already submitted a prediction today. Come back after UTC 00:00.";
  if (message.includes("abort code: 2"))
    return "Settlement is not available yet. The oracle has not posted today's price.";
  if (message.includes("abort code: 3"))
    return "This prediction has already been settled.";
  if (message.includes("abort code: 4"))
    return "Only the oracle can post prices.";
  if (message.includes("abort code: 5"))
    return "No pending prediction found to settle.";
  if (message.includes("abort code: 11"))
    return "Your prediction streak is too short for this vault.";
  if (message.includes("abort code: 12"))
    return "Your wallet balance is too low to apply for this vault.";
  if (message.includes("abort code: 13"))
    return "You already have a pending request for this vault.";
  if (message.includes("abort code: 14"))
    return "Grant request not found.";
  if (message.includes("abort code: 15"))
    return "Requested amount exceeds the vault maximum.";
  if (message.includes("abort code: 16"))
    return "The vault does not have enough funds for this grant.";
  if (message.includes("abort code: 17"))
    return "Your previous prediction has not been settled yet. Please settle it first.";
  if (message.includes("abort code: 18"))
    return "This vault is closed and no longer accepting requests.";
  if (message.includes("InsufficientGas") || message.includes("gas"))
    return "Not enough SUI to pay for gas. Please top up your wallet.";
  if (message.includes("No valid gas coins"))
    return "No SUI found in your wallet. Please add SUI from the faucet.";
  if (message.includes("User rejected") || message.includes("rejected"))
    return "Transaction was cancelled.";
  if (message.includes("not signed by the correct sender"))
    return "Wrong wallet connected. Please switch to the correct account.";
  return "Something went wrong. Please try again.";
}
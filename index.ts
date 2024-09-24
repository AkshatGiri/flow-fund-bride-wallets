import { ethers } from "ethers";
import usdcAbi from "./usdcAbi.json";
import "dotenv/config";
import { loadEnvVar } from "./utils";

const WS_RPC_URL = loadEnvVar("WS_RPC_URL");
const FUND_WALLET_PRIVATE_KEY = loadEnvVar("FUND_WALLET_PRIVATE_KEY");
const ADDRESS_0 = "0x0000000000000000000000000000000000000000"

const FLOW_MAINNET = 747;
const FLOW_TESTNET = 545;

const usdcContract = {
  address: "0x7f27352D5F83Db87a5A3E00f4B07Cc2138D8ee52" as `0x${string}`, // USDC.e address
  abi: usdcAbi,
  chainId: FLOW_MAINNET,
};

const FUND_AMOUNT = ethers.parseEther("0.05");

const provider = new ethers.WebSocketProvider(WS_RPC_URL);

// Setup our wallet
const fundWallet = new ethers.Wallet(FUND_WALLET_PRIVATE_KEY, provider);

// Create USDC.e contract instance
const contract = new ethers.Contract(
  usdcContract.address,
  usdcContract.abi,
  provider
);

// on transfer event handler
async function onTransfer(from: string, to: string, amount: bigint, event: any) {
  try {
    // ignore the transfer if it's not a post mint transfer.
    // i.e coming from the zero addresss
    if (from.toLowerCase() !== ADDRESS_0.toLowerCase()) {
      return;
    }

    // check user flow balance.
    const toFlowBalance = await provider.getBalance(to, "latest");

    if (toFlowBalance > ethers.parseEther("0.05")) {
      // user already has enough, no need to fund it.
      return;
    }

    // send the funding tx
    console.log("==================================");
    console.log(`Sending ${ethers.formatEther(FUND_AMOUNT)} FLOW to ${to}`);

    const tx = await fundWallet.sendTransaction({
      to,
      value: ethers.parseEther("0.05"),
    });

    console.table({
      from,
      to,
      eventTxHash: event?.log?.transactionHash,
      txHash: tx.hash,
      explorer: `https://evm.flowscan.io/tx/${tx.hash}`,
    });

    console.log("Success!");

    console.log("==================================");
  } catch (error) {
    console.error("Error processing Transfer event:", error);
  }
}

// Set up the event listener
const startListening = () => {
  console.log("Listening for Transfer events...");
  contract.on("Transfer", onTransfer);
};

// Function to stop listening
const stopListening = () => {
  console.log("Stopped listening for Transfer events.");
  contract.removeAllListeners("Transfer");
};


// // Every 60 minutes, let's make sure the connection is still active
setInterval(async () => {
  const currentBlock = await provider.getBlockNumber();
  console.log("Current block:", currentBlock);
}, 60 * 1000)

// catch all unhandled errors and log them
process.on("unhandledRejection", (error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

// Start listening
startListening();

import { ethers } from "ethers";
import usdcAbi from "./usdcAbi.json";
import usdfAbi from "./usdfAbi.json";
import trumpAbi from "./trumpAbi.json";
import erc20Abi from "./erc20Abi.json";
import "dotenv/config";
import { loadEnvVar } from "./utils/utils";
import { createResilientProviders } from "./utils/ResiliantWebsocketProvider";
import { tryAsyncWithRetries } from "./utils/trytm";
import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_BOT_TOKEN = loadEnvVar("TELEGRAM_BOT_TOKEN");
const CHAT_ID = Number(loadEnvVar("CHAT_ID"));

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

const WS_RPC_URL = loadEnvVar("WS_RPC_URL");
const RPC_URL = loadEnvVar("RPC_URL")
const FUND_WALLET_PRIVATE_KEY = loadEnvVar("FUND_WALLET_PRIVATE_KEY");
const ADDRESS_0 = "0x0000000000000000000000000000000000000000"

const FLOW_MAINNET = 747;
const FLOW_TESTNET = 545;

const usdcContractConfig = {
  address: "0x7f27352D5F83Db87a5A3E00f4B07Cc2138D8ee52" as `0x${string}`, // USDC.e address
  abi: usdcAbi,
  chainId: FLOW_MAINNET,
};

const usdfContractConfig = {
  address: "0x2aaBea2058b5aC2D339b163C6Ab6f2b6d53aabED" as `0x${string}`,
  abi: usdfAbi,
  chainId: FLOW_MAINNET
}

const trumpContractConfig = {
  address: "0xD3378b419feae4e3A4Bb4f3349DBa43a1B511760" as `0x${string}`,
  abi: trumpAbi,
  chainId: FLOW_MAINNET
}

const stargateETH = {
  address: "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B" as `0x${string}`,
  abi: erc20Abi,
  chainId: FLOW_MAINNET
}

const stargateUSDC = {
  address: "0xF1815bd50389c46847f0Bda824eC8da914045D14" as `0x${string}`,
  abi: erc20Abi,
  chainId: FLOW_MAINNET
}

const stargateUSDT = {
  address: "0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6" as `0x${string}`,
  abi: erc20Abi,
  chainId: FLOW_MAINNET
}

const weth = {
  address: "0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590" as `0x${string}`,
  abi: erc20Abi,
  chainId: FLOW_MAINNET
}



const FUND_AMOUNT = ethers.parseEther("0.05");

// websocket providers
const providers = await createResilientProviders([WS_RPC_URL], usdcContractConfig.chainId)

// http providers ( mainly for sending transaction )
const httpProvider = new ethers.JsonRpcProvider(RPC_URL, {
  chainId: usdcContractConfig.chainId,
  name: "flow",
});

if (providers.length === 0) {
  throw new Error("Could not establish a resilient websocket provider connection.")
}

const provider = providers[0];

// Setup our wallet
const fundWallet = new ethers.Wallet(FUND_WALLET_PRIVATE_KEY, httpProvider);

// Create USDC.e contract instance
const usdcContract = new ethers.Contract(
  usdcContractConfig.address,
  usdcContractConfig.abi,
  provider
);

const usdfContract = new ethers.Contract(
  usdfContractConfig.address,
  usdfContractConfig.abi,
  provider
)

const trumpContract = new ethers.Contract(
  trumpContractConfig.address,
  trumpContractConfig.abi,
  provider
)

const stargateETHContract = new ethers.Contract(
  stargateETH.address,
  stargateETH.abi,
  provider
)

const stargateUSDCContract = new ethers.Contract(
  stargateUSDC.address,
  stargateUSDC.abi,
  provider
)

const stargateUSDTContract = new ethers.Contract(
  stargateUSDT.address,
  stargateUSDT.abi,
  provider
)

const wethContract = new ethers.Contract(
  weth.address,
  weth.abi,
  provider
)

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

    await bot.sendMessage(CHAT_ID, `Transaction Caught: https://evm.flowscan.io/tx/${event?.log?.transactionHash} \n Sending funds...`)

    const [tx, err] = await tryAsyncWithRetries(() => fundWallet.sendTransaction({
      to,
      value: ethers.parseEther("0.05"),
    }), 3, 1000, true);

    if (err) {
      console.error("Error funding user:", err);
      await bot.sendMessage(CHAT_ID, `Failed to send funds after 3 tries.`);
      return;
    }

    console.table({
      from,
      to,
      eventTxHash: event?.log?.transactionHash,
      txHash: tx.hash,
      explorer: `https://evm.flowscan.io/tx/${tx.hash}`,
    });

    await bot.sendMessage(CHAT_ID, `Funds sent: https://evm.flowscan.io/tx/${tx.hash}`)

    console.log("Success!");

    console.log("==================================");
  } catch (error) {
    console.error("Error processing Transfer event:", error);
    await bot.sendMessage(CHAT_ID, `Failed to send funds. Please look at logs for error details.`)
  }
}

// Set up the event listener
const startListening = () => {
  console.log("Listening for Transfer events...");
  usdcContract.on("Transfer", onTransfer);
  usdfContract.on("Transfer", onTransfer);
  trumpContract.on("Transfer", onTransfer);
  stargateETHContract.on("Transfer", onTransfer);
  stargateUSDCContract.on("Transfer", onTransfer);
  stargateUSDTContract.on("Transfer", onTransfer);
  wethContract.on("Transfer", onTransfer)

};

// Function to stop listening
const stopListening = () => {
  console.log("Stopped listening for Transfer events.");
  usdcContract.removeAllListeners("Transfer");
  usdfContract.removeAllListeners("Transfer");
  trumpContract.removeAllListeners("Transfer");
  stargateETHContract.removeAllListeners("Transfer");
  stargateUSDCContract.removeAllListeners("Transfer");
  stargateUSDTContract.removeAllListeners("Transfer");
  wethContract.removeAllListeners("Transfer")
};

// catch all unhandled errors and log them
process.on("unhandledRejection", (error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

// kill the script every 20 mins because now we're using quicknode rpc again
// it will get restarted by coolify or pm2.
setTimeout(() => {
  console.log("Killing script after 20 minutes");
  process.exit(0);
}, 20 * 60 * 1000);

// Start listening
startListening();

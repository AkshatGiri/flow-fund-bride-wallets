import { ethers } from 'ethers';
import { writeFile } from 'fs/promises';

// ERC20 ABI - Only including relevant events and functions
const erc20Abi = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Mint(address indexed to, uint256 value)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

// Configuration
const config = {
  chainId: 747,
  contractAddress: '0xD3378b419feae4e3A4Bb4f3349DBa43a1B511760',
  rpcUrl: 'RPC_URL' // Replace with actual RPC URL for chain 747
};

const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);

async function getMintTransactions(startBlock: number, endBlock: number) {
  try {
    // Initialize provider

    // Initialize contract
    const contract = new ethers.Contract(
      config.contractAddress,
      erc20Abi,
      provider
    );

    // Get contract metadata
    const [name, symbol] = await Promise.all([
      contract.name(),
      contract.symbol()
    ]);

    console.log(`Querying mint transactions for ${name} (${symbol})`);

    // Query for Transfer events from zero address (indicating mints)
    const mintFilter = contract.filters.Transfer(
      ethers.ZeroAddress // from the zero address
    );

    const events = await contract.queryFilter(mintFilter, startBlock, endBlock);

    // Process and format the events
    const mintTransactions = await Promise.all(
      events.map(async (event) => {
        const block = await event.getBlock();
        const timestamp = block.timestamp;
        const date = new Date(timestamp * 1000);

        return {
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp,
          date: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
          to: event.args![1], // recipient address
          amount: ethers.formatEther(event.args![2]) // assuming 18 decimals
        };
      })
    );

    return mintTransactions;

  } catch (error) {
    console.error('Error fetching mint transactions:', error);
    throw error;
  }
}

// Example usage
async function main() {
  const currentBlock = await provider.getBlockNumber();
  console.log("Current Block: ", currentBlock)
  const maxBatchSize = 70_000; // Maximum number of blocks to query in a single batch
  const startBlock = currentBlock - (60 * 60 * 24 * 2 * 2) // flow produces 2 blocks every second, so this should give us past 2 days.
  const endBlock = currentBlock;   // Replace with desired end block or 'latest'

  const mintTxs: any = [];

  for (let i = startBlock; i < endBlock; i += maxBatchSize) {
    const batchStart = i;
    const batchEnd = Math.min(i + maxBatchSize, endBlock);
    console.log(`Fetching mint transactions for blocks ${batchStart} to ${batchEnd}...`);
    const batchMintTxs = await getMintTransactions(batchStart, batchEnd);
    mintTxs.push(...batchMintTxs);
  }
  mintTxs.forEach((tx, index) => {
    console.log(`\nTransaction ${index + 1}:`);
    console.log(`Hash: ${tx.transactionHash}`);
    console.log(`Block: ${tx.blockNumber}`);
    console.log(`Date: ${tx.date}`);
    console.log(`To: ${tx.to}`);
    console.log(`Amount: ${tx.amount}`);
  });

  // Let's save to a csv file

  const csvData = mintTxs.map((tx: any) => {
    return `${tx.transactionHash},${tx.blockNumber},${tx.date},${tx.to},${tx.amount}`;
  });

  csvData.unshift('Transaction Hash,Block Number,Date,To,Amount');

  await writeFile('mintTransactions.csv', csvData.join('\n'));
  console.log('Mint transactions saved to mintTransactions.csv');
}

main();
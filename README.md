# Fund Flow Wallets

Watch the celer bridge contract and fund new wallets that bridge over usdc over to flow. Allowing them to make transactions on flow evm.

## How to run

Clone the repo

```bash
git clone https://github.com/AkshatGiri/flow-fund-bride-wallets.git
```

Create a `.env` file in the root directory of the project.

Add the variables from `.env.example` file

Install dependencies

```bash
npm install
```

Run the project

```bash
npm start
```

To run in production it's a good idea to use a process manager like pm2 and also to save the logs to a file.

A solid rpc is also recommended, for development I've used quicknode which is most likely sufficient.

## Caveats

- Lost websocket connect with the rpc. If the rpc connection has been sitting dormant for a while it's possible that the provider will kill the connection. Not sure if etheres has a keep alive feature.

- If the script goes down for a bit for any reason, that can cause us to miss some bridge events. And the script doesn't currently have a way to catch up on missed events. Although it's possible for us to fetch historical events, that will increase the complexity of the script. It can be added if we need it tho.

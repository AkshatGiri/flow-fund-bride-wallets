// @ts-nocheck 
// this code was taken from an ethers feature request here - https://github.com/ethers-io/ethers.js/issues/1053#issuecomment-2293492089 

import { WebSocketProvider } from "ethers"
import WebSocket from "ws"

const EXPECTED_PONG_BACK = 15000;
const KEEP_ALIVE_CHECK_INTERVAL = 60 * 1000;
const MAX_RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 5000; // 5 seconds

const debug = (message) => {
  // console.debug(new Date().toISOString(), message);
};

export class ResilientWebsocketProvider {
  constructor(url, network) {
    this.url = url;
    this.network = network;
    this.terminate = false;
    this.pingTimeout = null;
    this.keepAliveInterval = null;
    this.ws = null;
    this.provider = null;
    this.subscriptions = new Set();
    this.reconnectionAttempts = 0;
    this.isConnected = false;
  }

  async connect() {
    return new Promise((resolve) => {
      const startConnection = () => {
        if (this.reconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
          console.error(`Max reconnection attempts (${MAX_RECONNECTION_ATTEMPTS}) reached for ${this.url}. Stopping reconnection.`);
          this.terminate = true;
          resolve(null);
          return;
        }

        this.ws = new WebSocket(this.url);

        this.ws.on("open", async () => {
          this.reconnectionAttempts = 0;
          this.isConnected = true;
          this.setupKeepAlive();

          try {
            const wsp = new WebSocketProvider(() => this.ws, this.network);

            while (this.ws?.readyState !== WebSocket.OPEN) {
              console.log("Waiting for websocket to be open");
              await this.sleep(1000);
            }

            wsp._start();

            while (!wsp.ready) {
              console.log("Waiting for websocket provider to be ready");
              await this.sleep(1000);
            }

            this.provider = wsp;
            await this.resubscribe();
            resolve(this.provider);
          } catch (error) {
            console.error(`Error initializing WebSocketProvider for ${this.url}:`, error);
            this.cleanupConnection();
            this.reconnectionAttempts++;
            setTimeout(startConnection, RECONNECTION_DELAY);
          }
        });

        this.ws.on("close", () => {
          console.error(`The websocket connection was closed for ${this.url}`);
          this.isConnected = false;
          this.cleanupConnection();
          if (!this.terminate) {
            this.reconnectionAttempts++;
            console.log(`Attempting to reconnect... (Attempt ${this.reconnectionAttempts})`);
            setTimeout(startConnection, RECONNECTION_DELAY);
          }
        });

        this.ws.on("error", (error) => {
          console.error(`WebSocket error for ${this.url}:`, error);
        });

        this.ws.on("pong", () => {
          debug("Received pong, so connection is alive, clearing the timeout");
          if (this.pingTimeout) clearTimeout(this.pingTimeout);
        });
      };

      startConnection();
    });
  }

  setupKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      if (!this.ws) {
        debug("No websocket, exiting keep alive interval");
        return;
      }
      debug("Checking if the connection is alive, sending a ping");

      this.ws.ping();

      this.pingTimeout = setTimeout(() => {
        if (this.ws) this.ws.terminate();
      }, EXPECTED_PONG_BACK);
    }, KEEP_ALIVE_CHECK_INTERVAL);
  }

  cleanupConnection() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.pingTimeout) clearTimeout(this.pingTimeout);
  }

  async resubscribe() {
    console.warn("Shutting down and restarting script to reconnect and resubscribe to topics...")
    process.exit(1)
    console.log("Resubscribing to topics...");
    for (const subscription of this.subscriptions) {
      try {
        // NOTE: the subscribe function on the websocketprovides doesn't seem to exist. 
        // We need to find a new way to make that happen. 
        // I think this entire solution is a bit weird 
        // and that we can write a much better solution. 
        // TODO: Fix resubscribing to topics. 
        await this.provider._subscribe(subscription.type, subscription.filter, subscription.listener);
        console.log(`Resubscribed to ${subscription.type}`);
      } catch (error) {
        console.error(`Failed to resubscribe to ${subscription.type}:`, error);
      }
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export async function createResilientProviders(urls, network): Promise<WebSocketProvider[]> {
  const providers = await Promise.all(
    urls.map(async (url) => {
      try {
        const resilientProvider = new ResilientWebsocketProvider(url, network);
        const provider = await resilientProvider.connect();

        if (provider) {
          // Wrap the provider's 'on' method to track subscriptions
          const originalOn = provider.on.bind(provider);
          provider.on = (eventName, listener) => {
            resilientProvider.subscriptions.add({ type: eventName, listener });
            return originalOn(eventName, listener);
          };
        }
        return provider;
      } catch (error) {
        console.error(`Failed to create ResilientWebsocketProvider for ${url}:`, error);
        return null;
      }
    })
  );

  // Filter out any null providers (failed connections)
  return providers.filter(provider => provider !== null);
}
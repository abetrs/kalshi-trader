require("dotenv").config({ path: "../../.env" });
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class KalshiAPI {
  constructor() {
    this.baseURL = "https://api.elections.kalshi.com";
    this.basePath = "/trade-api/v2";
    this.apiKeyId = process.env.KALSHI_API_KEY_ID;

    // Read private key from itsmine12.txt file for proper formatting
    const keyPath = path.join(__dirname, "../../itsmine12.txt");

    if (!this.apiKeyId) {
      throw new Error("KALSHI_API_KEY_ID must be set in .env file");
    }

    try {
      this.privateKey = fs.readFileSync(keyPath, "utf8").trim();
      console.log("✅ Private key loaded from itsmine12.txt");
    } catch (error) {
      throw new Error(
        `Failed to load private key from ${keyPath}: ${error.message}`
      );
    }

    console.log("✅ Kalshi API initialized with API Key ID:", this.apiKeyId);
  } // Create authentication headers for requests
  createAuthHeaders(method, path) {
    const timestamp = Date.now().toString();
    const message = timestamp + method + path;

    try {
      // Create signature using RSA-PSS with SHA-256
      const signature = crypto.sign("RSA-SHA256", Buffer.from(message), {
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      });

      const base64Signature = signature.toString("base64");

      return {
        "KALSHI-ACCESS-KEY": this.apiKeyId,
        "KALSHI-ACCESS-SIGNATURE": base64Signature,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "Content-Type": "application/json",
      };
    } catch (error) {
      console.error("❌ Failed to create signature:", error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Make authenticated GET request
  async authenticatedGet(endpoint, params = {}) {
    const path = this.basePath + endpoint;
    const url = this.baseURL + path;

    const headers = this.createAuthHeaders("GET", path);

    try {
      const response = await axios.get(url, { headers, params });
      return response.data;
    } catch (error) {
      console.error(
        "❌ GET request failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Make authenticated POST request
  async authenticatedPost(endpoint, data = {}) {
    const path = this.basePath + endpoint;
    const url = this.baseURL + path;

    const headers = this.createAuthHeaders("POST", path);

    try {
      const response = await axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      console.error(
        "❌ POST request failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Make authenticated DELETE request
  async authenticatedDelete(endpoint, data = {}) {
    const path = this.basePath + endpoint;
    const url = this.baseURL + path;

    const headers = this.createAuthHeaders("DELETE", path);

    try {
      const response = await axios.delete(url, { headers, data });
      return response.data;
    } catch (error) {
      console.error(
        "❌ DELETE request failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Test API connection
  async testConnection() {
    try {
      console.log("🔄 Testing Kalshi API connection...");
      const balance = await this.getBalance();
      console.log("✅ API connection successful!");
      console.log("💰 Account balance:", balance);
      return true;
    } catch (error) {
      console.error("❌ API connection failed:", error.message);
      return false;
    }
  }

  // Get account balance
  async getBalance() {
    return await this.authenticatedGet("/portfolio/balance");
  }

  // Get all available markets
  async getMarkets(limit = 1000, status = "open") {
    const params = { limit, status };
    return await this.authenticatedGet("/markets", params);
  }

  // Get market details
  async getMarket(ticker) {
    return await this.authenticatedGet(`/markets/${ticker}`);
  }

  // Get market orderbook
  async getOrderbook(ticker, depth = 5) {
    return await this.authenticatedGet(`/markets/${ticker}/orderbook`, {
      depth,
    });
  }

  // Create an order
  async createOrder(orderData) {
    return await this.authenticatedPost("/portfolio/orders", orderData);
  }

  // Get orders
  async getOrders(params = {}) {
    return await this.authenticatedGet("/portfolio/orders", params);
  }

  // Cancel order
  async cancelOrder(orderId) {
    return await this.authenticatedDelete(`/portfolio/orders/${orderId}`);
  }

  // Get positions
  async getPositions(params = {}) {
    return await this.authenticatedGet("/portfolio/positions", params);
  }

  // Buy a position (simplified helper)
  async buyPosition(ticker, count, price, side = "yes") {
    const orderData = {
      action: "buy",
      client_order_id: `buy_${Date.now()}`,
      count: count,
      side: side,
      ticker: ticker,
      type: "limit",
      yes_price: side === "yes" ? price : undefined,
      no_price: side === "no" ? price : undefined,
    };

    console.log(
      `📈 Creating BUY order for ${count} shares of ${ticker} (${side}) at ${price} cents`
    );
    return await this.createOrder(orderData);
  }

  // Sell a position (simplified helper)
  async sellPosition(ticker, count, price, side = "yes") {
    const orderData = {
      action: "sell",
      client_order_id: `sell_${Date.now()}`,
      count: count,
      side: side,
      ticker: ticker,
      type: "limit",
      yes_price: side === "yes" ? price : undefined,
      no_price: side === "no" ? price : undefined,
    };

    console.log(
      `📉 Creating SELL order for ${count} shares of ${ticker} (${side}) at ${price} cents`
    );
    return await this.createOrder(orderData);
  }

  // Test trading function - buy 10 cents worth of a random market then immediately sell
  async testTrading() {
    try {
      console.log("🎯 Starting test trading sequence...");

      // Get available markets
      const marketsResponse = await this.getMarkets(50, "open");
      const markets = marketsResponse.markets || [];

      if (markets.length === 0) {
        console.log("❌ No open markets found for testing");
        return;
      }

      // Find a market with reasonable pricing
      let selectedMarket = null;
      for (const market of markets) {
        try {
          const orderbook = await this.getOrderbook(market.ticker);
          if (orderbook.yes && orderbook.yes.length > 0) {
            const yesAsk = orderbook.yes[0][1]; // Best ask price
            if (yesAsk >= 5 && yesAsk <= 95) {
              // Reasonable price range
              selectedMarket = { ...market, yesAsk };
              break;
            }
          }
        } catch (error) {
          console.log(`⚠️ Skipping market ${market.ticker}: ${error.message}`);
          continue;
        }
      }

      if (!selectedMarket) {
        console.log("❌ No suitable market found for testing");
        return;
      }

      console.log(`🎲 Selected market: ${selectedMarket.ticker}`);
      console.log(`💲 Yes Ask Price: ${selectedMarket.yesAsk} cents`);

      // Calculate shares to buy for ~10 cents total
      const targetAmount = 10; // 10 cents
      const shareCount = Math.max(
        1,
        Math.floor(targetAmount / selectedMarket.yesAsk)
      );
      const actualCost = shareCount * selectedMarket.yesAsk;

      console.log(
        `🛒 Buying ${shareCount} shares for ~${actualCost} cents total`
      );

      // Buy position
      const buyOrder = await this.buyPosition(
        selectedMarket.ticker,
        shareCount,
        selectedMarket.yesAsk,
        "yes"
      );

      console.log("✅ Buy order created:", buyOrder.order_id);

      // Wait a moment then sell
      console.log("⏳ Waiting 2 seconds before selling...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get current orderbook to determine sell price
      const currentOrderbook = await this.getOrderbook(selectedMarket.ticker);
      const yesBid =
        currentOrderbook.yes && currentOrderbook.yes.length > 0
          ? currentOrderbook.yes[0][0]
          : selectedMarket.yesAsk - 1;

      // Sell position
      const sellOrder = await this.sellPosition(
        selectedMarket.ticker,
        shareCount,
        yesBid,
        "yes"
      );

      console.log("✅ Sell order created:", sellOrder.order_id);
      console.log("🎉 Test trading sequence completed successfully!");

      return {
        market: selectedMarket.ticker,
        buyOrder: buyOrder.order_id,
        sellOrder: sellOrder.order_id,
        shareCount,
        buyPrice: selectedMarket.yesAsk,
        sellPrice: yesBid,
      };
    } catch (error) {
      console.error("❌ Test trading failed:", error.message);
      throw error;
    }
  }
}

module.exports = KalshiAPI;

// Main execution function for testing
async function main() {
  try {
    console.log("🚀 Starting Kalshi API Test Suite");
    console.log("==================================\n");

    // Initialize API
    const kalshi = new KalshiAPI();

    // Test 1: API Connection
    console.log("TEST 1: API Connection");
    const connectionTest = await kalshi.testConnection();
    if (!connectionTest) {
      console.log("❌ API connection failed, stopping tests");
      return;
    }
    console.log("✅ API connection successful\n");

    // Test 2: Market Data Retrieval
    console.log("TEST 2: Market Data Retrieval");
    const MarketDataManager = require("./get_markets");
    const marketManager = new MarketDataManager();

    console.log("Fetching market data (this may take a few minutes)...");
    await marketManager.getAllMarkets();

    marketManager.printSummary();

    // Test 3: Test Trading
    console.log("TEST 3: Test Trading (Buy/Sell 10 cents)");
    console.log("⚠️  This will place real orders with real money!");
    console.log("Proceeding in 5 seconds...");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const tradingResult = await kalshi.testTrading();
    console.log("🎯 Trading test completed:", tradingResult);

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test suite failed:", error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

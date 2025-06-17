const KalshiAPI = require("./kalshi_api");
const _ = require("lodash");

class MarketDataManager {
  constructor() {
    // Load environment variables from root directory
    require("dotenv").config({ path: "../../.env" });
    this.kalshi = new KalshiAPI();
    this.marketsDataFrame = [];
    this.lastUpdated = null;
  }

  // Fetch all available markets and structure as a dataframe
  async getAllMarkets() {
    try {
      console.log("📊 Fetching all available markets from Kalshi...");

      let allMarkets = [];
      let cursor = null;
      let pageCount = 0;

      do {
        const params = {
          limit: 1000,
          status: "open",
        };

        if (cursor) {
          params.cursor = cursor;
        }

        console.log(`📄 Fetching page ${++pageCount}...`);
        const response = await this.kalshi.getMarkets(params.limit);

        if (response.markets) {
          allMarkets.push(...response.markets);
          cursor = response.cursor || null;
        } else {
          break;
        }

        // Add a small delay to be respectful to the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (cursor);

      console.log(`✅ Fetched ${allMarkets.length} markets total`);

      // Transform markets into a more structured dataframe format
      this.marketsDataFrame = await this.transformToDataFrame(allMarkets);
      this.lastUpdated = new Date();

      console.log(
        `📋 Markets dataframe created with ${this.marketsDataFrame.length} records`
      );

      return this.marketsDataFrame;
    } catch (error) {
      console.error("❌ Failed to fetch markets:", error.message);
      throw error;
    }
  }

  // Transform raw market data into a structured dataframe format
  async transformToDataFrame(markets) {
    console.log("🔄 Transforming market data into dataframe format...");

    const dataFrame = [];

    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];

      try {
        // Get orderbook data for each market
        const orderbook = await this.kalshi.getOrderbook(market.ticker, 1);

        const record = {
          // Basic market info
          ticker: market.ticker,
          title: market.subtitle || market.title || "",
          category: market.category || "",
          status: market.status || "",

          // Timing info
          open_time: market.open_time ? new Date(market.open_time) : null,
          close_time: market.close_time ? new Date(market.close_time) : null,
          expiration_time: market.expiration_time
            ? new Date(market.expiration_time)
            : null,

          // Price data from orderbook
          yes_bid:
            orderbook.yes && orderbook.yes.length > 0
              ? orderbook.yes[0][0]
              : null,
          yes_ask:
            orderbook.yes && orderbook.yes.length > 0
              ? orderbook.yes[0][1]
              : null,
          yes_bid_size:
            orderbook.yes && orderbook.yes.length > 0
              ? orderbook.yes[0][2]
              : null,
          yes_ask_size:
            orderbook.yes && orderbook.yes.length > 0
              ? orderbook.yes[0][3]
              : null,

          no_bid:
            orderbook.no && orderbook.no.length > 0 ? orderbook.no[0][0] : null,
          no_ask:
            orderbook.no && orderbook.no.length > 0 ? orderbook.no[0][1] : null,
          no_bid_size:
            orderbook.no && orderbook.no.length > 0 ? orderbook.no[0][2] : null,
          no_ask_size:
            orderbook.no && orderbook.no.length > 0 ? orderbook.no[0][3] : null,

          // Calculated metrics
          spread_yes: this.calculateSpread(
            orderbook.yes && orderbook.yes.length > 0
              ? orderbook.yes[0][0]
              : null,
            orderbook.yes && orderbook.yes.length > 0
              ? orderbook.yes[0][1]
              : null
          ),
          spread_no: this.calculateSpread(
            orderbook.no && orderbook.no.length > 0 ? orderbook.no[0][0] : null,
            orderbook.no && orderbook.no.length > 0 ? orderbook.no[0][1] : null
          ),

          // Market metadata
          volume: market.volume || 0,
          open_interest: market.open_interest || 0,
          last_price: market.last_price || null,

          // Raw market object for reference
          raw_market: market,
          raw_orderbook: orderbook,

          // Timestamp
          fetched_at: new Date(),
        };

        dataFrame.push(record);

        // Progress logging every 50 markets
        if ((i + 1) % 50 === 0) {
          console.log(`📊 Processed ${i + 1}/${markets.length} markets...`);
        }

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.warn(
          `⚠️ Failed to get orderbook for ${market.ticker}: ${error.message}`
        );

        // Add record without orderbook data
        dataFrame.push({
          ticker: market.ticker,
          title: market.subtitle || market.title || "",
          category: market.category || "",
          status: market.status || "",
          open_time: market.open_time ? new Date(market.open_time) : null,
          close_time: market.close_time ? new Date(market.close_time) : null,
          expiration_time: market.expiration_time
            ? new Date(market.expiration_time)
            : null,
          volume: market.volume || 0,
          open_interest: market.open_interest || 0,
          last_price: market.last_price || null,
          raw_market: market,
          fetched_at: new Date(),
          // Null values for orderbook data
          yes_bid: null,
          yes_ask: null,
          yes_bid_size: null,
          yes_ask_size: null,
          no_bid: null,
          no_ask: null,
          no_bid_size: null,
          no_ask_size: null,
          spread_yes: null,
          spread_no: null,
          raw_orderbook: null,
        });
      }
    }

    return dataFrame;
  }

  // Calculate bid-ask spread
  calculateSpread(bid, ask) {
    if (bid === null || ask === null) return null;
    return ask - bid;
  }

  // Filter dataframe by various criteria
  filterMarkets(criteria = {}) {
    let filtered = [...this.marketsDataFrame];

    if (criteria.category) {
      filtered = filtered.filter((m) => m.category === criteria.category);
    }

    if (criteria.min_volume) {
      filtered = filtered.filter((m) => m.volume >= criteria.min_volume);
    }

    if (criteria.max_spread_yes) {
      filtered = filtered.filter(
        (m) => m.spread_yes !== null && m.spread_yes <= criteria.max_spread_yes
      );
    }

    if (criteria.has_liquidity) {
      filtered = filtered.filter(
        (m) =>
          m.yes_bid !== null &&
          m.yes_ask !== null &&
          m.no_bid !== null &&
          m.no_ask !== null
      );
    }

    return filtered;
  }

  // Get market statistics
  getMarketStats() {
    if (this.marketsDataFrame.length === 0) {
      return { error: "No market data available" };
    }

    const categories = _.groupBy(this.marketsDataFrame, "category");
    const totalVolume = _.sumBy(this.marketsDataFrame, "volume");
    const marketsWithLiquidity = this.marketsDataFrame.filter(
      (m) => m.yes_bid !== null && m.yes_ask !== null
    ).length;

    return {
      total_markets: this.marketsDataFrame.length,
      categories: Object.keys(categories).map((cat) => ({
        category: cat,
        count: categories[cat].length,
      })),
      total_volume: totalVolume,
      markets_with_liquidity: marketsWithLiquidity,
      liquidity_percentage: (
        (marketsWithLiquidity / this.marketsDataFrame.length) *
        100
      ).toFixed(2),
      last_updated: this.lastUpdated,
    };
  }

  // Export dataframe to JSON for analysis
  exportToJSON() {
    return {
      data: this.marketsDataFrame,
      metadata: this.getMarketStats(),
      exported_at: new Date(),
    };
  }

  // Get random tradeable market
  getRandomTradeableMarket() {
    const tradeable = this.filterMarkets({ has_liquidity: true });
    if (tradeable.length === 0) return null;

    return tradeable[Math.floor(Math.random() * tradeable.length)];
  }

  // Print summary table
  printSummary() {
    const stats = this.getMarketStats();
    console.log("\n📊 KALSHI MARKETS SUMMARY");
    console.log("========================");
    console.log(`Total Markets: ${stats.total_markets}`);
    console.log(
      `Markets with Liquidity: ${stats.markets_with_liquidity} (${stats.liquidity_percentage}%)`
    );
    console.log(`Total Volume: ${stats.total_volume}`);
    console.log(`Last Updated: ${stats.last_updated}`);
    console.log("\nCategories:");
    stats.categories.forEach((cat) => {
      console.log(`  ${cat.category}: ${cat.count} markets`);
    });
    console.log("\n");
  }
}

module.exports = MarketDataManager;

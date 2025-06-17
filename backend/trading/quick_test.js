const KalshiAPI = require("./kalshi_api");

async function quickTest() {
  try {
    console.log("🚀 Kalshi API Quick Test");
    console.log("========================\n");

    const kalshi = new KalshiAPI();

    // Test 1: Connection
    console.log("1️⃣ Testing API Connection...");
    const balance = await kalshi.getBalance();
    console.log("✅ Connected! Balance:", balance);

    // Test 2: Get a few markets
    console.log("\n2️⃣ Getting sample markets...");
    const markets = await kalshi.getMarkets(10, "open");
    console.log(`✅ Found ${markets.markets.length} sample markets`);

    if (markets.markets.length > 0) {
      const sampleMarket = markets.markets[0];
      console.log(
        `📊 Sample market: ${sampleMarket.ticker} - ${sampleMarket.subtitle}`
      );

      // Test 3: Get orderbook
      console.log("\n3️⃣ Getting orderbook for sample market...");
      const orderbook = await kalshi.getOrderbook(sampleMarket.ticker);
      console.log("✅ Orderbook retrieved:", {
        yes_bid: orderbook.yes?.[0]?.[0],
        yes_ask: orderbook.yes?.[0]?.[1],
        no_bid: orderbook.no?.[0]?.[0],
        no_ask: orderbook.no?.[0]?.[1],
      });
    }

    // Test 4: Test Trading (minimal version)
    console.log("\n4️⃣ Testing minimal trading functionality...");
    console.log("⚠️  This will place small real orders!");
    console.log("Proceeding in 3 seconds...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const tradingResult = await kalshi.testTrading();
    if (tradingResult) {
      console.log("✅ Trading test completed:", tradingResult);
    }

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

quickTest();

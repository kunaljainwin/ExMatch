#include "core/matching_engine.h"
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <thread>
#include <vector>

using namespace core;
using namespace common;

#define ASSERT_TRUE(condition, message) \
    do { \
        if (!(condition)) { \
            std::cerr << "FAILED: " << (message) << " (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            std::exit(1); \
        } \
    } while (0)

#define ASSERT_EQ(actual, expected, message) \
    do { \
        if ((actual) != (expected)) { \
            std::cerr << "FAILED: " << (message) << " [Expected: " << (expected) \
                      << ", Actual: " << (actual) << "] (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            std::exit(1); \
        } \
    } while (0)

namespace {

constexpr int kDefaultTimeoutMs = 2000;

bool waitForReport(MatchingEngine& engine, ExecutionReport& report, int timeoutMs = kDefaultTimeoutMs) {
    const auto start = std::chrono::steady_clock::now();
    while (std::chrono::duration_cast<std::chrono::milliseconds>(
               std::chrono::steady_clock::now() - start).count() < timeoutMs) {
        if (engine.dequeueExecution(report)) {
            return true;
        }
        std::this_thread::yield();
    }
    return false;
}

} // namespace

void testEngineLifecycle() {
    MatchingEngine engine(64, 64);
    ASSERT_TRUE(!engine.isRunning(), "Engine should not be running initially");

    engine.start();
    ASSERT_TRUE(engine.isRunning(), "Engine should be running after start()");

    // Idempotent start
    engine.start();
    ASSERT_TRUE(engine.isRunning(), "Engine should still be running");

    engine.stop();
    ASSERT_TRUE(!engine.isRunning(), "Engine should stop cleanly");

    // Idempotent stop
    engine.stop();
    ASSERT_TRUE(!engine.isRunning(), "Engine should remain stopped");

    std::cout << "[PASS] testEngineLifecycle\n";
}

void testOrderIngressAndResting() {
    MatchingEngine engine(64, 64);
    engine.start();

    OrderRequest req{};
    req.type = RequestType::NEW_ORDER;
    req.orderId = 101;
    req.clientId = 1;
    req.side = Side::BUY;
    req.orderType = OrderType::LIMIT;
    req.price = 50000;
    req.quantity = 25;
    req.timestamp = 1000;

    ASSERT_TRUE(engine.enqueueOrder(req), "Enqueue new order must succeed");

    ExecutionReport report{};
    ASSERT_TRUE(waitForReport(engine, report), "Must receive execution report");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::ORDER_ACCEPTED), "Report should be ORDER_ACCEPTED");
    ASSERT_EQ(report.orderId, 101, "Order ID mismatch");
    ASSERT_EQ(static_cast<uint8_t>(report.status), static_cast<uint8_t>(OrderStatus::NEW), "Status should be NEW");

    // Cancel order
    ASSERT_TRUE(engine.enqueueCancel(101, 1, 2000), "Enqueue cancel must succeed");
    ASSERT_TRUE(waitForReport(engine, report), "Must receive cancel report");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::ORDER_CANCELLED), "Report should be ORDER_CANCELLED");
    ASSERT_EQ(report.orderId, 101, "Order ID mismatch on cancel");
    ASSERT_EQ(static_cast<uint8_t>(report.status), static_cast<uint8_t>(OrderStatus::CANCELLED), "Status should be CANCELLED");

    engine.stop();
    std::cout << "[PASS] testOrderIngressAndResting\n";
}

void testImmediateTradeExecution() {
    MatchingEngine engine(64, 64);
    engine.start();

    // Resting SELL order
    OrderRequest sellReq{};
    sellReq.type = RequestType::NEW_ORDER;
    sellReq.orderId = 201;
    sellReq.clientId = 10;
    sellReq.side = Side::SELL;
    sellReq.orderType = OrderType::LIMIT;
    sellReq.price = 15000;
    sellReq.quantity = 100;
    sellReq.timestamp = 1000;
    ASSERT_TRUE(engine.enqueueOrder(sellReq), "Enqueue sell order must succeed");

    ExecutionReport report{};
    ASSERT_TRUE(waitForReport(engine, report), "Must receive sell order accept");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::ORDER_ACCEPTED), "Sell order must be accepted");

    // Incoming BUY order matches SELL
    OrderRequest buyReq{};
    buyReq.type = RequestType::NEW_ORDER;
    buyReq.orderId = 202;
    buyReq.clientId = 20;
    buyReq.side = Side::BUY;
    buyReq.orderType = OrderType::LIMIT;
    buyReq.price = 15000;
    buyReq.quantity = 100;
    buyReq.timestamp = 2000;
    ASSERT_TRUE(engine.enqueueOrder(buyReq), "Enqueue buy order must succeed");

    // 1st report for buy: TRADE execution
    ASSERT_TRUE(waitForReport(engine, report), "Must receive trade report");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::TRADE), "Expected TRADE execution report");
    ASSERT_EQ(report.trade.makerOrderId, 201, "Maker order ID mismatch");
    ASSERT_EQ(report.trade.takerOrderId, 202, "Taker order ID mismatch");
    ASSERT_EQ(report.trade.price, 15000, "Trade price mismatch");
    ASSERT_EQ(report.trade.quantity, 100, "Trade quantity mismatch");

    // 2nd report for buy: ORDER_ACCEPTED with FILLED status
    ASSERT_TRUE(waitForReport(engine, report), "Must receive taker order status");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::ORDER_ACCEPTED), "Expected order status");
    ASSERT_EQ(report.orderId, 202, "Taker order ID mismatch");
    ASSERT_EQ(static_cast<uint8_t>(report.status), static_cast<uint8_t>(OrderStatus::FILLED), "Taker status should be FILLED");

    engine.stop();
    ASSERT_EQ(engine.getActiveOrderCount(), 0, "No orders should remain active after complete fill");

    std::cout << "[PASS] testImmediateTradeExecution\n";
}

void testPartialFillMatching() {
    MatchingEngine engine(64, 64);
    engine.start();

    // Resting SELL: 40 shares @ 20000
    OrderRequest sellReq{};
    sellReq.type = RequestType::NEW_ORDER;
    sellReq.orderId = 301;
    sellReq.clientId = 10;
    sellReq.side = Side::SELL;
    sellReq.orderType = OrderType::LIMIT;
    sellReq.price = 20000;
    sellReq.quantity = 40;
    sellReq.timestamp = 1000;
    ASSERT_TRUE(engine.enqueueOrder(sellReq), "Enqueue sell order must succeed");

    ExecutionReport report{};
    ASSERT_TRUE(waitForReport(engine, report), "Must receive sell accept");

    // Incoming BUY: 100 shares @ 20000
    OrderRequest buyReq{};
    buyReq.type = RequestType::NEW_ORDER;
    buyReq.orderId = 302;
    buyReq.clientId = 20;
    buyReq.side = Side::BUY;
    buyReq.orderType = OrderType::LIMIT;
    buyReq.price = 20000;
    buyReq.quantity = 100;
    buyReq.timestamp = 2000;
    ASSERT_TRUE(engine.enqueueOrder(buyReq), "Enqueue buy order must succeed");

    // 1st report: partial trade of 40 shares
    ASSERT_TRUE(waitForReport(engine, report), "Must receive partial trade");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::TRADE), "Expected TRADE report");
    ASSERT_EQ(report.trade.quantity, 40, "Trade quantity should be 40");

    // 2nd report: buy order accepted with PARTIALLY_FILLED
    ASSERT_TRUE(waitForReport(engine, report), "Must receive buy status");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::ORDER_ACCEPTED), "Expected ORDER_ACCEPTED");
    ASSERT_EQ(static_cast<uint8_t>(report.status), static_cast<uint8_t>(OrderStatus::PARTIALLY_FILLED), "Status should be PARTIALLY_FILLED");

    engine.stop();
    ASSERT_EQ(engine.getActiveOrderCount(), 1, "Remaining 60 shares should rest in active orders");

    std::cout << "[PASS] testPartialFillMatching\n";
}

void testCancelNonExistentOrder() {
    MatchingEngine engine(64, 64);
    engine.start();

    ASSERT_TRUE(engine.enqueueCancel(9999, 1, 1000), "Enqueue cancel must succeed");

    ExecutionReport report{};
    ASSERT_TRUE(waitForReport(engine, report), "Must receive cancel rejection");
    ASSERT_EQ(static_cast<uint8_t>(report.type), static_cast<uint8_t>(ExecutionReportType::CANCEL_REJECTED), "Expected CANCEL_REJECTED");
    ASSERT_EQ(report.orderId, 9999, "Order ID mismatch on reject");
    ASSERT_EQ(static_cast<uint8_t>(report.status), static_cast<uint8_t>(OrderStatus::REJECTED), "Status should be REJECTED");

    engine.stop();
    std::cout << "[PASS] testCancelNonExistentOrder\n";
}

void testSynchronousOfflineExecution() {
    MatchingEngine engine(64, 64);

    OrderRequest buyReq{};
    buyReq.type = RequestType::NEW_ORDER;
    buyReq.orderId = 401;
    buyReq.clientId = 1;
    buyReq.side = Side::BUY;
    buyReq.orderType = OrderType::LIMIT;
    buyReq.price = 30000;
    buyReq.quantity = 50;
    buyReq.timestamp = 1000;

    engine.processEvent(buyReq);
    ASSERT_EQ(engine.getOrderBook().getBestBid(), 30000, "Best bid price mismatch");
    ASSERT_EQ(engine.getActiveOrderCount(), 1, "Active order count mismatch");

    OrderRequest cancelReq{};
    cancelReq.type = RequestType::CANCEL_ORDER;
    cancelReq.orderId = 401;
    cancelReq.clientId = 1;
    cancelReq.timestamp = 2000;

    engine.processEvent(cancelReq);
    ASSERT_EQ(engine.getActiveOrderCount(), 0, "Order count should be 0 after cancel");

    std::cout << "[PASS] testSynchronousOfflineExecution\n";
}

void testBurstThroughput() {
    constexpr size_t kBurstCount = 500;
    MatchingEngine engine(2048, 2048);
    engine.start();

    // Submit 500 maker asks
    for (size_t i = 1; i <= kBurstCount; ++i) {
        OrderRequest ask{};
        ask.type = RequestType::NEW_ORDER;
        ask.orderId = i;
        ask.clientId = 100;
        ask.side = Side::SELL;
        ask.orderType = OrderType::LIMIT;
        ask.price = 10000;
        ask.quantity = 10;
        ask.timestamp = 1000 + i;
        while (!engine.enqueueOrder(ask)) {
            std::this_thread::yield();
        }
    }

    // Submit 500 taker bids
    for (size_t i = 1; i <= kBurstCount; ++i) {
        OrderRequest bid{};
        bid.type = RequestType::NEW_ORDER;
        bid.orderId = kBurstCount + i;
        bid.clientId = 200;
        bid.side = Side::BUY;
        bid.orderType = OrderType::LIMIT;
        bid.price = 10000;
        bid.quantity = 10;
        bid.timestamp = 2000 + i;
        while (!engine.enqueueOrder(bid)) {
            std::this_thread::yield();
        }
    }

    size_t tradeCount = 0;
    size_t acceptCount = 0;
    ExecutionReport report{};

    // Expected total reports: 500 ask accepts + 500 trades + 500 bid accepts = 1500 reports
    const size_t totalExpectedReports = kBurstCount * 3;
    size_t totalReceived = 0;

    while (totalReceived < totalExpectedReports && waitForReport(engine, report, 3000)) {
        if (report.type == ExecutionReportType::TRADE) {
            ++tradeCount;
        } else if (report.type == ExecutionReportType::ORDER_ACCEPTED) {
            ++acceptCount;
        }
        ++totalReceived;
    }

    ASSERT_EQ(tradeCount, kBurstCount, "Expected exactly 500 trades in burst");
    ASSERT_EQ(acceptCount, kBurstCount * 2, "Expected exactly 1000 order accepts in burst");
    ASSERT_EQ(totalReceived, totalExpectedReports, "Expected all 1500 reports processed");

    engine.stop();
    ASSERT_EQ(engine.getActiveOrderCount(), 0, "No active orders should remain after full burst execution");

    std::cout << "[PASS] testBurstThroughput (" << tradeCount << " trades executed)\n";
}

int main() {
    std::cout << "Running MatchingEngine test suite...\n";

    testEngineLifecycle();
    testOrderIngressAndResting();
    testImmediateTradeExecution();
    testPartialFillMatching();
    testCancelNonExistentOrder();
    testSynchronousOfflineExecution();
    testBurstThroughput();

    std::cout << "All MatchingEngine tests passed successfully!\n";
    return 0;
}

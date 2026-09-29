#include "core/order_book.h"
#include <iostream>
#include <cstdlib>

using namespace core;
using namespace common;

inline std::ostream& operator<<(std::ostream& os, OrderStatus status) {
    return os << orderStatusToString(status);
}

inline std::ostream& operator<<(std::ostream& os, Side side) {
    return os << sideToString(side);
}

inline std::ostream& operator<<(std::ostream& os, OrderType type) {
    return os << orderTypeToString(type);
}

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

void testExactLimitMatch() {
    OrderBook book;
    constexpr Price kPrice = 10000;
    constexpr Quantity kQty = 50;

    Order ask(1, 101, Side::SELL, OrderType::LIMIT, kPrice, kQty, 1000);
    auto askTrades = book.addOrder(&ask);
    ASSERT_TRUE(askTrades.empty(), "Resting ask must not emit trades immediately");
    ASSERT_TRUE(book.hasAsks(), "Ask book should contain resting order");
    ASSERT_EQ(book.getBestAsk(), kPrice, "Best ask price should match");
    ASSERT_EQ(book.getOrderCount(), 1, "Order count should be 1");

    Order bid(2, 102, Side::BUY, OrderType::LIMIT, kPrice, kQty, 2000);
    auto bidTrades = book.addOrder(&bid);
    ASSERT_EQ(bidTrades.size(), 1, "Expected exactly 1 trade");
    ASSERT_EQ(bidTrades[0].makerOrderId, 1, "Maker order ID mismatch");
    ASSERT_EQ(bidTrades[0].takerOrderId, 2, "Taker order ID mismatch");
    ASSERT_EQ(bidTrades[0].price, kPrice, "Trade execution price mismatch");
    ASSERT_EQ(bidTrades[0].quantity, kQty, "Trade execution quantity mismatch");

    ASSERT_TRUE(ask.isFilled(), "Ask order should be marked filled");
    ASSERT_TRUE(bid.isFilled(), "Bid order should be marked filled");
    ASSERT_EQ(ask.getStatus(), OrderStatus::FILLED, "Ask status should be FILLED");
    ASSERT_EQ(bid.getStatus(), OrderStatus::FILLED, "Bid status should be FILLED");
    ASSERT_TRUE(!book.hasBids(), "Bid book should be empty");
    ASSERT_TRUE(!book.hasAsks(), "Ask book should be empty");
    ASSERT_EQ(book.getOrderCount(), 0, "Book order count should be 0");
}

void testPartialFillAndRestingRemainder() {
    OrderBook book;
    constexpr Price kPrice = 10000;
    constexpr Quantity kAskQty = 100;
    constexpr Quantity kBidQty = 40;
    constexpr Quantity kRemainingQty = 60;

    Order ask(1, 101, Side::SELL, OrderType::LIMIT, kPrice, kAskQty, 1000);
    book.addOrder(&ask);

    Order bid(2, 102, Side::BUY, OrderType::LIMIT, kPrice, kBidQty, 2000);
    auto trades = book.addOrder(&bid);

    ASSERT_EQ(trades.size(), 1, "Expected exactly 1 trade");
    ASSERT_EQ(trades[0].quantity, kBidQty, "Trade quantity mismatch");
    ASSERT_EQ(trades[0].price, kPrice, "Trade price mismatch");

    ASSERT_TRUE(bid.isFilled(), "Taker bid should be completely filled");
    ASSERT_EQ(bid.getStatus(), OrderStatus::FILLED, "Bid status should be FILLED");
    ASSERT_TRUE(!ask.isFilled(), "Maker ask should not be completely filled");
    ASSERT_EQ(ask.getStatus(), OrderStatus::PARTIALLY_FILLED, "Ask status should be PARTIALLY_FILLED");
    ASSERT_EQ(ask.getRemainingQuantity(), kRemainingQty, "Ask remaining quantity mismatch");

    ASSERT_TRUE(book.hasAsks(), "Ask book should retain resting remainder");
    ASSERT_EQ(book.getBestAsk(), kPrice, "Best ask price should remain unchanged");
    ASSERT_EQ(book.getOrderCount(), 1, "Order count should reflect remaining order");
}

void testMultiLevelSweep() {
    OrderBook book;
    constexpr Price kAskPrice1 = 10000;
    constexpr Price kAskPrice2 = 10200;
    constexpr Quantity kAskQty1 = 30;
    constexpr Quantity kAskQty2 = 50;
    constexpr Price kTakerBidPrice = 10200;
    constexpr Quantity kTakerBidQty = 60;

    Order ask1(1, 101, Side::SELL, OrderType::LIMIT, kAskPrice1, kAskQty1, 1000);
    Order ask2(2, 102, Side::SELL, OrderType::LIMIT, kAskPrice2, kAskQty2, 2000);
    book.addOrder(&ask1);
    book.addOrder(&ask2);

    Order takerBid(3, 103, Side::BUY, OrderType::LIMIT, kTakerBidPrice, kTakerBidQty, 3000);
    auto trades = book.addOrder(&takerBid);

    ASSERT_EQ(trades.size(), 2, "Expected 2 execution trades across price levels");
    ASSERT_EQ(trades[0].makerOrderId, 1, "First trade maker ID mismatch");
    ASSERT_EQ(trades[0].price, kAskPrice1, "First trade price mismatch");
    ASSERT_EQ(trades[0].quantity, kAskQty1, "First trade quantity mismatch");

    ASSERT_EQ(trades[1].makerOrderId, 2, "Second trade maker ID mismatch");
    ASSERT_EQ(trades[1].price, kAskPrice2, "Second trade price mismatch");
    ASSERT_EQ(trades[1].quantity, 30, "Second trade quantity mismatch");

    ASSERT_TRUE(takerBid.isFilled(), "Taker bid should be filled completely");
    ASSERT_TRUE(ask1.isFilled(), "Ask 1 should be filled completely");
    ASSERT_TRUE(!ask2.isFilled(), "Ask 2 should be partially filled");
    ASSERT_EQ(ask2.getRemainingQuantity(), 20, "Ask 2 should have 20 remaining");
    ASSERT_EQ(book.getBestAsk(), kAskPrice2, "Best ask should advance to second level");
    ASSERT_EQ(book.getOrderCount(), 1, "Remaining order count should be 1");
}

void testPriceTimePriorityFIFO() {
    OrderBook book;
    constexpr Price kPrice = 10000;
    constexpr Quantity kAskQty = 20;
    constexpr Quantity kBidQty = 25;

    Order ask1(1, 101, Side::SELL, OrderType::LIMIT, kPrice, kAskQty, 1000);
    Order ask2(2, 102, Side::SELL, OrderType::LIMIT, kPrice, kAskQty, 2000);
    book.addOrder(&ask1);
    book.addOrder(&ask2);

    Order takerBid(3, 103, Side::BUY, OrderType::LIMIT, kPrice, kBidQty, 3000);
    auto trades = book.addOrder(&takerBid);

    ASSERT_EQ(trades.size(), 2, "Expected 2 trades for multi-order match");
    ASSERT_EQ(trades[0].makerOrderId, 1, "Trade must execute against earlier timestamp first");
    ASSERT_EQ(trades[0].quantity, 20, "First trade should consume entire first order");
    ASSERT_EQ(trades[1].makerOrderId, 2, "Trade must execute against second timestamp order");
    ASSERT_EQ(trades[1].quantity, 5, "Second trade should consume remainder");

    ASSERT_TRUE(ask1.isFilled(), "First order should be filled");
    ASSERT_EQ(ask2.getRemainingQuantity(), 15, "Second order should have 15 remaining");
    ASSERT_EQ(book.getOrderCount(), 1, "One resting order should remain");
}

void testOrderCancellationAndDepth() {
    OrderBook book;
    constexpr Price kBidPrice1 = 9900;
    constexpr Price kBidPrice2 = 9800;
    constexpr Quantity kBidQty1 = 50;
    constexpr Quantity kBidQty2 = 100;

    Order bid1(1, 101, Side::BUY, OrderType::LIMIT, kBidPrice1, kBidQty1, 1000);
    Order bid2(2, 102, Side::BUY, OrderType::LIMIT, kBidPrice2, kBidQty2, 2000);
    book.addOrder(&bid1);
    book.addOrder(&bid2);

    auto depthBefore = book.getBidDepth(5);
    ASSERT_EQ(depthBefore.size(), 2, "Depth should have 2 price levels");
    ASSERT_EQ(depthBefore[0].price, kBidPrice1, "Level 0 price mismatch");
    ASSERT_EQ(depthBefore[0].totalQuantity, kBidQty1, "Level 0 quantity mismatch");
    ASSERT_EQ(depthBefore[1].price, kBidPrice2, "Level 1 price mismatch");
    ASSERT_EQ(depthBefore[1].totalQuantity, kBidQty2, "Level 1 quantity mismatch");

    const bool cancelled = book.cancelOrder(bid1.getOrderId());
    ASSERT_TRUE(cancelled, "cancelOrder must return true for active order");
    ASSERT_EQ(bid1.getStatus(), OrderStatus::CANCELLED, "Order status should transition to CANCELLED");

    ASSERT_EQ(book.getBestBid(), kBidPrice2, "Best bid must update after cancellation");
    ASSERT_EQ(book.getOrderCount(), 1, "Order count must be decremented");

    auto depthAfter = book.getBidDepth(5);
    ASSERT_EQ(depthAfter.size(), 1, "Depth should have 1 price level after cancellation");
    ASSERT_EQ(depthAfter[0].price, kBidPrice2, "Remaining depth level price mismatch");

    const bool cancelNonExistent = book.cancelOrder(999);
    ASSERT_TRUE(!cancelNonExistent, "cancelOrder must return false for unknown order ID");
}

int main() {
    std::cout << "[RUNNING] OrderBook unit test suite...\n";

    testExactLimitMatch();
    std::cout << "[PASS] testExactLimitMatch\n";

    testPartialFillAndRestingRemainder();
    std::cout << "[PASS] testPartialFillAndRestingRemainder\n";

    testMultiLevelSweep();
    std::cout << "[PASS] testMultiLevelSweep\n";

    testPriceTimePriorityFIFO();
    std::cout << "[PASS] testPriceTimePriorityFIFO\n";

    testOrderCancellationAndDepth();
    std::cout << "[PASS] testOrderCancellationAndDepth\n";

    std::cout << "[ALL TESTS PASSED] 5/5 tests successful.\n";
    return 0;
}
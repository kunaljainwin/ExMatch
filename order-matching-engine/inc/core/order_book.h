#pragma once

#include "core/order.h"
#include "core/trade.h"
#include <map>
#include <vector>
#include <unordered_map>
#include <functional>
#include <cstddef>

namespace core {

struct Level2Entry {
    Price price;
    Quantity totalQuantity;
    uint32_t orderCount;
};

class OrderBook {
public:
    OrderBook() = default;
    ~OrderBook() = default;

    // Prevent copies (resource owner semantics)
    OrderBook(const OrderBook&) = delete;
    OrderBook& operator=(const OrderBook&) = delete;
    OrderBook(OrderBook&&) = delete;
    OrderBook& operator=(OrderBook&&) = delete;

    // Core Order Lifecycle API
    std::vector<Trade> addOrder(Order* order);
    bool cancelOrder(OrderId orderId);

    // Book State Observers
    bool hasBids() const noexcept { return !bids_.empty(); }
    bool hasAsks() const noexcept { return !asks_.empty(); }
    Price getBestBid() const noexcept;
    Price getBestAsk() const noexcept;
    size_t getOrderCount() const noexcept { return orderLookup_.size(); }

    // Level-2 Depth Snapshot
    std::vector<Level2Entry> getBidDepth(size_t maxLevels = 5) const;
    std::vector<Level2Entry> getAskDepth(size_t maxLevels = 5) const;

private:
    std::vector<Trade> matchBuyOrder(Order* takerOrder);
    std::vector<Trade> matchSellOrder(Order* takerOrder);

    void restOrder(Order* order);
    void removeOrderFromBook(Order* order);

    // Bids sorted descending (highest price first)
    std::map<Price, std::vector<Order*>, std::greater<Price>> bids_;

    // Asks sorted ascending (lowest price first)
    std::map<Price, std::vector<Order*>, std::less<Price>> asks_;

    // O(1) Order lookup for active resting orders
    std::unordered_map<OrderId, Order*> orderLookup_;

    uint64_t nextTradeId_{1};
};

} // namespace core

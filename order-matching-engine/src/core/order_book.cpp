#include "core/order_book.h"
#include <algorithm>

namespace core {

Price OrderBook::getBestBid() const noexcept {
    if (bids_.empty()) {
        return 0;
    }
    return bids_.begin()->first;
}

Price OrderBook::getBestAsk() const noexcept {
    if (asks_.empty()) {
        return 0;
    }
    return asks_.begin()->first;
}

std::vector<Trade> OrderBook::addOrder(Order* order) {
    if (!order || order->getRemainingQuantity() == 0) {
        return {};
    }

    std::vector<Trade> trades;
    if (order->getSide() == Side::BUY) {
        trades = matchBuyOrder(order);
    } else {
        trades = matchSellOrder(order);
    }

    // Rest remaining unfilled limit order quantity on the book
    if (!order->isFilled()) {
        if (order->getType() == OrderType::LIMIT) {
            restOrder(order);
        } else {
            // Market orders cannot rest on the order book
            order->cancel();
        }
    }

    return trades;
}

std::vector<Trade> OrderBook::matchBuyOrder(Order* takerOrder) {
    std::vector<Trade> trades;

    auto askIt = asks_.begin();
    while (askIt != asks_.end() && !takerOrder->isFilled()) {
        const Price bestAskPrice = askIt->first;

        // Spread check: buyer will not pay more than limit price
        if (takerOrder->getType() == OrderType::LIMIT && bestAskPrice > takerOrder->getPrice()) {
            break;
        }

        auto& ordersAtLevel = askIt->second;
        for (auto orderIt = ordersAtLevel.begin(); orderIt != ordersAtLevel.end() && !takerOrder->isFilled();) {
            Order* makerOrder = *orderIt;
            const Quantity matchQty = std::min(takerOrder->getRemainingQuantity(), makerOrder->getRemainingQuantity());
            const Price matchPrice = makerOrder->getPrice();

            makerOrder->fill(matchQty);
            takerOrder->fill(matchQty);

            trades.push_back(Trade{
                nextTradeId_++,
                makerOrder->getOrderId(),
                takerOrder->getOrderId(),
                matchPrice,
                matchQty,
                takerOrder->getTimestamp()
            });

            if (makerOrder->isFilled()) {
                orderLookup_.erase(makerOrder->getOrderId());
                orderIt = ordersAtLevel.erase(orderIt);
            } else {
                ++orderIt;
            }
        }

        if (ordersAtLevel.empty()) {
            askIt = asks_.erase(askIt);
        } else {
            ++askIt;
        }
    }

    return trades;
}

std::vector<Trade> OrderBook::matchSellOrder(Order* takerOrder) {
    std::vector<Trade> trades;

    auto bidIt = bids_.begin();
    while (bidIt != bids_.end() && !takerOrder->isFilled()) {
        const Price bestBidPrice = bidIt->first;

        // Spread check: seller will not accept less than limit price
        if (takerOrder->getType() == OrderType::LIMIT && bestBidPrice < takerOrder->getPrice()) {
            break;
        }

        auto& ordersAtLevel = bidIt->second;
        for (auto orderIt = ordersAtLevel.begin(); orderIt != ordersAtLevel.end() && !takerOrder->isFilled();) {
            Order* makerOrder = *orderIt;
            const Quantity matchQty = std::min(takerOrder->getRemainingQuantity(), makerOrder->getRemainingQuantity());
            const Price matchPrice = makerOrder->getPrice();

            makerOrder->fill(matchQty);
            takerOrder->fill(matchQty);

            trades.push_back(Trade{
                nextTradeId_++,
                makerOrder->getOrderId(),
                takerOrder->getOrderId(),
                matchPrice,
                matchQty,
                takerOrder->getTimestamp()
            });

            if (makerOrder->isFilled()) {
                orderLookup_.erase(makerOrder->getOrderId());
                orderIt = ordersAtLevel.erase(orderIt);
            } else {
                ++orderIt;
            }
        }

        if (ordersAtLevel.empty()) {
            bidIt = bids_.erase(bidIt);
        } else {
            ++bidIt;
        }
    }

    return trades;
}

void OrderBook::restOrder(Order* order) {
    if (!order) {
        return;
    }

    if (order->getSide() == Side::BUY) {
        bids_[order->getPrice()].push_back(order);
    } else {
        asks_[order->getPrice()].push_back(order);
    }

    orderLookup_[order->getOrderId()] = order;
}

bool OrderBook::cancelOrder(OrderId orderId) {
    auto it = orderLookup_.find(orderId);
    if (it == orderLookup_.end()) {
        return false;
    }

    Order* order = it->second;
    removeOrderFromBook(order);
    order->cancel();
    orderLookup_.erase(it);

    return true;
}

void OrderBook::removeOrderFromBook(Order* order) {
    if (!order) {
        return;
    }

    if (order->getSide() == Side::BUY) {
        auto levelIt = bids_.find(order->getPrice());
        if (levelIt != bids_.end()) {
            auto& vec = levelIt->second;
            vec.erase(std::remove(vec.begin(), vec.end(), order), vec.end());
            if (vec.empty()) {
                bids_.erase(levelIt);
            }
        }
    } else {
        auto levelIt = asks_.find(order->getPrice());
        if (levelIt != asks_.end()) {
            auto& vec = levelIt->second;
            vec.erase(std::remove(vec.begin(), vec.end(), order), vec.end());
            if (vec.empty()) {
                asks_.erase(levelIt);
            }
        }
    }
}

std::vector<Level2Entry> OrderBook::getBidDepth(size_t maxLevels) const {
    std::vector<Level2Entry> depth;
    depth.reserve(std::min(maxLevels, bids_.size()));

    size_t count = 0;
    for (const auto& [price, orders] : bids_) {
        if (count >= maxLevels) {
            break;
        }
        Quantity totalQty = 0;
        for (const auto* order : orders) {
            totalQty += order->getRemainingQuantity();
        }
        depth.push_back(Level2Entry{price, totalQty, static_cast<uint32_t>(orders.size())});
        ++count;
    }

    return depth;
}

std::vector<Level2Entry> OrderBook::getAskDepth(size_t maxLevels) const {
    std::vector<Level2Entry> depth;
    depth.reserve(std::min(maxLevels, asks_.size()));

    size_t count = 0;
    for (const auto& [price, orders] : asks_) {
        if (count >= maxLevels) {
            break;
        }
        Quantity totalQty = 0;
        for (const auto* order : orders) {
            totalQty += order->getRemainingQuantity();
        }
        depth.push_back(Level2Entry{price, totalQty, static_cast<uint32_t>(orders.size())});
        ++count;
    }

    return depth;
}

} // namespace core

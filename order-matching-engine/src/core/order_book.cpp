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

        LimitLevel& level = askIt->second;
        while (level.head != nullptr && !takerOrder->isFilled()) {
            Order* makerOrder = level.head;
            const Quantity matchQty = std::min(takerOrder->getRemainingQuantity(), makerOrder->getRemainingQuantity());
            const Price matchPrice = makerOrder->getPrice();

            makerOrder->fill(matchQty);
            takerOrder->fill(matchQty);
            level.totalQuantity -= matchQty;

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
                level.remove(makerOrder);
            }
        }

        if (level.empty()) {
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

        LimitLevel& level = bidIt->second;
        while (level.head != nullptr && !takerOrder->isFilled()) {
            Order* makerOrder = level.head;
            const Quantity matchQty = std::min(takerOrder->getRemainingQuantity(), makerOrder->getRemainingQuantity());
            const Price matchPrice = makerOrder->getPrice();

            makerOrder->fill(matchQty);
            takerOrder->fill(matchQty);
            level.totalQuantity -= matchQty;

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
                level.remove(makerOrder);
            }
        }

        if (level.empty()) {
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
        auto [it, inserted] = bids_.try_emplace(order->getPrice(), order->getPrice());
        it->second.append(order);
    } else {
        auto [it, inserted] = asks_.try_emplace(order->getPrice(), order->getPrice());
        it->second.append(order);
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
    if (!order || !order->level) {
        return;
    }

    LimitLevel* level = order->level;
    const Price price = level->price;
    const Side side = order->getSide();

    level->remove(order);

    if (level->empty()) {
        if (side == Side::BUY) {
            bids_.erase(price);
        } else {
            asks_.erase(price);
        }
    }
}

std::vector<Level2Entry> OrderBook::getBidDepth(size_t maxLevels) const {
    std::vector<Level2Entry> depth;
    depth.reserve(std::min(maxLevels, bids_.size()));

    size_t count = 0;
    for (const auto& [price, level] : bids_) {
        if (count >= maxLevels) {
            break;
        }
        depth.push_back(Level2Entry{price, level.totalQuantity, level.orderCount});
        ++count;
    }

    return depth;
}

std::vector<Level2Entry> OrderBook::getAskDepth(size_t maxLevels) const {
    std::vector<Level2Entry> depth;
    depth.reserve(std::min(maxLevels, asks_.size()));

    size_t count = 0;
    for (const auto& [price, level] : asks_) {
        if (count >= maxLevels) {
            break;
        }
        depth.push_back(Level2Entry{price, level.totalQuantity, level.orderCount});
        ++count;
    }

    return depth;
}

} // namespace core

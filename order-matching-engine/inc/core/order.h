#pragma once

#include "common/types.h"
#include <cassert>

namespace core {

using namespace common;

class Order {
public:
    Order(OrderId orderId, ClientId clientId, Side side, OrderType type, Price price, Quantity quantity, Timestamp timestamp)
        : orderId_(orderId),
          clientId_(clientId),
          side_(side),
          type_(type),
          price_(price),
          quantity_(quantity),
          filledQuantity_(0),
          status_(OrderStatus::NEW),
          timestamp_(timestamp) {}

    // Getters
    OrderId getOrderId() const noexcept { return orderId_; }
    ClientId getClientId() const noexcept { return clientId_; }
    Side getSide() const noexcept { return side_; }
    OrderType getType() const noexcept { return type_; }
    Price getPrice() const noexcept { return price_; }
    Quantity getQuantity() const noexcept { return quantity_; }
    Quantity getFilledQuantity() const noexcept { return filledQuantity_; }
    OrderStatus getStatus() const noexcept { return status_; }
    Timestamp getTimestamp() const noexcept { return timestamp_; }

    // State Inspection
    Quantity getRemainingQuantity() const noexcept {
        return quantity_ - filledQuantity_;
    }

    bool isFilled() const noexcept {
        return filledQuantity_ >= quantity_;
    }

    // State Mutators
    void fill(Quantity fillQty) noexcept {
        assert(fillQty <= getRemainingQuantity() && "Fill quantity exceeds remaining quantity");
        filledQuantity_ += fillQty;
        status_ = isFilled() ? OrderStatus::FILLED : OrderStatus::PARTIALLY_FILLED;
    }

    void cancel() noexcept {
        status_ = OrderStatus::CANCELLED;
    }

private:
    OrderId orderId_;
    ClientId clientId_;
    Side side_;
    OrderType type_;
    Price price_;
    Quantity quantity_;
    Quantity filledQuantity_;
    OrderStatus status_;
    Timestamp timestamp_;
};

} // namespace core

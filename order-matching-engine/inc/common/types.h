#pragma once

#include <cstdint>

namespace common {

// Financial primitives (Fixed-point integer ticks)
// Signed int64_t allows safe spread calculations (e.g. bid - ask) without unsigned underflow
using Price = int64_t;
using Quantity = uint64_t;
using OrderId = uint64_t;
using ClientId = uint32_t;
using Timestamp = uint64_t; // Nanoseconds since Unix epoch

enum class Side : uint8_t {
    BUY = 0,
    SELL = 1
};

enum class OrderType : uint8_t {
    LIMIT = 0,
    MARKET = 1
};

enum class OrderStatus : uint8_t {
    NEW = 0,
    PARTIALLY_FILLED,
    FILLED,
    CANCELLED,
    REJECTED
};

// Zero-allocation string helpers for logging and debugging
inline const char* sideToString(Side side) noexcept {
    return side == Side::BUY ? "BUY" : "SELL";
}

inline const char* orderStatusToString(OrderStatus status) noexcept {
    switch (status) {
        case OrderStatus::NEW:              return "NEW";
        case OrderStatus::PARTIALLY_FILLED: return "PARTIALLY_FILLED";
        case OrderStatus::FILLED:           return "FILLED";
        case OrderStatus::CANCELLED:        return "CANCELLED";
        case OrderStatus::REJECTED:         return "REJECTED";
        default:                            return "UNKNOWN";
    }
}

inline const char* orderTypeToString(OrderType type) noexcept {
    switch (type) {
        case OrderType::LIMIT:  return "LIMIT";
        case OrderType::MARKET: return "MARKET";
        default:                return "UNKNOWN";
    }
}

} // namespace common

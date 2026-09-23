#pragma once

#include "common/types.h"

namespace core {

using namespace common;

struct Trade {
    uint64_t tradeId;
    OrderId makerOrderId;
    OrderId takerOrderId;
    Price price;
    Quantity quantity;
    Timestamp timestamp;
};

} // namespace core

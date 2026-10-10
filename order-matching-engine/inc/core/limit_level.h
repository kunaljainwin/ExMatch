#pragma once

#include "common/types.h"
#include "core/order.h"
#include <cassert>
#include <cstddef>

namespace core {

struct LimitLevel {
    common::Price price{0};
    common::Quantity totalQuantity{0};
    uint32_t orderCount{0};
    Order* head{nullptr};
    Order* tail{nullptr};

    explicit LimitLevel(common::Price p = 0) noexcept : price(p) {}

    [[nodiscard]] bool empty() const noexcept {
        return orderCount == 0;
    }

    void append(Order* order) noexcept {
        assert(order != nullptr);
        order->level = this;
        order->next = nullptr;

        if (tail == nullptr) {
            order->prev = nullptr;
            head = order;
            tail = order;
        } else {
            order->prev = tail;
            tail->next = order;
            tail = order;
        }

        totalQuantity += order->getRemainingQuantity();
        ++orderCount;
    }

    void remove(Order* order) noexcept {
        assert(order != nullptr);
        assert(order->level == this);

        if (order->prev != nullptr) {
            order->prev->next = order->next;
        } else {
            head = order->next;
        }

        if (order->next != nullptr) {
            order->next->prev = order->prev;
        } else {
            tail = order->prev;
        }

        totalQuantity -= order->getRemainingQuantity();
        --orderCount;

        order->prev = nullptr;
        order->next = nullptr;
        order->level = nullptr;
    }
};

} // namespace core

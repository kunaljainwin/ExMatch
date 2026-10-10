#pragma once

#include "common/lock_free_queue.hpp"
#include "common/object_pool.hpp"
#include "common/types.h"
#include "core/order.h"
#include "core/order_book.h"
#include "core/trade.h"
#include <atomic>
#include <cstdint>
#include <memory>
#include <thread>
#include <unordered_map>
#include <vector>

namespace core {

enum class RequestType : uint8_t {
    NEW_ORDER = 0,
    CANCEL_ORDER = 1
};

enum class ExecutionReportType : uint8_t {
    ORDER_ACCEPTED = 0,
    TRADE = 1,
    ORDER_CANCELLED = 2,
    CANCEL_REJECTED = 3,
    ORDER_REJECTED = 4
};

inline const char* executionReportTypeToString(ExecutionReportType type) noexcept {
    switch (type) {
        case ExecutionReportType::ORDER_ACCEPTED:  return "ORDER_ACCEPTED";
        case ExecutionReportType::TRADE:           return "TRADE";
        case ExecutionReportType::ORDER_CANCELLED: return "ORDER_CANCELLED";
        case ExecutionReportType::CANCEL_REJECTED: return "CANCEL_REJECTED";
        case ExecutionReportType::ORDER_REJECTED:  return "ORDER_REJECTED";
        default:                                   return "UNKNOWN";
    }
}

struct OrderRequest {
    RequestType type{RequestType::NEW_ORDER};
    common::OrderId orderId{0};
    common::ClientId clientId{0};
    common::Side side{common::Side::BUY};
    common::OrderType orderType{common::OrderType::LIMIT};
    common::Price price{0};
    common::Quantity quantity{0};
    common::Timestamp timestamp{0};
};

struct ExecutionReport {
    ExecutionReportType type{ExecutionReportType::ORDER_ACCEPTED};
    common::OrderId orderId{0};
    common::ClientId clientId{0};
    Trade trade{};
    common::OrderStatus status{common::OrderStatus::NEW};
    common::Timestamp timestamp{0};
};

class MatchingEngine final {
public:
    explicit MatchingEngine(size_t ingressCapacity = 1024, size_t egressCapacity = 1024);
    ~MatchingEngine();

    MatchingEngine(const MatchingEngine&) = delete;
    MatchingEngine& operator=(const MatchingEngine&) = delete;
    MatchingEngine(MatchingEngine&&) = delete;
    MatchingEngine& operator=(MatchingEngine&&) = delete;

    void start();
    void stop();
    [[nodiscard]] bool isRunning() const noexcept;

    // SPSC Ingress (Producer side)
    [[nodiscard("Ignoring enqueueOrder status can cause silent order drop if ingress queue is saturated")]]
    bool enqueueOrder(const OrderRequest& request);

    [[nodiscard("Ignoring enqueueCancel status can cause silent cancel drop if ingress queue is saturated")]]
    bool enqueueCancel(common::OrderId orderId, common::ClientId clientId = 0, common::Timestamp timestamp = 0);

    // SPSC Egress (Consumer side)
    [[nodiscard("Ignoring dequeueExecution status can cause processing invalid report if egress queue is empty")]]
    bool dequeueExecution(ExecutionReport& report);

    // Synchronous execution for offline replay and unit testing
    void processEvent(const OrderRequest& request);

    // Book state inspector
    [[nodiscard]] const OrderBook& getOrderBook() const noexcept { return orderBook_; }
    [[nodiscard]] size_t getActiveOrderCount() const noexcept { return activeOrders_.size(); }

private:
    void run();
    void processNewOrder(const OrderRequest& req);
    void processCancelOrder(const OrderRequest& req);
    void emitEgressReport(const ExecutionReport& report);

    common::LFQueue<OrderRequest> ingressQueue_;
    common::LFQueue<ExecutionReport> egressQueue_;

    OrderBook orderBook_;
    common::ObjectPool<Order> orderPool_;
    std::unordered_map<common::OrderId, Order*> activeOrders_;

    std::atomic<bool> running_{false};
    std::thread workerThread_;
};

} // namespace core

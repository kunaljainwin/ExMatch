#include "core/matching_engine.h"
#include <utility>
#include <chrono>

namespace core {

namespace {
constexpr size_t kMaxEnqueueRetries = 100000;
}

MatchingEngine::MatchingEngine(size_t ingressCapacity, size_t egressCapacity)
    : ingressQueue_(ingressCapacity),
      egressQueue_(egressCapacity) {}

MatchingEngine::~MatchingEngine() {
    stop();
    for (auto& [id, orderPtr] : activeOrders_) {
        orderPool_.release(orderPtr);
    }
    activeOrders_.clear();
}

void MatchingEngine::start() {
    if (running_.exchange(true, std::memory_order_acq_rel)) {
        return;
    }
    workerThread_ = std::thread(&MatchingEngine::run, this);
}

void MatchingEngine::stop() {
    if (!running_.exchange(false, std::memory_order_acq_rel)) {
        return;
    }
    if (workerThread_.joinable()) {
        workerThread_.join();
    }
}

bool MatchingEngine::isRunning() const noexcept {
    return running_.load(std::memory_order_acquire);
}

bool MatchingEngine::enqueueOrder(const OrderRequest& request) {
    if (request.quantity == 0 || request.orderId == 0) {
        return false;
    }
    return ingressQueue_.enqueue(request);
}

bool MatchingEngine::enqueueCancel(common::OrderId orderId, common::ClientId clientId, common::Timestamp timestamp) {
    if (orderId == 0) {
        return false;
    }
    OrderRequest request{};
    request.type = RequestType::CANCEL_ORDER;
    request.orderId = orderId;
    request.clientId = clientId;
    request.timestamp = timestamp;
    return ingressQueue_.enqueue(request);
}

bool MatchingEngine::dequeueExecution(ExecutionReport& report) {
    return egressQueue_.dequeue(report);
}

void MatchingEngine::run() {
    OrderRequest request{};
    while (running_.load(std::memory_order_relaxed)) {
        if (ingressQueue_.dequeue(request)) {
            processEvent(request);
        } else {
            std::this_thread::yield();
        }
    }

    while (ingressQueue_.dequeue(request)) {
        processEvent(request);
    }
}

void MatchingEngine::processEvent(const OrderRequest& request) {
    if (request.type == RequestType::NEW_ORDER) {
        processNewOrder(request);
    } else if (request.type == RequestType::CANCEL_ORDER) {
        processCancelOrder(request);
    }
}

void MatchingEngine::emitEgressReport(const ExecutionReport& report) {
    size_t retries = 0;
    while (!egressQueue_.enqueue(report) && retries < kMaxEnqueueRetries) {
        std::this_thread::yield();
        ++retries;
    }
}

void MatchingEngine::processNewOrder(const OrderRequest& req) {
    Order* orderPtr = orderPool_.acquire(
        req.orderId, req.clientId, req.side, req.orderType, req.price, req.quantity, req.timestamp);

    activeOrders_[req.orderId] = orderPtr;
    const auto trades = orderBook_.addOrder(orderPtr);

    for (const auto& trade : trades) {
        ExecutionReport tradeReport{};
        tradeReport.type = ExecutionReportType::TRADE;
        tradeReport.orderId = req.orderId;
        tradeReport.clientId = req.clientId;
        tradeReport.trade = trade;
        tradeReport.status = orderPtr->getStatus();
        tradeReport.timestamp = trade.timestamp;
        emitEgressReport(tradeReport);

        auto makerIt = activeOrders_.find(trade.makerOrderId);
        if (makerIt != activeOrders_.end() && makerIt->second->isFilled()) {
            orderPool_.release(makerIt->second);
            activeOrders_.erase(makerIt);
        }
    }

    ExecutionReport statusReport{};
    statusReport.type = ExecutionReportType::ORDER_ACCEPTED;
    statusReport.orderId = req.orderId;
    statusReport.clientId = req.clientId;
    statusReport.status = orderPtr->getStatus();
    statusReport.timestamp = req.timestamp;
    emitEgressReport(statusReport);

    if (orderPtr->isFilled() || orderPtr->getStatus() == common::OrderStatus::CANCELLED) {
        orderPool_.release(orderPtr);
        activeOrders_.erase(req.orderId);
    }
}

void MatchingEngine::processCancelOrder(const OrderRequest& req) {
    const bool cancelled = orderBook_.cancelOrder(req.orderId);
    ExecutionReport report{};
    report.orderId = req.orderId;
    report.clientId = req.clientId;
    report.timestamp = req.timestamp;

    if (cancelled) {
        report.type = ExecutionReportType::ORDER_CANCELLED;
        report.status = common::OrderStatus::CANCELLED;
        auto it = activeOrders_.find(req.orderId);
        if (it != activeOrders_.end()) {
            orderPool_.release(it->second);
            activeOrders_.erase(it);
        }
    } else {
        report.type = ExecutionReportType::CANCEL_REJECTED;
        report.status = common::OrderStatus::REJECTED;
    }

    emitEgressReport(report);
}

} // namespace core

#pragma once

#include "core/order_book.h"
#include "core/order.h"
#include <memory>
#include <string>
#include <vector>

namespace client {

class Client {
public:
    Client();
    ~Client();

    void runTUI();
    void runDemo();

    void submitOrder(const std::string& orderStr);
    void cancelOrder(const std::string& orderIdStr);
    void displayDepth() const;

private:
    void printMenu() const;
    void printTrades(const std::vector<core::Trade>& trades) const;
    void executeOrderSubmission(common::Side side, common::Quantity quantity, common::Price price);

    core::OrderBook orderBook_;
    std::vector<std::unique_ptr<core::Order>> orders_;
    common::OrderId nextOrderId_{1};
    common::ClientId defaultClientId_{1001};
};

} // namespace client

#pragma once
#include <memory>
// #include "Engine/OrderBook.h"
#include "common/logger.h"

namespace client {

class Client {
public:
    Client();  // Constructor
    ~Client();

    // Start the text-based UI loop
    void runTUI();

    // Submit a new order to the engine
    void submitOrder(const std::string& orderStr);

    // Cancel an order by ID
    void cancelOrder(const std::string& orderId);

private:
    // std::unique_ptr<engine::OrderBook> orderBook_;

    // Print menu and read user input
    void printMenu();
};

} // namespace client

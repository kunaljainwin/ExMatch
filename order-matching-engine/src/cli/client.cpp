#include "cli/client.h"

namespace client {

Client::Client() {
    // orderBook_ = std::make_unique<engine::OrderBook>();
    LOG_INFO("Client initialized");
}

Client::~Client() {
    LOG_INFO("Client shutting down");
}

void Client::printMenu() {
    std::cout << "\n--- Order Matching Client ---\n";
    std::cout << "1. Submit Order\n";
    std::cout << "2. Cancel Order\n";
    std::cout << "3. Exit\n";
    std::cout << "Enter choice: ";
}

void Client::runTUI() {
    int choice = 0;
    while (choice != 3) {
        printMenu();
        std::cin >> choice;
        std::cin.ignore();  // Clear newline

        switch (choice) {
            case 1: {
                std::string order;
                std::cout << "Enter order: ";
                std::getline(std::cin, order);
                submitOrder(order);
                break;
            }
            case 2: {
                std::string orderId;
                std::cout << "Enter order ID to cancel: ";
                std::getline(std::cin, orderId);
                cancelOrder(orderId);
                break;
            }
            case 3:
                LOG_INFO("Exiting TUI");
                break;
            default:
                LOG_WARN("Invalid choice");
        }
    }
}

void Client::submitOrder(const std::string& orderStr) {
    // TODO: Convert string to Order object and submit
    LOG_INFO("Submitting order: " + orderStr);
    // Example: orderBook_->addOrder(orderObj);
}

void Client::cancelOrder(const std::string& orderId) {
    LOG_INFO("Cancelling order: " + orderId);
    // Example: orderBook_->cancelOrder(orderId);
}

} // namespace client
#include "cli/client.h"
#include "common/logger.h"
#include <chrono>
#include <iostream>
#include <sstream>
#include <algorithm>
#include <iomanip>

namespace client {

namespace {

constexpr int kMenuSubmitOrder = 1;
constexpr int kMenuCancelOrder = 2;
constexpr int kMenuViewDepth = 3;
constexpr int kMenuRunDemo = 4;
constexpr int kMenuExit = 5;

uint64_t getSystemTimestampNs() {
    auto now = std::chrono::steady_clock::now().time_since_epoch();
    return static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::nanoseconds>(now).count());
}

} // namespace

Client::Client() {
    LOG_INFO("Client initialized with OrderBook");
}

Client::~Client() {
    LOG_INFO("Client shutting down");
}

void Client::printMenu() const {
    std::cout << "\n=========================================\n";
    std::cout << "        ExMatch Order Engine TUI         \n";
    std::cout << "=========================================\n";
    std::cout << "  1. Submit Order  (BUY/SELL <qty> <price>)\n";
    std::cout << "  2. Cancel Order  (<orderId>)\n";
    std::cout << "  3. View Depth    (Level-2 Book)\n";
    std::cout << "  4. Run Demo      (Automated Flow)\n";
    std::cout << "  5. Exit\n";
    std::cout << "Enter choice: ";
}

void Client::runTUI() {
    int choice = 0;
    while (choice != kMenuExit) {
        printMenu();
        if (!(std::cin >> choice)) {
            std::cin.clear();
            std::cin.ignore(1024, '\n');
            continue;
        }
        std::cin.ignore(1024, '\n');

        switch (choice) {
            case kMenuSubmitOrder: {
                std::string orderStr;
                std::cout << "Enter order [BUY/SELL <qty> <price>]: ";
                std::getline(std::cin, orderStr);
                submitOrder(orderStr);
                break;
            }
            case kMenuCancelOrder: {
                std::string orderIdStr;
                std::cout << "Enter order ID to cancel: ";
                std::getline(std::cin, orderIdStr);
                cancelOrder(orderIdStr);
                break;
            }
            case kMenuViewDepth:
                displayDepth();
                break;
            case kMenuRunDemo:
                runDemo();
                break;
            case kMenuExit:
                LOG_INFO("Exiting TUI");
                break;
            default:
                std::cout << "Invalid choice. Please select 1-5.\n";
        }
    }
}

void Client::submitOrder(const std::string& orderStr) {
    std::istringstream iss(orderStr);
    std::string sideToken;
    common::Quantity qty = 0;
    common::Price price = 0;

    if (!(iss >> sideToken >> qty >> price) || qty == 0 || price <= 0) {
        std::cout << "Error: Invalid order format. Expected: BUY/SELL <qty> <price>\n";
        return;
    }

    std::transform(sideToken.begin(), sideToken.end(), sideToken.begin(), ::toupper);
    if (sideToken != "BUY" && sideToken != "SELL") {
        std::cout << "Error: Side must be BUY or SELL.\n";
        return;
    }

    const common::Side side = (sideToken == "BUY") ? common::Side::BUY : common::Side::SELL;
    executeOrderSubmission(side, qty, price);
}

void Client::executeOrderSubmission(common::Side side, common::Quantity quantity, common::Price price) {
    const common::OrderId id = nextOrderId_++;
    const uint64_t ts = getSystemTimestampNs();

    auto order = std::make_unique<core::Order>(
        id, defaultClientId_, side, common::OrderType::LIMIT, price, quantity, ts
    );

    std::cout << "Submitting Order #" << id << " [" << common::sideToString(side)
              << " " << quantity << " @ " << price << "]\n";

    core::Order* rawOrderPtr = order.get();
    orders_.push_back(std::move(order));

    auto trades = orderBook_.addOrder(rawOrderPtr);
    printTrades(trades);
}

void Client::cancelOrder(const std::string& orderIdStr) {
    std::istringstream iss(orderIdStr);
    common::OrderId orderId = 0;

    if (!(iss >> orderId) || orderId == 0) {
        std::cout << "Error: Invalid order ID.\n";
        return;
    }

    const bool cancelled = orderBook_.cancelOrder(orderId);
    if (cancelled) {
        std::cout << "Order #" << orderId << " successfully CANCELLED.\n";
    } else {
        std::cout << "Cancel failed: Order #" << orderId << " not found on active book.\n";
    }
}

void Client::displayDepth() const {
    const auto asks = orderBook_.getAskDepth(5);
    const auto bids = orderBook_.getBidDepth(5);

    std::cout << "\n================= ORDER BOOK DEPTH =================\n";
    std::cout << "  SIDE |    PRICE    |    QUANTITY   |  ORDER COUNT \n";
    std::cout << "----------------------------------------------------\n";
    if (asks.empty()) {
        std::cout << "  ASK  |       ---   |        ---    |     ---      \n";
    } else {
        for (auto it = asks.rbegin(); it != asks.rend(); ++it) {
            std::cout << "  ASK  | " << std::setw(11) << it->price
                      << " | " << std::setw(13) << it->totalQuantity
                      << " | " << std::setw(12) << it->orderCount << "\n";
        }
    }
    std::cout << "---------------------- SPREAD ----------------------\n";
    if (bids.empty()) {
        std::cout << "  BID  |       ---   |        ---    |     ---      \n";
    } else {
        for (const auto& bid : bids) {
            std::cout << "  BID  | " << std::setw(11) << bid.price
                      << " | " << std::setw(13) << bid.totalQuantity
                      << " | " << std::setw(12) << bid.orderCount << "\n";
        }
    }
    std::cout << "====================================================\n";
}

void Client::printTrades(const std::vector<core::Trade>& trades) const {
    if (trades.empty()) {
        std::cout << "-> Order resting in the book. No trades executed.\n";
        return;
    }

    std::cout << "-> Executed " << trades.size() << " trade(s):\n";
    for (const auto& trade : trades) {
        std::cout << "   * Trade #" << trade.tradeId
                  << " [Maker Order #" << trade.makerOrderId
                  << " vs Taker Order #" << trade.takerOrderId
                  << "] Executed: " << trade.quantity
                  << " @ Price " << trade.price << "\n";
    }
}

void Client::runDemo() {
    std::cout << "\n>>> Starting Automated Limit Order Book Demo <<<\n\n";

    std::cout << "[Step 1] Adding resting asks (liquidity providers):\n";
    submitOrder("SELL 100 15000");
    submitOrder("SELL 50 15100");

    std::cout << "\n[Step 2] Adding resting bids:\n";
    submitOrder("BUY 80 14900");
    submitOrder("BUY 40 14800");

    std::cout << "\n[Step 3] Current Order Book Depth:\n";
    displayDepth();

    std::cout << "\n[Step 4] Incoming aggressive taker BUY (Qty 120 @ 15050):\n";
    std::cout << "         (Will match entire 100 @ 15000; remaining 20 cannot cross 15100 ask and rests)\n";
    submitOrder("BUY 120 15050");

    std::cout << "\n[Step 5] Updated Order Book Depth:\n";
    displayDepth();

    std::cout << "\n[Step 6] Cancelling remaining resting bid #4:\n";
    cancelOrder("4");

    std::cout << "\n[Step 7] Final Order Book Depth:\n";
    displayDepth();

    std::cout << "\n>>> Demo Complete <<<\n";
}

} // namespace client
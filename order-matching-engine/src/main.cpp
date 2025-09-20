#include "common/common.h"      // Include all common headers
#include "cli/client.h"

int main() {
    // TODO: Initialize configuration
    // Example: Config config;
    
    // TODO: Initialize system manager
    // Example: SystemManager sysManager(config);
    
    // TODO: Initialize network manager
    // Example: NetworkManager netManager;
    
    // TODO: Add your main logic here
    // Example: netManager.connectToServer();
    
    // Print a simple message
    common::Logger::enableTimestamp(false);
    // LOG_DEBUG("Order Matching Engine started successfully.");
    // LOG_INFO("Order Matching Engine started successfully.");
    // LOG_ERROR("Order Matching Engine started successfully.");
    // LOG_WARN("Order Matching Engine started successfully.");
    // LOG_FATAL("Order Matching Engine started successfully.");
    client::Client client;
    client.runTUI();

    return 0;
}

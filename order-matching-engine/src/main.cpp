#include "common/logger.h"
#include "cli/client.h"
#include <string>

int main(int argc, char* argv[]) {
    common::Logger::enableTimestamp(false);

    client::Client client;

    if (argc > 1 && std::string(argv[1]) == "--demo") {
        client.runDemo();
        return 0;
    }

    client.runTUI();
    return 0;
}

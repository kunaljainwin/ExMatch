#pragma once

#include <string>

#define APP_NAME "order-matching-engine"
// Assuming PROJECT_ROOT is defined in CMake
#define ROOT_FILE(file) (std::string(file).substr(sizeof(PROJECT_ROOT) - 1).c_str())

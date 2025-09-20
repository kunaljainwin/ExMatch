#pragma once
#include <mutex>
#include <functional>
#include "common/std_libs.h"
#include "common/project_defs.h"

#define LOG_INFO(msg) common::Logger::log(msg, ROOT_FILE(__FILE__), __LINE__, __func__)
#define LOG_ERROR(msg) common::Logger::error(msg, ROOT_FILE(__FILE__), __LINE__, __func__)
#define LOG_DEBUG(msg) common::Logger::debug(msg, ROOT_FILE(__FILE__), __LINE__, __func__)
#define LOG_WARN(msg) common::Logger::warn(msg, ROOT_FILE(__FILE__), __LINE__, __func__)

namespace common {
    namespace LogColor {
        constexpr const char* RESET   = "\033[0m";
        constexpr const char* RED     = "\033[31m";  // ERROR
        constexpr const char* GREEN   = "\033[32m";  // INFO
        constexpr const char* YELLOW  = "\033[33m";  // WARNING (optional)
        constexpr const char* BLUE    = "\033[34m";  // DEBUG
    }
class Logger {
public:
    enum class Level { INFO, ERROR, DEBUG, WARN };

    // Enable or disable timestamps
    static void enableTimestamp(bool enable);

    // Enable or disable OTel integration
    static void enableOtel(bool enable);

    // Set custom OTel logging function (optional)
    static void setOtelHandler(std::function<void(Level, const std::string&)> handler);

    // Log functions
    static void log(const std::string &message, const char *file, int line, const char *func);
    static void error(const std::string &message, const char *file, int line, const char *func);
    static void debug(const std::string &message, const char *file, int line, const char *func);
    static void warn(const std::string &message, const char *file, int line, const char *func);


private:
    static std::mutex logMutex;
    static bool timestampEnabled;
    static bool otelEnabled;
    static std::function<void(Level, const std::string&)> otelHandler;

    static void logMessage(Level level, const std::string& message, const char *file, int line, const char *func);
    static std::string currentTimestamp();
};

} // namespace common

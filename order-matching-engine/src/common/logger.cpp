#include "common/logger.h"
#include <chrono>
#include <iomanip>
#include <sstream>

/*TODO
1.
#include <opentelemetry/logs/logger.h>

void otelLogHandler(common::Logger::Level level, const std::string &msg) {
    // Convert your Level to OTel severity
    auto severity = opentelemetry::logs::Severity::kInfo;
    if (level == common::Logger::Level::ERROR) severity = opentelemetry::logs::Severity::kError;
    if (level == common::Logger::Level::DEBUG) severity = opentelemetry::logs::Severity::kDebug;

    // Push log to OTel
    // pseudo-code:
    // otel_logger->Log(severity, msg);
}

CODE
common::Logger::enableOtel(true);
common::Logger::setOtelHandler(otelLogHandler);

2. Optimization for fast log writing using nanolog
3. Timestamp issue
4. Format : date | time| processid| type| message| functionname| linenumber
5. fatal,warn,info1,info3,info3,debug,error
- Optimization possible using lockfree queue
*/
namespace common
{

    std::mutex Logger::logMutex;
    bool Logger::timestampEnabled = false;
    bool Logger::otelEnabled = false;
    std::function<void(Logger::Level, const std::string &)> Logger::otelHandler = nullptr;

    void Logger::enableTimestamp(bool enable)
    {
        timestampEnabled = enable;
    }

    void Logger::enableOtel(bool enable)
    {
        otelEnabled = enable;
    }
    void Logger::log(const std::string &message, const char *file, int line, const char *func)
    {
        logMessage(Level::INFO, message, file, line, func);
    }

    void Logger::error(const std::string &message, const char *file, int line, const char *func)
    {
        logMessage(Level::ERROR, message, file, line, func);
    }

    void Logger::debug(const std::string &message, const char *file, int line, const char *func)
    {
        logMessage(Level::DEBUG, message, file, line, func);
    }
    void Logger::warn(const std::string &message, const char *file, int line, const char *func)
    {
        logMessage(Level::WARN, message, file, line, func);
    }
    void Logger::setOtelHandler(std::function<void(Level, const std::string &)> handler)
    {
        otelHandler = handler;
    }

    void Logger::logMessage(Level level, const std::string &message, const char *file, int line, const char *func)
    {
        std::lock_guard<std::mutex> lock(logMutex);

        std::ostringstream out;
        if (timestampEnabled)
        {
            out << "[" << currentTimestamp() << "] ";
        }
        // Apply colors
        const char *color = LogColor::RESET;
        switch (level)
        {
        case Level::INFO:
            color = LogColor::GREEN;
            break;
        case Level::ERROR:
            color = LogColor::RED;
            break;
        case Level::DEBUG:
            color = LogColor::BLUE;
            break;
        case Level::WARN:
            color = LogColor::YELLOW;
            break;
        }
        out << color;
        switch (level)
        {
        case Level::INFO:
            out << "[INFO]  ";
            break;
        case Level::ERROR:
            out << "[ERROR] ";
            break;
        case Level::DEBUG:
        {
            out << "[DEBUG] ";
        }
        break;
        case Level::WARN:
        {
            out << "[WARN]  ";
        }
        break;
        }

        // For Equal gap 
        std::string str="";
        
        if (file && line != 0 && func)
        {
            str =  "(" + std::string(file) + ":" + std::to_string(line) + " - " + func + ") ";
            
        }
        int n = 40 - str.length();
        if(n>0){
            std::string prefix(n/2,' ');
            std::string suffix(n-n/2,' ');
            out << " | " + prefix << str << suffix + " | " << message << LogColor::RESET;
        }
        else{
            out << " | " << str << " | " << message << LogColor::RESET;
        }
        // Console output
        if (level == Level::ERROR)
        {
            std::cerr << out.str() << std::endl;
        }
        else
        {
            std::cout << out.str() << std::endl;
        }
        out << color;
        // OpenTelemetry output
        if (otelEnabled && otelHandler)
        {
            otelHandler(level, message);
        }
    }
    std::string Logger::currentTimestamp()
    {
        // auto now = std::chrono::system_clock::now();
        // auto in_time_t = std::chrono::system_clock::to_time_t(now);
        // auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        //               now.time_since_epoch()) %
        //           1000;

        std::ostringstream ss;
        // ss << std::put_time(std::localtime(&in_time_t), "%Y-%m-%d %H:%M:%S")
        //    << '.' << std::setfill('0') << std::setw(3) << ms.count();
        return ss.str();
    }

} // namespace common

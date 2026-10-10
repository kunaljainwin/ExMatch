#pragma once

#include <string>
#include <thread>

namespace common {

/**
 * @brief Sets CPU core affinity for the current calling thread.
 * @param coreId Zero-indexed CPU core ID.
 * @return true if successfully pinned; false otherwise.
 */
bool setCurrentThreadAffinity(int coreId) noexcept;

/**
 * @brief Sets CPU core affinity for a specific std::thread instance.
 * @param thread The std::thread to pin.
 * @param coreId Zero-indexed CPU core ID.
 * @return true if successfully pinned; false otherwise.
 */
bool setThreadAffinity(std::thread& thread, int coreId) noexcept;

/**
 * @brief Sets a diagnostic thread name visible in htop, top, and profilers.
 * @param name Thread name (up to 15 characters on Linux).
 * @return true if successfully set; false otherwise.
 */
bool setThreadName(const std::string& name) noexcept;

/**
 * @brief Returns the CPU core index the calling thread is currently executing on.
 * @return Core ID, or -1 if unsupported/failed.
 */
int getCurrentThreadCore() noexcept;

} // namespace common
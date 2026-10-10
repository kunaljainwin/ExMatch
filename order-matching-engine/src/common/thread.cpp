#include "common/thread.h"

#if defined(__linux__)
#include <pthread.h>
#include <sched.h>
#include <cstring>

namespace common {

bool setCurrentThreadAffinity(int coreId) noexcept {
    if (coreId < 0) {
        return false;
    }
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    CPU_SET(coreId, &cpuset);
    return pthread_setaffinity_np(pthread_self(), sizeof(cpu_set_t), &cpuset) == 0;
}

bool setThreadAffinity(std::thread& thread, int coreId) noexcept {
    if (coreId < 0 || !thread.joinable()) {
        return false;
    }
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    CPU_SET(coreId, &cpuset);
    return pthread_setaffinity_np(thread.native_handle(), sizeof(cpu_set_t), &cpuset) == 0;
}

bool setThreadName(const std::string& name) noexcept {
    if (name.empty()) {
        return false;
    }
    char buf[16];
    std::strncpy(buf, name.c_str(), sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';
    return pthread_setname_np(pthread_self(), buf) == 0;
}

int getCurrentThreadCore() noexcept {
    return sched_getcpu();
}

} // namespace common

#elif defined(_WIN32)
#include <windows.h>

namespace common {

bool setCurrentThreadAffinity(int coreId) noexcept {
    if (coreId < 0 || coreId >= 64) {
        return false;
    }
    DWORD_PTR mask = static_cast<DWORD_PTR>(1) << coreId;
    return SetThreadAffinityMask(GetCurrentThread(), mask) != 0;
}

bool setThreadAffinity(std::thread& thread, int coreId) noexcept {
    if (coreId < 0 || coreId >= 64 || !thread.joinable()) {
        return false;
    }
    DWORD_PTR mask = static_cast<DWORD_PTR>(1) << coreId;
    return SetThreadAffinityMask(thread.native_handle(), mask) != 0;
}

bool setThreadName(const std::string& /*name*/) noexcept {
    return false;
}

int getCurrentThreadCore() noexcept {
    return static_cast<int>(GetCurrentProcessorNumber());
}

} // namespace common

#else

namespace common {

bool setCurrentThreadAffinity(int /*coreId*/) noexcept {
    return false;
}

bool setThreadAffinity(std::thread& /*thread*/, int /*coreId*/) noexcept {
    return false;
}

bool setThreadName(const std::string& /*name*/) noexcept {
    return false;
}

int getCurrentThreadCore() noexcept {
    return -1;
}

} // namespace common

#endif

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>
#ifdef _WIN32
#include <windows.h>
#elif defined(__linux__) || defined(__unix__) || defined(__APPLE__)
#include <execinfo.h>
#endif
#include "prx/libc/include/General.hpp"

extern "C" {

int APS5_VABI sceLibcBacktraceGetBufferSize_nid_postfix(int flags, int* maxFrames, std::size_t* size) {
    static_cast<void>(flags);
    int frames = (maxFrames != nullptr && *maxFrames > 0) ? *maxFrames : 64;
    if (maxFrames != nullptr) {
        *maxFrames = frames;
    }
    if (size != nullptr) {
        *size = static_cast<std::size_t>(frames) * sizeof(void*);
    }
    return 0;
}

int APS5_VABI sceLibcBacktraceSelf_nid_postfix(int maxFrames, void* buffer, std::size_t bufferSize, int* outCount) {
    if (buffer == nullptr || bufferSize < sizeof(void*)) {
        if (outCount != nullptr) {
            *outCount = 0;
        }
        return 0;
    }
    std::memset(buffer, 0, bufferSize);
    const std::size_t capacity = bufferSize / sizeof(void*);
    const int wanted = (maxFrames > 0) ? std::min<int>(maxFrames, static_cast<int>(capacity)) : static_cast<int>(capacity);
#ifdef _WIN32
    const auto count = RtlCaptureStackBackTrace(1, static_cast<DWORD>(std::min(wanted, 62)), reinterpret_cast<void**>(buffer), nullptr);
    if (outCount != nullptr) {
        *outCount = static_cast<int>(count);
    }
#elif defined(__linux__) || defined(__unix__) || defined(__APPLE__)
    const int count = ::backtrace(reinterpret_cast<void**>(buffer), wanted);
    if (outCount != nullptr) {
        *outCount = std::max(0, count);
    }
#else
    if (outCount != nullptr) {
        *outCount = 0;
    }
#endif
    return 0;
}

}

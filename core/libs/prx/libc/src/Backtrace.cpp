#include <cstddef>
#include <cstdint>
#include "prx/libc/include/General.hpp"

extern "C" {

int APS5_VABI sceLibcBacktraceGetBufferSize_nid_postfix(int flags, int* maxFrames, std::size_t* size) {
    static_cast<void>(flags);
    if (maxFrames != nullptr) {
        *maxFrames = 0;
    }
    if (size != nullptr) {
        *size = sizeof(void*);
    }
    return 0;
}

int APS5_VABI sceLibcBacktraceSelf_nid_postfix(int maxFrames, void* buffer, std::size_t bufferSize, int* outCount) {
    static_cast<void>(maxFrames);
    static_cast<void>(buffer);
    static_cast<void>(bufferSize);
    if (outCount != nullptr) {
        *outCount = 0;
    }
    return 0;
}

}

#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include "SceTypes.hpp"
#include "prx/libc/include/General.hpp"
#include "../include/Pthread.hpp"

namespace {

constexpr int ThrdSuccess = 0;
constexpr int ThrdNomem = 1;
constexpr int ThrdTimedout = 2;
constexpr int ThrdBusy = 3;
constexpr int ThrdError = 4;

constexpr int CppDeviceOrResourceBusy = 0;
constexpr int CppInvalidArgument = 1;
constexpr int CppResourceUnavailableTryAgain = 6;

constexpr int MtxPlain = 0x1;

struct GuestPad {
    unsigned (APS5_VABI* const* vtable)(GuestPad*);
    void* condition;
    void* mutex;
    bool started;
};
static_assert(offsetof(GuestPad, condition) == 0x8 && offsetof(GuestPad, mutex) == 0x10 && offsetof(GuestPad, started) == 0x18 && sizeof(GuestPad) == 0x20);

}

extern "C" {
int APS5_VABI scePthreadCreate(Pthread* thread, const PthreadAttr* attr, PthreadEntry entry, void* arg, const char* name);
int APS5_VABI scePthreadJoin(Pthread thread, void** retval);
int APS5_VABI scePthreadDetach(Pthread thread);
Pthread APS5_VABI scePthreadSelf();

int APS5_VABI _Mtx_init_nid_postfix(void** handle, int type);
void APS5_VABI _Mtx_destroy_nid_postfix(void** handle);
int APS5_VABI _Mtx_lock_nid_postfix(void** handle);
int APS5_VABI _Mtx_unlock_nid_postfix(void** handle);

int APS5_VABI _Cnd_init_nid_postfix(void** handle);
void APS5_VABI _Cnd_destroy_nid_postfix(void** handle);
int APS5_VABI _Cnd_wait_nid_postfix(void** condition, void** mutex);
int APS5_VABI _Cnd_signal_nid_postfix(void** handle);

[[noreturn]] void ThrowCppError_nid_no_patch(int code);
}

namespace {

void RequireThrd(int result, const char* what) {
    switch (result) {
    case ThrdSuccess:
        return;
    case ThrdNomem:
    case ThrdTimedout:
        ThrowCppError_nid_no_patch(CppResourceUnavailableTryAgain);
    case ThrdBusy:
        ThrowCppError_nid_no_patch(CppDeviceOrResourceBusy);
    case ThrdError:
        ThrowCppError_nid_no_patch(CppInvalidArgument);
    }
    throw std::runtime_error(std::string(what) + " failed with " + std::to_string(result));
}

void* APS5_VABI PadEntry_nid_no_patch(void* argument) {
    auto* pad = static_cast<GuestPad*>(argument);
    const auto go = pad->vtable[0];
    return reinterpret_cast<void*>(static_cast<std::uintptr_t>(go(pad)));
}

}

extern "C" {

int APS5_VABI _Thrd_detach_nid_postfix(Pthread thread) {
    return scePthreadDetach(thread) == 0 ? ThrdSuccess : ThrdError;
}

int APS5_VABI _Thrd_join_nid_postfix(Pthread thread, int* result) {
    void* value = nullptr;
    if (scePthreadJoin(thread, &value) != 0) return ThrdError;
    if (result) *result = static_cast<int>(reinterpret_cast<std::intptr_t>(value));
    return ThrdSuccess;
}

Pthread APS5_VABI _Thrd_id_nid_postfix() {
    return scePthreadSelf();
}

void APS5_VABI _ZNSt4_PadC2Ev_nid_postfix(GuestPad* pad) {
    if (!pad) APS5_INVALID_ARG_EX;
    RequireThrd(_Cnd_init_nid_postfix(&pad->condition), "_Pad::_Pad: _Cnd_init");
    const int created = _Mtx_init_nid_postfix(&pad->mutex, MtxPlain);
    if (created != ThrdSuccess) {
        _Cnd_destroy_nid_postfix(&pad->condition);
        RequireThrd(created, "_Pad::_Pad: _Mtx_init");
    }
    pad->started = false;
    const int locked = _Mtx_lock_nid_postfix(&pad->mutex);
    if (locked != ThrdSuccess) {
        _Mtx_destroy_nid_postfix(&pad->mutex);
        _Cnd_destroy_nid_postfix(&pad->condition);
        RequireThrd(locked, "_Pad::_Pad: _Mtx_lock");
    }
}

void APS5_VABI _ZNSt4_PadD2Ev_nid_postfix(GuestPad* pad) {
    if (!pad) APS5_INVALID_ARG_EX;
    RequireThrd(_Mtx_unlock_nid_postfix(&pad->mutex), "_Pad::~_Pad: _Mtx_unlock");
    _Mtx_destroy_nid_postfix(&pad->mutex);
    _Cnd_destroy_nid_postfix(&pad->condition);
}

void APS5_VABI _ZNSt4_Pad7_LaunchEPP7pthread_nid_postfix(GuestPad* pad, Pthread* thread) {
    if (!pad || !thread) APS5_INVALID_ARG_EX;
    const int created = scePthreadCreate(thread, nullptr, PadEntry_nid_no_patch, pad, nullptr);
    if (created != 0) ThrowCppError_nid_no_patch(CppResourceUnavailableTryAgain);
    while (!pad->started) RequireThrd(_Cnd_wait_nid_postfix(&pad->condition, &pad->mutex), "_Pad::_Launch: _Cnd_wait");
}

void APS5_VABI _ZNSt4_Pad8_ReleaseEv_nid_postfix(GuestPad* pad) {
    if (!pad) APS5_INVALID_ARG_EX;
    RequireThrd(_Mtx_lock_nid_postfix(&pad->mutex), "_Pad::_Release: _Mtx_lock");
    pad->started = true;
    RequireThrd(_Cnd_signal_nid_postfix(&pad->condition), "_Pad::_Release: _Cnd_signal");
    RequireThrd(_Mtx_unlock_nid_postfix(&pad->mutex), "_Pad::_Release: _Mtx_unlock");
}

}

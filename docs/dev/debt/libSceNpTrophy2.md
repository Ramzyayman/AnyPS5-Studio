# libSceNpTrophy2 technical debt

### Silent stubs

- [libSceNpTrophy2](../../../core/libs/prx/libSceNpTrophy2/src/GameInfo.cpp): `sceNpTrophy2RegisterUnlockCallback` accepts a callback that is never called, as no trophy is ever unlocked, `sceNpTrophy2UnregisterUnlockCallback` only returns success, and `sceNpTrophy2ShowTrophyList` returns success without showing a list (there is no system trophy UI; seen on PPSA15552).

### Unknown function info

- [sceNpTrophy2GetRewardIcon](../../../core/libs/prx/libSceNpTrophy2/src/Context.cpp) (libSceNpTrophy2) takes `(int context, int handle, int reward_id, void* buffer, size_t* size)`, from the call sites in the bundled `Media/Plugins/PSNCore.prx` of PPSA06888, the same shape as `sceNpTrophy2GetTrophyIcon`. The title calls it twice: first with a null buffer to read the size, then with a buffer of that size allocated with `malloc`. The meaning of the third argument is unverified, and the reward icon data is unknown, so every call throws

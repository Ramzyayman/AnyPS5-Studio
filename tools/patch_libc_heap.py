import pefile
import struct
import os

src_path = 'libs/libc.prx'
test_path = 'libs/libc.test_heap.prx'

pe = pefile.PE(src_path)
with open(src_path, 'rb') as f:
    b = bytearray(f.read())

# 1. In ApplicationProcessParameters (0x37630):
# Change `0f 84 be bf 06 00` at 0x37630 + 0xed to 6 NOPs
# So it returns 0 (NULL) cleanly when .procpar is not found
p_rva = 0x37630 + 0xed
p_off = pe.get_offset_from_rva(p_rva)
assert b[p_off:p_off+6] == b'\x0f\x84\xbe\xbf\x06\x00'
b[p_off:p_off+6] = b'\x90' * 6
print("1. NOPed throw in ApplicationProcessParameters")

# 2. Add executable code section .initcode
sec_align = pe.OPTIONAL_HEADER.SectionAlignment
file_align = pe.OPTIONAL_HEADER.FileAlignment
last_sec = pe.sections[-1]
new_sec_rva = (last_sec.VirtualAddress + last_sec.Misc_VirtualSize + sec_align - 1) // sec_align * sec_align
new_sec_file_offset = (len(b) + file_align - 1) // file_align * file_align

if len(b) < new_sec_file_offset:
    b.extend(b'\x00' * (new_sec_file_offset - len(b)))

helper_rva = new_sec_rva
print(f"2. New code section at RVA {hex(helper_rva)}")

code = bytearray()

# --- PART A: ApplicationHeapInitialize hook ---
# At 0x36950 (ApplicationHeapInitialize):
# We replace first 7 bytes with: jmp app_heap_init_hook
# app_heap_init_hook:
#   test rcx, rcx
#   jnz .normal_init
#   ; rcx is 0: register defaultApi
#   sub rsp, 0x78
#   xor eax, eax
#   mov [rsp+28h], rax
#   mov [rsp+30h], rax
#   mov [rsp+38h], rax
#   mov [rsp+40h], rax
#   mov [rsp+48h], rax
#   mov [rsp+50h], rax
#   mov [rsp+58h], rax
#   mov [rsp+60h], rax
#   mov [rsp+68h], rax
#   mov [rsp+70h], rax
#   lea rcx, [rsp+28h]
#   call ApplicationHeapRegister_nid_no_patch (0x364d0)
#   add rsp, 0x78
#   ret
# .normal_init:
#   push rdi
#   push rsi
#   push rbx
#   sub rsp, 30h
#   jmp 0x36957 (continue normal ApplicationHeapInitialize)

app_heap_init_hook_offset = len(code)
# test rcx, rcx -> 48 85 c9
code.extend(b'\x48\x85\xc9')
# jnz .normal_init
jnz_norm_pos = len(code)
code.extend(b'\x75\x00')

# rcx is 0:
code.extend(b'\x48\x83\xec\x78')
code.extend(b'\x31\xc0')
for off in range(0x28, 0x78, 8):
    code.extend(b'\x48\x89\x44\x24' + bytes([off]))
code.extend(b'\x48\x8d\x4c\x24\x28')
# call 0x364d0
curr = helper_rva + len(code)
code.extend(b'\xe8' + struct.pack('<i', 0x364d0 - (curr + 5)))
code.extend(b'\x48\x83\xc4\x78')
code.extend(b'\xc3')

# .normal_init:
code[jnz_norm_pos + 1] = len(code) - (jnz_norm_pos + 2)
# push rdi, push rsi, push rbx, sub rsp, 30h
code.extend(b'\x57\x56\x53\x48\x83\xec\x30')
# jmp 0x36957
curr = helper_rva + len(code)
code.extend(b'\xe9' + struct.pack('<i', 0x36957 - (curr + 5)))

# --- PART B: lazy_init_helper for callback ---
lazy_helper_offset = len(code)
lazy_helper_rva = helper_rva + lazy_helper_offset

# Helper entry:
# push rdi, rsi, rdx, rcx, r8, r9
code.extend(b'\x57\x56\x52\x51\x41\x50\x41\x51')
# sub rsp, 0x28
code.extend(b'\x48\x83\xec\x28')

# lea rax, [rip + heapApi]
def emit_lea_rax_heapApi():
    curr = helper_rva + len(code)
    disp = 0x106ce0 - (curr + 7)
    return b'\x48\x8d\x05' + struct.pack('<i', disp)

code.extend(emit_lea_rax_heapApi())
# cmp qword ptr [rax], 0
code.extend(b'\x48\x83\x38\x00')
# jne .read_slot
jne_read_slot_pos = len(code)
code.extend(b'\x0f\x85\x00\x00\x00\x00')

# lea rcx, [rip + heapMutex]
def emit_lea_rcx_mutex():
    curr = helper_rva + len(code)
    disp = 0x106d30 - (curr + 7)
    return b'\x48\x8d\x0d' + struct.pack('<i', disp)

code.extend(emit_lea_rcx_mutex())
# call pthread_mutex_unlock (0x7cce8)
curr = helper_rva + len(code)
code.extend(b'\xe8' + struct.pack('<i', 0x7cce8 - (curr + 5)))

# call _init_env_nid_postfix (0x46360)
curr = helper_rva + len(code)
code.extend(b'\xe8' + struct.pack('<i', 0x46360 - (curr + 5)))

# lea rcx, [rip + heapMutex]
code.extend(emit_lea_rcx_mutex())
# call pthread_mutex_lock (0x7ccf8)
curr = helper_rva + len(code)
code.extend(b'\xe8' + struct.pack('<i', 0x7ccf8 - (curr + 5)))

# lea rax, [rip + heapApi]
code.extend(emit_lea_rax_heapApi())
# cmp qword ptr [rax], 0
code.extend(b'\x48\x83\x38\x00')
# jne .read_slot
jne_read_slot2_pos = len(code)
code.extend(b'\x0f\x85\x00\x00\x00\x00')

# If still 0, register defaultApi:
code.extend(b'\x48\x83\xec\x60')
code.extend(b'\x31\xc0')
for off in range(0, 80, 8):
    code.extend(b'\x48\x89\x44\x24' + bytes([off]))
code.extend(b'\x48\x8d\x0c\x24')
curr = helper_rva + len(code)
code.extend(b'\xe8' + struct.pack('<i', 0x364d0 - (curr + 5)))
code.extend(b'\x48\x83\xc4\x60')

# .read_slot:
read_slot_target = len(code)
disp1 = read_slot_target - (jne_read_slot_pos + 6)
struct.pack_into('<i', code, jne_read_slot_pos + 2, disp1)
disp2 = read_slot_target - (jne_read_slot2_pos + 6)
struct.pack_into('<i', code, jne_read_slot2_pos + 2, disp2)

# lea rax, [rip + heapApi]
code.extend(emit_lea_rax_heapApi())
# mov rbx, [rax + rbx*8] (heapApi[index])
code.extend(b'\x48\x8b\x1c\xd8')
# test rbx, rbx
code.extend(b'\x48\x85\xdb')
# jnz .finish
jnz_finish_pos = len(code)
code.extend(b'\x75\x00')

# If still 0 (fallback to defaultAllocate):
curr = helper_rva + len(code)
disp_def = 0x36180 - (curr + 7)
code.extend(b'\x48\x8d\x1d' + struct.pack('<i', disp_def))

# .finish:
finish_target = len(code)
code[jnz_finish_pos + 1] = finish_target - (jnz_finish_pos + 2)

code.extend(b'\x48\x83\xc4\x28')
code.extend(b'\x41\x59\x41\x58\x59\x5a\x5e\x5f')
code.extend(b'\xc3')

# Pad code section to file_align
sec_raw_size = (len(code) + file_align - 1) // file_align * file_align
sec_data = bytearray(sec_raw_size)
sec_data[:len(code)] = code

# 3. Patch ApplicationHeapInitialize at 0x36950 with jmp to app_heap_init_hook
init_patch_off = pe.get_offset_from_rva(0x36950)
assert b[init_patch_off:init_patch_off+7] == b'\x57\x56\x53\x48\x83\xec\x30'
init_jmp = b'\xe9' + struct.pack('<i', (helper_rva + app_heap_init_hook_offset) - (0x36950 + 5))
init_patch = init_jmp + b'\x90\x90'
b[init_patch_off:init_patch_off+7] = init_patch
print("3. Patched ApplicationHeapInitialize at 0x36950")

# 4. Patch callback at 0x36355 to call lazy_helper_rva
cb_patch_rva = 0x36355
cb_patch_off = pe.get_offset_from_rva(cb_patch_rva)
assert b[cb_patch_off:cb_patch_off+7] == b'\x48\x8d\x05\x84\x09\x0d\x00', "Mismatch at callback 0x36355"

cb_call = b'\xe8' + struct.pack('<i', lazy_helper_rva - (cb_patch_rva + 5))
cb_patch = cb_call + b'\x90' * (20 - len(cb_call))
b[cb_patch_off:cb_patch_off+20] = cb_patch
print("4. Patched callback at 0x36355 with call to lazy_helper")

# Append code section to b
b.extend(sec_data)

# Update PE headers
pe_header_offset = struct.unpack_from('<I', b, 0x3C)[0]
coff_offset = pe_header_offset + 4
num_sections = struct.unpack_from('<H', b, coff_offset + 2)[0]
struct.pack_into('<H', b, coff_offset + 2, num_sections + 1)

size_of_optional_header = struct.unpack_from('<H', b, coff_offset + 16)[0]
optional_header_offset = coff_offset + 20

new_size_of_image = (new_sec_rva + len(code) + sec_align - 1) // sec_align * sec_align
struct.pack_into('<I', b, optional_header_offset + 56, new_size_of_image)

section_table_offset = optional_header_offset + size_of_optional_header
new_sec_hdr_offset = section_table_offset + num_sections * 40

sec_header = struct.pack(
    '<8sIIIIIIHHI',
    b'.initcod\x00',
    len(code),
    new_sec_rva,
    sec_raw_size,
    new_sec_file_offset,
    0, 0, 0, 0,
    0x60000020  # IMAGE_SCN_MEM_EXECUTE | IMAGE_SCN_MEM_READ | IMAGE_SCN_CNT_CODE
)
b[new_sec_hdr_offset:new_sec_hdr_offset+40] = sec_header
pe.close()

with open(test_path, 'wb') as f:
    f.write(b)

print(f"Successfully created test library {test_path}!")

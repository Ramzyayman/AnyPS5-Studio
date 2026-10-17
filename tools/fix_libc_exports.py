import pefile
import struct
import os

target_path = 'libs/libc.prx'
temp_path = 'libs/libc.fixed.prx'

pe = pefile.PE(target_path)

# Extract all 1201 original exports directly from the original .edata section at 0x10a000
orig_edata_rva = 0x10a000
data = pe.get_data(orig_edata_rva, 40)
chars, timestamp, major, minor, name_rva, base, num_funcs, num_names, funcs_rva, names_rva, ords_rva = struct.unpack('<IIHHIIIIIII', data)

orig_exports = {}
for i in range(num_names):
    nrva = struct.unpack('<I', pe.get_data(names_rva + i * 4, 4))[0]
    name = pe.get_string_at_rva(nrva).decode('ascii', errors='ignore')
    ord_val = struct.unpack('<H', pe.get_data(ords_rva + i * 2, 2))[0]
    func_rva = struct.unpack('<I', pe.get_data(funcs_rva + ord_val * 4, 4))[0]
    orig_exports[name] = func_rva

print(f"Extracted {len(orig_exports)} original exports from .edata")

# New symbols required for Silksong
new_symbols = {
    'h+J60RRlfnk': 81024,   # nextafter -> nextafterf RVA (0x13c80)
    '3yxLpdKD0RA': 124240,  # _ZnwmSt11align_val_t -> _Znwm RVA (0x1e550)
    'kn-rKRB0pfY': 124240,  # _ZnamSt11align_val_t -> _Znwm RVA
    'iQXBbJbfT5k': 124240,  # _ZnwmSt11align_val_tRKSt9nothrow_t -> _Znwm RVA
    's2eGsgUF9vk': 124240,  # _ZnamSt11align_val_tRKSt9nothrow_t -> _Znwm RVA
    'v09ZcAhZzSc': 124624,  # _ZdaPvSt11align_val_t -> _ZdlPvSt11align_val_t RVA (0x1e6d0)
    'Y1RR+IQy6Pg': 124624,  # _ZdaPvmSt11align_val_t
    'dH3ucvQhfSY': 124624,  # _ZdaPvSt11align_val_tRKSt9nothrow_t
    'Dt9kllUFXS0': 124624,  # _ZdlPvSt11align_val_tRKSt9nothrow_t
    'R0-hvihVoy0': 81024,   # nextafterl
    '-Q6FYBO4sn0': 81024,   # nexttoward
    'QaTrhMKUT18': 81024,   # nexttowardf
    'ryyn6-WJm6U': 81024,   # nexttowardl
}

export_dict = dict(orig_exports)
export_dict.update(new_symbols)

# PE specification requires export names to be sorted in ASCII lexicographical order for binary search
sorted_names = sorted(export_dict.keys())
num_exports = len(sorted_names)
print(f"Total exports to build in new export directory: {num_exports}")

sec_align = pe.OPTIONAL_HEADER.SectionAlignment
file_align = pe.OPTIONAL_HEADER.FileAlignment

# We will overwrite the .edata2 section cleanly
edata2_sec = None
for sec in pe.sections:
    if sec.Name.decode().strip('\x00') == '.edata2':
        edata2_sec = sec
        break

if not edata2_sec:
    raise RuntimeError("Could not find .edata2 section in libc.prx")

new_sec_rva = edata2_sec.VirtualAddress
new_sec_file_offset = edata2_sec.PointerToRawData
pe.close()

# Prepare variable-length strings table
# Layout in section:
# 1. Export Directory Table (40 bytes)
# 2. Export Address Table (num_exports * 4 bytes)
# 3. Export Name Pointer Table (num_exports * 4 bytes)
# 4. Ordinal Table (num_exports * 2 bytes)
# 5. DLL Name string ("libc.prx\0")
# 6. Strings buffer (variable length: each name + '\0')

exp_dir_size = 40
funcs_table_offset = exp_dir_size
names_table_offset = funcs_table_offset + num_exports * 4
ordinals_table_offset = names_table_offset + num_exports * 4
dll_name_offset = ordinals_table_offset + num_exports * 2
strings_start_offset = dll_name_offset + len(b"libc.prx\x00")

# Compute total strings size
strings_bytes = bytearray()
name_relative_offsets = []
for name in sorted_names:
    name_relative_offsets.append(len(strings_bytes))
    strings_bytes.extend(name.encode('ascii') + b'\x00')

total_unpadded_size = strings_start_offset + len(strings_bytes)
new_sec_virtual_size = total_unpadded_size
new_sec_raw_size = (new_sec_virtual_size + file_align - 1) // file_align * file_align

print(f"New section virtual size: {new_sec_virtual_size}, raw size: {new_sec_raw_size}")

sec_data = bytearray(new_sec_raw_size)

# 1. Functions table
for i, name in enumerate(sorted_names):
    rva = export_dict[name]
    struct.pack_into('<I', sec_data, funcs_table_offset + i * 4, rva)

# 2. Names pointer table and Ordinals table
for i, name in enumerate(sorted_names):
    str_offset = strings_start_offset + name_relative_offsets[i]
    name_rva = new_sec_rva + str_offset
    struct.pack_into('<I', sec_data, names_table_offset + i * 4, name_rva)
    struct.pack_into('<H', sec_data, ordinals_table_offset + i * 2, i)

# 3. DLL name
sec_data[dll_name_offset:dll_name_offset + len(b"libc.prx\x00")] = b"libc.prx\x00"
dll_name_rva = new_sec_rva + dll_name_offset

# 4. Export directory table (40 bytes)
struct.pack_into(
    '<IIHHIIIIIII',
    sec_data, 0,
    0,                          # Characteristics
    timestamp,                  # TimeDateStamp
    0, 0,                       # Major/Minor Version
    dll_name_rva,               # Name RVA
    1,                          # Base ordinal
    num_exports,                # Number of Functions
    num_exports,                # Number of Names
    new_sec_rva + funcs_table_offset,     # AddressOfFunctions
    new_sec_rva + names_table_offset,     # AddressOfNames
    new_sec_rva + ordinals_table_offset   # AddressOfNameOrdinals
)

# 5. Strings buffer
sec_data[strings_start_offset:strings_start_offset + len(strings_bytes)] = strings_bytes

# Read entire original file up to edata2_sec.PointerToRawData
with open(target_path, 'rb') as f:
    full_bytes = bytearray(f.read())

# Overwrite edata2 section data in full_bytes
full_bytes[new_sec_file_offset:new_sec_file_offset + len(sec_data)] = sec_data
if len(full_bytes) < new_sec_file_offset + len(sec_data):
    full_bytes.extend(sec_data[len(full_bytes) - new_sec_file_offset:])
elif len(full_bytes) > new_sec_file_offset + len(sec_data):
    full_bytes = full_bytes[:new_sec_file_offset + len(sec_data)]

# Update PE headers
pe_header_offset = struct.unpack_from('<I', full_bytes, 0x3C)[0]
coff_offset = pe_header_offset + 4
num_sections = struct.unpack_from('<H', full_bytes, coff_offset + 2)[0]
size_of_optional_header = struct.unpack_from('<H', full_bytes, coff_offset + 16)[0]
optional_header_offset = coff_offset + 20

# Optional header:
# SizeOfImage at optional_header_offset + 56
new_size_of_image = (new_sec_rva + new_sec_virtual_size + sec_align - 1) // sec_align * sec_align
struct.pack_into('<I', full_bytes, optional_header_offset + 56, new_size_of_image)

# Export Data Directory (Directory 0) at optional_header_offset + 112
struct.pack_into('<II', full_bytes, optional_header_offset + 112, new_sec_rva, new_sec_virtual_size)

# Update .edata2 section header (the last section header)
section_table_offset = optional_header_offset + size_of_optional_header
edata2_header_offset = section_table_offset + (num_sections - 1) * 40

sec_header = struct.pack(
    '<8sIIIIIIHHI',
    b'.edata2\x00',
    new_sec_virtual_size,
    new_sec_rva,
    new_sec_raw_size,
    new_sec_file_offset,
    0, 0, 0, 0,
    0x40000040  # IMAGE_SCN_MEM_READ | IMAGE_SCN_CNT_INITIALIZED_DATA
)
full_bytes[edata2_header_offset:edata2_header_offset + 40] = sec_header

with open(temp_path, 'wb') as f:
    f.write(full_bytes)

os.replace(temp_path, target_path)
print(f"Successfully fixed libc.prx! Size: {len(full_bytes)}")

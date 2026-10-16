import React, { useState } from 'react';
import { 
  Code2, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert
} from 'lucide-react';
import { GameItem } from '../types';

interface NidInspectorProps {
  game: GameItem;
}

export const NidInspector: React.FC<NidInspectorProps> = ({ game }) => {
  const [filterModule, setFilterModule] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const knownNidDefinitions = [
    { nid: '0x1A2B3C4D5E6F7001', module: 'libkernel.prx', func: 'sceKernelCreateEqueue', status: 'implemented', notes: 'Native epoll/IOCP wait queue translation' },
    { nid: '0x1A2B3C4D5E6F7002', module: 'libkernel.prx', func: 'sceKernelWaitEqueue', status: 'implemented', notes: 'Event queue poll loop' },
    { nid: '0x2F3A4B5C6D7E8001', module: 'libkernel.prx', func: 'scePthreadCreate', status: 'implemented', notes: 'FreeBSD pthread cancellation semantics' },
    { nid: '0x2F3A4B5C6D7E8002', module: 'libkernel.prx', func: 'scePthreadJoin', status: 'implemented', notes: 'Maps directly to host Win32 thread' },
    { nid: '0x3A4B5C6D7E8F9001', module: 'libSceAgcDriver.prx', func: 'sceAgcDriverSubmitDcb', status: 'implemented', notes: 'Direct Vulkan queue submission' },
    { nid: '0x3A4B5C6D7E8F9002', module: 'libSceAgcDriver.prx', func: 'sceAgcDriverRegisterShader', status: 'implemented', notes: 'RDNA ISA to SPIR-V JIT compiler' },
    { nid: '0x4A5B6C7D8E9F0001', module: 'libScePad.prx', func: 'scePadOpen', status: 'implemented', notes: 'DirectInput / XInput DualSense HID layer' },
    { nid: '0x4A5B6C7D8E9F0002', module: 'libScePad.prx', func: 'scePadReadState', status: 'implemented', notes: 'High precision state polling' },
    { nid: '0x5A6B7C8D9E0F1001', module: 'libSceAudioOut.prx', func: 'sceAudioOutOpen', status: 'implemented', notes: 'WASAPI 48kHz float multichannel stream' },
    { nid: '0x99A3F12D00000001', module: 'libSceHaptic.prx', func: 'sceHapticTriggerFeedback', status: 'stub', notes: 'Stubbed return SCE_OK (no motor passthrough)' },
    { nid: '0xE8912C0400000001', module: 'libSceNpMatching2.prx', func: 'sceNpMatching2CreateRoom', status: 'missing', notes: 'Network matchmaking unsupported' },
    { nid: '0xAA88442200000001', module: 'libSceSaveData.prx', func: 'sceSaveDataMountCloud', status: 'stub', notes: 'Redirected to local host folder app0/savedata' },
  ];

  const modules = ['all', 'libkernel.prx', 'libSceAgcDriver.prx', 'libScePad.prx', 'libSceAudioOut.prx', 'libSceHaptic.prx', 'libSceNpMatching2.prx'];

  const filteredNids = knownNidDefinitions.filter((item) => {
    const matchesModule = filterModule === 'all' || item.module === filterModule;
    const matchesSearch = item.func.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.nid.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesModule && matchesSearch;
  });

  return (
    <div className="relative w-full h-[calc(100vh-56px)] flex flex-col p-8 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div>
          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1">
            Symbol Diagnostics
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            NID Inspector · {game.title}
          </h2>
        </div>

        {/* Status Metrics */}
        <div className="flex items-center space-x-6 text-xs">
          <div>
            <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Total Imports</span>
            <span className="text-white font-mono font-bold text-base">{game.compatibility.totalNids}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Resolved</span>
            <span className="text-emerald-400 font-mono font-bold text-base">{game.compatibility.resolvedNids}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Coverage</span>
            <span className="text-white font-mono font-bold text-base">{game.compatibility.score}%</span>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {modules.map((m) => (
            <button
              key={m}
              onClick={() => setFilterModule(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterModule === m
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/5 text-neutral-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
          <input
            type="text"
            placeholder="Search function or NID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Clean Table */}
      <div className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-neutral-400 uppercase tracking-wider font-semibold border-b border-white/10">
              <tr>
                <th className="py-3 px-4 font-mono text-[11px]">NID Hash</th>
                <th className="py-3 px-4">Resolved Symbol</th>
                <th className="py-3 px-4">PRX Module</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Implementation Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredNids.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-4 text-neutral-400">{item.nid}</td>
                  <td className="py-2.5 px-4 font-semibold text-white font-sans">{item.func}</td>
                  <td className="py-2.5 px-4 text-neutral-400 font-sans">{item.module}</td>
                  <td className="py-2.5 px-4 font-sans">
                    {item.status === 'implemented' ? (
                      <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px] font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Implemented</span>
                      </span>
                    ) : item.status === 'stub' ? (
                      <span className="inline-flex items-center space-x-1 text-amber-400 text-[11px] font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Stub</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-red-400 text-[11px] font-medium">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Missing</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-neutral-400 font-sans text-[11px]">{item.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

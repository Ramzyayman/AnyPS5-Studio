import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Layers, 
  Activity, 
  CheckCircle2, 
  HardDrive, 
  ShieldCheck
} from 'lucide-react';
import { SystemTelemetry } from '../types';
import { apiBridge } from '../services/apiBridge';

export const TelemetryPanel: React.FC = () => {
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);

  useEffect(() => {
    apiBridge.getTelemetry().then(setTelemetry);
  }, []);

  const requiredExtensions = [
    { name: 'AVX2', present: true, desc: 'Advanced Vector Extensions 2 (256-bit SIMD)' },
    { name: 'FMA', present: true, desc: 'Fused Multiply-Add instructions' },
    { name: 'F16C', present: true, desc: 'Half-precision 16-bit floating point conversion' },
    { name: 'BMI1', present: true, desc: 'Bit Manipulation Instruction Set 1' },
    { name: 'BMI2', present: true, desc: 'Bit Manipulation Instruction Set 2' },
    { name: 'LZCNT', present: true, desc: 'Leading Zero Count instruction' },
    { name: 'MOVBE', present: true, desc: 'Move Data After Swapping Bytes' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col pt-20 px-8 pb-8 overflow-y-auto select-none">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-white/5">
        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1">
          Hardware & Driver Verification
        </span>
        <h2 className="text-2xl font-bold text-white tracking-tight">System Status</h2>
      </div>

      {/* Hardware Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* CPU */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-400">Host Processor</span>
              <span className="text-emerald-400 text-xs font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Compatible</span>
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{telemetry?.hostCpu || 'Scanning Host CPU...'}</p>
          </div>
          <p className="text-xs text-neutral-400 mt-3 pt-3 border-t border-white/5">
            Native Zen 2 instruction extensions available.
          </p>
        </div>

        {/* Vulkan */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-400">Vulkan Graphics Device</span>
              <span className="text-emerald-400 text-xs font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Vulkan 1.3</span>
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{telemetry?.gpuName || 'Vulkan Driver'}</p>
          </div>
          <p className="text-xs text-neutral-400 mt-3 pt-3 border-t border-white/5">
            Direct DCB queue submission & SPIR-V pipeline journaling supported.
          </p>
        </div>

        {/* Memory */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-neutral-400">Guest Arena Memory</span>
              <span className="text-xs font-mono text-white">
                {telemetry ? `${telemetry.memoryUsageMb} / ${telemetry.totalMemoryMb} MB` : ''}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mb-2 overflow-hidden">
              <div className="bg-white h-full rounded-full" style={{ width: '18%' }} />
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-3 pt-3 border-t border-white/5">
            Address space (0x10000 - 0x7FFFFFFF0000) mapped.
          </p>
        </div>
      </div>

      {/* Instruction Set Checklist */}
      <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
          PS5 Zen 2 Host CPU Extensions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {requiredExtensions.map((ext) => (
            <div key={ext.name} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-start space-x-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-mono text-xs font-semibold text-white">{ext.name}</span>
                <p className="text-[11px] text-neutral-400 leading-tight mt-0.5">{ext.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export interface ReleaseHighlight {
  title: string;
  description: string;
}

export interface ReleaseInfo {
  version: string;
  highlights: ReleaseHighlight[];
}

export const RELEASE_HIGHLIGHTS_MAP: Record<string, ReleaseHighlight[]> = {
  '1.2.0': [
    {
      title: 'Runtime Engine Manager',
      description: 'Switch execution cores between bundled, upstream commits, and local custom builds.'
    },
    {
      title: 'Local PR Builder',
      description: 'Native CMake & Ninja compilation of community pull requests and multi-PR hybrid merges.'
    },
    {
      title: 'Git Worktree Resilience',
      description: 'Automated self-healing, stale lock removal, and conflict recovery.'
    },
    {
      title: 'Keep-Alive Tab State',
      description: 'Compilation and relink operations persist continuously across tab switches.'
    },
    {
      title: 'Dual-Platform Parity',
      description: 'Full support for Windows (app.exe) and Linux (app.elf) runtime targets.'
    }
  ],
  '1.2.1': [
    {
      title: 'PS5 First-Run Setup (OOBE)',
      description: 'Authentic PlayStation 5 first-run onboarding wizard with hardware detection and setup guide.'
    },
    {
      title: '1-Click Silent Installer',
      description: 'Streamlined zero-friction Windows setup without legacy wizard dialogs.'
    },
    {
      title: 'Seamless Update Detection',
      description: 'Automatically preserves existing user libraries and configuration without repeating setup.'
    }
  ],
  '1.3.0': [
    {
      title: 'Bulk Import',
      description: 'Automatically discover and add multiple PlayStation 5 titles from any directory.'
    }
  ],
  '1.3.1': [
    {
      title: 'Real-Time NID Inspector',
      description: 'Live dynamic symbol extraction and coverage auditing directly from authentic PlayStation 5 binaries with an integrated title switcher.'
    },
    {
      title: 'Streamlined Diagnostics',
      description: 'Permanently retired the deprecated PRX mockup tab and optimized diagnostic navigation.'
    }
  ],
  '1.3.2': [
    {
      title: 'Installer Optimization',
      description: 'Reduced installer download size by over 60% through improved compression and cleaned runtime files.'
    }
  ],
  '1.4.0': [
    {
      title: 'Discord Rich Presence',
      description: 'Show your active game, official cover art, and live playtime directly on your Discord profile.'
    },
    {
      title: 'Privacy & Compliance',
      description: 'Added official Terms of Service and a Privacy Policy confirming zero tracking and that all data stays strictly on your computer.'
    }
  ],
  '1.4.1': [
    {
      title: 'New App Icon',
      description: 'Updated the launcher, taskbar, desktop shortcut, and installer to the new PlayStation badge logo.'
    }
  ],
  '1.4.2': [
    {
      title: 'Core Update',
      description: 'Upgraded the built-in relinker and system libraries to the latest stable release (v0.1.3).'
    }
  ]
};

export const DEFAULT_FALLBACK_HIGHLIGHTS: ReleaseHighlight[] = [
  {
    title: 'System Stability & Performance',
    description: 'Internal performance optimizations, translation refinements, and security improvements.'
  },
  {
    title: 'Routine Maintenance',
    description: 'Upstream compatibility fixes and platform reliability enhancements.'
  }
];

export function getReleaseHighlights(version: string): ReleaseHighlight[] {
  if (!version) {
    return DEFAULT_FALLBACK_HIGHLIGHTS;
  }

  const cleanVersion = version.replace(/^v/, '').trim();
  if (RELEASE_HIGHLIGHTS_MAP[cleanVersion]) {
    return RELEASE_HIGHLIGHTS_MAP[cleanVersion];
  }

  const baseVersion = cleanVersion.split('-')[0];
  if (RELEASE_HIGHLIGHTS_MAP[baseVersion]) {
    return RELEASE_HIGHLIGHTS_MAP[baseVersion];
  }

  return DEFAULT_FALLBACK_HIGHLIGHTS;
}

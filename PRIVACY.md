# Privacy Policy

Last Updated: October 23, 2026

## 1. Overview and Core Privacy Commitment

AnyPS5 Studio ("the Software", "the Application") is an open-source PlayStation 5 executable launcher, runtime manager, and orchestration utility. We are committed to absolute user privacy. AnyPS5 Studio operates on a strict zero-telemetry, local-first architecture.

The Software runs entirely on your local machine. It does not harvest personal information, track user behavior, profile your gaming activities, or transmit personal data to central servers or third-party advertising networks.

## 2. Information We Do Not Collect

AnyPS5 Studio does not collect, record, harvest, transmit, or monetize any of the following:
- Personal Identifiable Information (PII): No names, physical addresses, email addresses, phone numbers, or account credentials.
- Device and Network Identifiers: No IP addresses, MAC addresses, hardware UUIDs, or digital fingerprints.
- Game Library and Usage Analytics: No paths to your local game directories, game library contents, titles executed, playtime durations, save states, or crash logs are transmitted to any developer-managed server.
- System Activity: No tracking of open applications, system processes, or file system activity outside the configured game directory.

## 3. Local-First Storage Architecture

All data generated during the operation of AnyPS5 Studio remains strictly under your direct custody on your local workstation.

### 3.1 Local Files and Configuration
Configuration parameters, UI preferences, and game metadata are stored in standard local application directories:
- Windows: `%APPDATA%\anyps5-ui` (e.g. `C:\Users\<Username>\AppData\Roaming\anyps5-ui\anyps5_settings.json`)
- Linux: `~/.config/anyps5-ui/anyps5_settings.json`

Stored local data includes:
- Path configurations (selected games directory, runtime engine paths, relinker options).
- Display and sound preferences (theme selections, audio volume, UI layout).
- Cached title metadata parsed directly from your local game folders (`param.json`, title ID, local artwork).
- Local execution logs (`anyps5.log` and relinker diagnostic summaries).

### 3.2 User Data Control and Deletion
You retain complete control over all data stored by AnyPS5 Studio. You may inspect, modify, or permanently delete the configuration files and logs at any time using your native operating system file manager, with zero external service dependencies or developer intervention required.

## 4. Discord Rich Presence Disclosure (Local IPC)

AnyPS5 Studio includes optional Discord Rich Presence integration to display your current launcher activity or active PlayStation 5 title on your Discord user profile.

### 4.1 Local Communication Mechanism
The Discord Rich Presence feature functions exclusively through local Inter-Process Communication (IPC):
- Windows: Local Named Pipe (`\\.\pipe\discord-ipc-0` through `\\.\pipe\discord-ipc-9`)
- Linux: Local UNIX domain sockets (located in standard temporary directories such as `/tmp` or `$XDG_RUNTIME_DIR`)

This communication occurs strictly on your local computer between the AnyPS5 Studio process and the locally running Discord desktop application client.

### 4.2 Data Transmitted Over Local Pipe
When active, AnyPS5 Studio sends formatted activity packets over the local pipe containing:
- Application Identification: AnyPS5 Studio Client ID (`1562955881182920855`).
- State Information: Current state ("Browsing Games" or "Playing · [Title ID]").
- Title Name: The name of the active title (e.g. "Dreaming Sarah").
- Timing: Live session start timestamp for elapsed playtime calculation.
- Asset Keys: Text identifiers representing pre-registered Discord assets (e.g. `anyps5_logo`, `ps_badge`, or lowercase title IDs such as `ppsa02929`).

### 4.3 Zero Intermediary Servers and User Control
- No game state, Title IDs, or session information are ever transmitted to any AnyPS5 Studio server or third-party analytics collector.
- Presence broadcasting to the Discord network is handled solely by your official Discord desktop client, subject to Discord's Terms of Service and Privacy Policy.
- You can disable Discord Rich Presence at any time in AnyPS5 Studio Settings (`Settings -> Discord Rich Presence` toggle). When disabled, the local IPC client immediately disconnects and closes the local named pipe.

## 5. Outbound Network Communications

AnyPS5 Studio is engineered to operate offline. The only outbound network requests the Application ever initiates are explicitly user-requested or updater-related interactions with public GitHub infrastructure:

### 5.1 GitHub Public APIs
- Release Checks: Querying `https://api.github.com/repos/ramsforge/AnyPS5-Studio/releases` to detect updated software versions.
- Runtime Engine Discovery: Reading publicly available pull request or release artifacts on GitHub when the user opens the Runtime Manager.
- Remote Cover Art: If a game item points to a remote image URL (HTTP/HTTPS) provided by the user, the UI fetches that image directly from the host.

No personal identifiers, authentication tokens (unless manually configured), or machine signatures are transmitted during these requests.

## 6. Third-Party Services

Aside from direct local IPC communication with your local Discord client and read-only queries to GitHub public release endpoints, AnyPS5 Studio integrates no third-party SDKs, marketing trackers, or analytical libraries.

## 7. Modifications to This Policy

We reserve the right to update this Privacy Policy as the Software evolves. Any modifications will be committed directly to the public source repository. Because AnyPS5 Studio does not collect email addresses or contact details, users are encouraged to review this file periodically.

## 8. Inquiries and Compliance Contact

For questions, concerns, or inquiries regarding this Privacy Policy, please open an issue in the official project repository:
https://github.com/ramsforge/AnyPS5-Studio

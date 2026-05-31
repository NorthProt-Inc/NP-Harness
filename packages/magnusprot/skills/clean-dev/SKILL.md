---
name: clean-dev
description: Use when cleaning caches, Docker, logs, or auditing disk/RAM usage
metadata:
  pi:
    user-invocable: true
    argument-hint: '[--dev|--system|--deep|--nuke|--mem|--audit|--dry-run|--category=X|path|--all]'
---

# /clean - System Garbage Cleaner v2 (Linux)

Multi-distro support (Fedora/Ubuntu/Pop!_OS). Sudo policy detected at runtime.

### Distro Detection (run once at start)
```bash
if command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
elif command -v apt &>/dev/null; then
    PKG_MGR="apt"
else
    PKG_MGR="unknown"
fi
```

## Usage
- `/clean` - Current project cache only (scan -> confirm -> delete)
- `/clean --dev` - + Global dev tool caches (~/.cache/pip, uv, npm, cargo...)
- `/clean --system` - + OS-level maintenance (journalctl, pkg cache, tmp, trash)
- `/clean --deep` - + Docker, ML models, backups/logs
- `/clean --nuke` - Everything above + --mem + --audit (confirmation required)
- `/clean --mem` - RAM report + optimization suggestions (standalone)
- `/clean --audit` - Package audit: bloatware, unused tools (standalone)
- `/clean --dry-run` - Scan only, no deletion (combinable with any flag)
- `/clean --category=X` - Specific category only: docker, ml, logs, maven, kernel, chrome
- `/clean [path]` - Project cache at specified path
- `/clean --all` - All projects under ~/projects

Flags are combinable: `/clean --dev --dry-run`, `/clean --mem --audit`

## Arguments: $ARGUMENTS

## Level Inclusion Matrix

| Flag | L0 Project | L1 Dev Tools | L2 System | L3 Docker | L4 ML | L5 Logs | L6 Stale Bins | Audit | Mem |
|------|-----------|--------------|-----------|-----------|-------|---------|---------------|-------|-----|
| (default) | O | | | | | | | | |
| --dev | O | O | | | | | | | |
| --system | O | O | O | | | | O | | |
| --deep | O | O | O | O | O | O | O | | |
| --nuke | O | O | O | O | O | O | O | O | O |
| --mem | | | | | | | | | O |
| --audit | | | | | | | | O | |
| --category=X | | | | only X | only X | only X | only X | | |

## Path Resolution
1. `--all` present -> TARGET=`~/projects`
2. Path argument given -> TARGET=that path
3. Neither -> TARGET=current working directory

## Target Safety Gate (MANDATORY before deletion)
Before any command that deletes files (`rm`, `find -delete`, `-exec rm`, package purge, Docker prune), resolve and validate TARGET:

```bash
TARGET_REAL=$(realpath -m "$TARGET")
HOME_REAL=$(realpath -m "$HOME")
case "$TARGET_REAL" in
  "$HOME_REAL"|"/"|"/home"|"/usr"|"/var"|"/etc"|"/opt"|"/bin"|"/sbin"|"/lib"|"/lib64")
    echo "Refusing unsafe cleanup target: $TARGET_REAL" >&2
    exit 1
    ;;
esac
[ -e "$TARGET_REAL" ] || { echo "Target does not exist: $TARGET_REAL" >&2; exit 1; }
```

If TARGET is outside `~/projects` and not the current working directory or an explicit user-provided path, run a scan-only report first and ask before deleting. Never infer a broad target from an ambiguous argument.

## Exclusion Patterns (applied to ALL find commands)
```bash
# Use array syntax — string form causes quotes to become literals in find
EXCLUDE=(-not -path "*/site-packages/*" -not -path "*/.venv/*" -not -path "*/venv/*" -not -path "*/env/*" -not -path "*/.git/*" -not -path "*/flatpak/runtime/*" -not -path "*/GoogleDrive/*" -not -path "$HOME/GoogleDrive/*" -not -path "*/Documents/*" -not -path "*/Pictures/*")
# Always expand as "${EXCLUDE[@]}" — never bare "${EXCLUDE[@]}"
```

## Size Calculation Rule (MANDATORY)
Always use `xargs -r` when piping find into du. Without `-r`, empty find output causes
xargs to run `du .` on the current directory, reporting a wildly wrong size.
```bash
# Correct
find TARGET ... "${EXCLUDE[@]}" 2>/dev/null | xargs -r du -sh --total 2>/dev/null | tail -1
# Wrong — omitting -r gives bogus size when nothing is found
find TARGET ... | xargs du -sh --total | tail -1
```

## Safety Rules (MANDATORY)

### NEVER Delete
- `site-packages/`, `.venv/`, `venv/`, `env/` — virtual environments
- `node_modules/` itself — only `node_modules/.cache/` and `node_modules/.vitest/`
- `~/.ssh/`, `~/.gnupg/`, `~/.config/` (root level)
- `.git/` directories
- `/usr/`, `/bin/`, `/sbin/`, `/lib/`, `/lib64/`
- NVIDIA/GPU packages: `libnvidia-*`, `nvidia-*`, `nvidia-dkms-*`, `libcuda*` — removing causes compositor/mouse lag, display breakage
- `libllvm*` packages — mesa/GPU stack dependency
- `xserver-xorg-video-*`, `mesa-*` — display server dependencies
- flatpak NVIDIA GL runtime (`org.freedesktop.Platform.GL.nvidia-*`)
- `~/GoogleDrive/` — cloud sync mirror, cleanup MUST skip entirely (user data, not cache)
- `~/Documents/`, `~/Desktop/`, `~/Pictures/` — user data zones, never scan or delete inside them

### Confirm Required (ask user before deleting)
- Docker volumes (data loss risk)
- ML model caches (large re-download cost)
- Maven `~/.m2/repository/` (may break builds)
- Package purge (--audit results) — ALWAYS confirm, even in --nuke
- Package-manager autoremove (`apt autoremove`, `dnf autoremove`) — report dry-run output first; never execute automatically
- `--nuke` mode entirely

### Sudo Handling
- Detect sudo policy at runtime: `sudo -n true 2>/dev/null` (NOPASSWD check)
- If NOPASSWD: show what will run, then execute directly
- If password required: present as suggestions with exact command, user confirms
- Always show commands in scan/report regardless of sudo policy

---

## Execution Flow

### Step 1: Parse Arguments
From $ARGUMENTS, determine:
- Level: default / `--dev` / `--system` / `--deep` / `--nuke`
- Standalone flags: `--mem`, `--audit`
- Modifiers: `--dry-run`, `--category=X`, `--all`
- TARGET path

### Step 2: Auto-Detect Project Type (Layer 0)
Check at TARGET:
- `pyproject.toml`, `setup.py`, `requirements.txt` -> Python
- `package.json` -> Node.js
- `Cargo.toml` -> Rust
- `go.mod` -> Go
- `build.gradle`, `build.gradle.kts` -> Gradle
- `pom.xml` -> Maven

### Step 3: Scan Phase (ALWAYS runs first)
Run scan commands for all applicable layers IN PARALLEL. Collect category, item count, size, risk.
```bash
# Protected user directories — abort if TARGET is inside one
case "$TARGET" in
    "$HOME/GoogleDrive"*|"$HOME/Documents"*|"$HOME/Desktop"*|"$HOME/Pictures"*)
        echo "ERROR: TARGET '$TARGET' is a protected user directory. Aborting."
        exit 1 ;;
esac

echo "=== Disk usage before ==="
du -sh TARGET 2>/dev/null
df -h TARGET 2>/dev/null | tail -1
```

### Step 4: Display Results Table
Show unified table sorted by size descending:
| Category | Items | Size | Risk | Action |

### Step 5: Confirmation
- `--dry-run` -> Stop here
- `--nuke` -> Require explicit "yes" before ANY deletion
- Otherwise -> Proceed with Safe items, ask individually for Confirm items

### Step 6: Execute Deletion
Run deletion commands for confirmed categories.

### Step 7: Report
Before/after comparison with freed space.

---

## Layer 0: Project Cache (Default)

### Python (if detected)
```bash
# Scan
find TARGET -type d -name "__pycache__" "${EXCLUDE[@]}" 2>/dev/null | wc -l
find TARGET \( -name "*.pyc" -o -name "*.pyo" \) "${EXCLUDE[@]}" 2>/dev/null | wc -l
find TARGET -type d \( -name ".pytest_cache" -o -name ".mypy_cache" -o -name ".ruff_cache" -o -name ".tox" \) "${EXCLUDE[@]}" 2>/dev/null
find TARGET -type f -name ".coverage" "${EXCLUDE[@]}" 2>/dev/null
find TARGET -type d \( -name "htmlcov" -o -name "*.egg-info" \) "${EXCLUDE[@]}" 2>/dev/null

# Delete
find TARGET -type d -name "__pycache__" "${EXCLUDE[@]}" -exec rm -rf {} + 2>/dev/null
find TARGET \( -name "*.pyc" -o -name "*.pyo" \) "${EXCLUDE[@]}" -delete 2>/dev/null
find TARGET -type d \( -name ".pytest_cache" -o -name ".mypy_cache" -o -name ".ruff_cache" -o -name ".tox" \) "${EXCLUDE[@]}" -exec rm -rf {} + 2>/dev/null
find TARGET -type f -name ".coverage" "${EXCLUDE[@]}" -delete 2>/dev/null
find TARGET -type d \( -name "htmlcov" -o -name "*.egg-info" \) "${EXCLUDE[@]}" -exec rm -rf {} + 2>/dev/null
```

### Node.js (if detected)
```bash
# Scan
find TARGET -type d -path "*/node_modules/.cache" 2>/dev/null
find TARGET -type d -path "*/node_modules/.vitest" 2>/dev/null
find TARGET -type d \( -name ".turbo" -o -name ".next" -o -name ".nuxt" -o -name ".svelte-kit" \) "${EXCLUDE[@]}" 2>/dev/null

# Delete
find TARGET -type d -path "*/node_modules/.cache" -exec rm -rf {} + 2>/dev/null
find TARGET -type d -path "*/node_modules/.vitest" -exec rm -rf {} + 2>/dev/null
find TARGET -type d \( -name ".turbo" -o -name ".next" -o -name ".nuxt" -o -name ".svelte-kit" \) "${EXCLUDE[@]}" -exec rm -rf {} + 2>/dev/null
```

### Rust (if detected)
```bash
# Scan
du -sh TARGET/target/debug/incremental 2>/dev/null
du -sh TARGET/target/release/incremental 2>/dev/null
du -sh TARGET/target/debug/build 2>/dev/null
du -sh TARGET/target/debug/deps 2>/dev/null

# Delete
rm -rf TARGET/target/debug/incremental 2>/dev/null
rm -rf TARGET/target/release/incremental 2>/dev/null
rm -rf TARGET/target/debug/build 2>/dev/null
rm -rf TARGET/target/debug/deps 2>/dev/null
```

### Go (if detected)
```bash
find TARGET -type d -name "__debug_bin*" -exec rm -rf {} + 2>/dev/null
```

### Gradle (if detected)
```bash
find TARGET -type d -name "build" -not -path "*/node_modules/*" -not -path "*/.git/*" "${EXCLUDE[@]}" -exec rm -rf {} + 2>/dev/null
find TARGET -type d -name ".gradle" "${EXCLUDE[@]}" -exec rm -rf {} + 2>/dev/null
```

### Maven (if detected)
```bash
find TARGET -type d -name "target" -not -path "*/node_modules/*" -not -path "*/rust/*" "${EXCLUDE[@]}" -exec rm -rf {} + 2>/dev/null
```

### General Junk (always)
```bash
find TARGET \( -name ".DS_Store" -o -name "Thumbs.db" -o -name "*.swp" -o -name "*.swo" -o -name "*~" -o -name "#*#" \) "${EXCLUDE[@]}" -delete 2>/dev/null
```

---

## Layer 1: Global Dev Tool Cache (--dev)

Safe to delete — tools re-download as needed.

```bash
# Scan all
echo "=== Global Dev Tool Caches ==="
du -sh ~/.cache/pip 2>/dev/null || true
du -sh ~/.cache/uv 2>/dev/null || true
du -sh ~/.npm/_cacache 2>/dev/null || true
du -sh ~/.local/share/pnpm/store 2>/dev/null || true
du -sh ~/.cache/yarn 2>/dev/null || true
du -sh ~/.cargo/registry/cache 2>/dev/null || true
du -sh ~/.cache/go-build 2>/dev/null || true
du -sh ~/.gradle/caches 2>/dev/null || true

# Delete (safe)
rm -rf ~/.cache/pip 2>/dev/null
rm -rf ~/.cache/uv 2>/dev/null
rm -rf ~/.npm/_cacache 2>/dev/null
rm -rf ~/.local/share/pnpm/store 2>/dev/null
rm -rf ~/.cache/yarn 2>/dev/null
rm -rf ~/.cargo/registry/cache 2>/dev/null
rm -rf ~/.cache/go-build 2>/dev/null
rm -rf ~/.gradle/caches 2>/dev/null
```

### Confirm Required: Maven
```bash
du -sh ~/.m2/repository 2>/dev/null
# Only with --category=maven or --nuke + explicit confirmation:
# rm -rf ~/.m2/repository 2>/dev/null
```

---

## Layer 2: System Maintenance (--system)

Commands adapt based on `$PKG_MGR`. Sudo behavior follows runtime detection (see Sudo Handling).

### User-level cleanup
```bash
echo "=== Trash ==="
du -sh ~/.local/share/Trash 2>/dev/null
rm -rf ~/.local/share/Trash/* 2>/dev/null

echo "=== Thumbnail cache ==="
du -sh ~/.cache/thumbnails 2>/dev/null
rm -rf ~/.cache/thumbnails/* 2>/dev/null

echo "=== Desktop environment caches ==="
du -sh ~/.cache/tracker3 2>/dev/null || true
du -sh ~/.cache/gnome-software 2>/dev/null || true
du -sh ~/.cache/pop-shop 2>/dev/null || true
rm -rf ~/.cache/tracker3/* 2>/dev/null
rm -rf ~/.cache/gnome-software/* 2>/dev/null
rm -rf ~/.cache/pop-shop/* 2>/dev/null

echo "=== Flatpak unused data ==="
FLATPAK_APPS=$(flatpak list --app 2>/dev/null | wc -l)
if [ "$FLATPAK_APPS" -gt 0 ] 2>/dev/null; then
    # Flatpak actively used — only remove unused runtimes
    flatpak uninstall --unused -y 2>/dev/null
else
    # Flatpak not used — report size for manual decision
    du -sh ~/.local/share/flatpak 2>/dev/null || true
fi

echo "=== /tmp old files (7+ days, current user only) ==="
find /tmp -maxdepth 1 -user "$(whoami)" -mtime +7 2>/dev/null | wc -l
find /tmp -maxdepth 1 -user "$(whoami)" -mtime +7 -exec rm -rf {} + 2>/dev/null
```

### System-level cleanup (sudo, executed directly)
```bash
echo "=== journalctl ==="
journalctl --disk-usage
sudo journalctl --vacuum-time=7d

echo "=== Package manager cache ==="
if [ "$PKG_MGR" = "dnf" ]; then
    du -sh /var/cache/dnf 2>/dev/null
    sudo dnf clean all
    sudo rm -rf /var/tmp/dnf-* /var/tmp/rpm-tmp.* 2>/dev/null
    echo "=== Autoremove candidates (report only) ==="
    dnf autoremove --assumeno 2>/dev/null || true
elif [ "$PKG_MGR" = "apt" ]; then
    du -sh /var/cache/apt/archives 2>/dev/null
    sudo apt clean
    sudo rm -rf /var/cache/apt/archives/partial/* 2>/dev/null
    echo "=== Autoremove candidates (report only) ==="
    apt --dry-run autoremove 2>/dev/null || true
fi

# Snap old revisions (apt systems, if snap installed)
if command -v snap &>/dev/null; then
    echo "=== Snap old revisions ==="
    snap list --all 2>/dev/null | awk '/disabled/{print $1, $3}'
    snap list --all | awk '/disabled/{print $1, "--revision=" $3}' | while read snapname rev; do
        sudo snap remove $snapname $rev 2>/dev/null
    done
fi

echo "=== systemd coredumps ==="
du -sh /var/lib/systemd/coredump 2>/dev/null
sudo rm -rf /var/lib/systemd/coredump/* 2>/dev/null
```

---

## Layer 3: Docker (--deep or --category=docker)

Check if docker is available first:
```bash
command -v docker &>/dev/null || { echo "Docker not installed, skipping"; }
```

### Scan
```bash
docker system df 2>/dev/null
docker images -f "dangling=true" -q 2>/dev/null | wc -l
docker ps -a -f "status=exited" -q 2>/dev/null | wc -l
```

### Delete (safe)
```bash
docker image prune -f 2>/dev/null
docker container prune -f 2>/dev/null
docker builder prune -f 2>/dev/null
docker network prune -f 2>/dev/null
```

### Confirm Required: Volumes
```bash
docker volume ls -f "dangling=true" -q 2>/dev/null | wc -l
# DANGER: May delete persistent data. Only with --nuke + explicit confirmation:
# docker volume prune -f
```

---

## Layer 4: ML Model Cache (--deep or --category=ml)

WARNING: Can be tens of GB. Always show size, always confirm before deleting.

### Scan
```bash
du -sh ~/.cache/huggingface 2>/dev/null || true
du -sh ~/.cache/torch 2>/dev/null || true
du -sh ~/.cache/huggingface/hub 2>/dev/null || true
du -sh ~/.cache/huggingface/transformers 2>/dev/null || true
```

### Delete (confirm required)
```bash
# Only after explicit user confirmation:
# rm -rf ~/.cache/huggingface 2>/dev/null
# rm -rf ~/.cache/torch 2>/dev/null
```

---

## Layer 5: Backups & Logs (--deep or --category=logs)

### Scan
```bash
echo "=== Log files (30+ days old) ==="
find TARGET -name "*.log" -mtime +30 "${EXCLUDE[@]}" 2>/dev/null | wc -l

echo "=== Backup files ==="
find TARGET \( -name "*.bak" -o -name "*.backup" -o -name "*.orig" \) "${EXCLUDE[@]}" 2>/dev/null | wc -l

echo "=== Core dumps (actual dumps only, not core.js/core.ts) ==="
find TARGET -type f \( -name "core" -o -regex ".*/core\.[0-9]+" \) -not -name "*.js" -not -name "*.ts" -not -name "*.json" -not -name "*.d.ts" -not -name "*.map" "${EXCLUDE[@]}" 2>/dev/null | wc -l
```

### Delete
```bash
find TARGET -name "*.log" -mtime +30 "${EXCLUDE[@]}" -delete 2>/dev/null
find TARGET \( -name "*.bak" -o -name "*.backup" -o -name "*.orig" \) "${EXCLUDE[@]}" -delete 2>/dev/null
find TARGET -type f \( -name "core" -o -regex ".*/core\.[0-9]+" \) -not -name "*.js" -not -name "*.ts" -not -name "*.json" -not -name "*.d.ts" -not -name "*.map" "${EXCLUDE[@]}" -delete 2>/dev/null
```

---

## Layer 6: Stale Binaries + Large File Discovery (--system)

### Step A: Hardcoded Paths (auto-detect and delete)

#### Claude old versions
```bash
# Scan: list all versions, identify current
ls -1 ~/.local/share/claude/versions/ 2>/dev/null | sort -V
CURRENT_CLAUDE=$(claude --version 2>/dev/null | grep -oP '[\d.]+' | head -1)
# Delete: all except current version
# Keep only the file matching $CURRENT_CLAUDE
```
Risk: Safe. Old binaries are never used.

#### VS Code extensions (duplicate versions)
```bash
# Scan: find extensions with version-suffixed dirs, group by base name
ls ~/.vscode-server/extensions/ 2>/dev/null
# For each extension base name, keep only the highest version
# Delete older versions
```
Risk: Safe. VS Code loads only the latest.

#### VS Code CLI servers (old builds)
```bash
du -sh ~/.vscode-server/cli/servers/*/ 2>/dev/null
# Keep only the most recently modified server
```
Risk: Safe.

#### Old kernels (sudo, executed directly)
```bash
CURRENT_KERNEL=$(uname -r)

if [ "$PKG_MGR" = "dnf" ]; then
    # Fedora: rpm-based kernel listing
    rpm -qa kernel-core* kernel-modules* kernel-devel* | grep -v "$CURRENT_KERNEL" | sort
    rpm -qa kernel-core* kernel-modules* kernel-devel* | grep -v "$CURRENT_KERNEL" | xargs rpm -q --queryformat '%{SIZE} %{NAME}-%{VERSION}-%{RELEASE}\n' 2>/dev/null | awk '{total+=$1} END {printf "Total: %.0fM\n", total/1024/1024}'
    OLD_KERNELS=$(rpm -qa kernel-core* kernel-modules* kernel-devel* | grep -v "$CURRENT_KERNEL")
    if [ -n "$OLD_KERNELS" ]; then
        echo "Removing: $OLD_KERNELS"
        sudo dnf remove -y $OLD_KERNELS
    fi
elif [ "$PKG_MGR" = "apt" ]; then
    # Ubuntu/Pop!_OS: dpkg-based kernel listing (protect generic-hwe metapackages)
    dpkg -l 'linux-image-*' 'linux-headers-*' 'linux-modules-*' 2>/dev/null | grep '^ii' | grep -v "$CURRENT_KERNEL" | grep -v "generic-hwe" | awk '{print $2}'
    OLD_KERNELS=$(dpkg -l 'linux-image-*' 'linux-headers-*' 'linux-modules-*' 2>/dev/null | grep '^ii' | grep -v "$CURRENT_KERNEL" | grep -v "generic-hwe" | awk '{print $2}')
    if [ -n "$OLD_KERNELS" ]; then
        echo "Removing: $OLD_KERNELS"
        sudo apt purge -y $OLD_KERNELS
    fi
fi
```
Risk: Safe (never remove running kernel).

#### Chrome crash reports
```bash
du -sh ~/.config/google-chrome/Crash\ Reports/ 2>/dev/null
rm -rf ~/.config/google-chrome/Crash\ Reports/completed/ 2>/dev/null
rm -rf ~/.config/google-chrome/Crash\ Reports/new/ 2>/dev/null
rm -rf ~/.config/google-chrome/Crash\ Reports/pending/ 2>/dev/null
```
Risk: Safe.

#### Chrome browser cache
```bash
du -sh ~/.cache/google-chrome/ 2>/dev/null
rm -rf ~/.cache/google-chrome/ 2>/dev/null
```
Risk: Safe. Browser regenerates on next launch.

### Step B: Dynamic Pattern Scan (report only, no auto-delete)
```bash
echo "=== Large directories in ~/.cache ==="
du -sh ~/.cache/*/ 2>/dev/null | sort -rh | head -10

echo "=== Large directories in ~/.local ==="
du -sh ~/.local/share/*/ 2>/dev/null | sort -rh | head -10

echo "=== Large directories in ~/.config ==="
du -sh ~/.config/*/ 2>/dev/null | sort -rh | head -10

echo "=== Files > 100MB in home ==="
find ~ -type f -size +100M -not -path "*/.git/*" -not -path "*/node_modules/*" -not -path "*/site-packages/*" -not -path "*/.venv/*" 2>/dev/null | head -20
```
Output as a report table. User decides what to act on.

---

## --audit: Package Audit

Standalone flag or included in `--nuke`.

### Scan
```bash
if [ "$PKG_MGR" = "dnf" ]; then
    # 1. Manually installed packages
    dnf repoquery --userinstalled --qf '%{name}' 2>/dev/null | sort
    # 2. Large packages top 15
    rpm -qa --queryformat '%{SIZE}\t%{NAME}\n' | sort -rn | head -15 | awk '{printf "%.0fM\t%s\n", $1/1024/1024, $2}'
    # 3. Orphan / autoremovable
    dnf autoremove --assumeno 2>/dev/null
    # 4. Leaf packages
    dnf repoquery --installed --extras 2>/dev/null
    # 5. Reverse dependencies: dnf repoquery --installed --whatrequires <package>
elif [ "$PKG_MGR" = "apt" ]; then
    # 1. Manually installed packages
    apt-mark showmanual 2>/dev/null | sort
    # 2. Large packages top 15
    dpkg-query -W --showformat='${Installed-Size}\t${Package}\n' | sort -rn | head -15 | awk '{printf "%.0fM\t%s\n", $1/1024, $2}'
    # 3. Orphan / autoremovable
    apt --dry-run autoremove 2>/dev/null
    # 4. Residual configs (removed but config remains)
    dpkg -l | awk '/^rc/{print $2}'
    # 5. Leaf packages
    deborphan 2>/dev/null || apt list --installed 2>/dev/null | head -20
    # 6. Reverse dependencies: apt-cache rdepends --installed <package>
fi
```

### LLM Analysis
Using the scan data, categorize packages:
- **Server/VM bloat**: Packages meant for cloud VMs or servers on a desktop machine (e.g., open-vm-tools, open-iscsi, cloud-init). Judge based on actual machine context.
- **Unused build tools**: Packages with no reverse dependencies that were likely installed for a one-time build.
- **Large packages**: Flag anything > 50MB that the user may not actively need.
- **GPU/Display Critical**: NEVER suggest removal of `libnvidia-*`, `nvidia-*`, `libllvm*`, `xserver-xorg-video-*`, `mesa-*` — causes compositor breakage and input lag. Skip these entirely in the audit output.

### Output
```
| Package | Size | Category | Reason |
| cmake   | 50M  | Build tool   | No reverse dependencies |
```

### Deletion
ALWAYS present as a report first. User selects which to remove.
Even in `--nuke`, package purge requires explicit confirmation — these are not caches.

After user confirms selected packages, remove only those packages. Then show autoremove candidates as a separate report and ask again before running autoremove:
```bash
if [ "$PKG_MGR" = "dnf" ]; then
    sudo dnf remove -y <selected packages>
    dnf autoremove --assumeno 2>/dev/null || true
elif [ "$PKG_MGR" = "apt" ]; then
    sudo apt purge -y <selected packages>
    apt --dry-run autoremove 2>/dev/null || true
fi
```

Do not run `apt autoremove`, `apt autoremove --purge`, or `dnf autoremove` unless the user explicitly approves the displayed candidate list.

---

## --mem: RAM Management

Standalone flag or included in `--nuke`.

### Report
```bash
# Memory overview
free -h

# Kernel cache detail
grep -E "MemTotal|MemFree|MemAvailable|Buffers|^Cached|SwapTotal|SwapFree|Dirty|Slab|SReclaimable" /proc/meminfo

# Top 15 memory consumers
ps aux --sort=-%mem | head -16

# Swap status
swapon --show

# Swappiness
cat /proc/sys/vm/swappiness
```

### Output Format
```
=== Memory Report ===
Total: 30GB | Used: XXG | Cache/Buffer: XXG | Free: XXG
Swap:  XXG  | Used: XXB | Swappiness: XX

| PID  | Process        | RSS    | %MEM |
| 1234 | chrome         | 2.1 GB | 6.5% |
| 5678 | node           | 890 MB | 2.7% |
...

Reclaimable cache: XXG
```

### Action Suggestions (show command, then execute directly with sudo)

| Condition | Action |
|-----------|--------|
| Cache/Buffer > 30% of total RAM | `sudo sysctl vm.drop_caches=3` |
| Swap used > 1GB | List top swap-consuming processes |
| Swappiness > 10 on desktop | `sudo sysctl vm.swappiness=10` and persist in `/etc/sysctl.d/99-swappiness.conf` |
| Single process RSS > 2GB | Alert with process details |

---

## --nuke Execution Flow

This is the primary use case. Optimized for single-command full cleanup.

```
1. Disk before snapshot (df -B1, du -sh)
2. Parallel scan:
   ├─ L0: Project cache
   ├─ L1: Global tool cache
   ├─ L2: System (trash, journalctl, pkg manager cache)
   ├─ L3: Docker (if present)
   ├─ L4: ML cache
   ├─ L5: Logs/backups
   ├─ L6: Stale binaries + large file discovery
   ├─ --audit: Package audit
   └─ --mem: RAM report
3. Unified report table (sorted by size descending)
4. Confirmation prompt ("yes" required for --nuke)
5. Execute deletion:
   a. Safe items (no confirmation needed)
   b. Confirm items (ask per category)
   c. Sudo items (execute directly, show commands)
   d. Report items (display only)
6. Disk after snapshot + freed space report
7. RAM report at the end
```

### Confirmation Categories
- **Auto-delete (Safe)**: caches, __pycache__, trash, old logs, stale binaries, Chrome cache/crash reports
- **Confirm required**: Docker volumes, ML models, Maven repo
- **Report only**: Large file TOP, package audit results, RAM suggestions
- **Sudo (execute directly)**: old kernel purge, journalctl vacuum, pkg manager cache clean, drop_caches
- **Sudo (confirm separately)**: package-manager autoremove after displaying dry-run candidates

---

## Output Format

```
## System Cleanup Report

### Target
- Path: TARGET
- Level: [default|--dev|--system|--deep|--nuke]
- Mode: [--dry-run|actual deletion]

### Disk Before
- Target size: XXX
- Disk used: XXX
- Disk free: XXX

### Scan Results
| Category          | Items | Size     | Risk    | Action  |
|-------------------|-------|----------|---------|---------|
| __pycache__       | 45    | 12.3 MB  | Safe    | Deleted |
| .pytest_cache     | 3     | 1.2 MB   | Safe    | Deleted |
| pip cache         | 892   | 2.1 GB   | Safe    | Deleted |
| uv cache          | 234   | 890 MB   | Safe    | Deleted |
| Claude old bins   | 2     | 449 MB   | Safe    | Deleted |
| Old kernels       | 3     | 461 MB   | Sudo    | Deleted |
| Pkg manager cache | -     | 450 MB   | Safe    | Deleted |
| journalctl        | -     | 500 MB   | Safe    | Vacuumed |
| coredumps         | 3     | 120 MB   | Safe    | Deleted |
| HuggingFace cache | 5     | 15.2 GB  | Confirm | Skipped |
| **Total cleaned** |       | **3.0 GB** |       |         |

### Large File Discovery (report only)
| Path | Size |
| ~/.config/google-chrome/ | 925 MB |
| ... | ... |

### Package Audit (report only)
| Package | Size | Category | Reason |
| cmake   | 50M  | Build tool   | No reverse dependencies |

### Memory Report
Total: 30GB | Used: XXG | Cache/Buffer: XXG | Free: XXG
[process table]
[suggestions if any]

### Disk After
- Target size: XXX
- Disk used: XXX
- Disk free: XXX
- **Freed: XXX**

### Skipped (requires confirmation)
- ~/.cache/huggingface: 15.2 GB (use --category=ml)
- ~/.m2/repository: 3.2 GB (use --category=maven)
```

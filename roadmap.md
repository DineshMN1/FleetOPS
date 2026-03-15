# FleetOPS: SSH Server Monitoring Project Roadmap

Based on an architectural review of the current implementation, here is a detailed roadmap to evolve the project from its current state into a fully-featured, production-ready SSH Server Monitoring application.

## 🎯 Current State Assessment
**What's working:**
- Next.js 15+ frontend with Tailwind CSS and Framer Motion.
- PostgreSQL database with a `users`, `ssh_keys`, and `remote_servers` schema.
- Basic Authentication system ([lib/auth.ts](file:///c:/Users/kisho/Desktop/GitHub/FleetOPS/lib/auth.ts)).
- `systeminformation` API providing stats for the *local* hosting node.
- Next.js API route that tests an SSH connection and updates the DB status.

**Critical Gaps Identified:**
- **Interactive Terminal:** [components/Terminal.tsx](file:///c:/Users/kisho/Desktop/GitHub/FleetOPS/components/Terminal.tsx) renders `xterm.js`, but doesn't actually stream data. The backend `app/api/ssh/connect` connects but immediately closes the connection. WebSockets (`ws` package is in `package.json`) need to be implemented to pipe stdin/stdout between the browser and the SSH connection.
- **First-Time Admin Setup:** Currently, the admin user is seeded directly in the database (`admin@fleetops.com`). It should redirect to a `/register` page if no users exist to allow the first user to set up their custom admin credentials.
- **Real-Time Remote Monitoring:** The `app/api/monitor` route currently fetches system stats for the *local Server* where Next.js is running, not the remote servers. It must connect to the target remote servers (both public like `100.98.6.232` and private like `192.168.0.4`) via SSH to fetch live stats (CPU, RAM, Storage, and GPU if present).

---

## 🗺️ Detailed Roadmap

### Phase 1: Core Functionality & First-Time Setup (Immediate Next Steps)
Goal: Make the application functional, secure from day one, and capable of actual server interaction.
* **1.1 First-Time Launch & Admin Registration**
  * Detect if the `users` table is empty on startup.
  * If empty, redirect all requests to a `/register` page to create the initial Admin account.
  * Remove hardcoded admin seeding from the database script.
* **1.2 Application-Level SSH Key Management (Coolify/Dokploy style)**
  * Remove the current `ssh_keys` sidebar and feature where users upload their own private keys.
  * Instead, upon initial setup, FleetOPS generates a secure `ED25519` SSH Keypair for the application itself.
  * Present the generated Public Key to the admin in a "Settings" or "Installation" tab.
  * The admin manually adds this public key to the `~/.ssh/authorized_keys` of any server they want FleetOPS to monitor.
  * FleetOPS database only needs to store the application's global Private Key, mitigating the security risk of users pasting multiple private keys into the dashboard.
* **1.3 Interactive Web Terminal (SSH Streaming)**
  * Set up a Node.js WebSocket Server (using `ws`) alongside or integrated into the Next.js backend.
  * Connect `xterm.js` on the frontend to the WebSocket.
  * Pipe the WebSocket stream into the `ssh2` client interactive shell session utilizing the FleetOPS Application Private Key.
* **1.4 Real-Time Live Server Monitoring**
  * Modify monitoring logic: Upon connecting to a server (public or private IP), execute lightweight commands via SSH (e.g., `top`, `df -h`, `free`, `nvidia-smi` for GPU) to parse stats in real-time using the FleetOPS auto-generated key.
  * Show a live monitoring dashboard alongside or inside the terminal view of each connected individual server, displaying CPU, RAM, Storage, and GPU utilization.

### Phase 2: Historical Data & Alerting
Goal: Move from real-time-only dashboards to historical analysis and proactive monitoring.
* **2.1 Metrics Persistence**
  * Create a `server_metrics` table in PostgreSQL or migrate to a time-series DB extension (like TimescaleDB).
  * Set up a Node cron job or background service to poll servers every X minutes and save stats.
* **2.2 Alerting Engine**
  * Create an alerting rules table (e.g., "CPU > 90% for 5 mins").
  * Implement an evaluation loop that checks historical metrics against rules.
  * Integrate Webhooks (Slack/Discord) and Email notifications for triggered alerts.

### Phase 3: Fleet Management & Automation
Goal: Manage large clusters of servers simultaneously and implement Termius-like capabilities.
* **3.1 Server Grouping & Tagging**
  * Add tags to `remote_servers` (e.g., `production`, `database`, `web`).
* **3.2 Termius-like Snippets & Automation**
  * Save frequently used commands as "snippets" that can be executed with a single click across one or multiple connected servers.
* **3.3 SFTP File Browser**
  * Implementation of an intuitive SFTP drag-and-drop GUI interface over SSH to browse, upload, and download files from remote servers without using the terminal.
* **3.4 Port Forwarding & Advanced Networking**
  * Built-in local and dynamic port forwarding rules and SSH agent forwarding support to securely proxy traffic and jump hosts.

### Phase 4: Enterprise Security & Multi-Tenancy
Goal: Ensure the platform is safe for teams and audit-compliant.
* **4.1 Role-Based Access Control (RBAC)**
  * Different user tiers (Admin, Operator, Read-only).
  * Restrict specific server groups or SSH keys to specific users.
* **4.2 Audit Logging**
  * Record a trail of ALL executed SSH commands tied to the internal user who executed them.
  * Log all login attempts, server modifications, and key viewings.
* **4.3 Advanced Key Management**
  * Implement Vault-like encryption for stored Private Keys (currently stored in plaintext or basic encryption in SQLite).
  * Native SSH Agent forwarding support.

---
**Recommended Immediate Action:** Focus on **Phase 1.1** (fixing the Web Terminal) as the foundation. Without an interactive shell, the "Fleet" operations cannot be practically validated.

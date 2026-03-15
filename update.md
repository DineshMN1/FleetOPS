# UI Design Update: Dokploy-Style SSH Management

Based on research into how Dokploy manages SSH keys and remote servers, we are pivoting the FleetOPS design away from a single global background key, and instead implementing a comprehensive UI for granular SSH management.

## 1. Sidebar & Menu Updates
*   **Remove:** The "Settings" page (previously proposed for the global key) is no longer needed and will be removed.
*   **Add/Enhance:** The sidebar will prominently feature two main management views under the Dashboard:
    *   `⚿ SSH Keys`
    *   `🖥️ Remote Servers`

## 2. SSH Keys UI (`/dashboard/sshkeys`)
Just like Dokploy, this will be a centralized vault for the admin's SSH credentials.
*   **Generate Key Feature:** A button to instantly generate a new `ED25519` or `RSA` keypair directly within the browser/server.
*   **Import Existing Key Feature:** A form to paste an existing Private Key and Public Key.
*   **Security Measure:** Once a key is generated or imported, the Private Key will **never** be readable or displayable in the UI again. It is stored securely in the database and only used by the backend.
*   **List View:** A table showing the Key Name, Key Type, and the Public Key (so the user can easily copy the Public Key to paste into their target remote server's `~/.ssh/authorized_keys` file).

## 3. Remote Servers UI (`/dashboard/remoteservers`)
This is where servers are linked to the keys managed above.
*   **Add Server Form:** When adding a new server, the user inputs the IP Address (`host`), `username` (e.g., root), `port` (e.g., 22), and **selects one of the SSH Keys** designated in the SSH Keys UI via a dropdown menu.
*   **Connection Test:** Upon adding, a background job tests the SSH connection using the selected key.
*   **Server Dashboard:** Clicking on a server opens a detailed view showing:
    *   The "Launch Terminal" button (which connects using the attached SSH key).
    *   Live Monitoring metrics (CPU, RAM, DISK, GPU) polled directly via that SSH connection.

## 4. Implementation Steps
1.  **Re-enable and upgrade `app/dashboard/sshkeys`:** Implement the Generate/Import forms.
2.  **Update `remote_servers` API:** Ensure the server setup correctly links to `ssh_key_id` via the dropdown.
3.  **Remove Settings:** Clean up any sidebar references to a global settings page.

# Manual Testing Guide for ArkVault

This guide outlines the steps to manually test all features of the ArkVault application to ensure full functionality.

## Prerequisites
- **App Running**: Ensure the application is accessible (default: `http://localhost:5173`).
- **S3 Testing**: Run `npm run s3:start` to spin up a local S3-compatible server.
- **Clean State**: Optional, but starting with a fresh database or known state helps with verification.
- **Test Credentials**: Default user `admin` / `admin123` (or as configured).
- **NFS Testing**:
    - Requires `sudo` privileges for the user running the server (to execute `mount`/`umount`).
    - Run `npm run nfs:start` to spin up a local NFS server container.
    - Run `npm run nfs:stop` to cleanup.
    - **Host**: `localhost` (or docker bridge IP)
    - **Path**: `/nfsshare`

---

## 1. Authentication

### 1.1 Login
- **Scenario: Successful Login**
    1. Navigate to `/login`.
    2. Enter valid username and password.
    3. Click **Login**.
    4. **Verify**: Redirects to Dashboard (`/`). Sidebar is visible.

- **Scenario: Invalid Login**
    1. Navigate to `/login`.
    2. Enter incorrect credentials.
    3. Click **Login**.
    4. **Verify**: Error message "Invalid credentials" (or similar) appears. Remain on login page.

### 1.2 Change Password
- **Scenario: Change Password Flow**
    1. Log in.
    2. Navigate to **Change Password** (either forced on first login or via URL `/change-password`).
    3. Enter a new password and confirm it.
    4. Click **Change Password**.
    5. **Verify**: Success message. Redirects to Login or Dashboard.
    6. **Verify**: Log out and try logging in with the *old* password (should fail) and *new* password (should success).

### 1.3 Logout
- **Scenario: User Logout**
    1. Click **Logout** in the Sidebar footer.
    2. **Verify**: Redirects to Login page.
    3. **Verify**: accessing protected routes (e.g., `/`) redirects back to Login.

---

## 2. Dashboard (`/`)

- **Scenario: View Dashboard Statistics**
    1. Navigate to Dashboard.
    2. **Verify**:
        - **Total Backups**: Displays a number.
        - **Total Storage**: Displays formatted size (e.g., GB/MB).
        - **Active Connectors**: Displays count.
        - **Recent History**: Table shows latest jobs (if any).

---

## 3. Connectors (`/connectors`)

### 3.1 Manage Connectors
- **Scenario: Create Connector (Absolute Path)**
    1. Navigate to **Connectors**.
    2. Click **Add Connector**.
    3. Select Type **Local Folder**.
    4. Enter Name (e.g., "Absolute Source").
    5. Enter an absolute path (e.g., `/tmp/backup-source`).
    6. Click **Save**.
    7. **Verify**: Connector appears in the list.
    8. **Verify**: Click **Test connection** -> Status changes to "Connected".

- **Scenario: Create Connector (Relative Path)**
    1. Click **Add Connector**.
    2. Select Type **Local Folder**.
    3. Enter Name (e.g., "Relative Source").
    4. Enter a relative path (e.g., `./my-backups`).
    5. Click **Save**.
    6. **Verify**: Connector appears.
    7. **Verify**: Test connection succeeds (verifies backend resolves path relative to CWD).

- **Scenario: Create Connector (Home Directory)**
    1. Click **Add Connector**.
    2. Select Type **Local Folder**.
    3. Enter Name (e.g., "Home Source").
    4. Enter a home-relative path (e.g., `~/Documents/backups`).
    5. Click **Save**.
    6. **Verify**: Connector appears.
    7. **Verify**: Test connection succeeds (verifies `~` expansion).

- **Scenario: Create Connector (S3 Compatible)**
    1. Click **Add Connector**.
    2. Select Type **S3 Compatible**.
    3. Enter Name (e.g., "MinIO Backup").
    4. Fill in:
        - **Endpoint**: `http://localhost:9000` (or leave empty for AWS).
        - **Region**: `us-east-1`.
        - **Bucket**: `my-backup-bucket`.
        - **Access Key**: `minioadmin`.
        - **Secret Key**: `minioadmin`.
    5. Click **Save**.
    6. **Verify**: Connector appears.
    7. **Verify**: Test connection succeeds.

- **Scenario: Create Connector (NFS Share)**
    1. Click **Add Connector**.
    2. Select Type **NFS Share**.
    3. Enter Name (e.g., "NAS Backup").
    4. Fill in:
        - **NFS Server**: `localhost` (if using Docker setup above) or your NAS IP.
        - **Export Path**: `/nfsshare` (or your export path).
        - **Mount Options**: `rw,soft,timeo=30,port=22049,mountport=22049` (Add `nolock` if testing locally against docker sometimes requires it).
    5. Click **Save**.
    6. **Verify**: Connector appears.
    7. **Verify**: Test connection succeeds.
        - *Note*: If failing with "Permission denied", ensure the node process has sudo rights or is run as root (ONLY for testing).
    8. **Verify**: Create a backup job using this connector and run it. Check `/tmp/nfs-share` (volume) to see if files appeared.

- **Scenario: Create Connector (Google Drive)**
    1. Click **Add Connector**.
    2. Select Type **Google Drive**.
    3. Enter Name (e.g., "GDrive Backup").
    4. Paste a valid **Service Account JSON** into the text area.
    5. (Optional) Enter a **Folder ID**.
    6. Click **Save**.
    7. **Verify**: Connector appears.
    8. **Verify**: Test connection succeeds (requires valid credentials).

- **Scenario: Create Connector (PostgreSQL Source)**
    1. Click **Add Connector**.
    2. Select Type **PostgreSQL**.
    3. Enter Name (e.g., "App DB").
    4. Fill in:
        - **Host**: `localhost`.
        - **Database**: `myapp_db`.
        - **Username**: `postgres`.
        - **Password**: `password`.
    5. Click **Save**.
    6. **Verify**: Connector appears.
    7. **Verify**: Test connection succeeds.
    8. **Note**: This connector can ONLY be used as a Source in backup jobs.

- **Scenario: Edit Connector**
    1. Click **Edit** icon on an existing connector.
    2. Change the Name or Path.
    3. Click **Save**.
    4. **Verify**: Details are updated in the list.

- **Scenario: Delete Connector**
    1. Click **Delete** icon on a connector.
    2. Confirm the dialog.
    3. **Verify**: Connector is removed from the list.

---

## 4. Backup Jobs (`/jobs`)

### 4.1 Job Management
- **Scenario: List Jobs**
    1. Navigate to **Backup Jobs**.
    2. **Verify**: List of configured jobs is displayed with status (Active/Paused).

- **Scenario: Run Job Manually**
    1. Click the **Play** (Run) button on a specific job.
    2. **Verify**:
        - Button changes to a loading spinner.
        - Success message "Backup completed!" appears after completion.
        - **Last Run** timestamp updates.

- **Scenario: Pause/Resume Job**
    1. Click the **Pause** button on an active job.
    2. **Verify**: Status changes to "Paused". Icon changes to Play.
    3. Click **Resume** (Play icon).
    4. **Verify**: Status changes to "Active".

- **Scenario: Edit Job**
    1. Click the **Menu (three dots)** -> **Edit**.
    2. Change Schedule or Retention settings.
    3. Click **Save Changes**.
    4. **Verify**: Job details card updates with new settings.

- **Scenario: Delete Job**
    1. Click **Menu** -> **Delete**.
    2. Confirm.
    3. **Verify**: Job is removed from the list.

---

## 5. Create Backup (`/create`)

- **Scenario: Create New Backup Task**
    1. Navigate to **Create Backup**.
    2. **Step 1: Source**: Select a Source Connector.
    3. **Step 2: Destination**: Select a Destination Connector.
    4. **Step 3: Configuration**:
        - Set a **Job Name**.
        - Select existing **Schedule** or enter **Custom Cron**.
        - Set **Retention Policy**.
        - Toggle **Compression/Encryption**.
    5. Click **Create Job**.
    6. **Verify**: Redirects to Backup Jobs page. New job is listed.

---

## 6. Restore (`/restore`)

- **Scenario: Restore Data**
    1. Navigate to **Restore**.
    2. Select a **Destination Connector** (where files will be restored).
    3. Locate a backup from the list (sourced from history).
    4. Click **Restore**.
    5. **Verify**:
        - Loading state appears.
        - Success message upon completion.
    6. **Physical Verify**: Check the actual directory of the Destination Connector to confirm files are there.

---

## 7. History (`/history`)

- **Scenario: Filter & Search**
    1. Navigate to **History**.
    2. Enter a job name in **Search**.
    3. **Verify**: List filters to match.
    4. Change **Status Filter** (e.g., to "Failed").
    5. **Verify**: List updates accordingly.

- **Scenario: Job Details & Actions**
    1. Click on a row to expand details.
    2. **Verify**: Shows detailed timestamps, size, and destination path.
    3. **Action: Re-run**: Click **Re-run Backup**.
        - **Verify**: A new job starts and completes.
    4. **Action: Download**: Click **Download** (if local/available).
        - **Verify**: Browser downloads the file.
    5. **Action: Delete**: Click **Delete**.
        - **Verify**: Entry is removed from history.

---

## 8. Settings (`/settings`)

- **Scenario: Update Preferences**
    1. Navigate to **Settings**.
    2. Change **Default Retention** (e.g., to 60 days).
    3. Toggle **Enable email notifications** and enter an email.
    4. Click **Save Settings**.
    5. **Verify**: Success message. Settings persist on page reload.

- **Scenario: Maintenance**
    1. View **Database & Maintenance** card.
    2. Click **Run Cleanup**.
    3. Confirm dialog.
    4. **Verify**: Success message with number of deleted backups (if any expired).

---

## 9. Error Handling (Edge Cases)
    2. Run the job.
    3. **Verify**: Job status becomes "Failed". Error log in History explains the issue.

---

## 10. Security Testing

### 10.1 Rate Limiting
- **Scenario: Brute Force Protection (Login)**
    1. Navigate to `/login`.
    2. Enter incorrect credentials 6 times in a row within 15 minutes.
    3. **Verify**: On the 6th attempt, the server returns 429 Too Many Requests with an error message: "Too many authentication attempts. Please try again later."
- **Scenario: API Rate Limiting**
    1. Rapildy refresh the Dashboard or Connectors page.
    2. **Verify**: The application remains responsive until a high threshold (100 requests) is hit, after which it should throttle.

### 10.2 Path Traversal Prevention
- **Scenario: Malicious Connector Path**
    1. Navigate to **Connectors** -> **Add Connector**.
    2. Try to save a path like `../../etc/passwd` or `/home/user/../../etc/shadow`.
    3. **Verify**: The UI or Backend returns a validation error indicating an invalid path.

### 10.3 Security Headers
- **Scenario: Verify Headers (Inspector)**
    1. Open Browser DevTools (F12) -> **Network** tab.
    2. Refresh the page.
    3. Click on the main document request.
    4. **Verify** Response Headers:
        - `Content-Security-Policy` is present.
        - `Strict-Transport-Security` is present.
        - `X-Frame-Options: DENY` is present.
        - `X-Content-Type-Options: nosniff` is present.

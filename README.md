# AKS Ava Kirolos Scout Project Documentation

## Project Name
AKS Ava Kirolos Scout Group Management System

## Purpose
This project is a scouting group management website for the Ava Kirolos Scout Group. It stores, reviews, searches, edits, and exports scout records, leader records, patrol records, attendance records, follow-up work, and approval workflows.

The application is built as a front-end-only management portal using static HTML, JavaScript, CSS, Tailwind, Font Awesome, and Supabase as the data layer.

## Technology Stack
- HTML pages for each operational page
- JavaScript for page initialization, business rules, filtering, and Supabase CRUD logic
- Tailwind CSS for responsive UI styling
- Font Awesome icons
- Supabase JavaScript client for reading and writing data from the `public` database schema
- Chart.js, html2canvas, jsPDF, and SheetJS for charts, profile printing, PDF export, and Excel export

## Runtime / Hosting
The project is a static website. It can be opened through a browser locally, or served over a simple web server.

Example local server:

```bash
python -m http.server 8000
```

Then open:

http://localhost:8000

## Project File Map

### Main entry points
- `index.html` – login page and new-leader registration modal
- `home.html` – landing dashboard after login
- `dashboard.html` – main scout database dashboard and management UI

### Scout and operational pages
- `form.html` – scout create/edit form
- `follow_up.html` – follow-up task / scout follow-up management
- `attendance_history.html` – historical attendance viewing and search
- `attendance_session.html` – attendance session entry/check-in UI
- `fast_attendance.html` – optimized attendance capture page
- `benchmark.html` – comparative sector/performance dashboard
- `patrols.html` – patrol management and requests
- `add-patrol.html` – add patrol entry page

### Leader / approval pages
- `leaders.html` – leader administration
- `leader_requests.html` – new-leader requests
- `requests.html` – scout add/edit/delete approval requests
- `sector_requests.html` – patrol / sector-level request management
- `my_profile.html` – profile page for logged-in leader

### Supporting SQL migration and data scripts
- `database_migration.sql` – stage normalization and data consistency updates
- `update_leaders_schema.sql` – adds leader profile fields
- `add_scouts_comments.sql` – adds comments to scout records
- `create_scout_requests_table.sql` – scout request approval log schema
- `sync_leaders_to_ashira_gawala.sql` – special leader-to-scout synchronization workflow
- `register_all_leaders_as_scouts.sql` – scout registration sync for leaders

## Application Flow

### Login Path
1. A user lands on `index.html`.
2. The login form reads `username` and `password`.
3. The app queries the `leaders` table in Supabase using `username` and `password`.
4. If the leader record is active (`status` is not pending) the app stores the session in `localStorage` using the key `scout_leader_session`.
5. The user is redirected to `home.html`.

### Registration Path
- `index.html` contains a signup modal that collects leader registration details.
- A new leader request is stored in Supabase through the `leaders` table and the `status` is initially `قيد الانتظار`.
- The Master or General must activate the account for the user to log in.

## Navigation Guide

### Landing dashboard
`home.html` serves as the permission-aware main navigation hub.

The page applies role labels and surfaces a set of dashboard cards such as:

- `dashboard.html` – show scout database
- `form.html` – register new scout
- `follow_up.html` – follow-up tasks / check-in
- `attendance_history.html` – attendance history
- `benchmark.html` – attendance comparison

Cards are hidden or shown based on the user's role, using class visibility rules such as:

- `role-troop-up` visible to `TroopLeader`, `SectorLeader`, `General`, `Master`
- `role-sector-up` visible to `SectorLeader`, `General`, `Master`
- `role-admin` visible to `General` and `Master`

### Main data dashboard
`dashboard.html` contains the main database list.

It exposes:

- Scout search by name or code
- Stage tabs for each scouting stage: `براعم`, `أشبال وزهرات`, `مبتدئ ومرشدات`, `متقدم ورائدات`, `مرشح جوالة`, `عشيرة الجوالة`
- Export to Excel and PDF-style operations
- Modal profile viewer for each scout
- Direct edit/delete if the current user has management permission

## Role-Based Access Model

The application uses the session payload stored in `localStorage` to decide what data and pages a user can access.

Supported roles:

- `Master`
- `General`
- `SectorLeader`
- `TroopLeader`
- `Viewer`

### Access Rules Summary

| Role | Main Access | Database Access | Approvals | Leader Management | Patrol Management |
| --- | --- | --- | --- | --- | --- |
| Master | Full access | Full system | Full | Full | Full |
| General | Full operational access except Master-only administrative setup | Full or all-stage visible | Full | Full | Full |
| SectorLeader | Full access within assigned sector/stage | Sector-aware dataset | Sector request review | Limited to own sector | Sector patrol operation |
| TroopLeader | Read and manage assigned troop scouts, create follow-up tasks | Troop-aware dataset | Requests may go to sector/general/master | Not leader management | Patrol-level allowed |
| Viewer | Login only, limited read-only visibility | Usually blocked for scout records | None | None | None |

## Role-Specific Business Logic

### Master
- The Master can see all groups, all scout records, all leader management screens, and all approval flows.
- The Master acts as the highest system authority.
- The home page shows all available advanced cards.

### General
- The General sees the entire organization and can approve new leader requests and scout requests.
- The dashboard view is not constrained to a single sector.
- The home page exposes the General-only admin cards.

### SectorLeader
- The SectorLeader sees the scout data within their own stage/sector.
- In `fetchScouts()` a sector leader query is filtered by `school_stage` matching the assigned sector map.
- Sector request screens and request review pages are enabled.
- Sector leaders can manage scout records in the visible sector context.

### TroopLeader
- The TroopLeader sees only the scouts belonging to the troop assigned to the leader.
- Troop leaders can create or view follow-up tasks assigned to them.
- Troop leaders may send edit requests instead of changing scout records directly in some cases.
- They cannot view the full master/general data map.

### Viewer
- A `Viewer` account is a limited role that is explicitly blocked from full scout data access in `fetchScouts()`.
- The viewer is allowed to login but cannot use the data management pages in the same way as management roles.

## Data Model

The main operational data tables are expected to be present in Supabase.

### leaders
Stores login and role information for all users.

Important fields include:
- `id`
- `full_name`
- `username`
- `password`
- `role`
- `troop`
- `sector`
- `status`
- `employment_status`
- `job_title`
- `workplace`
- `education_level`
- `university`
- `faculty`
- `academic_year`
- `scouting_experience`

### scouts
Stores the central scout registry.

Important fields include:
- `scout_id`
- `full_name`
- `gender`
- `school_stage`
- `troop`
- `patrol_id`
- `personal_phone`
- `father_phone`
- `mother_phone`
- `address`
- `photo_url`
- `comments`
- `status`

The `school_stage` field is normalized to a unified stage vocabulary:
- `براعم`
- `أشبال وزهرات`
- `مبتدئ ومرشدات`
- `متقدم ورائدات`
- `مرشح جوالة`
- `عشيرة الجوالة`

### patrols
Stores patrol definitions used in the operations dashboard.

### attendance
Stores attendance and scoring records for scouts.

Attendance scoring is derived from the fields:
- `attendance_score`
- `commitment_score`
- `uniform_score`
- `activity_score`

### follow_up_tasks
Stores tasks assigned to leaders for follow-up operations.

Important fields in the bugfix documentation and page logic include:
- `task_date`
- `sector`
- `assigned_to`
- `assigned_to_name`
- `created_by`
- `notes`

### scout_requests
Stores edit/delete requests from troop-level users before approval by higher-level roles.

Columns include:
- `id`
- `scout_id`
- `type`
- `scout_data`
- `school_stage`
- `requested_by`
- `status`
- `created_at`
- `updated_at`

## What Each Page Does

### index.html
This is the authentication page. It contains login and signup workflow. Login requires username and password. Registering a new leader starts a pending approval flow.

### home.html
The home page is the role-aware landing dashboard. It displays the user name, role badge, sector information, peer leader listing, and the cards that navigate to major system screens.

### dashboard.html
The main scout database. It pulls all scouts or approved scouts from Supabase and renders them in a page with tabs, search, filter, export, profile modal, and edit/delete operations.

### form.html
The scout registration/editing UI. It collects personal details, stage, patrol, contact details, health and education data, and uploads scout photo details.

### follow_up.html
A follow-up work management page for checking in with scouts and managing outstanding operational tasks. It is permission-aware and can load tasks for the current leader.

### attendance_history.html
A historical reporting page built around the `attendance` table. It shows attendance records and timeline of evaluations.

### fast_attendance.html
A short path for rapidly recording attendance and scoring for selected dates.

### attendance_session.html
Likely the session attendance capture page used to mark scout attendance for a Scout meeting or event.

### benchmark.html
Benchmarking page that compares attendance and status across groups and sectors.

### patrols.html
Patrol and troop management page. It is exposed to selected leader roles and used to manage patrol visibility and assignment.

### add-patrol.html
Implements the patrol creation screen used by leadership.

### leaders.html
Action page for leader administration: viewing leader profiles, searching them, adding or updating systems, and assigning roles.

### leader_requests.html
Provides the approval tray for new leader registrations.

### requests.html
Provides the approval tray for scout addition/edit/delete requests.

### sector_requests.html
Provide a same-sector approval / patrol request workflow.

### my_profile.html
User profile page that lets a logged-in leader see their profile and possibly edit personal information.

## Access and Workflow Example

### Master workflow
- Logs in at `index.html`
- Open `home.html` and then all cards are visible
- Can view full scout dataset in `dashboard.html`
- Can approve leader requests and scout requests
- Can manage leader records in `leaders.html`

### General workflow
- Logs in at `index.html`
- Sees the full organization inside `home.html`
- Can approve new leader accounts
- Can see sector and scout approval screens

### Sector Leader workflow
- Logs in and sees sector-specific navigation and dataset view
- Views only scouts whose `school_stage` aligns with that sector
- Reviews scout and sector request lists
- May approve edit/delete requests within that sector

### Troop Leader workflow
- Logs in and sees the troop assigned to their `troop` field
- Uses `dashboard.html` filtered to that troop’s scout stage
- Can create follow-up tasks and see assigned follow-up work
- Can submit modification requests for scout approval if direct editing is blocked

## Business Rules and Data Restrictions

The website implements client-side restrictions and DB filtering. Important examples:

- `applyRoleRestrictions()` hides or unlocks page actions based on login session role.
- `fetchScouts()` filters the query for TroopLeader and SectorLeader using stage mapping.
- The Master and General roles can see all scout records without a stage restriction.
- `Viewer` users are blocked from the normal scout pages.
- TroopLeader direct edits are not allowed in the same way as authorized higher roles—the flow sends a request instead of saving directly.

## Security Note
The site uses Supabase client-side credentials (`SUPABASE_URL` and anonymous key) loaded in the browser. This is appropriate for a thin front-end project but means all page access rules must be enforced in the UI and strong database permissions, authentication, and RLS policies should be applied in Supabase for production.

## Production Recommendations
- Move Supabase credentials to a secure administrative server or a deploy-time environment variable rather than embedding them inside static front-end pages.
- Configure Supabase Row Level Security for all tables.
- Add admin-only API routes or server-side checks for high-impact actions.
- Validate users on the server side, not only in the browser.
- Enforce leader activation and role approval from a trusted admin process.

## Development Notes
Because the frontend is static HTML/JS, there are no unit tests or build files present in this repository. Any new page added should:

- Store the current session with `localStorage` under `scout_leader_session`
- Read and enforce `currentUser.role`
- Use Supabase queries against the correct `public` tables
- Reuse the same theme and dashboard layout conventions

## How to Start Working on the Project

1. Open the static site locally using a small web server.
2. Check the login flow in `index.html`.
3. Inspect the page that interests you:
   - `home.html` for navigation
   - `dashboard.html` for scout table logic
   - `app.js` for base role logic
4. Regenerate or update SQL migrations when introducing new columns or tables.
5. Test the UI through Supabase-connected data after logging in as different roles.


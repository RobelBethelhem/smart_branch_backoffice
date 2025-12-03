# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Smart Branch Backoffice** application built on CoreUI Free React Admin Template v5.1.0. It's an enterprise backoffice system for managing branch operations with role-based access control, document generation (letters), and various administrative workflows.

**Backend Repository**: The backend is located at `D:\smart_branch_backend` - a Node.js/Express server that handles:
- Banking transaction requests (deposits, withdrawals, transfers)
- Rental Management System (RMS) operations
- User authentication and authorization
- Integration with MongoDB and Oracle Flexcube banking system
- Document/letter generation workflows

## Development Commands

### Starting Development Server
```bash
npm start
# Runs on http://localhost:4000 (configured in vite.config.mjs)
```

### Building for Production
```bash
npm run build
# Output directory: build/
```

### Linting
```bash
npm run lint
# Lints all JS files in src/
```

### Preview Production Build
```bash
npm run serve
```

## Key Architecture Patterns

### Authentication & Authorization Flow

1. **Redux State Management**: Uses `redux-persist` with `sessionStorage` (not localStorage)
   - Store location: `src/store.js`
   - Auth state includes: `user.role`, `user.accessToken`, `user.refreshToken`
   - Actions: `setUser`, `clearUser`, `loginSuccess`, `logout`

2. **Token Verification**: `PrivateRoute` component verifies tokens on every protected route access
   - Endpoint: `/api/api/verify-token`
   - Token sent via `x-access-token` header
   - Uses `jwt-decode` to extract user roles from JWT

3. **Role-Based Access Control (RBAC)**: Multiple user roles with different permissions
   - Roles: `Super_Admin`, `Admin`, `Teller`, `Maker`, `CSR`, `Authorizer`, `Auditor`, `Branch_Management`, `user`
   - Routes include `roles` array defining allowed roles (see `src/routes.js`)
   - Navigation menu dynamically generated based on user role (see `src/_nav.js`)

### API Communication & Backend Integration

**Backend Server**: Node.js/Express server running on `http://localhost:5000` (default port 5000, configurable)

**Frontend Proxy Setup**:
- All `/api` requests are proxied to `http://localhost:5000` (configured in `vite.config.mjs`)
- Example: Frontend calls `/api/api/login` → proxied to `http://localhost:5000/api/login`
- The double `/api/api` is intentional: first `/api` triggers proxy, second `/api` is the actual backend route

**API Call Pattern**:
```js
const accessToken = useSelector(state => state.user.accessToken)

const response = await fetch('/api/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-access-token': accessToken  // JWT token in header
  },
  body: JSON.stringify(data)
})
```

**Key Backend Endpoints**:

1. **Authentication** (`/api/api/`):
   - `POST /login` - User login, returns accessToken & refreshToken
   - `POST /verify-token` - Verify JWT token validity
   - `POST /signUp` - User registration (default password: `@Test1234`)
   - `GET /getUsers` - Fetch all users
   - `PATCH /editUser` - Edit user details
   - `DELETE /deleteUser` - Delete user

2. **Branch Requests** (`/api/zsmart_branch_requests/`):
   - `GET /get_assigned_to_me` - Get transactions assigned to current user
   - `POST /transaction_posted` - Mark transaction as posted with trn_ref_no
   - Handles deposits, withdrawals, transfers, air ticket payments
   - Uses Oracle Flexcube for banking integration

3. **Letters/Documents** (`/api/`):
   - `POST /experiance/register_request_experiance` - Experience letter requests
   - `POST /embassy/register_request_embassy` - Embassy letter requests
   - `POST /guaranty/register_request_guaranty` - Guaranty letter requests
   - `POST /supportive/register_request_supportive` - Supportive letter requests

4. **Voting System** (`/api/`):
   - `POST /zemen_vote_candidate` - Vote management
   - `GET /candidates` - Candidate data
   - `POST /candidates/game_score` - Game scoring
   - `POST /candidates/employee_excel_upload` - Excel upload

5. **RMS (Rental Management)** (`/api/rms/admin/`):
   - CRUD operations for Place, Site, Building, Floor, Room hierarchies
   - Pricing models for each level
   - Customer and agreement management
   - Site manager KPI tracking

**Authentication Flow**:
1. User logs in via `POST /api/api/login` with email/password
2. Backend validates credentials, returns JWT accessToken (15min) and refreshToken (30d)
3. Frontend stores tokens in Redux state (persisted to sessionStorage)
4. Every API call includes `x-access-token` header with JWT
5. Backend middleware (`auth.js`) verifies token and checks token blacklist
6. Backend middleware (`roleCheck.js`) validates user role against allowed roles
7. Token blacklist prevents token reuse via `UsedToken` model

**Error Response Format**:
```json
{
  "error": true,
  "message": "Error description"
}
```

**Success Response Format**:
```json
{
  "error": false,
  "message": "Success message",
  "data": { /* response data */ }
}
```

**Important Notes**:
- Backend uses ES modules (`import`/`export` syntax)
- MongoDB connection required (default: `localhost:27017`)
- Oracle Instant Client required for Flexcube banking integration
- CORS enabled for all origins in backend
- Token sent as `x-access-token` header (not `Authorization: Bearer`)
- Some endpoints return direct URLs to backend: use `http://localhost:5000` for development

### State Management

Uses **legacy Redux** (not Redux Toolkit for main store, though RTK is available):
- Main store: `src/store.js` - simple reducer with switch statements
- State persisted to sessionStorage via `redux-persist`
- Key state slices:
  - `sidebarShow`: sidebar visibility
  - `theme`: 'light' or 'dark'
  - `user`: auth credentials and role
  - `aggrementDetailId`: workflow-specific ID
  - `siteManagerID`: manager context
  - `isVote`: voting flag

### Routing Architecture

- Uses **HashRouter** (not BrowserRouter) - important for deployment
- Routes defined in `src/routes.js` with lazy loading for all views
- All protected routes wrapped in `<PrivateRoute>` with role checks
- Main layout: `DefaultLayout` contains sidebar, header, breadcrumb, content area

### View Structure

Views organized by user role under `src/views/`:
- `admin/` - admin-specific views (Approval, Audit, Authorize, Branch_Record, Candidate, Chat, Letters, System_User_Management, etc.)
- `user/` - end-user views
- `pages/login/` - authentication pages
- `theme/` - theme demo pages

Key view patterns:
- Most views use **material-react-table** for data grids
- DetailPanel components for expandable row details
- Modal forms for create/edit operations
- PDF generation via `jspdf` and `react-pdf`

### Component Organization

- `src/components/` - shared UI components
  - `AppHeader`, `AppFooter`, `AppSidebar`, `AppBreadcrumb`, `AppContent`
  - `AppSidebarNav` - dynamic navigation based on role
  - `LogOut` - logout functionality
  - `header/AppHeaderDropdown` - user dropdown menu

### Document Generation

Multiple letter generation views in `src/views/admin/`:
- `Experiance_Letter/` - Experience letters
- `Letter_Of_Embassy/` - Embassy letters
- `Guaranty_Letter/` - Guaranty letters
- `Supportive_Letter/` - Supportive letters
- `Letters/` - Consolidated letter templates

Pattern: Uses `qrcode.react` for QR codes, `jspdf` for PDF export, `html2canvas` for rendering

### Styling

- **CoreUI React components** as primary UI library
- **Material-UI (MUI)** components for complex forms and tables
- **SCSS** for custom styling (`src/scss/`)
- **Tailwind CSS** configured (see `tailwind.config` in dependencies)
- Theme switching supported (light/dark) stored in Redux

### Important Configuration Details

1. **JSX Handling**: Vite configured to treat `.js` files as JSX (see `vite.config.mjs` esbuild loader)
2. **Prettier**: No semicolons, single quotes, 100 char width (see `.prettierrc.js`)
3. **Port**: Dev server runs on port 4000, not default 3000
4. **Build Output**: `build/` directory, not `dist/`

## Common Workflows

### Adding a New Protected Route

1. Create lazy-loaded component in `src/routes.js`:
   ```js
   const MyNewView = React.lazy(() => import('./views/admin/MyNewView/MyNewView'))
   ```

2. Add route definition with roles:
   ```js
   {
     path: '/admin/my-new-view',
     name: 'My New View',
     element: MyNewView,
     roles: ['Admin', 'Teller']
   }
   ```

3. Add navigation item in `src/_nav.js` within appropriate role block

### Making API Calls

**Standard Pattern** (with proxy):
```js
const accessToken = useSelector(state => state.user.accessToken)

const response = await fetch('/api/api/your-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-access-token': accessToken
  },
  body: JSON.stringify(data)
})

const result = await response.json()
if (response.ok) {
  // Handle success: result.error === false
  console.log(result.data)
} else {
  // Handle error: result.error === true
  toast.error(result.message)
}
```

**Direct Backend Call Pattern** (some views use this):
```js
const response = await fetch('http://localhost:5000/api/zsmart_branch_requests/endpoint', {
  headers: {
    'Content-Type': 'application/json',
    'x-access-token': accessToken
  }
})
```

**Using React Query** (modern approach, used in some views):
```js
import { useQuery } from '@tanstack/react-query'

const { data, isError, isLoading } = useQuery({
  queryKey: ['transactions'],
  queryFn: async () => {
    const response = await fetch('/api/zsmart_branch_requests/get_assigned_to_me', {
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': accessToken
      }
    })
    const json = await response.json()
    return json.data
  }
})
```

### Working with Redux State

```js
import { useDispatch, useSelector } from 'react-redux'

// Reading state
const theme = useSelector(state => state.theme)
const userRole = useSelector(state => state.user.role)

// Updating state
const dispatch = useDispatch()
dispatch({ type: 'set', theme: 'dark' })
dispatch({ type: 'setUser', role: 'Admin', accessToken: token })
```

## Dependencies of Note

- **@coreui/react** - Primary UI component library
- **@mui/material** - Material-UI for complex components
- **material-react-table** - Advanced data tables
- **react-redux** + **redux-persist** - State management
- **axios** - HTTP client (available but fetch API also used)
- **react-router-dom v6** - Routing
- **jspdf**, **jspdf-autotable** - PDF generation
- **react-pdf** - PDF viewing
- **qrcode.react** - QR code generation
- **react-toastify** - Notifications
- **date-fns**, **dayjs** - Date utilities
- **jwt-decode** - JWT parsing
- **framer-motion** - Animations
- **recharts** - Charts
- **export-to-csv** - CSV export

## Special Features

1. **Games Module**: Contains bingo game implementations with text-to-speech (BingoGame, BingoTv, GoldDiggerGame)
2. **Voting System**: Employee/candidate voting with statistics
3. **Branch Record Management**: Transaction records and audit trails
4. **Approval Workflow**: Multi-stage approval system (Maker → Teller → Authorizer → Auditor)
5. **Reassignment**: Request reassignment between users

## Running the Full Stack

### Prerequisites
1. **MongoDB** - Must be running on `localhost:27017`
2. **Oracle Instant Client** (optional, for Flexcube integration)
3. **Node.js 14+** for backend ES modules support

### Starting Backend
```bash
cd D:\smart_branch_backend
npm install
npm start  # Runs on http://localhost:5000 with nodemon
```

### Starting Frontend
```bash
cd D:\smart_branch_backoffice
npm install
npm start  # Runs on http://localhost:4000
```

### Environment Variables (.env in backend)
Required backend environment variables:
- `PORT` - Server port (default: 5000)
- `DB` - MongoDB connection string
- `ACCESS_TOKEN_PRIVATE_KEY` - JWT access token secret
- `REFRESH_TOKEN_PRIVATE_KEY` - JWT refresh token secret
- `SALT` - Bcrypt salt rounds
- `FLEXCUBE_DB_USER`, `FLEXCUBE_DB_PASSWORD`, `FLEXCUBE_DB_CONNECTION_STRING` - Oracle connection
- `ORACLE_CLIENT_PATH` - Path to Oracle Instant Client

## Backend Database Schema

**MongoDB Collections** (key models):
- `users` - System users with roles, credentials, site assignments
- `deposits`, `withdraws`, `transfers`, `other_bank_transfers`, `air_ticket_payments` - Transaction requests
- `candidates` - Voting candidates
- `experianceletter`, `guarantyletter`, `embassyletter`, `supportiveletter` - Letter requests
- `places`, `sites`, `buildings`, `floors`, `rooms` - RMS hierarchy
- `customers`, `aggrements` - RMS customer data
- `usedtokens` - JWT token blacklist

**Oracle Flexcube** (read-only integration):
- Account information queries
- Transaction history
- Customer data verification

## Development Notes

- Files may have `.js` extension but contain JSX - this is intentional for this project
- Multiple commented-out code blocks in store.js show evolution of state management approach
- Some views have clone/backup versions (e.g., approvalclone.js, BranchRecordBackup.js) - these may be experimental versions
- Navigation items are role-dependent - test with different user roles to see full navigation
- Backend has comprehensive CLAUDE.md at `D:\smart_branch_backend\CLAUDE.md` for detailed backend documentation
- Backend route `ZSmartBrannchRequests.js` is 138KB - contains extensive banking transaction logic
- Default test password for new users: `@Test1234`

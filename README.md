# Parental Eye — Backend (Express API)

The backend API for **Parental Eye**, a real-time child/vehicle location-tracking platform. It handles authentication, user/role management, device management, geofencing, live location ingestion via MQTT, and real-time notifications via Socket.IO. It's built to be consumed by the [Parental Eye React frontend](https://github.com/maferozi/parental-eye-react).

## Overview

Tracking devices publish their GPS coordinates to an MQTT broker (HiveMQ). This service subscribes to every active device's topic, checks each incoming location against that device's assigned geofences (circle, polygon area, or route), stores the result in PostgreSQL/PostGIS, and broadcasts live updates and alerts (geofence exits, danger signals, device status changes) to every user associated with that device — child, guardian, driver, and admin — over Socket.IO.

## Features

- **JWT authentication** — register, login, refresh tokens, email verification, forgot/reset password.
- **Role-based user hierarchy** — Super Admin → Admin → Guardian (parent) → Child / Driver, modeled as self-referencing relations on a single `Users` table.
- **Device management** — CRUD, assignment/unassignment of devices to parents and children, unassigned-children lookup, active device listing.
- **Geofencing** — create/delete geofences (circle, polygon area, or route), assign/unassign to devices, stored as native PostGIS geometry.
- **Real-time location ingestion** — MQTT subscriber per active device; geospatial safe/danger checks using Turf.js; automatic active/inactive status detection (30s inactivity timeout).
- **Live push updates** — Socket.IO events for device status changes, new locations, danger alerts, and notifications.
- **Notifications** — persisted per-user notifications with a 5-minute cooldown to prevent duplicate geofence-alert spam.
- **Location history** — per-device/user location history with safe/danger status per point.

## Tech Stack

- **Runtime/Framework:** Node.js, Express 4
- **Database/ORM:** PostgreSQL + PostGIS, Sequelize (with Sequelize CLI migrations)
- **Real-time:** MQTT.js (HiveMQ broker), Socket.IO
- **Auth:** jsonwebtoken, bcrypt
- **Geospatial:** @turf/turf
- **Email:** Nodemailer + nodemailer-express-handlebars
- **Other:** cors, morgan, dotenv, faker/@faker-js/faker (seed data)

## Project Structure

```
config/            # Sequelize DB config, MQTT connection setup, Socket.IO setup
constants/         # Shared constants
controller/        # Route handlers (auth, device, geofence, location, notification, invitedUser, home)
email/             # Email templates/senders (verify email, reset password)
helper/            # Business logic helpers (hashing, JWT, mail, caching, location/geofence storage, notifications)
middlewares/       # authenticate.js — JWT auth middleware
migrations/        # Sequelize migrations (users, devices, locations, geofences, notifications, PostGIS setup)
models/            # Sequelize models (User, Device, Geofence, GeofenceDevice, Location, Notification)
router/            # Express routers, mounted under /api
app.js             # App entry point (Express + HTTP server, MQTT, Socket.IO, DB connection)
```

## Data Model

| Model | Purpose |
|---|---|
| `User` | All accounts (Super Admin, Admin, Guardian, Child, Driver). Self-referencing `adminId`, `parentId`, `driverId` encode the hierarchy. Includes status (approved/pending/rejected) and email verification fields. |
| `Device` | A tracking device, linked to a `User` (owner) and optionally a parent; many-to-many with `Geofence` via `GeofenceDevice`. |
| `Geofence` | A safe zone of type `area` (polygon), `route` (linestring), or `circle` (point + radius), stored as PostGIS geometry (SRID 4326). |
| `GeofenceDevice` | Join table linking devices to their assigned geofences. |
| `Location` | Historical location points per device, with `location_status` (1 = safe, 2 = danger). |
| `Notification` | Per-user notifications (e.g. geofence alerts), with arbitrary JSON `data`. |

## API Reference

All routes are mounted under `/api`.

### Auth — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register a new user |
| POST | `/login` | Log in, receive JWT |
| GET | `/me` | Get current authenticated user |
| GET | `/verify-email/:token` | Verify email via token |
| POST | `/refresh-token` | Refresh access token |
| POST | `/forget-password` | Request password reset email |
| POST | `/reset-password` | Reset password with token |
| GET | `/get-admin-parent` | Get admin/parent relations |

### Users / Invitations — `/api/invite-user`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Add or update an invited user |
| GET | `/` | List all invited users |
| GET | `/parent` | List all parents/guardians |
| GET | `/driver` | List all drivers |
| GET | `/:id` | Get user by ID |
| DELETE | `/:id` | Remove a user |

### Devices — `/api/device`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Create a device |
| GET | `/` | List all devices |
| GET | `/unassigned-child` | List children not yet assigned a device |
| GET | `/active-devices` | List currently active devices |
| GET | `/:id` | Get device by ID |
| PUT | `/:id` | Update a device |
| DELETE | `/:id` | Delete a device |
| POST | `/update-status` | Assign a device to a parent |
| POST | `/assign-child` | Assign a device to a child |
| PUT | `/unassign-parent/:id` | Unassign a device from its parent |
| PUT | `/unassign-child/:id` | Unassign a device from its child |

### Geofences — `/api/geofence`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List all geofences |
| GET | `/get-assigned-devices` | List devices assigned to a geofence |
| POST | `/` | Create a geofence |
| POST | `/assign` | Assign a geofence to a device |
| POST | `/unassign` | Unassign a geofence from a device |
| DELETE | `/:id` | Delete a geofence |

### Location — `/api/location`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Get location history by user/device |
| GET | `/` | Get users with their location history |

### Notifications — `/api/notification`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/unread` | Get paginated unread notifications |

### Misc
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ping` | Health check |

All routes above (except registration/login/password-reset/email-verification) require a `Bearer` JWT in the `Authorization` header.

## MQTT & Real-Time Flow

1. On startup, all devices are reset to `inactive`, then the server subscribes to every device that has both a `parentId` and `userId` set.
2. Each device publishes to two topics: `tracking/location/{deviceName}` and `tracking/danger/{deviceName}`.
3. **Location messages** are checked against the device's assigned geofences using Turf.js (point-in-polygon for areas, distance-to-line for routes, distance-to-center for circles) to mark the point safe or unsafe, then saved to `Location`. The device is marked `active`; if no message arrives for 30 seconds it's marked `inactive`.
4. **Danger messages** immediately trigger a danger alert to all associated users.
5. Alerts and status changes are pushed to affected users (child, guardian, driver, admin) via Socket.IO, and geofence-exit alerts are persisted as `Notification` records with a 5-minute cooldown per user/device to avoid duplicate spam.

## Getting Started

### Prerequisites

- Node.js 20.x
- PostgreSQL with the **PostGIS** extension available
- An MQTT broker (HiveMQ) connection string
- SMTP credentials for outgoing email (verification/reset)

### Installation

```bash
git clone https://github.com/maferozi/parental-eye-express.git
cd parental-eye-express
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
NODE_ENV=development

DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=
DB_HOST=
DB_PORT=
DB_DIALECT=postgres

EMAIL_USER=
EMAIL_PASS=
DEFAULT_MAIL_SENDER=

JWT_SECRET_KEY=

HIVEMQ_CONNECTION_STRING=
FORNTEND_URL=
PORT=3000
```

| Variable | Description |
|---|---|
| `NODE_ENV` | Environment mode |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` / `DB_HOST` / `DB_PORT` / `DB_DIALECT` | PostgreSQL connection settings (dialect should be `postgres`, with PostGIS enabled) |
| `EMAIL_USER` / `EMAIL_PASS` / `DEFAULT_MAIL_SENDER` | SMTP credentials for verification/reset emails |
| `JWT_SECRET_KEY` | Secret used to sign JWTs |
| `HIVEMQ_CONNECTION_STRING` | MQTT broker connection string (`wss://...`) used for live device tracking |
| `FORNTEND_URL` | Frontend URL (used for CORS/links in emails) |
| `PORT` | Port the server listens on (default `3000`) |

### Database Setup

```bash
npm run db:migrate
# optional: seed sample data
npm run db:seed
```

Migrations include enabling the PostGIS extension and creating the users, devices, locations, geofences, and notifications tables.

### Run in development

```bash
npm run dev
```

### Build & run in production

```bash
npm run build
npm start
```

## Related Repository

- Frontend: [parental-eye-react](https://github.com/maferozi/parental-eye-react)

## License

No license specified.v 

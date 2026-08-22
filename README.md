# AZ Panel

A web-based Minecraft server control panel with support for mobile and desktop browsers.

## Features

- **Server Management** — Create, start, stop, restart, and kill Minecraft servers (Vanilla, Paper, Purpur, Spigot, Fabric, Forge, NeoForge)
- **Live Console** — Real-time console output with command sending
- **File Manager** — Browse, edit, rename, upload, and download server files
- **Backups** — Create, restore, and delete server backups
- **Mod Support** — Search and install mods from Modrinth
- **User Management** — Multi-user support with owner/admin/user roles
- **Audit Log** — Track all panel actions
- **Responsive Design** — Works on mobile phones, tablets, and desktop computers
- **Customizable** — Custom panel name, theme color, logo, and login background
- **Authentication** — Login with username or email, JWT-based sessions

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Node.js, Express, SQLite (better-sqlite3)
- **Build:** Vite
- **Icons:** Lucide React

## Getting Started

```bash
npm install
npm run build
npm start
```

Then open your browser to the displayed URL. On first launch, you'll be guided through a setup wizard to create your admin account.

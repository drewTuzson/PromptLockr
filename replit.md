# PromptLockr

## Overview

PromptLockr is a full-stack AI prompt management system designed to help AI power users organize, store, and retrieve prompts across multiple AI platforms. The application is built using a modern web stack with React/TypeScript on the frontend, Express.js for the backend API, and PostgreSQL with Drizzle ORM for data persistence. The system supports user authentication, prompt categorization, search functionality, and data export/import capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**September 25, 2025 - Layout Consistency Fix**
- **Issue Resolved**: Fixed persistent styling issues on Folders and Templates pages caused by incorrect sidebar CSS positioning
- **Root Cause**: FoldersPage and TemplatesPage were using `lg:relative` instead of correct `lg:sticky lg:top-[73px]` CSS classes
- **Solution**: Created shared `DashboardLayout` component in `client/src/components/ui/dashboard-layout.tsx` 
- **Implementation**: Updated both FoldersPage and TemplatesPage to use shared layout component, eliminating CSS drift
- **Benefits**: Ensures 100% layout consistency, prevents future regressions, saves debugging time

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Comprehensive component library based on Radix UI primitives with shadcn/ui styling
- **Styling**: Tailwind CSS with CSS variables for theming support
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API endpoints for authentication, prompts, folders, and data management
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **Request Logging**: Custom middleware for API request logging and debugging
- **Development**: Hot module replacement with Vite middleware integration for development

### Data Storage
- **Database**: PostgreSQL with connection via Neon Database serverless driver
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **Schema**: Well-defined tables for users, prompts, and folders with proper relationships
- **Migrations**: Drizzle Kit for database schema migrations and management

### Authentication & Authorization
- **Strategy**: JWT token-based authentication stored in localStorage
- **Security**: Password hashing with bcryptjs, secure token generation and verification
- **Session Management**: Client-side token storage with automatic header injection
- **Route Protection**: Higher-order components for authenticated and guest-only routes

### Key Features
- **Prompt Management**: Create, read, update, delete operations for AI prompts
- **Platform Support**: Multi-platform categorization (ChatGPT, Claude, Midjourney, DALL-E, Other)
- **Organization**: Folder-based organization system with nested structure support
- **Search**: Full-text search across prompt titles, content, and tags
- **Favorites**: Mark prompts as favorites for quick access
- **Recent Access**: Track and display recently accessed prompts
- **Data Portability**: Export/import functionality for backup and migration
- **Responsive Design**: Mobile-first responsive design with adaptive layouts

## External Dependencies

### Database
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle ORM**: Type-safe database operations and schema management
- **Drizzle Kit**: Database migration and schema management tools

### UI & Styling
- **Radix UI**: Unstyled, accessible UI component primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **shadcn/ui**: Pre-built component library built on Radix UI and Tailwind
- **Lucide React**: Icon library for consistent iconography

### State Management
- **TanStack Query**: Server state management, caching, and synchronization
- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation for type-safe data handling

### Authentication
- **jsonwebtoken**: JWT token generation and verification
- **bcryptjs**: Password hashing and verification

### Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Static type checking and enhanced developer experience
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind CSS integration

### Deployment
- **Replit**: Cloud-based development and hosting platform
- **Environment Variables**: Secure configuration management for database URLs and JWT secrets
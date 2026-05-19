# Product Requirements Document (PRD): CareerCRM
**Author:** Mayank Choradia
**Project Type:** Application Management System with AI-Powered Gmail Add-on

## 1. Executive Summary
CareerCRM is a centralized tracking system designed to manage high-volume job and university applications. It eliminates the manual data-entry fatigue of traditional spreadsheets by utilizing a native Google Workspace (Gmail) Add-on. When a user receives an application update (e.g., an interview invite or rejection), they can sync it directly from their open email. An LLM backend processes the email, extracts structured data, and automatically updates a Kanban-style tracking dashboard.

## 2. Target Architecture & Tech Stack
* **Frontend Framework:** Next.js (App Router), React, Tailwind CSS
* **Database:** PostgreSQL (with Prisma or Drizzle ORM)
* **Add-on Integration:** Google Workspace Alternate Runtimes (HTTP API Endpoints in Next.js)
* **AI/LLM:** OpenAI API or Google Gemini API (for structured JSON extraction)
* **Deployment:** Vercel (Frontend/API) and Supabase/Neon (PostgreSQL Database)

## 3. Core Features & Requirements

### 3.1. The User Dashboard (Web App)
* **Kanban Board:** Visual, drag-and-drop board with standard columns: *Saved, Applied, Assessment/OA, Interviewing, Offer, Rejected*.
* **Application Detail View:** Clicking a card reveals the full history (dates of updates, role description, extracted deadlines).
* **Document Vault (Future Phase):** Central storage for standard resumes and cover letters.
* **Analytics View:** A dashboard calculating response rates, average time-to-response, and a funnel of total applications to offers.

### 3.2. The Gmail Add-on (Google Workspace Alternate Runtime)
* **Trigger:** Activates contextually when a user opens an email.
* **UI:** Renders via Google's Card Service JSON structure delivered by a Next.js API route.
* **Data Flow:** Uses temporary OAuth scope `gmail.addons.current.message.readonly` to read the currently open message when the user clicks "Sync".

### 3.3. AI Extraction Pipeline
* **Input:** Raw, plain text extracted from the active Gmail message using the Gmail API.
* **Processing:** Passes text to an LLM with strict system instructions to output a standardized JSON object.
* **Data Schema for LLM Extraction:**
    * `company_name` (String)
    * `role_title` (String)
    * `status_update` (Enum: APPLIED, ASSESSMENT, INTERVIEW, OFFER, REJECTION)
    * `action_items` (String/Nullable - e.g., "Complete OA within 72 hours")
    * `confidence_score` (Float)

## 4. API Endpoints Reference

* `POST /api/addon/homepage`
    * **Purpose:** Returns the UI layout (JSON) for the Gmail Add-on sidebar.
* `POST /api/addon/sync`
    * **Purpose:** Receives the `messageId` and `userOAuthToken` from the Add-on. Fetches the email text, triggers the LLM, and updates PostgreSQL.

---

## 5. Security & Compliance
* No background inbox scanning. The system only processes data explicitly triggered by the user via the Add-on UI.
* Bypasses Google's CASA security audit by relying strictly on the Sensitive (not Restricted) Contextual Trigger scopes.

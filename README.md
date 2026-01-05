# Tracey | AI-Powered Lost & Found Platform

Tracey is an intelligent recovery ecosystem that uses Multimodal AI and Semantic Search to reunite people with their lost belongings. By automating the identification, matching, and notification process, Tracey replaces fragmented manual systems with a secure, automated digital hub.

## The Problem
Traditional lost-and-found processes are broken. Information is scattered across WhatsApp groups and physical notice boards, manual logging is slow, and public posts often expose sensitive personal data (like IDs) to the public.

## Key Features
* **AI Auto-Logging:** Uses Google Gemini Vision to automatically extract item attributes (type, color, brand) from a single photo.
* **Semantic Search:** Enables "human-like" natural language queries (e.g., "blue leather bag") using Vector Embeddings.
* **Privacy-First Redaction:** Automatically detects and blurs sensitive PII (Personally Identifiable Information) on IDs using AI before publication.
* **Automated Matching:** A real-time engine calculates Cosine Similarity between lost and found reports to find matches instantly.
* **Instant Notifications:** Automated alerts via Email (Resend) and Push Notifications (FCM) when a high-probability match is detected.

## Tech Stack
* **Frontend:** Next.js, Tailwind CSS, Lucide Icons
* **Backend & Auth:** Firebase (Authentication, Firestore, Admin SDK)
* **Artificial Intelligence:** Google Gemini (2.0 Flash & Text Embeddings)
* **Media Handling:** Cloudinary (Storage & AI Redaction)
* **Communication:** Resend API (Email) & Firebase Cloud Messaging (Push)
* **Deployment:** Vercel

## How It Works
1.  **Report:** User uploads a photo or description of a lost/found item.
2.  **Process:** Gemini AI analyzes the image, generates tags, and creates a mathematical vector embedding.
3.  **Secure:** If an ID is detected, the system blurs sensitive areas via Cloudinary.
4.  **Match:** The system runs a Cosine Similarity check against the database.
5.  **Reunite:** If a match exceeds a confidence threshold, both parties are notified instantly.

## Process flowchart
<img width="1305" height="793" alt="diagram-export-1-4-2026-4_13_21-PM" src="https://github.com/user-attachments/assets/12e0d5ab-a04b-4763-af40-2144ea2a6c23" />


## Architecture
<img width="2156" height="1003" alt="diagram-export-1-4-2026-4_30_09-PM" src="https://github.com/user-attachments/assets/b63fdebf-3533-4ade-9362-5b9aa8b9269c" />



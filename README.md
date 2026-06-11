# Veenolex - Quick Commerce Platform

Veenolex is a full-stack quick commerce application consisting of a React frontend and a Node.js backend. This repository is structured as a monorepo containing:
- `/frontend`: React client application built with Vite and TailwindCSS.
- `/backend`: Node.js API server, background worker, and scheduler services.

---

## 🚀 Deployment

The recommended way to deploy Veenolex is to host the React frontend on **Netlify** and the backend services on **Render** (or any other container host).

### Frontend Deployment (Netlify)

You can deploy the frontend of this repository directly to Netlify.

#### One-Click Deploy
Click the button below to initiate deployment on your Netlify account:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/harshu-panchal/veenolex)

#### Manual Deployment Steps via Netlify Dashboard
1. Log in to [Netlify](https://app.netlify.com/) and click **Add new site** -> **Import an existing project**.
2. Select your Git provider and select the `harshu-panchal/veenolex` repository.
3. Configure the **Build Settings**:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist` (or `dist` if Netlify automatically switches to the base directory)
4. Add the required Environment Variables in the **Environment variables** section (see below).
5. Click **Deploy site**.

#### Environment Variables (Frontend)
Make sure to configure the following environment variables in your Netlify site settings (under **Site configuration** -> **Environment variables**):

| Variable Name | Description | Example / Value |
|---|---|---|
| `VITE_API_URL` | The URL of your deployed backend API | `https://your-backend-api.render.com/api` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key for maps & delivery address tracking | *Your Google Maps API Key* |
| `VITE_FIREBASE_API_KEY` | Firebase API Key | *Your Firebase API Key* |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain | `appzeto-quick-commerce.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Database URL | `https://appzeto-quick-commerce-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `appzeto-quick-commerce` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `appzeto-quick-commerce.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | `477007016819` |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | `1:477007016819:web:cc5fafe34a8b25b24a8b06` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Measurement ID | `G-NKHFJRKT0Z` |
| `VITE_FIREBASE_VAPID_KEY` | Firebase VAPID Key for notifications | *Your VAPID key* |

---

### Backend Deployment (Render)

The backend is fully configured for deployment on Render.com using the provided `backend/render.yaml` file.

1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Blueprint**.
3. Connect the `harshu-panchal/veenolex` repository.
4. Render will automatically parse the `backend/render.yaml` file and create the API, Worker, and Scheduler services.
5. Setup a managed Redis instance on Render and connect it to the services using the `REDIS_URL` environment variable.
6. Configure the `MONGO_URI`, `JWT_SECRET`, and other credentials in the Render dashboard environment settings.

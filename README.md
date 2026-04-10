# 🌱 Verdant (Working Title)

## 📌 Overview

Verdant is a modern plant care tracking web application designed to help users manage and monitor their plants efficiently. It combines simple tracking features with AI-powered insights to improve plant health and user engagement.

---

## 🎯 Goals

* Help users track plant care activities
* Provide reminders for watering, fertilizing, and pruning
* Offer AI-based plant health insights
* Deliver a clean, modern, portfolio-worthy UI/UX

---

## 🚀 Core Features

### 1. Plant Management

* Add, edit, delete plants
* Store plant details (name, type, location)
* Upload plant images

### 2. Care Tracking

* Watering schedule
* Fertilizing schedule
* Pruning tracking
* Custom notes per plant

### 3. Reminders & Notifications

* Daily reminders for plant care
* Upcoming task alerts

### 4. Dashboard

* Overview of all plants
* Tasks due today
* Activity timeline

### 5. Calendar View

* Monthly view of plant care tasks
* Task filtering by plant and activity

### 6. AI Integration (Phase 2)

* Upload plant image
* Detect plant health issues
* Provide suggestions (overwatering, sunlight issues, etc.)
* Optional AI chat assistant

---

## 🧱 Tech Stack

### Frontend

* React / Next.js
* Tailwind CSS
* Component-based architecture

### Backend

* Node.js + Express
* REST API

### Database

* MongoDB / PostgreSQL

### Authentication

* JWT-based authentication

### AI Integration

* Google Gemini API

---

## 🧩 System Architecture

### Client

* UI components
* State management
* API integration

### Server

* REST API endpoints
* Business logic
* Authentication middleware

### Database

* Stores users, plants, schedules, and logs

### AI Service

* Image processing
* Health analysis

---

## 📊 Data Models

### User

* id
* name
* email
* password

### Plant

* id
* userId
* name
* type
* location
* image
* createdAt

### CareSchedule

* id
* plantId
* wateringFrequency
* fertilizingFrequency
* pruningFrequency

### ActivityLog

* id
* plantId
* action (watered, fertilized, pruned)
* date
* notes

---

## 📄 Pages & UI Structure

### 1. Dashboard

* Overview cards
* Today's tasks
* Plant preview grid
* Activity timeline

### 2. My Plants

* Plant grid
* Filters and search

### 3. Add Plant

* Form with image upload

### 4. Plant Detail

* Plant info
* Care schedule
* Timeline

### 5. Calendar

* Monthly task view

### 6. AI Health Analysis

* Image upload
* Results display

### 7. Settings

* Profile
* Notifications

### 8. Auth

* Login / Signup

---

## 🛠️ API Endpoints (Sample)

### Auth

* POST /api/auth/signup
* POST /api/auth/login

### Plants

* GET /api/plants
* POST /api/plants
* GET /api/plants/:id
* PUT /api/plants/:id
* DELETE /api/plants/:id

### Activities

* POST /api/activities
* GET /api/plants/:id/activities

### AI

* POST /api/ai/analyze

---

## 🗺️ Roadmap

### Phase 1 (MVP)

* Plant CRUD
* Care tracking
* Dashboard
* Basic reminders

### Phase 2

* AI image analysis
* Smart suggestions

### Phase 3

* UI/UX polish
* Analytics
* Advanced notifications

---

## 🎨 Design Principles

* Minimal and clean UI
* Nature-inspired colors
* Card-based layout
* Responsive design

---

## 🧠 Unique Selling Point

* AI-powered plant health insights
* Plant timeline (activity history like a feed)

---

## ⚠️ Challenges

* AI accuracy limitations
* Notification scheduling
* Image processing latency

---

## 📌 Future Enhancements

* Community features
* Plant sharing
* Advanced analytics
* Mobile app version

---

## 🏁 Conclusion

Verdant aims to be a smart, user-friendly plant care assistant that blends tracking with AI to enhance user experience and plant health management.

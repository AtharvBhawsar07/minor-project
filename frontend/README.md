# 📚 LibraCard — Digital Library Card Management System

> **Academic Project | SRS Compliant | React.js + Bootstrap**

---

## 🎯 Project Overview

**LibraCard** is a complete frontend web application for managing digital library cards, books, and fines. Built with React.js functional components, React Router DOM, and Bootstrap, it simulates a real-world library management system with role-based access for Students, Librarians, and Administrators.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm start

# App opens at http://localhost:3000
```

---

## 🔑 Demo Credentials

| Role       | Email                 | Password    |
|------------|-----------------------|-------------|
| Student    | student@lib.com       | student123  |
| Librarian  | librarian@lib.com     | lib123      |
| Admin      | admin@lib.com         | admin123    |

You can also register a new account from the Register page.

---

## 🗂️ Project Structure

```
digital-library/
├── public/
│   └── index.html              # HTML entry point + CDN links
├── src/
│   ├── App.js                  # Root component — Router + Routes
│   ├── index.js                # ReactDOM render
│   ├── index.css               # Global styles + CSS variables
│   │
│   ├── context/
│   │   └── AuthContext.js      # Global auth state (login/logout/currentUser)
│   │
│   ├── services/
│   │   └── data.js             # Dummy data + localStorage helpers
│   │
│   ├── components/
│   │   ├── Navbar.js           # Responsive nav with role-aware links
│   │   ├── Footer.js           # Site footer
│   │   └── ProtectedRoute.js   # Auth guard + role restriction
│   │
│   └── pages/
│       ├── HomePage.js         # Landing page with hero + features
│       ├── LoginPage.js        # Login form with validation
│       ├── RegisterPage.js     # Registration form with validation
│       ├── DashboardPage.js    # Role-based dashboard
│       ├── BooksPage.js        # Book catalog (table + search/filter)
│       ├── RequestCardPage.js  # Library card request form
│       ├── FinesPage.js        # Fine records (table + search/filter)
│       └── NotFoundPage.js     # 404 page
├── package.json
└── README.md
```

---

## 📄 Pages & Features

### 1. 🏠 Home Page (`/`)
- Hero section with animated card illustration
- Stats bar (books, roles, access info)
- Feature cards grid (6 features)
- Demo credentials display
- CTA section for new users

### 2. 🔐 Login Page (`/login`)
- Email + password fields with validation
- Show/hide password toggle
- Quick-fill buttons for demo roles (Student / Librarian / Admin)
- Error messages for invalid credentials
- Submit + Reset buttons
- Link to Register

### 3. 📝 Register Page (`/register`)
- Full name, email, phone, role selection
- Conditional fields: Enrollment No. (Student) / Employee ID (Librarian/Admin)
- Password + confirm password with match validation
- Duplicate email check
- Submit + Reset buttons

### 4. 📊 Dashboard (`/dashboard`) — Role-Based
- **Student**: Stats (books available, card requests, unpaid fines), Quick Actions, My Requests table
- **Librarian**: Stats, Pending requests table with Approve/Reject buttons
- **Admin**: Stats, Progress bars, System overview with totals

### 5. 📚 Books Page (`/books`)
- Full book catalog in sortable table
- Search by title, author, or ISBN
- Filter by category dropdown
- Availability status badges
- Summary stat cards

### 6. 💳 Request Card Page (`/request-card`) — Students Only
- Student name + enrollment number (auto-filled from session)
- Book selection dropdown (shows availability)
- Book detail preview on selection
- Request date + expected return date
- Purpose/reason textarea
- Full field validation

### 7. 💰 Fines Page (`/fines`)
- Fine records in sortable table
- Students see only their own fines
- Librarians/Admins see all records
- Filter by status (Paid / Unpaid)
- Search by student name or book
- Totals row in table footer
- "Mark Paid" action for Librarians/Admins

---

## ✅ SRS Requirements Checklist

| Requirement                        | Status |
|------------------------------------|--------|
| Minimum 5 functional pages         | ✅ 8 pages |
| Login with validation              | ✅      |
| Register with validation           | ✅      |
| Role-based dashboard               | ✅ Student / Librarian / Admin |
| Books page (table format)          | ✅      |
| Fine page (table format)           | ✅      |
| Request Card form with validation  | ✅      |
| localStorage for auth persistence  | ✅      |
| Navbar with all required links     | ✅      |
| Responsive design (mobile+desktop) | ✅      |
| Search/filter on data tables       | ✅      |
| Submit + Reset on all forms        | ✅      |
| Email format validation            | ✅      |
| Password minimum length            | ✅      |
| Proper error messages              | ✅      |
| React functional components        | ✅      |
| React hooks (useState, useMemo…)   | ✅      |
| React Router DOM v6                | ✅      |
| Bootstrap 5                        | ✅      |
| No backend required                | ✅      |
| Comments throughout code           | ✅      |

---

## 🛠️ Technologies Used

| Technology         | Version  | Purpose                        |
|--------------------|----------|--------------------------------|
| React.js           | 18.2.0   | UI framework                   |
| React Router DOM   | 6.22.0   | Client-side routing            |
| Bootstrap          | 5.3.2    | Responsive CSS framework       |
| Bootstrap Icons    | 1.11.3   | Icon library                   |
| Google Fonts       | —        | Playfair Display + DM Sans     |
| localStorage API   | Native   | Session persistence            |

---

## 🔒 Authentication Flow

```
User visits /login
    → Fills email + password
    → Validated against getRegisteredUsers() (dummy data + localStorage)
    → On success: login(user) stores user in AuthContext + localStorage
    → Redirected to /dashboard

User refreshes page
    → AuthContext reads user from localStorage on init
    → Session persists automatically

User clicks Logout
    → logout() clears AuthContext + localStorage
    → Redirected to /login
```

---

## 🎨 Design System

| Token            | Value                       |
|------------------|-----------------------------|
| Primary color    | `#1a1a2e` (deep navy)       |
| Accent color     | `#e94560` (crimson red)     |
| Gold             | `#f0a500`                   |
| Display font     | Playfair Display (serif)    |
| Body font        | DM Sans (sans-serif)        |
| Border radius    | 6px / 12px / 20px           |

---

## 👨‍💻 Academic Notes

- All data is simulated — no backend or API calls
- User sessions persist via `localStorage`
- New registrations are saved to `localStorage` and merged with dummy users
- Card requests submitted via the form are saved to `localStorage`
- Fine data is static dummy data (read-only for display)
- Code is commented throughout for academic review

---

*Built for academic submission — Digital Library Card Management System*

# 🧩 Requisition Tracker (Real-Time Collaboration System)

A **full-stack real-time requisition management system** for staffing firms.  
Built with **React + Node.js + PostgreSQL + Socket.io**, and deployed fully on **Railway**.

---

## 🚀 Features

✅ **Real-Time Editing** — Multiple users can collaborate simultaneously with live updates via Socket.io.  
✅ **Editable Table** — Inline cell editing with automatic updates and validation.  
✅ **Column Resizing** — Resize columns freely; all cells and inputs dynamically adjust to fit.  
✅ **Status Management** — Protected status/slot updates with conflict prevention.  
✅ **Recruiter Tracking** — Shows who’s working on each requirement in real time.  
✅ **Pagination** — Displays 20 rows per page for smooth performance.  
✅ **Filters & Sorting** — Each column supports live filtering and sorting.  
✅ **Auto UI Adjustments** — Input fields stretch automatically to fit resized columns.  
✅ **Deployment-Ready** — Works seamlessly on Railway (frontend + backend + PostgreSQL).

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React.js, Axios, TailwindCSS (optional), Custom CSS |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **Real-time Engine** | Socket.io |
| **Hosting** | Railway (single app with frontend + backend) |

---

## ⚙️ Local Setup Instructions

### 1. Clone the Repo
```bash
git clone https://github.com/yourusername/requisition-tracker.git
cd requisition-tracker
```

### 2. Install Dependencies
```bash
npm install
```
If you have separate folders:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Create a .env file in backend
```env
PORT=5000
DB_URL=postgresql://<user>:<password>@<host>:<port>/<database>
```

### 4. Start the Server
If integrated:
```bash
npm run dev
```
If separate:
```bash
# In backend/
npm run start

# In frontend/
npm start
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## 🧠 How It Works

- Socket.io broadcasts live editing activity (`editing_status`) to all users.  
- Backend enforces recruiter and status/slot rules.  
- All clients refresh instantly on updates (`requisitions_updated`).  
- Recruiters can only work on one requirement at a time.

---

## 💾 Deployment (Railway)

1. Push your project to GitHub.  
2. On [Railway.app](https://railway.app/), create a new project.  
3. Link your repo and PostgreSQL plugin.  
4. Add environment variable:
   ```
   DB_URL=<your Railway PostgreSQL connection string>
   ```
5. Deploy and access via Railway URL.

---

## 📘 Folder Structure
```
📦 requisition-tracker
├── backend/
│   ├── app.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Table.jsx
│   │   └── Table.css
│   ├── public/
│   └── package.json
├── README.md
└── package.json
```

---

## 🧑‍💼 Author

**Moin Khan**  
Recruitment Manager | Full-Stack Developer (Internal Tools)  
📧 Gulamk@lancesoft.om  
🌐 https://www.linkedin.com/in/moin-khan-64a62116b/

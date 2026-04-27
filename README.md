# Organizerr Frontend (React)

A React-based UI for managing and visualizing media organization workflows.
It communicates with the FastAPI backend.

---

## 🚀 Features

* ⚛️ React UI
* 📊 Dashboard for media processing
* 🔄 Real-time updates (WebSocket support)
* 📡 Backend API integration
* 📁 File/torrent management UI

---

## 🧱 Tech Stack

* React (CRA)
* Node.js
* Nginx (for production serving)

---

## 📂 Project Structure

```
organizerr-frontend/
├── src/
├── public/
├── package.json
├── .env
└── Dockerfile
```

---

## ⚙️ Environment Variables

Create `.env`:

```
REACT_APP_API_URL=http://localhost:8005
REACT_APP_WS_HOST=localhost
REACT_APP_WS_PORT=8005
PORT=3032
```

---

## 🐳 Docker Setup

### Build & Run

```bash
docker compose up -d --build frontend
```

---

### Ports

```
Frontend: http://localhost:3032
```

---

## 🔗 Backend Connection

Frontend communicates with backend via:

```
REACT_APP_API_URL
```

Example:

```
http://localhost:8005
```

---

## ▶️ Run Locally (Dev Mode)

```bash
npm install
npm start
```

App runs on:

```
http://localhost:3032
```

---

## 🏗 Production Build

```bash
npm run build
```

Served via Nginx in Docker.

---

## 🔄 Integration Flow

```
Frontend → Backend → Media Organizer → Filesystem
```

---

## ⚠️ Common Issues

### CORS Errors

Ensure backend allows frontend origin.

---

### API not reachable

Check:

```
REACT_APP_API_URL
```

---

## 🔐 Security Notes

* Do not expose API keys in frontend
* Use HTTPS in production

---

## 📌 Future Improvements

* Better UI/UX
* Notifications system
* Upload progress tracking

---

## 👨‍💻 Author

Akshay Kumar

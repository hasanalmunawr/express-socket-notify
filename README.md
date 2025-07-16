# 📢 Real-Time Notification Server

This repository provides a simple real-time notification server built using **Express** and **Socket.IO**. It is designed to be used as a standalone service that can broadcast real-time events such as notifications to connected clients (e.g., Vue.js frontend) via WebSockets.

---

## 🚀 Features

- Real-time notification broadcasting via WebSocket
- Built with Express and Socket.IO
- CORS enabled for cross-origin communication
- API endpoint to trigger notifications via HTTP (e.g., from Laravel backend)

---

## 🧱 Tech Stack

- Node.js
- Express
- Socket.IO

---

## 📦 Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/hasanalmunawr/express-socket-notify.git
cd express-socket-notify
npm install
````

## Run The Server
Start the server with the following command:
```bash
  node server.js
```

## Rest API
To send a notification via HTTP (e.g., from Postman or Laravel), use the following:
- Method : ```POST```
- URL : ```http://localhost:3000/emit-notification```
- Content-Type : ```application/json```

### Request Body
Body:
```bash
  {
    "message" : "Sending Notification From API Postman"
    "user_id" : 1
  }
```
This will broadcast the message to all connected WebSocket clients under the receive-notification event.


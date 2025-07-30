const express = require("express");
const https = require("http");
const fileStream = require("fs");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");
const { log } = require("console");

const now = new Date();
const app = express();
const server = https.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// create new directory for auth
io.of("/devices");

const userSockets = {};

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/client-receiving", (req, res) => {
  res.sendFile(path.join(__dirname, "client-receive.html"));
});

const userRateLimit = {};
// Middleware autentikasi untuk koneksi socket.io
// Digunakan untuk memverifikasi token autentikasi dari client sebelum koneksi socket dibuka
io.use((socket, next) => {
  // Cek apakah ada data autentikasi pada handshake
  if (socket.handshake.auth) {
    // Ambil token dari data autentikasi
    const { token, user_id } = socket.handshake.auth;
    console.log(
      "Token yang di terima ada ? " +
        token +
        " dan ini user id nya ? " +
        user_id
    );

    const privateKey = generatePrivateKey();

    // Bandingkan token dari client dengan private key yang telah dienkripsi menggunakan bcrypt
    bcrypt.compare(privateKey, token, (err, result) => {
      if (err || !result) {
        console.log("Tidak Cocok Token nya");
        return next(new Error("Authentication Failed"));
      }

      // ✅ Putuskan koneksi lama jika ada
      if (userSockets[user_id] && userSockets[user_id] !== socket.id) {
        const oldSocketId = userSockets[user_id];
        const oldSocket = io.sockets.sockets.get(oldSocketId);

        if (oldSocket) {
          console.log(`🔌 Memutus koneksi lama user ${user_id}`);
          oldSocket.disconnect(true); // Putuskan koneksi lama
        }
      }

      next(); // ✅ aman karena hanya dipanggil kalau semuanya lolos
    });
  } else {
    console.error("Tidak Ada data authenticasi pada Handshake");
    // Jika tidak ada data autentikasi, tolak koneksi
    next(new Error("Permission Denied"));
  }

  // Event listener saat ada koneksi socket baru
}).on("connection", (socket) => {
  // Ambil user_id dari query parameter saat koneksi socket dibuat
  const userId = socket.handshake.auth.user_id;
  // const token = socket.handshake.query.token;

  console.log(`👤 User connected: socket=${socket.id}, user_id=${userId}`);

  // Simpan mapping antara userId dan socket.id untuk keperluan pengiriman notifikasi personal
  if (userId) {
    socket.userId = userId;
    userSockets[userId] = socket.id;
  }
  // 1️⃣ Custom event dari client untuk kirim notifikasi ke user lain
  socket.on("client-send-notification", ({ target_user_id, message }) => {
    const now = Date.now();
    const lastSent = userRateLimit[socket.userId] || 0;

    if (now - lastSent < 2000) {
      console.log("🚫 Rate limit dilanggar");
      return;
    }

    userRateLimit[socket.userId] = now;

    // Validasi isi payload
    if (
      !target_user_id ||
      typeof target_user_id !== "number" ||
      typeof message !== "string" ||
      message.trim().length === 0 ||
      message.length > 300
    ) {
      console.log(`🚫 Payload mencurigakan dari user ${socket.userId}`);
      return;
    }

    const targetSocketId = userSockets[target_user_id];
    if (targetSocketId) {
      io.to(targetSocketId).emit("receive-notification", { message });
      console.log(`✅ Notifikasi dikirim ke user ${target_user_id}`);
    } else {
      console.log(`⚠️ User ${target_user_id} tidak online`);
    }
  });

  // Event listener ketika socket disconnect (terputus)
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);

    // Hapus hanya jika socket yang disconnect adalah yang aktif
    if (userSockets[userId] === socket.id) {
      delete userSockets[userId];
    }
  });
});

server.listen(3003, () => {
  console.log("Server running on http://localhost:3000");
});

function generatePrivateKey() {
  const now = new Date();
  const currentDate = `${now.getFullYear()}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return "Password:" + currentDate;
}

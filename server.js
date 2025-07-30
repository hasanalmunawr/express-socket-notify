const express = require("express");
const https = require("http");
const fileStream = require("fs");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");
const { log } = require("console");

// Konfigurasi TLS/SSL untuk membuat HTTPS server atau mengamankan koneksi socket.io
// let options = {
//     // Membaca private key untuk sertifikat TLS dari file lokal (format .key)
//     // Penting: Pastikan path dan file berisi private key yang valid
//     key: fileStream.readFileSync('/arenvis.arisamandiri.com'),

//     // Membaca sertifikat publik (CRT/PEM) untuk TLS dari file lokal
//     // Sertifikat ini biasanya diberikan oleh CA seperti Let's Encrypt atau GlobalSign
//     cert: fileStream.readFileSync('/arenvis.arisamandiri.com'),

//     // requestCert: false artinya server tidak meminta sertifikat dari client
//     // Cocok untuk skenario di mana hanya server yang memerlukan sertifikat
//     requestCert: false,

//     // rejectUnauthorized: false artinya server tetap menerima koneksi walau client tidak punya sertifikat valid
//     // Perlu hati-hati: pengaturan ini cocok untuk development/testing, tapi **tidak direkomendasikan di production**
//     rejectUnauthorized: false
// };

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

// app.post("/emit-notification", async (req, res) => {
//   const { message, user_id, token } = req.body;

//   // Step 1: Buat ulang privateKey
//   const privateKey = generatePrivateKey();

//   // Step 2: Bandingkan token dari body
//   const valid = await bcrypt.compare(privateKey, token);
//   if (!valid) {
//     console.log("❌ Token tidak valid untuk emit-notification");
//     return res.status(401).json({ error: "Unauthorized" });
//   }

//   // Step 3: Lanjut kirim notifikasi
//   console.log("✅ Token valid, Receive Notification From API", {
//     user_id,
//     message,
//   });

//   const targetSocketId = userSockets[user_id];
//   if (targetSocketId) {
//     io.to(targetSocketId).emit("receive-notification", { message });
//     console.log(`✅ Notification sent to user ${user_id}`);
//   } else {
//     console.log(`⚠️ User ${user_id} is not connected`);
//   }

//   res.sendStatus(200);
// });

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

// app.post('/emit-notification', express.json(), (req, res) => {
//     const { message, user_id } = req.body;
//     console.log("Receive Notification From API ", { message })
//     io.emit('receive-notification', { message, user_id });
//     res.sendStatus(200)
// })

// io.on('connection', (socket) => {
//     console.log("User Connected: ", socket.id);
//     const userId = socket.handshake.query.user_id;

//     if (userId) {
//          userSockets[userId] = socket.id;
//     }
//     socket.on('send-notification', (data) => {
//         io.emit('receive-notification', data)
//         console.log("receive-notification", data);
//     })

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//     });
// })

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

function generatePrivateKey() {
  const now = new Date();
  const currentDate = `${now.getFullYear()}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return "Password:" + currentDate;
}

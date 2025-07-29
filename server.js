const express = require('express')
const https = require('http')
const fileStream = require('fs')
const bcrypt = require('bcryptjs')
const { Server } = require('socket.io')
const { log } = require('console')

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
const io = new Server( server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
})

// create new directory for auth
io.of("/devices")

const userSockets = {};

app.use(express.json())

app.get('/', (req, res) => {
    res.send("Server is running")
})

app.get('/client-receiving', (req, res) => {
    res.sendFile(path.join(__dirname, 'client-receive.html'))
})

app.post('/emit-notification', (req, res) => {
    const { message, user_id } = req.body;
    console.log("Receive Notification From API", { user_id, message });

    const targetSocketId = userSockets[user_id];
    if (targetSocketId) {
        io.to(targetSocketId).emit('receive-notification', { message });
        console.log(`✅ Notification sent to user ${user_id}`);
    } else {
        console.log(`⚠️ User ${user_id} is not connected`);
    }

    res.sendStatus(200);
})

// Middleware autentikasi untuk koneksi socket.io
// Digunakan untuk memverifikasi token autentikasi dari client sebelum koneksi socket dibuka
io.use((socket, next) => {
    // Cek apakah ada data autentikasi pada handshake
    if (socket.handshake.auth) {
        // Ambil token dari data autentikasi
        const { token, user_id } = socket.handshake.auth;
        console.log("Token yang di terima ada ? " + token + " dan ini user id nya ? " + user_id)
        // Buat tanggal sekarang dalam format YYYYMMDD sebagai bagian dari kunci private
        const now = new Date();
        const currentDate = parseInt(
            `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
        );

        // Buat private key berdasarkan tanggal hari ini
        const privateKey = "Password:" + currentDate;

        // Bandingkan token dari client dengan private key yang telah dienkripsi menggunakan bcrypt
        bcrypt.compare(privateKey, token, (err, result) => {
            if (err || !result) {
                // Jika terjadi error atau hasil tidak cocok, tolak koneksi
                console.log("Tidak Cocok Token nya");
                
                next(new Error("Authentication Failed"));
            } else {
                 console.log("Cocok Token nya");
                // Jika cocok, lanjutkan koneksi
                next();
            }
        });
    } else {
        console.error("Tidak Ada data authenticasi pada Handshake")
        // Jika tidak ada data autentikasi, tolak koneksi
        next(new Error("Permission Denied"));
    }

    // Event listener saat ada koneksi socket baru
}).on('connection', (socket) => {
    // Ambil user_id dari query parameter saat koneksi socket dibuat
    const userId = socket.handshake.auth.user_id;
    // const token = socket.handshake.query.token;

    console.log(`👤 User connected: socket=${socket.id}, user_id=${userId}`);

    // Simpan mapping antara userId dan socket.id untuk keperluan pengiriman notifikasi personal
    if (userId) {
        userSockets[userId] = socket.id;
    }

    // Event listener ketika socket disconnect (terputus)
    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);

        // Hapus user dari daftar userSockets jika socket.id yang disconnect cocok
        for (const [uid, sid] of Object.entries(userSockets)) {
            if (sid === socket.id) {
                delete userSockets[uid];
                break;
            }
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
    console.log('Server running on http://localhost:3000');
});


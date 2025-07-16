const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express();
const server = http.createServer(app);
const io = new Server( server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
})

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

io.on('connection', (socket) => {
    const userId = socket.handshake.query.user_id;
    console.log(`👤 User connected: socket=${socket.id}, user_id=${userId}`);

    if (userId) {
        userSockets[userId] = socket.id;
    }

    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
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


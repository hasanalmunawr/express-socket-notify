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

app.get('/', (req, res) => {
    res.send("Server is running")
})

app.post('/emit-notification', express.json(), (req, res) => {
    const { message } = req.body;
    console.log("Receive Notification From API ", { message })
    io.emit('receive-notification', { message });
    res.sendStatus(200)
})

io.on('connection', (socket) => {
    console.log("User Connected: ", socket.id);

    socket.on('send-notification', (data) => {
        io.emit('receive-notification', data)
        console.log("receive-notification", data);
    })

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
})

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});


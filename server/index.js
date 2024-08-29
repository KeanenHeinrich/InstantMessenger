// Import the necessary libraries
import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import fs from 'fs'
import {promises as fsPromises} from "fs"
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// initialises the port at 3500
const PORT = process.env.PORT || 3500
const ADMIN = "Admin"

// creates an express application
const app = express()

// create a normalised path for the express application to use
app.use(express.static(path.join(__dirname, "public")))

// Immediately passes the index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

const expressServer = app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})

// state monitoring
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray
    }
}

// cross origin resource sharing
const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
})

// Reads and returns an object storing the user details
const getLogins = async () => {
    try {
        const data = await fsPromises.readFile("server\\logins.json", 'utf-8', (err, object)=>{
      })
      const jsonData = JSON.parse(data)
      return jsonData
    } catch (err) {
      console.error('Error reading the JSON file:', err)
    }
}

// writes new user details to logins file
const saveAccountDetails = (data, username, email, password) => {
    data.logins.push({"username": username, "email": email, "password": password})
    fs.writeFileSync("server\\logins.json", JSON.stringify(data, null, 2))
}

// upon a device connects to the server
io.on('connection', socket => {
    console.log(`User ${socket.id} connected`)

    // Attempts to create login details for a new account
    socket.on('accountCreate', async ({username, email, password}) => {
        let loginList = await getLogins()
        let count = loginList.logins.length
        let check = 0
        for (let i = 0; i < count; i++){
            if (email !== loginList.logins[i].email){
                check++
            }
            else{
                socket.emit("login-failed", "Email Address Already Taken")
            }
            if (check === loginList.logins.length){
                saveAccountDetails(loginList, username, email, password) 
                socket.emit('login-successful', {username})
            }
        }
    })

    // check user login details against all logins
    socket.on('login-attempt', async ({email, password}) => {
        let loginList = await getLogins()
        let count = loginList.logins.length
        for (let i = 0; i < count; i++){
            if (email !== loginList.logins[i].email){
            }
            else{
                if(password !== loginList.logins[i].password){
                    socket.emit('login-failed', "Incorrect Password, Please Try Again")
                    break
                }
                else{
                    let username = loginList.logins[i].username
                    socket.emit('login-successful', ({username}))
                    break
                }
            }
            if (i === (loginList.logins.length - 1)){
                socket.emit("login-failed", "Email Address Incorrect")
            }
        }
    })

    // Upon connection - only to user 
    socket.emit('message', buildMsg(ADMIN, "Welcome to Chat App!"))

    socket.on('enterRoom', ({ name, room }) => {
        // leave previous room 
        const prevRoom = getUser(socket.id)?.room

        if (prevRoom) {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} has left the room`))
        }

        const user = activateUser(socket.id, name, room)

        // Cannot update previous room users list until after the state update in activate user 
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            })
        }

        // join room 
        socket.join(user.room)

        // To user who joined 
        socket.emit('message', buildMsg(ADMIN, `You have joined the ${user.room} chat room`))

        // To everyone else 
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has joined the room`))

        // Update user list for room 
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })

        // Update rooms list for everyone 
        io.emit('roomList', {
            rooms: getAllActiveRooms()
        })
    })

    // When user disconnects all others receive admin message and adjust those currently in room 
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        userLeavesApp(socket.id)

        if (user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))

            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        console.log(`User ${socket.id} disconnected`)
    })

    // Listening for a message event 
    socket.on('message', ({ name, text }) => {
        const room = getUser(socket.id)?.room
        if (room) {
            io.to(room).emit('message', buildMsg(name, text))
        }
    })

    // Listen for typing activity within room
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if (room) {
            socket.broadcast.to(room).emit('activity', name)
        }
    })
})

// Returns the messenger, the message, and the time sent
function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    }
}

// adds new user to Users
function activateUser(id, name, room) {
    const user = { id, name, room }
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ])
    return user
}

// Filters out users whos IDs match the current ID out from the Users list
function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    )
}

// Returns users who's connection ID matches the current ID
function getUser(id) {
    return UsersState.users.find(user => user.id === id)
}

// Returns users who's room is the same as the current room
function getUsersInRoom(room) {
    return UsersState.users.filter(user => user.room === room)
}

// Returns a list of all rooms that currently exist
function getAllActiveRooms() {
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}
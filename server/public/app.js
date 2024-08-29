// set up web socket
const socket = io('ws://localhost:3500')

// set up various html elements
const msgInput = document.querySelector('#message')
const nameHolder = document.querySelector('#name')
const chatRoom = document.querySelector('#room')
const emailInput = document.querySelector('#email')
const passwordInput = document.querySelector('#password')
const usernameInput = document.querySelector('#username')
const loginReport = document.querySelector('#loginReport')
const loginPopup = document.querySelector('.popup')
const blocker = document.querySelector('.blocker')
const activity = document.querySelector('.activity')
const usersList = document.querySelector('.user-list')
const roomList = document.querySelector('.room-list')
const chatDisplay = document.querySelector('.chat-display')

// setup variables
let userName;
let loggedIn = false
let creatingAccount = false

// sends a message to the server to redistribute
function sendMessage(e) {
    e.preventDefault()
    if (userName && msgInput.value && chatRoom.value) {
        socket.emit('message', {
            name: userName,
            text: msgInput.value
        })
        msgInput.value = ""
    }
    msgInput.focus()
}

// sends signal to server that user is entering a chat room
function enterRoom(e) {
    e.preventDefault()
    if (loggedIn && userName && chatRoom.value) {
        socket.emit('enterRoom', {
            name: userName,
            room: chatRoom.value
        })
        clearChat()
    }
}   

// sends a signal that a login attempt has been made
function loginSubmit(e){
    e.preventDefault()
    if (email.value && password.value){
        socket.emit('login-attempt', {
            email: emailInput.value,
            password: passwordInput.value
        })
    }
}

// sends a signal that an attempt to make an account has been made
function createAccount(e){
    e.preventDefault()
    loginPopup.classList.remove('active');
    if (email.value && password.value && usernameInput.value){
        socket.emit('accountCreate', {
            username: usernameInput.value,
            email: emailInput.value,
            password: passwordInput.value
        })
    }
}

// changes the login form to either login or create account
function swapLoginState(e){
    e.preventDefault()
    if (creatingAccount === false){
        document.querySelector('#swap-state').textContent = "I already have an account"
        document.querySelector('#login').style.display = "none"
        document.querySelector('#create-account').style.display = "flex"
        usernameInput.style.display = "flex"
        title.textContent = "Create Account"
        creatingAccount = true
        usernameInput.value = ""
        emailInput.value = ""
        passwordInput.value = ""
    }
    else{
        document.querySelector('#swap-state').textContent = "Create Account"
        document.querySelector('#login').style.display = "flex"
        document.querySelector('#create-account').style.display = "none"
        usernameInput.style.display = "none"
        title.textContent = "Log In"
        creatingAccount = false
        usernameInput.value = ""
        emailInput.value = ""
        passwordInput.value = ""
    }
}

// various event listeners to login, join a room, or send message
document.querySelector('.form-login')
    .addEventListener('submit', loginSubmit)

document.querySelector('#create-account').addEventListener('click', createAccount)

document.querySelector('#swap-state')
    .addEventListener('click', swapLoginState)

document.querySelector('.form-msg')
    .addEventListener('submit', sendMessage)

document.querySelector('.form-join')
    .addEventListener('submit', enterRoom)

msgInput.addEventListener('keypress', () => {
    socket.emit('activity', userName)
})

// displays a failed login or account creation message
socket.on("login-failed", message => {
    loginReport.textContent =   message
})

// removes the login form upon login
socket.on("login-successful", ({username}) => {
    loginPopup.style.visibility = "hidden"
    blocker.style.visibility = "hidden"
    userName = username
    nameHolder.textContent = userName
    loggedIn = true
})

// Listen for messages 
socket.on("message", (data) => {
    activity.textContent = ""
    const { name, text, time } = data
    const li = document.createElement('li')
    li.className = 'post'
    if (name === userName) li.className = 'post post--right'
    if (name !== userName && name !== 'Admin') li.className = 'post post--left'
    if (name !== 'Admin') {
        li.innerHTML = `<div class="post__header ${name === userName
            ? 'post__header--user'
            : 'post__header--reply'
            }">
        <span class="post__header--name">${name}</span> 
        <span class="post__header--time">${time}</span> 
        </div>
        <div class="post__text">${text}</div>`
    } else {
        li.innerHTML = `<div class="post__text">${text}</div>`
    }
    document.querySelector('.chat-display').appendChild(li)

    chatDisplay.scrollTop = chatDisplay.scrollHeight
})

// clears the typing activity after 3 seconds of no activity
let activityTimer
socket.on("activity", (name) => {
    activity.textContent = `${name} is typing...`

    // Clear after 3 seconds 
    clearTimeout(activityTimer)
    activityTimer = setTimeout(() => {
        activity.textContent = ""
    }, 3000)
})

// updates user list
socket.on('userList', ({ users }) => {
    showUsers(users)
})

// update rooms list
socket.on('roomList', ({ rooms }) => {
    showRooms(rooms)
})

// displays the users in the current room
function showUsers(users) {
    usersList.textContent = ''
    if (users) {
        usersList.innerHTML = `<em>Users in ${chatRoom.value}:</em>`
        users.forEach((user, i) => {
            usersList.textContent += ` ${user.name}`
            if (users.length > 1 && i !== users.length - 1) {
                usersList.textContent += ","
            }
        })
    }
}

// Display active rooms
function showRooms(rooms) {
    roomList.textContent = ''
    if (rooms) {
        roomList.innerHTML = '<em>Active Rooms:</em>'
        rooms.forEach((room, i) => {
            roomList.textContent += ` ${room}`
            if (rooms.length > 1 && i !== rooms.length - 1) {
                roomList.textContent += ","
            }
        })
    }
}

// removes all current texts
function clearChat(){
    counter = chatDisplay.childElementCount
    for (let i=0; i < counter; i++){
        msg = chatDisplay.querySelector('li')
        msg.remove()
    }
}
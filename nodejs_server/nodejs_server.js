const credentials = require("./credentials");
const express = require("express");
const app = express();

var server;
var port;
var allClients = {};

if (credentials.key && credentials.cert) {
  const https = require("https");
  server = https.createServer(credentials, app);
  port = 3001;
}
else {
  const http = require("http");
  server = http.createServer(app);
  port = 3001;
}

const io = require("socket.io")(server);

io.sockets.on("error", e => console.log(e));

io.sockets.on("connection", socket => {
  allClients[socket.id] = socket;

  // When a new watcher is connected, reconnects all candidates with it.
  socket.on("administrator", () => {
    for (let broadcaster in allClients) {
      let broadcater = allClients[broadcaster].id;
      let anchor = allClients[broadcaster].broadcaster;
      // Jump administrators connection.
      if (!anchor) {
        continue;
      }
      // Send invitation to reconnect.
      io.emit("broadcaster", /** of the broadcaster */ broadcater);
    }
  })

  socket.on("broadcaster", () => {
    allClients[socket.id] = { ...allClients[socket.id], 'broadcaster': true };
    socket.broadcast.emit("broadcaster", /** broadcaster socket id */ socket.id);
  });

  socket.on("watcher", (/** broadcaster socket id */ id) => {
    socket.to(id).emit("watcher", /** watcher socket id */ socket.id);
  });

  socket.on("offer", (/* watcher scoket id */ id, message) => {
    // Store additional server-side broadcaster data.
    let has_extra_key = ('extra' in message);
    if (has_extra_key) {
      allClients[socket.id] = { ...allClients[socket.id], 'extra': message.extra };
    }
    socket.to(id).emit("offer", /* broadcaster socket id */ socket.id, /** init connection | broadcater object */ { ...message, 'socket_id': socket.id });
  });

  socket.on("answer", (/** broadcaster socket id */ id, message) => {
    socket.to(id).emit("answer", /* watcher socket id */ socket.id, message);
  });

  socket.on("candidate", (id, message) => {
    socket.to(id).emit("candidate", socket.id, message);
  });

  socket.on('disconnect', () => {
    let client_extra_obj = {};
    let has_extra_key = ('extra' in allClients[socket.id]);
    if (has_extra_key) {
      client_extra_obj = allClients[socket.id].extra;
    }
    delete allClients[socket.id];

    for (let i in Object.keys(allClients)) {
      socket.to(Object.keys(allClients)[i]).emit('bye', socket.id, client_extra_obj);
    }
  });

  socket.on('ban', (/** broadcaster socket id */ id, extra) => {
    // Notify all participants about the banned user.
    for (let i in Object.keys(allClients)) {
      socket.to(Object.keys(allClients)[i]).emit('ban', /** watcher socket id */ socket.id, extra);
    }
  });

  // The socket event below was created with the aim of unifying
  // the broadcaster chat from the pre-start page and examination page.
  socket.on('chat_message', (recipient_data, sender_socket_id, chat_message_object) => {
    if (recipient_data.destination == 'broadcaster') {
      // Based on the fact that the exam page may be reloaded,
      //  we are limited to storing persistent data.
      // On the pre-start page, socket_id remains constant, but on the exam page
      //  it’s constantly changing.
      // As an alternative, we will send a message to all socket participants
      //  and check on the recipient's side whether this is his message.
      for (let i in Object.keys(allClients)) {
        socket.to(Object.keys(allClients)[i]).emit('chat_message', recipient_data, sender_socket_id, chat_message_object);
      }
    }

    // At the moment, the back connection will be implemented through
    //  the WebRTC channel, but in the future you can rewrite the bidirectional
    //  chat via the socket.
    // Structure example (recipient_data.destination == 'watcher') to send
    // messages from the broadcaster to the watcher.
  });

});

server.listen(port, () => console.log(`Server is running on port ${port}`));

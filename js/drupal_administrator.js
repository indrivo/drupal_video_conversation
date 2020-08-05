/** @type {RTCConfiguration} */
const config = {
  iceServers
};
const socket = io.connect(window.location.origin + ":3001");

// URLS.
const merge_chunks_url = '/merge_chunks';

let audio = document.querySelector("#audio");
let d = new Date;

// Method for send POST request.
function sendData(url, data) {
  var formData = new FormData();
  for (let i in data) {
    if (i == 'file') {
      continue;
    }
    formData.append(i, data[i]);
  }
  if (data.file) {
    formData.append('files[]', data.file);
  }

  fetch(url, {
    method: 'POST',
    body: formData
  }).then((response) => {
    response.json().then((data) => {
      return data;
    });
  });
}

let broadcasters = {};
window.onunload = window.onbeforeunload = function () {
  socket.close();
};

/* Global socket, video, config */
socket.on("offer", (id, description) => {
  // Prevent duplicate connections on the page.
  let candidate_wrapper = document.querySelectorAll(`*[data-extra='${ id }']`);
  if (candidate_wrapper.length) {
    return;
  }

  let chatWrapper, chatTitle, chatInput, chatMessages, chatSendBtn, videot, extra;
  // Save all active broadcast connections.
  broadcasters[description.socket_id] = description.extra;
  // Initialize extra broadcaster data.
  extra = description.extra;
  // Display in console new broadcaster data, with debugging purpose.
  console.log('New broadcaster connection:', extra);

  let peerConnection = new RTCPeerConnection(config);
  peerConnection
    .setRemoteDescription(description.sdp)
    .then(() => peerConnection.createAnswer())
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit("answer", id, peerConnection.localDescription);
    });

  // Add Peer conection on common object.
  broadcasters[description.socket_id] = {
    ...broadcasters[description.socket_id],
    'peerconnection': peerConnection
  };

  function newDateTime() {
    let d = new Date,
    dformat = [
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    ].join(':');
    return `<span class="message_arrival_time">${dformat}</span>`;
  }
  function insertMessage(data) {
    if (typeof data.message == "undefined") {
      return;
    }
    let message = document.createElement("p");
    message.innerHTML = newDateTime() + " " + data.message + `<br>\n`;
    chatMessages.prepend(message);
  }

  peerConnection.ondatachannel = event => {
    let channel = event.channel;
    // Method that will send the message to broadcaster via the WebRTC channel
    // to the pre-start page and through the Socket to the exam page.
    function sendMessage(chat_message_object) {
      if (channel.readyState != 'open') {
        return;
      }
      // To Pre-start page trought WebRTC channel.
      channel.send(JSON.stringify(chat_message_object));
      // Show sent message on admin side.
      insertMessage(chat_message_object);
      // To Exam Page trought the Socket.
      let recipient_data = {
        'socket_id': description.socket_id,
        'extra': extra,
        'destination': 'broadcaster'
      };
      let sender_socket_id = socket.id;
      socket.emit('chat_message', recipient_data, sender_socket_id, chat_message_object);
    }
    chatSendBtn.addEventListener('click', () => {
      if (!chatInput.value) {
        return;
      }
      let chat_message_object = {"message": chatInput.value};
      sendMessage(chat_message_object);
      chatInput.value = "";
    });
    channel.onopen = event => {
      // Send a message to the candidate about the successful connection.
      let obj = { "message": `<span class="green">* Conexiunea cu administrator (${ d.getTime() }) este deschisă.</span>`};
      channel.send(JSON.stringify(obj));
    };
    channel.onclose = event => {
      chatTitle.innerHTML = `<span class="orange">* Chatul a fost inchis.</span> ${ chatTitle.innerHTML }`;
    }
    channel.onmessage = event => {
      let data = JSON.parse(event.data);
      insertMessage(data);
      audio.play();
    }
  }

  peerConnection.ontrack = event => {
    wrapper = document.createElement("div");
    wrapper.classList.add('candidate_wrapper');
    wrapper.setAttribute("data-extra", description.socket_id);

    // Video element.
    videoWrapper = document.createElement("div");
    videoWrapper.className = 'videoWrapper';
    videot = document.createElement("video");
    videot.classList.add('video');
    videot.muted = videot.autoplay = videot.controls = true;
    videot.srcObject = event.streams[0];
    // Chat.
    chatWrapper = document.createElement("div");
    chatWrapper.className = 'chatWrapper';
    chatTitle = document.createElement("h3");
    chatTitle.className = 'chatTitle';
    chatTitle.innerHTML = extra.chanel_name;

    // Ban candidate (elements & event listener).
    banBtn = document.createElement("button");
    banBtn.classList.add('banBtn', 'btn');
    banBtn.innerHTML = 'BAN';
    banBtn.addEventListener('click', () => {
      socket.emit('ban', description.socket_id, extra);
    });

    senderWrapper = document.createElement("div");
    senderWrapper.className = 'send-wrapper';
    chatInput = document.createElement("input");
    chatInput.classList.add('chatInput', 'form-control');
    chatSendBtn = document.createElement("button");
    chatSendBtn.innerHTML = "Trimite mesaj";
    chatSendBtn.classList.add('chatSendBtn', 'btn');
    chatMessages = document.createElement("div");
    chatMessages.className = 'chatMessages';

    // Group elements in needed wrappers.
    videoWrapper.appendChild(banBtn);
    videoWrapper.appendChild(chatTitle);
    videoWrapper.appendChild(videot);

    senderWrapper.appendChild(chatInput);
    senderWrapper.appendChild(chatSendBtn);
    chatWrapper.appendChild(senderWrapper);
    chatWrapper.appendChild(chatMessages);

    // Appent Video element in wrapper.
    wrapper.appendChild(videoWrapper);
    // Append Chat element in wrapper.
    wrapper.appendChild(chatWrapper);

    // * Check whether the connection status is complete and insert a video element on the page.
    let streamInjection = window.setInterval(function () {
      if (peerConnection.iceConnectionState != 'connected') {
        return;
      }
      document.querySelector('#video_container').appendChild(wrapper);
      videot.play();
      clearInterval(streamInjection);
    }, 1000);
  };

  peerConnection.oniceconnectionstatechange = () => {
    let obj = {"message": ''};

    /** @todo After will be tested on preprod, remove line below */
    console.log('Current state:', peerConnection.iceConnectionState);

    if (peerConnection.iceConnectionState === "closed") {
      obj.message = `<span class="red">* Conexiunea cu ${ extra.username } este inchisâ.</span>`;
      insertMessage(obj);
    }

    if (
      peerConnection.iceConnectionState === "closed" ||
      peerConnection.iceConnectionState === "failed"
    ) {
      delete peerConnection;
    }
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };

  socket.on("candidate", function (id, candidate) {
    peerConnection
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch(e => console.log(e));
  });
});

socket.on('bye', /** broadcaster socket id */ function (broadcaster_id, client_extra_obj) {
  if (!broadcasters[broadcaster_id]) {
    return;
  }

  // Close peer connection.
  if (
    broadcasters[broadcaster_id] &&
    broadcasters[broadcaster_id].peerconnection &&
    broadcasters[broadcaster_id].peerconnection.iceConnectionState != 'closed'
  ) {
    broadcasters[broadcaster_id].peerconnection.close();
  }

  // Concatenate the fragments of video files into one..
  sendData(merge_chunks_url, { ...broadcasters[broadcaster_id], 'merge_chunks': true });

  // Clean broadcasters object data.
  delete broadcasters[broadcaster_id];
  console.log('Active Broadcasters:', broadcasters);

  // Remove unnecessary items after the socket is closed.
  let video, chatInput, chatSendBtn;
  let candidate_wrapper = document.querySelectorAll(`*[data-extra='${broadcaster_id}']`);
  if (!candidate_wrapper) {
    return;
  }
  candidate_wrapper.forEach((wrapper) => {
    if (video = wrapper.querySelector('video')) {
      video.remove();
    }
    if (chatInput = wrapper.querySelector('.chatInput')) {
      chatInput.remove();
    }
    if (chatSendBtn = wrapper.querySelector('.chatSendBtn')) {
      chatSendBtn.remove();
    }
  });

});

socket.on("connect", function () {
  socket.emit("administrator");
});

socket.on("broadcaster", function (/** socket.id */ broadcaster) {
  socket.emit("watcher", /** socket.id */ broadcaster);
});

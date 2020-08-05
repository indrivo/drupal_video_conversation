/*Global io*/
/** @type {RTCConfiguration} */
/** @see Notice: iceServers coming from js file "iceServers.js" */
let config = {
  iceServers
};

const socket = io.connect(window.location.origin + ":3001");

// URLS
const ban_url = '/ban';
const logging_href = '/logging';

let d = new Date;

/** Candidate info */
let candidate_name = document.querySelector("#candidate_name");
candidate_name = candidate_name ? candidate_name.innerHTML.replace(/\s/g, "") : 'Nume_candidat';
let group_label = document.querySelector("#group_label");
group_label = group_label ? group_label.innerHTML : 'Examenul';

/** Media elements */
const video = document.querySelector("video");

/**
 * "PIP" button will be temporarily commented out,
 *  may need in the future.
 */
// let pipContainer = document.querySelector("#pipContainer");
// if (document.pictureInPictureElement === null) {
//   pipButton = document.createElement("button");
//   pipButton.innerHTML = "Picture in picture";
//   pipContainer.prepend(pipButton);
//   pipButton.classList.add('btn', 'btn--blue');

//   pipButton.addEventListener('click', () => {
//     video.requestPictureInPicture()
//       .catch(error => {
//         console.log(error);
//       });
//   });
// }

// Video & Audio file name.
let uid = document.querySelector("#drupal_uid");
uid = uid ? uid.innerHTML.replace(/\s/g, "") : "";
let gid = document.querySelector("#drupal_gid");
gid = gid ? gid.innerHTML.replace(/\s/g, "") : "";
let filename = "uid_" + uid + "_gid_" + gid + '_' + d.getTime();
filename = filename.replace(/\s/g, "") + ".webm";
let audio = document.querySelector("#audio");

/** Data chanel elements */
let chanel_name = candidate_name + " | " + group_label;
if (chanel_name.length > 200) {
  chanel_name = chanel_name.slice(0, 200) + "...";
}
let chatMessages = document.querySelector("#chatMessages");
let chatInput = document.querySelector("#chatInput");
let chatSendBtn = document.querySelector("#chatSendBtn");

/** Blockers of candidate */
let vm_required = document.querySelector('#video_monitoring_required');
if (vm_required && typeof vm_required !== 'undefined') {
  vm_required = vm_required.innerHTML == "1" ? true : false;
}
else {
  vm_required = false;
}

let start_exam_btn = document.querySelector("#edit-start-exam");
if (vm_required && start_exam_btn) {
  var start_exam_btn_value = start_exam_btn.getAttribute('href');
  start_exam_btn.setAttribute('href', "#");
  start_exam_btn.removeAttribute('target');
}

/** extra candidate data */
let extra = {
  "uid": uid,
  "username": candidate_name,
  "gid": gid,
  "group_label": group_label,
  "filename": filename,
  "chanel_name": chanel_name
};

/** Peer connection stats */
let pc_stats_start = document.querySelector('#pc-stats-start');
let pc_stats_stop = document.querySelector('#pc-stats-stop');
let stats_wrapper = document.querySelector('#stats-wrapper');
let stats;

/** Checking TURN | STUN Servers */
let check_turn_server_btn = document.createElement("button");
check_turn_server_btn.innerHTML = "Check Stun|Turn servers";
check_turn_server_btn.classList.add('btn', 'btn--blue');
pipContainer.prepend(check_turn_server_btn);

check_turn_server_btn.onclick = function () {
  let mess = 'Checking signaling servers ...';
  insertMessage({ "message": `<span class="orange">* ${mess}</span>` });
  logging(mess);

  checkSignalingServer(config)
    .then(function (bool) {
      if (bool) {
        mess = 'Yes, signaling servers work.';
        insertMessage({ "message": `<span class="green">* ${mess}</span>` });
        logging(mess);
      }
      else {
        throw new Error('Doesn\'t work');
      }
    }).catch(function (e) {
      mess = 'Signaling servers does not work.';
      insertMessage({"message": `<span class="red">* ${mess}</span>` });
      logging(mess);
    });
};

/* Global socket, video, config */
const peerConnections = {};
let ownStream = {};

window.onunload = window.onbeforeunload = function () {
  socket.close();
  stopWebcamStream();
};

let stop_record_anchor = true;
let rerun_record = (stream) => {
  setTimeout(() => {
    stopRecording();
    f(stream);
  }, 20000);
}

let stopWebcamStream = () => {
  video.srcObject.getTracks().forEach(function (track) {
    track.stop();
  });
}

let stopShareScreen = () => {
  let has_active_key = ('active' in ownStream);
  if (has_active_key && ownStream.active) {
    ownStream.getTracks().forEach(function (track) {
      track.stop();
    });
  }
}

let disable_start_exam_btn = () => {
  if (start_exam_btn) {
    start_exam_btn.setAttribute('href', "#");
    start_exam_btn.removeAttribute('target');
  }
}

let f = (stream) => {
  if (!stream || !stream.active || !stop_record_anchor) {
    console.log('Stop the recording restart function.', 'stream', stream);
    stop_record_anchor = false;
    return;
  }

  stop_record_anchor && startRecording(stream);
  stop_record_anchor && rerun_record(stream);
};

let complete_connection_closure = () => {
  if (!Object.keys(peerConnections).length) {
    insertMessage({ 'message': '<span class="red">* Conexiunea este inchisă.</span>' }) ;
    socket.close();
    // Stop the recording restart function.
    f();
    stopRecording();
    stopShareScreen();
    stopWebcamStream();
    // Concatenate the fragments of video files into one.
    sendData(merge_chunks_url, { ...extra, 'merge_chunks': true });
    disable_start_exam_btn();
  }
};

let active_administrators = () => {
  let active_connections = Object.keys(peerConnections).length;
  insertMessage({ 'message': `<span class="orange">* Administratorii online (${active_connections}).</span>` });
}

/** @type {MediaStreamConstraints} */
const constraints = {
  audio: true,
  video: true
};

vm_required && alert('Pentru partajare ecranului, trebuie să permiteți accesul la cameră și la microfon în ferestrele pop-up.');
// Capture user camera and microphone.
navigator.mediaDevices
  .getUserMedia(constraints)
  .then((user_media_stream) => {
    video.srcObject = user_media_stream;
    screen_capture(user_media_stream);
  })
  .catch(error => {
    logging('getUserMedia: ' + error.toString());
    insertMessage({ "message": `<span class="red">${ error.toString() }</span>` });

    // Limit the exam passing if the video from a webcam or the screen sharing
    // does not work.
    disable_start_exam_btn();
  });

/**
 * @param {*MediaStream} user_media_stream
 */
var screen_capture = (user_media_stream) => {
  // User screen capture.
  navigator.mediaDevices
    .getDisplayMedia({
      video: {
        cursor: "always",
        width: 1024,
        frameRate: 3,
        aspectRatio: 1.777777778,
        displaySurface: "monitor",
      },
      audio: false
    })
    .then(display_media_stream => {
      // Add audio from the microphone to the captured media from the display.
      user_media_stream.getAudioTracks().forEach(function (audio_track) {
        display_media_stream.addTrack(audio_track);
      });

      // Call function which is responsible for rerun record.
      stop_record_anchor && f(display_media_stream);

      // Catch an event when screen sharing is over.
      display_media_stream.getVideoTracks()[0].addEventListener('ended', () => {
        logging('Screen sharing is stopped.');
        insertMessage({ "message": `<span class="red">* Partajare ecranului este oprită.</span>` });
        // Close peer connection if exist.
        for (let i in peerConnections) {
          peerConnections[i].close();
          delete peerConnections[i];
        }
        complete_connection_closure();
      });

      ownStream = display_media_stream;
      socket.emit("broadcaster");
    })
    .catch(error => {
      let message = `Din motive necunoscute, nu putem accesa ecranul partajat.
      Reîncărcați pagina astfel încât să apară o fereastră pop-up cu optiuni
      pentru a accepta permisiunile de partajere a ecranului.`;
      insertMessage({ "message": `<span class="red">${message}</span>` });
      logging(message);
      socket.close();
      stopWebcamStream();

      // Limit the exam passing if the video from a webcam or the screen sharing
      // does not work.
      disable_start_exam_btn();
    });
};

socket.on("answer", (id, description) => {
  peerConnections[id].setRemoteDescription(description);
});

socket.on("watcher", (id) => {
  console.log("On watcher client.");
  let peerConnection = new RTCPeerConnection(config);
  let channel = peerConnection.createDataChannel(id);

  let sendMessage = (obj) => {
    // To watcher side through the WebRTC channel.
    channel.send(JSON.stringify(obj));
    // Show sent message on pre-start page.
    insertMessage(obj);
    // To Exam Page trought the Socket.
    let recipient_data = {
      'socket_id': id,
      'extra': extra,
      'destination': 'broadcaster'
    };
    let sender_socket_id = socket.id;
    socket.emit('chat_message', recipient_data, sender_socket_id, obj);
  }
  // Extract a message from the pre-start page from the chat form in the block.
  chatSendBtn.addEventListener('click', () => {
    if (!chatInput.value) {
      return;
    }
    sendMessage({ "message": chatInput.value });
    chatInput.value = "";
  });
  // Extract a message from the exam page.
  socket.on('chat_message', (recipient_data, sender_socket_id, chat_message_object) => {
    if (recipient_data.socket_id != 'pre-start_page' || recipient_data.extra.uid != uid || recipient_data.extra.gid != gid) {
      return;
    }
    sendMessage(chat_message_object);
  });

  channel.onopen = (event) => {
    if (vm_required && start_exam_btn) {
      start_exam_btn.setAttribute('href', start_exam_btn_value);
      start_exam_btn.setAttribute('target', "_blank");
    }

    // Send a message to the administrator about the successful connection.
    let obj = { "message": `<span class="green"> * Conexiunea cu ${ extra.username } este deschisă.</span>` };
    channel.send(JSON.stringify(obj));
  }
  channel.onclose = (event) => {
  }
  channel.onmessage = (event) => {
    let data = JSON.parse(event.data);
    insertMessage(data);
    audio.play();
  }

  // Peer configurations.
  peerConnections[id] = peerConnection;
  peerConnection.addStream(ownStream);
  peerConnection
    .createOffer()
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit(
        "offer", id, { 'sdp': /** Session Description Protocol */ peerConnection.localDescription, 'extra': /** Candidate extra object */ extra }
      );
    })
    .catch(error => {
      console.log(error);
      logging(error.toString());
    });

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("candidate", id, event.candidate);
    }
  };

  /** Live state Reports */
  pc_stats_start.addEventListener('click', () => {
    stats = window.setInterval(() => {
      peerConnection.getStats(null).then(stats => {
        let statsOutput = "";

        stats.forEach(report => {
          statsOutput += `<h2>Report: ${report.type}</h3>\n<strong>ID:</strong> ${report.id}<br>\n` +
            `<strong>Timestamp:</strong> ${report.timestamp}<br>\n`;

          Object.keys(report).forEach(statName => {
            if (statName !== "id" && statName !== "timestamp" && statName !== "type") {
              statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
            }
          });
        });

        document.querySelector(".stats-box").innerHTML = statsOutput;
      });
    }, 1000);
  });
  pc_stats_stop.addEventListener('click', () => {
    clearInterval(stats);
    document.querySelector(".stats-box").innerHTML = "";
  });

  peerConnection.oniceconnectionstatechange = (event) => {
    logging('Connection state: ' + peerConnection.iceConnectionState);
    if (
      peerConnection.iceConnectionState === "closed" ||
      peerConnection.iceConnectionState === "failed" ||
      peerConnection.iceConnectionState === "disconnected"
    ) {
      peerConnections[id] && peerConnections[id].close();
      delete peerConnection;
      delete peerConnections[id];

      // Tell the candidate how many connections to administrators are
      // currently present.
      active_administrators();
      // check if there are active administrators, and if there are no active,
      // close the exam.
      complete_connection_closure();
    }
  }
});

socket.on("candidate", function (id, candidate) {
  peerConnections[id]
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(error => {
      console.log(error);
      logging(error);
    });
});

// Respond to socket event "ban".
socket.on('ban', (/** watcher socket id */ id, incoming_extra) => {
  if (JSON.stringify(incoming_extra) != JSON.stringify(extra)) {
    return;
  }

  // Stop screen sharing.
  ownStream.getTracks().forEach(function (track) {
    track.stop();
  });

  // Stop webcam video stream.
  stopWebcamStream();

  // Close scoket connection.
  socket.close();

  // Notify user that he was banned.
  let message = `V-a fost blocat accesul la examinare de catre administratorul examenului.
    Dacă credeți că blocarea a fost nejustificată, puteți depune o contestatie.`;
  insertMessage({ "message": `<span class="red">${message}</span>` });

  // Change member's validation status to "Removed".
  sendData(ban_url, { 'ban': true, ...extra });

  // Save log message.
  let mess = `Access to the exam was blocked by the administrator.
    If you think the lock was unjustified, you can lodge a challenge.`;
  logging(mess);
});

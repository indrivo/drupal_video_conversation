// Open the connection to the socket.
const socket = io.connect(window.location.origin + ":3001");
const $ = jQuery;
const video = document.querySelector("#drupal_candidate_exam_video");
const ban_url = '/ban';

// Prepare user data that represents it.
let uid = document.querySelector("#drupal_uid");
uid = uid ? uid.innerHTML.replace(/\s/g, "") : "";
let gid = document.querySelector("#drupal_gid");
gid = gid ? gid.innerHTML.replace(/\s/g, "") : "";

let chatMessages = document.querySelector("#chatMessages");
let chatInput = document.querySelector("#chatInput");
let chatSendBtn = document.querySelector("#chatSendBtn");

// Capture user camera and microphone.
const constraints = {
  audio: false,
  video: { facingMode: "user" }
};
navigator.mediaDevices
  .getUserMedia(constraints)
  .then(function (stream) {
    video.srcObject = stream;
  })
  .catch(error => console.log('drupal_candidate_exam_video', error.toString()));

// The functionality which will make obstacles
//  to broadcaster in case when his was banned.
socket.on('ban', (/** watcher id */id, incoming_extra) => {
  if (incoming_extra.uid != uid || incoming_extra.gid != gid) {
    return;
  }

  var timer = $('#timer');
  if (timer.length) {
    timer.remove();
  }

  var goNext = $('#edit-actions');
  if (goNext.length) {
    goNext.remove();
  }

  let message = `V-a fost blocat accesul la examinare de catre administratorul examenului.
    Dacă credeți că blocarea a fost nejustificată, puteți depune o contestatie.`;
  alert(message);

  // Redirect to home page.
  window.location.replace = window.location.origin;
  window.location.href = window.location.origin;
});

// Functionality that will catch messages from the WebRTC channel
// and display them in this block.
socket.on('chat_message', (recipient_data, sender_socket_id, chat_message_object) => {
  if (recipient_data.extra.uid != uid || recipient_data.extra.gid != gid) {
    return;
  }
  // Show received message in block.
  insertMessage(chat_message_object);
});

// Extract the message from the chat form on the exam page
//  and send it to the watcher.
// Technical solution: The main idea is to send a message from the exam page
//  to the pre-start page and after it through WebRTC to the watcher.
chatSendBtn.addEventListener('click', () => {
  if (!chatInput.value) {
    return;
  }

  let recipient_data = {
    'socket_id': 'pre-start_page',
    'extra': {
      "uid": uid,
      "gid": gid,
    },
    'destination': 'broadcaster'
  };
  let sender_socket_id = socket.id;
  let chat_message_object = { "message": chatInput.value };
  socket.emit('chat_message', recipient_data, sender_socket_id, chat_message_object);
  chatInput.value = "";
});

// Suspend candidate from exam in case of connection failure with
// all video administrators.
socket.on('bye', /** broadcaster socket id */ function (broadcaster_id, client_extra_obj) {
  // Check the object itself.
  if (!client_extra_obj || !('uid' in client_extra_obj) || !('gid' in client_extra_obj)) {
    return;
  }
  // Check if the object belongs to the current user.
  if (client_extra_obj.uid != uid || client_extra_obj.gid != gid) {
    return;
  }

  var timer = $('#timer');
  if (timer.length) {
    timer.remove();
  }
  var goNext = $('#edit-actions');
  if (goNext.length) {
    goNext.remove();
  }
  let message = `Conexiunea cu toți administratorii este închisă.`;
  alert(message);

  // Change member's validation status to "Removed".
  sendData(ban_url, { 'ban': true, ...client_extra_obj });

  // Redirect to home page.
  window.location.replace = window.location.origin;
  window.location.href = window.location.origin;
});

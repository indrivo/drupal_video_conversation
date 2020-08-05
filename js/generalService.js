const store_record_url = '/store_record';
const merge_chunks_url = '/merge_chunks';

let mediaRecorder, chunks = [];

function newDateTime(full = false, wrapper = true) {
  let d = new Date, dformat;
  if (!full) {
    dformat = [
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    ].join(':');
  }
  else {
    dformat = [
      d.getFullYear(),
      d.getMonth(),
      d.getDay()
    ].join('-') + ' ' + [
      d.getHours(),
      d.getMinutes(),
      d.getSeconds()
    ].join(':');
  }
  return wrapper ? `<span class="message_arrival_time">${dformat}</span>` : dformat;
}

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
  }).then(function (response) {
    response.json().then(function (data) {
      return data;
    });
  });
}

function startRecording(stream) {
  if (!stream.active) {
    return;
  }

  if (typeof MediaRecorder.isTypeSupported == 'function') {
    var options = { mimeType: 'video/webm' };
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      options = { mimeType: 'video/webm;codecs=vp9' };
    }
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      options = { mimeType: 'video/webm;codecs=h264' };
    }
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      options = { mimeType: 'video/webm;codecs=vp8' };
    }
    options = {
      videoBitsPerSecond: 256 * 8 * 1024,
      // timeSlice: 1000, // Concatenate intervals based blobs.
      ...options
    };

    mediaRecorder = new MediaRecorder(stream, options);
  }
  else {
    console.log('isTypeSupported is not supported, using default codecs for browser');
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = function (e) {
    console.log('mediaRecorder.ondataavailable, e.data.size=' + e.data.size);
    chunks.push(e.data);
  };

  mediaRecorder.onerror = function (e) {
    console.log('mediaRecorder.onerror: ' + e);
  };

  mediaRecorder.onstart = function () {
    console.log(`mediaRecorder.onstart, mediaRecorder.state ${mediaRecorder.state}`);
  };

  mediaRecorder.onstop = function () {
    console.log(`mediaRecorder.onstop, mediaRecorder.state ${mediaRecorder.state}`);
    var blob = new Blob(chunks, { type: "video/webm" });
    chunks = [];

    getVideoFile(blob, filename, function (file) {
      sendData(store_record_url, { 'file': file });
    });
  };

  mediaRecorder.onwarning = function (e) {
    console.log('mediaRecorder.onwarning: ' + e);
  };

  mediaRecorder.start();
}

function stopRecording() {
  try {
    if (mediaRecorder.state && mediaRecorder.state == "recording") {
      mediaRecorder.stop();
    }
  } catch (e) {
    console.log(e);
  }
}

function getVideoFile(blob, name, callback) {
  let reader = new FileReader();
  reader.onload = function () {
    let dataUrl = reader.result;
    let binary = window.atob(dataUrl.split(',')[1]);
    let data = [];

    for (let i = 0; i < binary.length; i++) {
      data.push(binary.charCodeAt(i));
    }

    callback(new File([new Uint8Array(data)], name, {
      type: 'video/webm'
    }));
  };
  reader.readAsDataURL(blob);
}

function insertMessage(data) {
  if (typeof data.message == "undefined") {
    return;
  }
  let message = document.createElement("p");
  message.innerHTML = newDateTime() + " " + data.message + "<br>";
  chatMessages.prepend(message);
}

function logging(message) {
  let formData = new FormData();
  formData.append('log_message', message);
  fetch(logging_href, {
    method: 'POST',
    body: formData
  }).then((response) => {
    response.json().then((data) => {
      console.log('Logging:', message);
    });
  });
}

function checkSignalingServer(config) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      if (promiseResolved) {
        return;
      }
      resolve(false);
      promiseResolved = true;
    }, 1000);

    var promiseResolved = false
    // Compatibility for firefox and chrome.
    var myPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    var pc = new myPeerConnection(config);
    var noop = function () { };

    // Create a bogus data channel.
    pc.createDataChannel("");
    // Create offer and set local description.
    pc.createOffer(function (sdp) {
      // Sometimes sdp contains the ice candidates...
      if (sdp.sdp.indexOf('typ relay') > -1) {
        promiseResolved = true;
        resolve(true);
      }
      pc.setLocalDescription(sdp, noop, noop);
    }, noop);
    // Listen for candidate events.
    pc.onicecandidate = function (ice) {
      if (promiseResolved || !ice || !ice.candidate || !ice.candidate.candidate || !(ice.candidate.candidate.indexOf('typ relay') > -1)) {
        return;
      }
      promiseResolved = true;
      resolve(true);
    };
  });
}

var configuration = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]},
// {"url":"stun:stun.services.mozilla.com"}

    roomURL = document.getElementById('url'),
    video = document.getElementsByTagName('video')[0],
    photo = document.getElementById('photo'),
    canvas = photo.getContext('2d'),
    trail = document.getElementById('trail'),
	snapBtn = document.getElementById('snap'),
	sendBtn = document.getElementById('send'),
    snapAndSendBtn = document.getElementById('snapAndSend'),
	canvasWidth, canvasHeight;

//hide(photo, snapBtn, sendBtn);

video.addEventListener('play', setCanvasDimensions);
snapBtn.addEventListener('click', snapPhoto);
sendBtn.addEventListener('click', sendPhoto);
snapAndSendBtn.addEventListener('click', snapAndSend);

var socket = io.connect();

function sendMessage(message){
    console.log('Client sending message: ', message);
    socket.emit('message', message);
}


var isInitiator;
var room = window.location.hash.substring(1);
if (!room) {
	room = window.location.hash = randomToken();
}

socket.on('ipaddr', function (ipaddr) {
    console.log('My IP address is', ipaddr);
    roomURL.innerHTML = 'http://' + ipaddr + ':2013/#' + room;
});

socket.on('created', function (room, clientId) {
  console.log('Created room', room, '- my client ID is', clientId);
  isInitiator = true;
});

socket.on('joined', function (room, clientId) {
  console.log('This peer has joined room', room, 'with client ID', clientId);
  isInitiator = false;
});

socket.on('ready', function () {
    createPeerConnection(isInitiator, configuration);
})

socket.on('log', function (array) {
  console.log.apply(console, array);
});

socket.emit('ipaddr');
socket.emit('create or join', room);

console.log('Getting user media (video) ...');
getUserMedia({video: true}, getMediaSuccessCallback, getMediaErrorCallback);



var peerConn, dataChannel;

socket.on('message', function (message){
    console.log('Client received message:', message);

    if (message.type === 'offer') {
        console.log('Got offer. Sending answer to peer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function(){}, logError);
        peerConn.createAnswer(onLocalSessionCreated, logError);

    } else if (message.type === 'answer') {
        console.log('Got answer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function(){}, logError);

    } else if (message.type === 'candidate') {
        peerConn.addIceCandidate(new RTCIceCandidate({candidate: message.candidate}));

    } else if (message === 'bye') {

    }
});


function createPeerConnection(isInitiator, config) {
    console.log('Creating Peer connection as initiator?', isInitiator, 'config:', config);
	peerConn = new RTCPeerConnection(config);

	// send any ice candidates to the other peer
    peerConn.onicecandidate = function (event) {
    	console.log('onIceCandidate event:', event);
        if (event.candidate) {
            sendMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
            console.log('End of candidates.');
        }
    };

    // let the "negotiationneeded" event trigger offer generation
    // peerConn.onnegotiationneeded = function () {
    //     console.log('onNegotiationNeeded event');
    //     peerConn.createOffer(onLocalSessionCreated, logError);
    // }

    if (isInitiator) {
        console.log('Creating Data Channel');
        dataChannel = peerConn.createDataChannel("photos");
        onDataChannelCreated(dataChannel);

        console.log('Creating an offer');
        peerConn.createOffer(onLocalSessionCreated, logError);
    } else {
        peerConn.ondatachannel = function (event) {
            console.log('ondatachannel:', event.channel);
            dataChannel = event.channel;
            onDataChannelCreated(dataChannel);
        };
    }
}

function onLocalSessionCreated(desc) {
    console.log('local session created:', desc);
    peerConn.setLocalDescription(desc, function () {
        console.log('sending local desc:', peerConn.localDescription);
        sendMessage(peerConn.localDescription);
    }, logError);
}

function onDataChannelCreated(channel) {
    console.log('onDataChannelCreated:', channel);

    channel.onopen = function () {
        console.log('CHANNEL opened!!!');
    };

    var buf, count;

    channel.onmessage = function (event) {
        console.log('got data from CHANNEL');

        if (typeof event.data === 'string') {
            buf = window.buf = new Uint8ClampedArray(parseInt(event.data));
            count = 0;
            console.log('Expecting a total of', buf.byteLength, 'bytes');
            return;
        }
        buf.set(new Uint8ClampedArray(event.data), count);

        count += event.data.byteLength;
        console.log('count:', count)

        if (count == buf.byteLength) {
            // we're done: all data chunks have been received
            renderPhoto(buf);
        }
    }
}



function getMediaSuccessCallback(stream) {
	var streamURL = window.URL.createObjectURL(stream);
	console.log('getUserMedia video stream URL:', streamURL);
	window.stream = stream; // stream available to console

	video.src = streamURL;
	show(snapBtn);
}

function getMediaErrorCallback(error){
 	console.log("getUserMedia error:", error);
}

function snapPhoto() {
	canvas.drawImage(video, 0, 0, canvasWidth, canvasHeight);
	show(photo, sendBtn);
}

function sendPhoto() {
    var img = canvas.getImageData(0, 0, canvasWidth, canvasHeight);
    console.log('Sending a photo of', img.data.byteLength, 'bytes over RTC Data Channel');
    dataChannel.send(img.data.byteLength);
    dataChannel.send(img.data);
}

function snapAndSend() {
    snapPhoto();
    sendPhoto();
}

function renderPhoto(data) {
    var photo = document.createElement('canvas');
    photo.setAttribute('style', 'display: inline-block; margin: 1em; width: 200px; height: 150px; border: 1px solid #ccc;');
    trail.insertBefore(photo, trail.firstChild);

    var canvas = photo.getContext('2d');
    img = canvas.createImageData(300, 150);
    img.data.set(data);
    canvas.putImageData(img, 0, 0);
}

function setCanvasDimensions() {
	if (video.videoWidth == 0) {
		setTimeout(setCanvasDimensions, 200);
		return;
	}
	
	console.log('video width:', video.videoWidth, 'height:', video.videoHeight)

	canvasWidth = video.videoWidth / 2;
	canvasHeight = video.videoHeight / 2;
	//photo.style.width = canvasWidth + 'px';
	//photo.style.height = canvasHeight + 'px';
	// TODO: figure out right dimensions
	canvasWidth = 300; //300;
	canvasHeight = 150; //150;
}

function show() {
	Array.prototype.forEach.call(arguments, function(elem){
		elem.style.display = null;
	});
}

function hide() {
	Array.prototype.forEach.call(arguments, function(elem){
		elem.style.display = 'none';
	});
}

function randomToken() {
	return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
    console.log(err.toString(), err);
}

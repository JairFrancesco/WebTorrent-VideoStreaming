var http = require('http');
var MultiStream = require('multistream');
var util = require('util');
var Readable = require('stream').Readable;
var readableStream = require('readable-stream');
var videostream = require('../videostream.js');
var WebTorrent = require('webtorrent');

 /**
 * @module OakStreaming
 */

 module.exports = OakStreaming;
 
 
 /**
 * Creates a new OakStreaming instance which has the methods streamVideo, loadVideo, addPeer and on.
 * @class
 */ 
 function OakStreaming(){
   this.peerId = Math.floor(Math.random() * Math.pow(10,300) + 1);
   this.knownPeers = [];
   
   this.streamVideo = streamVideo; 
   this.loadVideo = loadVideo;
   this.addPeer = addPeer;  
   this.on = on;
};

 
 /**
 * @typedef StreamInformationObject
 * @type {object}
 * @property {string} magnetURI - Magnet URI of the torrent. If this property is undefined, no video data will be requested from the WebTorrent network.
 * @property {number} videoFileSize - The size in byte of the video file that was passed as an argument.
 * @property {string} XHRPath - The file path (e.g. /example.mp4 or /videos/example2.mp4) that will be used for the XML HTTP Requests to the Web server. Via these XML HTTP Requests, video data will be requested from the Web sever. If this property is undefined, no video data will be requested from the Web server.
 */
 
/**
 * @callback OakStreaming~streamVideoFinished
 * @param {StreamInformationObject} streamInformationObject - An object that other clients/peers can pass as an argument to their loadVideo method to download the video from other clients/peers and/or the Web Server.
 */ 

/**
 * Streams a video file to all other clients/peers.
 * @param {object} videoFile - The video file that should be streamed to the other clients/peers. This paramter can either be a {@link https://developer.mozilla.org/en-US/docs/Web/API/File|W3C File object}, a {@link https://developer.mozilla.org/en-US/docs/Web/API/FileList|W3C FileList}, a {@link https://nodejs.org/api/buffer.html|Node Buffer object} or a {@link https://nodejs.org/api/stream.html#stream_class_stream_readable|Readable stream object}.
 * @param {object} [options] - Options for the creation of the StreamInformationObject, that gets passed as an argument to the callback function.
 * @param {string} options.XHRPath - The path that will be used for the XML HTTP Request (XHR). If the option object or this property of the option object is undefined, no video data will be requested from the server.
 * @param {OakStreaming~streamVideoFinished} callback - This callback function gets called with the generated StreamInformationObject at the end of the execution of streamVideo.
 */
function streamVideo(videoFile, options, callback){ 
   var webTorrentClient = new WebTorrent();
   console.log("streamVideo is executed");
   webTorrentClient.seed(videoFile, {announceList: [["wss://localhost:8081"]]}, function(torrent){
      var streamInformationObject = {};
      console.log("Video file was seeded");
      //streamInformationObject.torrent = torrent;
      streamInformationObject.magnetURI = torrent.magnetURI;
      streamInformationObject.videoFileSize = torrent.files[0].length;
      streamInformationObject.XHRPath = options.XHRPath;
      //console.log("Creaded streamInformationObject:\n" + JSON.stringify(streamInformationObject));
      setTimeout(function(){callback(streamInformationObject);},0);
      return torrent;
   });   
};


/**
 * @callback OakStreaming~loadedVideoFinished
 */ 
 
/**
 * Streams a video file to all other clients/peers.
 * @param {StreamInformationObject} streamInformationObject - This object contains all data that is needed to initiate loading the video from other peers and/or a Web server. StreamInformationObjects can be created by the {@link streamVideo|streamVideo} method.
 * @param {OakStreaming~loadedVideoFinished} callback - This callback gets called when the video has been loaded entirely into the buffer of the video player.
 */
function loadVideo(streamInformationObject, callback){
   console.log("Version BAM 2");
   //console.log("I entered this.loadVideo");
   //console.log("option paramter:\n" + JSON.stringify(streamInformationObject));
   var deliveryByServer = streamInformationObject.XHRPath ? true : false;
   var deliveryByWebtorrent = streamInformationObject.magnetURI ? true : false;
   var MAGNET_URI = streamInformationObject.magnetURI;
   var PATH_TO_VIDEO_FILE = streamInformationObject.XHRPath;
   var SIZE_OF_VIDEO_FILE = streamInformationObject.videoFileSize;
   

   var DOWNLOAD_FROM_SERVER_TIME_RANGE = streamInformationObject.downloadFromServerTimeRange || 5; // in seconds
   var UPLOAD_LIMIT = streamInformationObject.uploadLimit || 2; // multiplied by number of downloaded bytes
   var ADDITION_TO_UPLOAD_LIMIT = streamInformationObject.additionToUploadLimit || 5000; // amount of byte added to upload limit
   var XHR_REQUEST_SIZE = streamInformationObject.xhrRequestSize || 50000; // in byte
   var THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM = streamInformationObject.thresholdForReturningAnswerStream || 500000; // in byte

   var CHECK_IF_BUFFER_FULL_ENOUGH_INTERVAL = streamInformationObject.checkIfBufferFullEnoughInterval || 300; // in miliseconds
   var CHECK_IF_ANSWERSTREAM_READY_INTERVAL = streamInformationObject.checkIfAnswerstreamReadyInterval || 200; // in miliseconds
   var UPDATE_CHART_INTERVAL = streamInformationObject.updateChartInterval || 1000; // in miliseconds
   var CHOKE_IF_NECESSARY_INTERVAL = streamInformationObject.chokeIfNecessaryInterval || 500; // in miliseconds
   
   
   var myVideo = document.getElementById("myVideo");
   var theCoolCounter = 0;
   var consoleCounter = 0;
   //var firstCreateReadStream = true;
   //var first500ByteBuffer = Buffer.allocUnsafe(500);
   var globalvideostreamRequestNumber = 0;
   // var fileSize = -1;
   //var first500ByteBufferFull = false;
   var bytesReceivedFromServer = 0;
   var theTorrent;
   var webTorrentFile;
   var videostreamRequestHandlers = [];
   var inCritical = true;
   var wires = [];
   var fileSize2 = 42;
   var videoCompletelyLoaded = false;
   var endStreaming = false;
   

   function MyReadableStream(options){
      Readable.call(this, options);
   }
   util.inherits(MyReadableStream, Readable);
   MyReadableStream.prototype._read = function(size){};
   
   if(deliveryByWebtorrent){
      var client = new WebTorrent();
      client.add(MAGNET_URI, function (torrent){
         //console.log("torrent meta data ready");
         theTorrent = torrent;
         webTorrentFile = torrent.files[0];

         torrent.on('wire', function (wire){
            wires.push(wire);
            if(!window.firstWire){
               window.firstWire = wire;
            }
         });

         for(var i=0, length=videostreamRequestHandlers.length; i<length; i++){
            var thisRequest = videostreamRequestHandlers[i];
            if(thisRequest.currentCB !== null){
               ////console.log("In onTorrent nachträglich webtorrent stream erzeugen  thisRequest.start: " + thisRequest.start);
               ////console.log("In onTorrent  webTorrentFile.length: " + webTorrentFile.length);
               thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : webTorrentFile.length-1});
               //thisRequest.webTorrentStream.pause();
               thisRequest.oldStartWebTorrent = thisRequest.start;
               thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
               //thisRequest.webTorrentStream.resume();
            }
         }
      });
   }
   
   var file = function (path) {
      this.path = path;
   }
   file.prototype.createReadStream = function (opts){
      if(opts.start > SIZE_OF_VIDEO_FILE){
         return new MultiStream(function (cb){cb(null,null);});
      }
      inCritical = true;
      var videostreamRequestNumber = ++globalvideostreamRequestNumber;
      //console.log(consoleCounter++ + " called createreadStream " + videostreamRequestNumber);
      ////console.log(consoleCounter++ + " opts.start: " + opts.start);
      ////console.log(consoleCounter++ + " opts.end: " + opts.end);
      var end = isNaN(opts.end) ? SIZE_OF_VIDEO_FILE : (opts.end + 1);
      var thisRequest = new VideostreamRequestHandler(videostreamRequestNumber, opts, end, this);
      var MyWriteableStream = function(){
         readableStream.Writable.call(this);
      };
      util.inherits(MyWriteableStream, readableStream.Writable);
      MyWriteableStream.prototype._write = function(chunk, encoding, done){
         //console.log("MyWriteableStream _write is called");
         if(thisRequest.start-thisRequest.oldStartWebTorrent < chunk.length){
            ////console.log("MyWriteableStream _write: pushing received data in answerStream")
            if(thisRequest.answerStream.push(chunk.slice(thisRequest.start-thisRequest.oldStartWebTorrent, chunk.length))){
               thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
            } else {
               //thisRequest.answerStream.push(null);

               if (thisRequest.webTorrentStream) {
                  thisRequest.webTorrentStream.pause();
               }
               thisRequest.bytesInAnswerStream = 0;
               var res = thisRequest.answerStream;
               thisRequest.answerStream = new MyReadableStream({highWaterMark: 50000000});
               var theCallbackFunction = thisRequest.currentCB;
               thisRequest.currentCB = null;
               ////console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
               theCallbackFunction(null, res);
            }
            thisRequest.start += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
         }
         thisRequest.oldStartWebTorrent += chunk.length;
         //ceckIfAnswerStreamReady(thisRequest);
         done();
      };
      thisRequest.collectorStreamForWebtorrent = new MyWriteableStream();
      videostreamRequestHandlers.push(thisRequest);

      if(theTorrent && theTorrent.uploaded <= UPLOAD_LIMIT * theTorrent.downloaded + ADDITION_TO_UPLOAD_LIMIT){
         if(webTorrentFile){
            ////console.log("after new videostreamRequest creating a corresponding webtorrent stream");
            console.log("opts.start: " + opts.start);
            console.log("webTorrentFile.length: " + webTorrentFile.length);
            var webTorrentStream = webTorrentFile.createReadStream({"start" : opts.start, "end" : webTorrentFile.length-1});
            //webTorrentStream.pause();
            thisRequest.webTorrentStream = webTorrentStream;
            thisRequest.oldStartWebTorrent = opts.start;
            webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
            //webTorrentStream.resume();
            /*
            webTorrentStream.on('data', (chunk) => {
               if(thisRequest.start-thisRequest.oldStartWebTorrent < chunk.length){
                  var videoDataBuffer = Buffer.allocUnsafe(chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent));
                  thisRequest.answerStream.push(videoDataBuffer.fill(chunk, thisRequest.start-thisRequest.oldStartWebTorrent, chunk.length));
                  thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
                  thisRequest.start += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
               }
               thisRequest.oldStartWebTorrent += chunk.length;
               ceckIfAnswerStreamReady(thisRequest);
            });
            */
         }
      }

      var multi = new MultiStream(function (cb){
         thisRequest.CBNumber++;
         if(theCoolCounter<20){
            //console.log(consoleCounter++ + "    " + thisRequest.CBNumber + ". call of function(cb) from " + videostreamRequestNumber);
            ////console.log(consoleCounter++ + "    start: " + thisRequest.start);
         }
         thisRequest.currentCB = cb;

         if(thisRequest.webTorrentStream){
            thisRequest.webTorrentStream.resume();
         } else if(webTorrentFile){
            ////console.log("New cb function was called and I subsequently create a new torrentStream for it because non existed before for this videostreamRequest");
            thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : webTorrentFile.length-1});
            //thisRequest.webTorrentStream.pause();
            thisRequest.oldStartWebTorrent = thisRequest.start;
            thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
            //thisRequest.webTorrentStream.resume();
         }

         if(deliveryByServer && inCritical && !thisRequest.XHRConducted){
            conductXHR(thisRequest);
         }
      });
      ////console.log(consoleCounter++ + " terminate createReadStream");
      return multi;
   };

   function ceckIfAnswerStreamReady(thisRequest){
       ////console.log("At the beginning of thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
       ////console.log("In ceckIfAnswerStreamReady of videostreamRequest number " + thisRequest.readStreamNumber +  ". thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream + "     thisRequest.currentCB: " + thisRequest.currentCB);
       if (thisRequest.currentCB && ((thisRequest.bytesInAnswerStream >= THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM) || (thisRequest.start >= SIZE_OF_VIDEO_FILE))) {
           ////console.log("answerStream from videostream Request number " + thisRequest.readStreamNumber + " and CB number " + thisRequest.CBNumber + " gets returned");
         // //console.log("Returing answerStream out of ceckIfAnswerStreamReady()");

           //thisRequest.answerStream.push(null);

           if (thisRequest.webTorrentStream){
               thisRequest.webTorrentStream.pause();
           }
           thisRequest.bytesInAnswerStream = 0;
           var res = thisRequest.answerStream;
           thisRequest.answerStream = new MyReadableStream({highWaterMark: 50000000});
           var theCallbackFunction = thisRequest.currentCB;
           thisRequest.currentCB = null;

           ////console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
           theCallbackFunction(null, res);
           if(thisRequest.start >= SIZE_OF_VIDEO_FILE){
              if(callback){
                 videoCompletelyLoaded = true;
                 callback();
              };
           }
       }
   }

       function chokeIfNecessary() {
           if (theTorrent && theTorrent.uploaded >= theTorrent.downloaded * UPLOAD_LIMIT + ADDITION_TO_UPLOAD_LIMIT) {
               for (var i = 0, length = wires.length; i < length; i++) {
                   //console.log("I choked a peer");
                   wires[i].choke();
               }
               if(theTorrent.progress >= 1){
                  theTorrent.destroy();
                  endStreaming = true;
                  return;
               }
           }
           setTimeout(chokeIfNecessary, CHOKE_IF_NECESSARY_INTERVAL);
       }

       function updateChart() {
             if(endStreaming){
                return;
             }
           if (theTorrent) {
               document.getElementById("WebTorrent-received").innerHTML = "webTorrentFile.length: " + webTorrentFile.length + "\n torrent.downloaded: " + theTorrent.downloaded + "\n torrent.uploaded: " + theTorrent.uploaded + "\n torrent.progress: " + theTorrent.progress + "\n Bytes received from server: " + bytesReceivedFromServer;
           }
           setTimeout(updateChart, UPDATE_CHART_INTERVAL);
       }

       function VideostreamRequestHandler(readStreamNumber, opts, end, self) {
           this.readStreamNumber = readStreamNumber;
           this.opts = opts;
           this.start = opts.start;
           this.oldStartWebTorrent = 42;
           this.oldStartServer = 42;
           this.currentCB = null;
           this.CBNumber = 0;
           this.webTorrentStream = null;
           this.answerStream = new MyReadableStream({highWaterMark: 50000000});
           this.bytesInAnswerStream = 0;
           this.collectorStreamForWebtorrent = null;
           this.XHRConducted = false;
           this.end = end;
           this.self = self;
       }

       function frequentlyCeckIfAnswerStreamReady() {
         if(videoCompletelyLoaded){
            return;
         }
           for (var i = 0, length = videostreamRequestHandlers.length; i < length; i++) {
               ceckIfAnswerStreamReady(videostreamRequestHandlers[i]);
           }
           setTimeout(frequentlyCeckIfAnswerStreamReady, CHECK_IF_ANSWERSTREAM_READY_INTERVAL);
       }

       function checkIfBufferFullEnough(){
           if(videoCompletelyLoaded){
              return;
           }
           var timeRanges = document.querySelector('video').buffered;
           inCritical = true;
           for (var i = 0, length = timeRanges.length; i < length; i++) {
               ////console.log("Time range number " + i + ": start(" + timeRanges.start(i) + ") end(" + timeRanges.end(i) + ")");
               if (myVideo.currentTime >= timeRanges.start(i) && myVideo.currentTime <= timeRanges.end(i)) {
                   if (timeRanges.end(i) - myVideo.currentTime >= DOWNLOAD_FROM_SERVER_TIME_RANGE) {
                       inCritical = false;
                       ////console.log("I set inCritical to false");
                   }
               }
           }
           if (deliveryByServer && inCritical) {
               for (var j = 0, length = videostreamRequestHandlers.length; j < length; j++) {
                   if (videostreamRequestHandlers[j].currentCB !== null && videostreamRequestHandlers[j].XHRConducted === false) {
                       conductXHR(videostreamRequestHandlers[j]);
                   }
               }
           }
           setTimeout(checkIfBufferFullEnough, CHECK_IF_BUFFER_FULL_ENOUGH_INTERVAL);
       }

       function conductXHR(thisRequest) {
           thisRequest.XHRConducted = true;
           var reqStart = thisRequest.start;
           var reqEnd = reqStart + XHR_REQUEST_SIZE;

           if (thisRequest.end >= 0 && reqEnd > thisRequest.end) {
               reqEnd = thisRequest.end;
           }
           if (reqStart >= reqEnd) {
               req = null;
               return thisRequest.currentCB(null, null);
           }
           if (consoleCounter < 10000000) {
               //////console.log(consoleCounter++ + "  videoStream " + thisRequest.readStreamNumber + "  CB number " + thisRequest.CBNumber + "    reqStart: " + reqStart);
               //////console.log(consoleCounter++ + "  Multistream " + thisRequest.readStreamNumber + "   CB number " + thisRequest.CBNumber + "    reqEnd: " + reqEnd);
           }

           var XHRDataHandler = function (chunk) {
               //////console.log("TypeOf chunk: " + typeof chunk);
               if (consoleCounter < 1000000000) {
                   //////console.log(consoleCounter++, "BAM In XHRDataHandler from readStream ", thisRequest.readStreamNumber, "and thisRequestCBNumber", thisRequest.CBNumber);
                   //////console.log(consoleCounter++, "chunk.length: ", chunk.length);
                   //////console.log("thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
                   //////console.log("thisRequest.answerStream: " + thisRequest.answerStream);
                   //////console.log("thisRequest.start: " + thisRequest.start);
               }
               if (thisRequest.start - thisRequest.oldStartServer < chunk.length) {
                   if (consoleCounter < 100000000) {
                       /*
                       //console.log("add data to answerStream");
                       //console.log("chunk.length: " + chunk.length);
                       //console.log("thisRequest.start: " + thisRequest.start);
                       //console.log("thisRequest.oldStartServer: " + thisRequest.oldStartServer);
                       //console.log("thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
                       //console.log("length of slice: " + (chunk.slice(thisRequest.start - thisRequest.oldStartServer, chunk.length)).length);
                       */
                   }
                   if (thisRequest.answerStream.push(chunk.slice(thisRequest.start - thisRequest.oldStartServer, chunk.length))) {
                      // //console.log("push returned true");
                       thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start - thisRequest.oldStartServer);
                   } else {
                      // //console.log("push returned false");
                      // thisRequest.answerStream.push(null);

                       if (thisRequest.webTorrentStream) {
                           thisRequest.webTorrentStream.pause();
                       }
                       thisRequest.bytesInAnswerStream = 0;
                       var res = thisRequest.answerStream;
                       thisRequest.answerStream = new MyReadableStream({highWaterMark: 50000000});
                       var theCallbackFunction = thisRequest.currentCB;
                       thisRequest.currentCB = null;
                       ////console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
                       theCallbackFunction(null, res);
                   }
                   thisRequest.start += chunk.length - (thisRequest.start - thisRequest.oldStartServer);
               }
               thisRequest.oldStartServer += chunk.length;
               bytesReceivedFromServer += chunk.length;
               if (consoleCounter < 10000000000) {
                   //////console.log("After putting in answerStream - thisRequest.start: " + thisRequest.start);
                   //////console.log("After putting in answerStream - thisRequest.oldStartServer: " + thisRequest.oldStartServer);
                   //////console.log("After putting in answerStream - thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
               }
           }

           var XHREnd = function () {
               if (consoleCounter < 1000000000000) {
                   //////console.log("XHREnd from videostreamRequest number " + thisRequest.readStreamNumber);
               }
               thisRequest.XHRConducted = false;
           }

           thisRequest.oldStartServer = reqStart;
           //////console.log("At htto.get   reqStart: " + reqStart + "     reqEnd: " + reqEnd);

           req = http.get({
               path: thisRequest.self.path,
               hostname: 'localhost',
               port: 8080,
               path: "/example.mp4",
               headers: {
                   range: 'bytes=' + 0 + '-' + SIZE_OF_VIDEO_FILE
               }
           }, function (res) {
               var contentRange = res.headers['content-range'];
               if (contentRange) {
                   fileSize2 = parseInt(contentRange.split('/')[1], 10);
               }
               //////console.log("I return currentCB with http response stream");
               ////////console.log("function(res) is executed from readstream number " + createReadStreamCounter + " and CB number " + thisCBNumber);
               res.on('end', XHREnd);
               res.on('data', XHRDataHandler);
           });
       }
   chokeIfNecessary();
   updateChart();
   frequentlyCeckIfAnswerStreamReady();
   checkIfBufferFullEnough();

   var video = document.querySelector('video');
   video.addEventListener('error', function (err){
      console.error(video.error);
   });
   //console.log("I call Videostream constructor");
   videostream(new file(PATH_TO_VIDEO_FILE), video);
};


function addPeer(simplePeerInstance, options){
   // add a peer manually to the WebTorrent swarm instance of all clients/peers in the group
}

function on(type, callback){
   // call callback when event of type "type" happend
   // bisher nur das event "foundNewPeerViaTracker" geplant
}
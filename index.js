var firstWire;
(function(){
//Parameters

console.log("15 Cheese");

//var magnet_YawsAndCechi = "magnet:?xt=urn:btih:be1594ca948b3c1d1a4f25c3cf17f08a4c9b4309&dn=Warcraft+III-+Nirvana+of+the+Elapse+-+Cechi+vs.+YAWS.mp4&tr=udp%3A%2F%2Fexodus.desync.com%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.io";
var magnet_Bam = "magnet:?xt=urn:btih:c99b557b765302db6d84eca0125e6d5f6f9d4f84&dn=bam.mp4&tr=udp%3A%2F%2Fexodus.desync.com%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.io";
var magnet_Sintel = "magnet:?xt=urn:btih:6a9759bffd5c0af65319979fb7832189f4f3c35d&dn=sintel.mp4&tr=udp%3A%2F%2Fexodus.desync.com%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.io";

var deliveryByServer = true;
var deliveryByWebtorrent = false;

//File size bam.mp4: 788493
//File size sintel.mp4: 129241752
//File size Yaws_and_Cechi: 596269367

    var VIDEO_FILE_NAME = "sintel.mp4";
    var SIZE_OF_VIDEO_FILE = 129241752;

var DOWNLOAD_FROM_SERVER_TIME_RANGE = 5; // in seconds
var UPLOAD_LIMIT = 2; // multiplied by number of downloaded bytes
var ADDITION_TO_UPLOAD_LIMIT = 5000; // amount of byte added to upload limit
var XHR_REQUEST_SIZE = 50000; // in byte
var THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM = 500000; // in byte

var CHECK_IF_BUFFER_FULL_ENOUGH_INTERVAL = 300; // in miliseconds
var CHECK_IF_ANSWERSTREAM_READY_INTERVAL = 200; // in miliseconds
var UPDATE_CHART_INTERVAL = 1000; // in miliseconds
var CHOKE_IF_NECESSARY_INTERVAL = 500; // in miliseconds


var http = require('http');
var MultiStream = require('multistream');
var util = require('util');
var Readable = require('stream').Readable;
var readableStream = require('readable-stream');
var videostream = require('./videostream.js');
var WebTorrent = require('webtorrent');
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
         if(!firstWire){
            firstWire = wire;
         }
      });
      
      for(var i=0, length=videostreamRequestHandlers.length; i<length; i++){
         var thisRequest = videostreamRequestHandlers[i];
         if(thisRequest.currentCB !== null){
            //console.log("In onTorrent nachträglich webtorrent stream erzeugen  thisRequest.start: " + thisRequest.start);
            //console.log("In onTorrent  webTorrentFile.length: " + webTorrentFile.length);
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
   inCritical = true;
   var videostreamRequestNumber = ++globalvideostreamRequestNumber;
   //console.log(consoleCounter++ + " called createreadStream " + videostreamRequestNumber);
   //console.log(consoleCounter++ + " opts.start: " + opts.start);
   //console.log(consoleCounter++ + " opts.end: " + opts.end);
   var end = isNaN(opts.end) ? SIZE_OF_VIDEO_FILE : (opts.end + 1);
   var thisRequest = new VideostreamRequestHandler(videostreamRequestNumber, opts, end, this);
   var MyWriteableStream = function(){
      readableStream.Writable.call(this);
   };
   util.inherits(MyWriteableStream, readableStream.Writable);
   MyWriteableStream.prototype._write = function(chunk, encoding, done){
      //console.log("MyWriteableStream _write is called");
      if(thisRequest.start-thisRequest.oldStartWebTorrent < chunk.length){
         //console.log("MyWriteableStream _write: pushing received data in answerStream")
         if(thisRequest.answerStream.push(chunk.slice(thisRequest.start-thisRequest.oldStartWebTorrent, chunk.length))){
            thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
         } else {
            thisRequest.answerStream.push(null);

            if (thisRequest.webTorrentStream) {
               thisRequest.webTorrentStream.pause();
            }
            thisRequest.bytesInAnswerStream = 0;
            var res = thisRequest.answerStream;
            thisRequest.answerStream = new MyReadableStream({highWaterMark: 50000000});
            var theCallbackFunction = thisRequest.currentCB;
            thisRequest.currentCB = null;
            //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
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
         //console.log("after new videostreamRequest creating a corresponding webtorrent stream");
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
         //console.log(consoleCounter++ + "    start: " + thisRequest.start);
      }
      thisRequest.currentCB = cb;
      
      if(thisRequest.webTorrentStream){
         thisRequest.webTorrentStream.resume();
      } else if(webTorrentFile){
         //console.log("New cb function was called and I subsequently create a new torrentStream for it because non existed before for this videostreamRequest");
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
   //console.log(consoleCounter++ + " terminate createReadStream");
   return multi;
};

function ceckIfAnswerStreamReady(thisRequest) {
    //console.log("At the beginning of thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
    //console.log("In ceckIfAnswerStreamReady of videostreamRequest number " + thisRequest.readStreamNumber +  ". thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream + "     thisRequest.currentCB: " + thisRequest.currentCB);
    if (thisRequest.currentCB && ((thisRequest.bytesInAnswerStream >= THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM) || (thisRequest.start >= SIZE_OF_VIDEO_FILE))) {
        //console.log("answerStream from videostream Request number " + thisRequest.readStreamNumber + " and CB number " + thisRequest.CBNumber + " gets returned");
      // console.log("Returing answerStream out of ceckIfAnswerStreamReady()");

        thisRequest.answerStream.push(null);

        if (thisRequest.webTorrentStream) {
            thisRequest.webTorrentStream.pause();
        }
        thisRequest.bytesInAnswerStream = 0;
        var res = thisRequest.answerStream;
        thisRequest.answerStream = new MyReadableStream({highWaterMark: 50000000});
        var theCallbackFunction = thisRequest.currentCB;
        thisRequest.currentCB = null;

        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
        theCallbackFunction(null, res);
        return true;
    }
    return false;
}

    function chokeIfNecessary() {
        if (theTorrent && theTorrent.uploaded >= theTorrent.downloaded * UPLOAD_LIMIT + ADDITION_TO_UPLOAD_LIMIT) {
            for (var i = 0, length = wires.length; i < length; i++) {
                console.log("I choked a peer");
                wires[i].choke();
            }
        }
        setTimeout(chokeIfNecessary, CHOKE_IF_NECESSARY_INTERVAL);
    }

    function updateChart() {
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
        for (var i = 0, length = videostreamRequestHandlers.length; i < length; i++) {
            ceckIfAnswerStreamReady(videostreamRequestHandlers[i]);
        }
        setTimeout(frequentlyCeckIfAnswerStreamReady, CHECK_IF_ANSWERSTREAM_READY_INTERVAL);
    }

    function checkIfBufferFullEnough() {
        var timeRanges = document.querySelector('video').buffered;
        inCritical = true;
        for (var i = 0, length = timeRanges.length; i < length; i++) {
            //console.log("Time range number " + i + ": start(" + timeRanges.start(i) + ") end(" + timeRanges.end(i) + ")");
            if (myVideo.currentTime >= timeRanges.start(i) && myVideo.currentTime <= timeRanges.end(i)) {
                if (timeRanges.end(i) - myVideo.currentTime >= DOWNLOAD_FROM_SERVER_TIME_RANGE) {
                    inCritical = false;
                    //console.log("I set inCritical to false");
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
            ////console.log(consoleCounter++ + "  videoStream " + thisRequest.readStreamNumber + "  CB number " + thisRequest.CBNumber + "    reqStart: " + reqStart);
            ////console.log(consoleCounter++ + "  Multistream " + thisRequest.readStreamNumber + "   CB number " + thisRequest.CBNumber + "    reqEnd: " + reqEnd);
        }

        var XHRDataHandler = function (chunk) {
            ////console.log("TypeOf chunk: " + typeof chunk);
            if (consoleCounter < 1000000000) {
                ////console.log(consoleCounter++, "BAM In XHRDataHandler from readStream ", thisRequest.readStreamNumber, "and thisRequestCBNumber", thisRequest.CBNumber);
                ////console.log(consoleCounter++, "chunk.length: ", chunk.length);
                ////console.log("thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
                ////console.log("thisRequest.answerStream: " + thisRequest.answerStream);
                ////console.log("thisRequest.start: " + thisRequest.start);
            }
            if (thisRequest.start - thisRequest.oldStartServer < chunk.length) {
                if (consoleCounter < 100000000) {
                    /*
                    console.log("add data to answerStream");
                    console.log("chunk.length: " + chunk.length);
                    console.log("thisRequest.start: " + thisRequest.start);
                    console.log("thisRequest.oldStartServer: " + thisRequest.oldStartServer);
                    console.log("thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
                    console.log("length of slice: " + (chunk.slice(thisRequest.start - thisRequest.oldStartServer, chunk.length)).length);
                    */
                }
                if (thisRequest.answerStream.push(chunk.slice(thisRequest.start - thisRequest.oldStartServer, chunk.length))) {
                   // console.log("push returned true");
                    thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start - thisRequest.oldStartServer);
                } else {
                   // console.log("push returned false");
                    thisRequest.answerStream.push(null);

                    if (thisRequest.webTorrentStream) {
                        thisRequest.webTorrentStream.pause();
                    }
                    thisRequest.bytesInAnswerStream = 0;
                    var res = thisRequest.answerStream;
                    thisRequest.answerStream = new MyReadableStream({highWaterMark: 50000000});
                    var theCallbackFunction = thisRequest.currentCB;
                    thisRequest.currentCB = null;
                    //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
                    theCallbackFunction(null, res);
                }
                thisRequest.start += chunk.length - (thisRequest.start - thisRequest.oldStartServer);
            }
            thisRequest.oldStartServer += chunk.length;
            bytesReceivedFromServer += chunk.length;
            if (consoleCounter < 10000000000) {
                ////console.log("After putting in answerStream - thisRequest.start: " + thisRequest.start);
                ////console.log("After putting in answerStream - thisRequest.oldStartServer: " + thisRequest.oldStartServer);
                ////console.log("After putting in answerStream - thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
            }
        }

        var XHREnd = function () {
            if (consoleCounter < 1000000000000) {
                ////console.log("XHREnd from videostreamRequest number " + thisRequest.readStreamNumber);
            }
            thisRequest.XHRConducted = false;
        }

        thisRequest.oldStartServer = reqStart;
        ////console.log("At htto.get   reqStart: " + reqStart + "     reqEnd: " + reqEnd);

        req = http.get({
            path: thisRequest.self.path,
            headers: {
                range: 'bytes=' + reqStart + '-' + (reqEnd - 1)
            }
        }, function (res) {
            var contentRange = res.headers['content-range'];
            if (contentRange) {
                fileSize2 = parseInt(contentRange.split('/')[1], 10);
            }
            ////console.log("I return currentCB with http response stream");
            //////console.log("function(res) is executed from readstream number " + createReadStreamCounter + " and CB number " + thisCBNumber);
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
videostream(new file(VIDEO_FILE_NAME), video);
})();
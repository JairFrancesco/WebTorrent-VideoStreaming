(function(){
var http = require('http');
var MultiStream = require('multistream');
var util = require('util');
var Readable = require('stream').Readable;
var readableStream = require('readable-stream');
var videostream = require('../');
var WebTorrent = require('webtorrent');
var myVideo = document.getElementById("myVideo");
var theCoolCounter = 0;
var consoleCounter = 0;
//var firstCreateReadStream = true;
//var first500ByteBuffer = Buffer.allocUnsafe(500);
var globalvideostreamRequestNumber = 0;
//var xhrhappened = false;
var fileSize = -1;
//var first500ByteBufferFull = false;
var bytesReceivedFromServer = 0;
var theTorrent;
var webTorrentFile;
var videostreamRequestHandlers = [];
var inCritical = true;

/*
var client = new WebTorrent();
client.add('magnet:?xt=urn:btih:6a9759bffd5c0af65319979fb7832189f4f3c35d&dn=sintel.mp4&tr=udp%3A%2F%2Fexodus.desync.com%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.internetwarriors.net%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.webtorrent.io', function (torrent){
   console.log("torrent meta data ready");
   theTorrent = torrent;
   webTorrentFile = torrent.files[0];
   webTorrentFile.deselect();
   
   for(var i=0, length=videostreamRequestHandlers.length; i<length; i++){
      var thisRequest = videostreamRequestHandlers[i];
      if(thisRequest.currentCB !== null){
         thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : webTorrentFile.length});
         thisRequest.webTorrentStream.pause();
         thisRequest.oldStartWebTorrent = thisRequest.start;
         thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
         thisRequest.webTorrentStream.resume();    
      }
   }
});   
*/

updateChart();
frequentlyCeckIfAnswerStreamReady();
checkIfBufferFullEnough();



//console.log("Program starts");
//console.log("version 2");
var REQUEST_SIZE = 500000 // 500 kilobyte
var file = function (path) {
	this.path = path
}
file.prototype.createReadStream = function (opts){
   inCritical = true;
   var self = this;
   var videostreamRequestNumber = ++globalvideostreamRequestNumber;
   console.log(consoleCounter++ + " called createreadStream " + videostreamRequestNumber);
   console.log(consoleCounter++ + " opts.start: " + opts.start);
   console.log(consoleCounter++ + " opts.end: " + opts.end);
   var CBcount = 0;
   var end = isNaN(opts.end) ? fileSize : (opts.end + 1);
   var thisRequest = new VideostreamRequestHandler(videostreamRequestNumber, opts, end, self);
   var MyWriteableStream = function(){ // step 2
      readableStream.Writable.call(this);
   };
   util.inherits(MyWriteableStream, readableStream.Writable); // step 1
   MyWriteableStream.prototype._write = function(chunk, encoding, done){ // step 3
      if(thisRequest.start-thisRequest.oldStartWebTorrent < chunk.length){
         //var videoDataBuffer = Buffer.allocUnsafe(chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent));
         thisRequest.answerStream.push(chunk.slice(thisRequest.start-thisRequest.oldStartWebTorrent, chunk.length));
         thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
         thisRequest.start += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
      }
      thisRequest.oldStartWebTorrent += chunk.length;
      //ceckIfAnswerStreamReady(thisRequest);
      //done();
   };
   thisRequest.collectorStreamForWebtorrent = new MyWriteableStream(); // instanciate your brand new stream
   videostreamRequestHandlers.push(thisRequest);
   
   if(webTorrentFile){
      var webTorrentStream = webTorrentFile.createReadStream({"start" : opts.start, "end" : webTorrentFile.length});
      webTorrentStream.pause();
      thisRequest.webTorrentStream = webTorrentStream;
      webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
      webTorrentStream.resume();
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
              
   //var req = null;
   //var end = opts.end ? (opts.end + 1) : fileSize;
     
   
   
   
   var multi = new MultiStream(function (cb){
     // if(ceckIfAnswerStreamReady(thisRequest)){
     //    return;
     // }
      var thisCBNumber = ++CBcount;
      if(theCoolCounter<20){
         console.log(consoleCounter++ + "    " + thisCBNumber + ". call of function(cb) from " + videostreamRequestNumber);
         console.log(consoleCounter++ + "    start: " + thisRequest.start);
      }
      thisRequest.currentCB = cb;
      
      if(thisRequest.webTorrentStream){
         thisRequest.webTorrentStream.resume();
      }
      if(inCritical && !thisRequest.XHRConducted){
         conductXHR(thisRequest);
      }
   });
   console.log(consoleCounter++ + " terminate createReadStream");
   return multi;
};

function ceckIfAnswerStreamReady(thisRequest){
   //console.log("In ceckIfAnswerStreamReady of videostreamRequest number " + thisRequest.readStreamNumber +  ". thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream + "     thisRequest.currentCB: " + thisRequest.currentCB);
   if(thisRequest.currentCB && (thisRequest.bytesInAnswerStream >= 500000 || (webTorrentFile && thisRequest.start >= webTorrentFile.length) || (fileSize !== -1 && thisRequest.start >= fileSize))){ 
      thisRequest.answerStream.push(null);
      if(thisRequest.webTorrentStream){
         thisRequest.webTorrentStream.pause();
      }
      thisRequest.bytesInAnswerStream = 0;
      var res = thisRequest.answerStream; 
      thisRequest.answerStream = new Readable();
      var theCallbackFunction = thisRequest.currentCB;
      thisRequest.currentCB = null;
      //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
      theCallbackFunction(null, res);
      return true;
   }
   return false;
}

function updateChart(){
   if(theTorrent){
      document.getElementById("WebTorrent-received").innerHTML = "file.length: " + webTorrentFile.length + "\n torrent.downloaded: " + theTorrent.downloaded + "\n torrent.uploaded: " + theTorrent.uploaded + "\n torrent.progress: " + theTorrent.progress + "\n Bytes received from server: " + bytesReceivedFromServer;
   }
   setTimeout(updateChart, 5000);
}

function VideostreamRequestHandler(readStreamNumber, opts, end){
   this.readStreamNumber = readStreamNumber;
   this.opts = opts;
   this.start = opts.start;
   this.oldStartWebTorrent = opts.start;
   this.oldStartServer = opts.start;
   this.currentCB = null;
   this.webTorrentStream = null;
   this.answerStream = new Readable();
   this.bytesInAnswerStream = 0;
   this.collectorStreamForWebtorrent = null;
   this.XHRConducted = false;
   this.end = end;
   this.self = self;
}

function frequentlyCeckIfAnswerStreamReady(){
   for(var i=0, length=videostreamRequestHandlers.length; i<length; i++){
      ceckIfAnswerStreamReady(videostreamRequestHandlers[i]);
   }
   setTimeout(frequentlyCeckIfAnswerStreamReady, 1000);
}

function checkIfBufferFullEnough(){
   var timeRanges = document.querySelector('video').buffered;
   inCritical = true;
   for(var i=0, length=timeRanges.length; i<length; i++){
      console.log("Time range number " + i + ": start(" + timeRanges.start(i) + ") end(" + timeRanges.end(i) + ")");
      if(myVideo.currentTime >= timeRanges.start(i) && myVideo.currentTime <= timeRanges.end(i)){
         if(timeRanges.end(i)-myVideo.currentTime >= 10){
            inCritical = false;
            console.log("I set inCritical to false");
         } 
      }   
   }
   if(inCritical){
      for(var j=0, length=videostreamRequestHandlers.length; j<length; j++){
         if(videostreamRequestHandlers[i].currentCB !== null && videostreamRequestHandlers[i].XHRConducted === false){
            conductXHR(videostreamRequestHandlers[i]);           
         }       
      }      
   }
   setTimeout(checkIfBufferFullEnough, 3000);   
}

function conductXHR(thisRequest){
   thisRequest.XHRConducted = true;
   var reqStart = thisRequest.start;
   /*
   if(!firstCreateReadStream && reqStart < 500){
      var rs = new Readable();
      rs.push(first500ByteBuffer.slice(reqStart, 501));
      rs.push(null);
      start += 500-reqStart;
      return cb(null, rs);
   }
   */
   var reqEnd = reqStart + REQUEST_SIZE;
   if (thisRequest.end >= 0 && reqEnd > thisRequest.end){
      reqEnd = thisRequest.end;
   }
   if (reqStart >= reqEnd){
      req = null;
      return thisRequest.currentCB(null, null);
   }
   /*
   if(firstCreateReadStream){
      reqEnd = reqEnd - REQUEST_SIZE + 500;
   }
   */
   if(theCoolCounter<20){
      //console.log(consoleCounter++ + " reqStart: " + reqStart);
      //console.log(consoleCounter++ + " reqEnd: " + reqEnd);
   }
       
   function XHRDataHandler(chunk){
      if(theCoolCounter<20){
         console.log(consoleCounter++, "BAM In XHRDataHandler from readStream ", thisRequest.videostreamRequestNumber, "and thisCBNumber", thisRequest.thisCBNumber);
         console.log(consoleCounter++, "chunk size:", chunk.length);
      }
      if(thisRequest.start-thisRequest.oldStartServer < chunk.length){
         //console.log("add data to answerStream");
         //console.log("thisRequest.start: " + thisRequest.start);
         //console.log("thisRequest.oldStartServer: " + thisRequest.oldStartServer);
         //var videoDataBuffer = Buffer.allocUnsafe(chunk.length - (thisRequest.start-thisRequest.oldStartServer));
         thisRequest.answerStream.push(chunk.slice(thisRequest.start-thisRequest.oldStartServer, chunk.length));
         thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start-thisRequest.oldStartServer);
         //console.log("thisRequest.bytesInAnswerStream after adding of data: " + thisRequest.bytesInAnswerStream);
         thisRequest.start += chunk.length - (thisRequest.start-thisRequest.oldStartServer);
         //ceckIfAnswerStreamReady(thisRequest);
      }
      thisRequest.oldStartServer += chunk.length;
      bytesReceivedFromServer += chunk.length;
   }
   
   function XHREnd(){
      //console.log("XHREnd from videostreamRequest number " + thisRequest.readStreamNumber);
      conductingXHRRequest = false;               
   }

   req = http.get({
         path: self.path,
         headers: {
            range: 'bytes=' + reqStart + '-' + (reqEnd - 1)
            }
      }, function (res){
         var contentRange = res.headers['content-range']
         if (contentRange){
            fileSize = parseInt(contentRange.split('/')[1], 10)
         }
         //console.log("function(res) is executed from readstream number " + videostreamRequestNumber + " and CB number " + thisCBNumber);
         res.on('end', XHREnd);
         res.on('data', XHRDataHandler);             
      }
   ); 
}

var video = document.querySelector('video')
video.addEventListener('error', function (err) {
   console.error(video.error)
})
videostream(new file('sintel.mp4'), video);
})();
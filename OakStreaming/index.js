var http = require('http');
var MultiStream = require('multistream');
var util = require('util');
//var Readable = require('stream').Readable;
var readableStream = require('readable-stream');
var Videostream = require('videostream');
var WebTorrent = require('webtorrent');
var SimplePeer = require('simple-peer');
var ut_pex = require('ut_pex');
//var parseTorrent = require('parse-torrent');



 /**
 * @module OakStreaming
 */
module.exports = OakStreaming;


 /**
 * Creates a new OakStreaming instance which has the methods streamVideo, loadVideo, addPeer and on.
 * @constructor
 */ 
function OakStreaming(OakName){ 
   var self = this;
   (function(){
      var peerId = Math.floor(Math.random() * Math.pow(10,300) + 1);   
      console.log("Version: Alchimist   In OakStreaming constructor. this.name: " + OakName);
      var OakName = OakName;
      
      var simplePeerCreationCounter = 0;
      var connectionsWaitingForSignalingData = [];
      var theTorrent = null;
      var peersToAdd = [];
      var notificationsBecauseNewWires = 0;
      var bytesReceivedFromServer = 0;
      var SIZE_OF_VIDEO_FILE = -42;
      
      self.streamVideo = streamVideo;
      self.loadVideo = loadVideo;
      self.on = function(){};
      self.forTesting_connectedToNewWebTorrentPeer = null;
                
      self.numberOfBytesDownloadedFromServer = function(){
         return bytesReceivedFromServer;
      };
      self.numberOfBystesDownloadedP2P = function(){
         if(theTorrent){
            return theTorrent.downloaded;
         } else {
            return 0;
         }
      };
      self.numberOfBytesUploadedP2P = function(){
         if(theTorrent){
            return theTorrent.uploaded;
         } else {
            return 0;
         }
      };
      self.percentageDownloadedTorrent = function(){
         if(theTorrent){
            return theTorrent.progress;
         } else {
            return 0;
         }
      };
      self.fileSize = function(){
         return SIZE_OF_VIDEO_FILE;
      };
      
      /*
      this.streamVideo = function(a,b,c,d,e){streamVideo.call(self, a, b, c, d, e)};
      this.loadVideo = function(a,b,c){loadVideo.call(self, a, b, c)};
      this.addSimplePeerInstance = function(a,b,c){addSimplePeerInstance.call(self, a, b, c)};
      this.on = function(){};
      this.forTesting_connectedToNewWebTorrentPeer = function(){};
      */
      
      self.createSignalingData = function (callback){
         var alreadyCalledCallback = false;
         console.log("Archemage");
         var oakNumber = simplePeerCreationCounter;
         console.log("In createSignalingData oakNumber: " + oakNumber);
         connectionsWaitingForSignalingData[oakNumber] = new SimplePeer({initiator: true, tickle: false});
         simplePeerCreationCounter++;
         
         connectionsWaitingForSignalingData[oakNumber].on('signal', function (signalingData){
            if(!alreadyCalledCallback){
               alreadyCalledCallback = true;
               signalingData.oakNumber = oakNumber;
               callback(signalingData);
            }
         });
      };
      
      self.createSignalingDataResponse = function (signalingData, callback){
         console.log("Pala");
         var oakNumber = signalingData.oakNumber;
         console.log("In createSignalingDataResponse zu Beginn oakNumber: " + oakNumber);
         delete signalingData.oakNumber;
         
         var myPeer = new SimplePeer({initiator: false, tickle: false});
         var index = simplePeerCreationCounter;
         connectionsWaitingForSignalingData[index] = myPeer;
         simplePeerCreationCounter++;
         
         myPeer.on('signal', function (answerSignalingData){
            console.log("In createSignalingDataResponse nach onSignal oakNumber: " + oakNumber);
            answerSignalingData.oakNumber = oakNumber;
            console.log("In createSignalingDataResponse  object that is returned with callback: " + JSON.stringify(answerSignalingData));
            callback(answerSignalingData);
         });
         myPeer.signal(signalingData);
         
         var self = this;
         myPeer.on('connect', function(){
            self.addSimplePeerInstance(connectionsWaitingForSignalingData[index], {}, function(){console.log("addSimplePeerInstance ended");});
         });
      };
      
      self.processSignalingResponse = function (signalingData, callback){
         console.log("In processSignalingResponse  signalingData paramter: " + JSON.stringify(signalingData));
         var oakNumber = signalingData.oakNumber;
         delete signalingData.oakNumber;
         console.log("In processSignalingResponse  oakNumber: " + oakNumber);
         console.log("connectionsWaitingForSignalingData: " + connectionsWaitingForSignalingData);
         var self = this;
         (connectionsWaitingForSignalingData[oakNumber]).on('connect', function (){
            console.log('CONNECT');
            self.addSimplePeerInstance(connectionsWaitingForSignalingData[oakNumber]);
            connectionsWaitingForSignalingData[oakNumber] = undefined;
            callback();
         });
         console.log("In processSignalingResponse  object that is passed to .signal(): " + JSON.stringify(signalingData));
         connectionsWaitingForSignalingData[oakNumber].signal(signalingData);
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
      function streamVideo(videoFile, options, callback, returnTorrent, destroyTorrent){ 
         var webTorrentClient = new WebTorrent();
         ////console.log("streamVideo is executed");
         ////console.log("videoFile: " + videoFile);
         ////console.log("options: " + options);
         ////console.log("callback: " + callback);
         
         var streamInformationObject = {};
         streamInformationObject.bufferSize = options.bufferSize;
         streamInformationObject.pathToFileOnXHRServer = options.pathToFileOnXHRServer;
         streamInformationObject.XHRPort = options.XHRPort;
         streamInformationObject.hashValue = options.hashValue; 
             
         if(videoFile){
            var seedingOptions = {};
            if(options.webTorrentTrackers){
               seedingOptions.announceList = options.webTorrentTrackers;
               //seedingOptions.announce = options.webTorrentTrackers; // nur zum test
            }
            
            var self = this; 
            webTorrentClient.seed(videoFile, seedingOptions, function(torrent){
               console.log("torrent file is seeded");
               
               streamInformationObject.videoFileSize = torrent.files[0].length;
               streamInformationObject.torrentFile = torrent.torrentFile;
               streamInformationObject.pathToFileToSeed = options.pathToFileToSeed;
               
               //if(options.webTorrentTrackers){ Schauen ob es auch ohne if block drum herum läuft
                  streamInformationObject.magnetURI = torrent.magnetURI;
                  // Sind dann ja schon im torrent file drin      streamInformationObject.webTorrentTrackers = options.webTorrentTrackers;
               //}
               
               console.log("In streamVideo    " + self.OakName + ".forTesting_connectedToNewWebTorrentPeer gets created");
               self.forTesting_connectedToNewWebTorrentPeer = function(callback){
                  console.log("In streamVideo    " + self.OakName + ".forTesting_connectedToNewWebTorrentPeer gets executed");
                  if(notificationsBecauseNewWires <= 0){
                     notificationsBecauseNewWires--;
                     var callbackCalled = false;
                     
                     torrent.on('wire', function(wire){
                        if(!callbackCalled){
                           callback();
                           callbackCalled = true;
                        }
                     });
                  } else {
                     notificationsBecauseNewWires--;            
                     callback();
                  }
               };
               
               torrent.on('wire', function (wire){
                  notificationsBecauseNewWires++;  
               });          
                        
               //////console.log("Creaded streamInformationObject:\n" + JSON.stringify(streamInformationObject));
               if(returnTorrent === "It's a test"){
                  if(destroyTorrent){
                     notificationsBecauseNewWires = 0;
                     torrent.destroy();
                     delete webTorrentClient;
                  }
                  callback(streamInformationObject, torrent);
               } else {
                  callback(streamInformationObject);
                  return streamInformationObject;
               }
            });
         } else {
            callback(streamInformationObject);
         }
      }


      /**
       * @callback OakStreaming~loadedVideoFinished
       */ 
       
      /**
       * Streams a video file to all other clients/peers.
       * @param {StreamInformationObject} streamInformationObject - This object contains all data that is needed to initiate loading the video from other peers and/or a Web server. StreamInformationObjects can be created by the {@link streamVideo|streamVideo} method.
       * @param {OakStreaming~loadedVideoFinished} callback - This callback gets called when the video has been loaded entirely into the buffer of the video player.
       */
      function loadVideo(streamInformationObject, callback, endIfVideoLoaded){         
         //////console.log("I entered this.loadVideo");
         //////console.log("option paramter:\n" + JSON.stringify(streamInformationObject));
         var deliveryByServer = (streamInformationObject.pathToFileOnXHRServer || streamInformationObject.hashValue) ? true : false;
         var deliveryByWebtorrent = streamInformationObject.torrentFile ? true : false;
         var XHRServerURL = streamInformationObject.XHRServerURL || false;
         var XHR_PORT = streamInformationObject.XHRPort || 80;
         var pathToFileOnXHRServer = streamInformationObject.pathToFileOnXHRServer;       
         var hashValue = streamInformationObject.hashValue;
         var webTorrentTrackers = streamInformationObject.webTorrentTrackers;
         //var deliveryByWebtorrent = streamInformationObject.magnetURI ? true : false;
         var MAGNET_URI = streamInformationObject.magnetURI;
         var THE_RECEIVED_TORRENT_FILE = streamInformationObject.torrentFile;
         //console.log("streamInformationObject.XHRPath: " + streamInformationObject.XHRPath);
         SIZE_OF_VIDEO_FILE = streamInformationObject.videoFileSize;

         var DOWNLOAD_FROM_P2P_TIME_RANGE = streamInformationObject.videoBufferSize || 20; // how much seconds must be buffered in advance such that no more data streams are requested from the P2P network                  Old Describtion: This is the minomum byte range that the WebTorrent client will download in advance (regarding the current playback position) with a sequential chunk selection strategy. This means the video buffer size in byte
         var CREATE_READSTREAM_REQUEST_SIZE = streamInformationObject.createReadstreamRequestSize || 50000000; // The size of the createReadstream WebTorrent requests in bytes. 
         
         var DOWNLOAD_FROM_SERVER_TIME_RANGE = streamInformationObject.downloadFromServerTimeRange || 5; // in seconds
         var UPLOAD_LIMIT = streamInformationObject.uploadLimit || 2; // multiplied by number of downloaded bytes
         var ADDITION_TO_UPLOAD_LIMIT = streamInformationObject.additionToUploadLimit || 500000; // amount of byte added to upload limit
         
         
         var XHR_REQUEST_SIZE = streamInformationObject.xhrRequestSize || 50000; // in byte
         var THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM = streamInformationObject.thresholdForReturningAnswerStream || 50000; // in byte

         var CHECK_IF_BUFFER_FULL_ENOUGH_INTERVAL = streamInformationObject.checkIfBufferFullEnoughInterval || 300; // in miliseconds
         var CHECK_IF_ANSWERSTREAM_READY_INTERVAL = streamInformationObject.checkIfAnswerstreamReadyInterval || 200; // in miliseconds
         var UPDATE_CHART_INTERVAL = streamInformationObject.updateChartInterval || 1000; // in miliseconds
         var CHOKE_IF_NECESSARY_INTERVAL = streamInformationObject.chokeIfNecessaryInterval || 500; // in miliseconds
         var CHECK_IF_NEW_CREATE_READSTREAM_NECESSARY_INTERVAL = streamInformationObject.checkIfNewCreateReadstreamInterval || 500 ;
         
         var self = this;
         var endStreaming = false;
         var webTorrentClient = null;
         var wires = [];
         var consoleCounter = 0;
         var globalvideostreamRequestNumber = 0;
         bytesReceivedFromServer = 0;
         var webTorrentFile;
         var videostreamRequestHandlers = [];
         var inCritical = true;
         var videoCompletelyLoaded = false;
         var bytesTakenFromWebTorrent = 0;
         var bytesTakenFromServer = 0;   
         
         
         var myVideo = document.querySelector('video');
         myVideo.addEventListener('error', function (err){
            console.error(myVideo.error);
         });
         
         function MyReadableStream(options){
            readableStream.Readable.call(this, options);
         }
         util.inherits(MyReadableStream, readableStream.Readable);
         MyReadableStream.prototype._read = function(size){};
         
        
         if(deliveryByWebtorrent){
            console.log("entered if(deliveryByWebtorrent)");
            webTorrentClient = new WebTorrent();
                
            //THE_RECEIVED_TORRENT_FILE 
           
            var webTorrentOptions = {};
            /* Weiß nicht mehr warum das hier steht
            if(streamInformationObject.pathToFileToSeed){
               webTorrentOptions.path = streamInformationObject.pathToFileToSeed;
            }
            */
            webTorrentClient.add(MAGNET_URI, webTorrentOptions, function (torrent){              
               console.log("webTorrentClient.add   torrent meta data ready");         
               theTorrent = torrent;
               webTorrentFile = torrent.files[0];
               
               for(var j=0; j< peersToAdd.length; j++){
                  theTorrent.addPeer(peersToAdd[j][0]);
                  if(peersToAdd[j][1]){
                     (peersToAdd[j][1])();
                  }
               } 
                            
               //console.log("In loadVideo typeof webTorrentFile after assignment: " + typeof webTorrentFile);

               console.log("In loadVideo    " + self.OakName + ".forTesting_connectedToNewWebTorrentPeer gets created");
               self.forTesting_connectedToNewWebTorrentPeer = function(callback){
                  console.log("In loadVideo     " + self.OakName + ".forTesting_connectedToNewWebTorrentPeer   gets called");
                  if(notificationsBecauseNewWires <= 0){
                     notificationsBecauseNewWires--;
                     var callbackCalled = false;
                     
                     torrent.on('wire', function(wire){
                        if(!callbackCalled){
                           callback();
                           callbackCalled = true;
                        }
                     });
                  } else {
                     notificationsBecauseNewWires--;            
                     callback();
                  }
               };
               
               torrent.on('wire', function (wire){
                  console.log("torrent.on('wire', ..) is fired");
                  wires.push(wire);
                  if(!window.firstWire){
                     window.firstWire = wire;
                  }
                  notificationsBecauseNewWires++;
                  
                  
                  wire.use(ut_pex());
                  //wire.ut_pex.start();
                  
                  /*
                  wire.ut_pex.on('peer', function (peer){
                     theTorrent.addPeer(peer);
                     // got a peer
                     // probably add it to peer connections queue
                  });
                  */
               });

               for(var i=0, length=videostreamRequestHandlers.length; i<length; i++){
                  var thisRequest = videostreamRequestHandlers[i];
                  if(thisRequest.currentCB !== null){
                     //console.log("In onTorrent nachträglich webtorrent stream erzeugen  thisRequest.start: " + thisRequest.start);
                     //console.log("In onTorrent  webTorrentFile.length: " + webTorrentFile.length);
                                 
                     var endCreateReadStream;
                     if(thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE > webTorrentFile.length-1){
                        endCreateReadStream = webTorrentFile.length-1;
                     } else {
                        endCreateReadStream = thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE;
                     }
                         
                     thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : endCreateReadStream});
                     /*
                     thisRequest.on('end', function(){
                        if(thisRequest.currentCB !== null && thisRequest.start > thisRequest.lastEndCreateReadStream && thisRequest.start < thisRequest.videoFileSize){
                           var endCreateReadStream;
                           if(thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE >= webTorrentFile.length-1){
                              endCreateReadStream = webTorrentFile.length-1;
                           } else {
                              endCreateReadStream = thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE;
                           }                
                           thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : endCreateReadStream});
                           thisRequest.oldStartWebTorrent = thisRequest.start;
                           thisRequest.webTorrentStream.unpipe();
                           thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
                        }             
                     });
                     */
                     thisRequest.oldStartWebTorrent = thisRequest.start;
                     thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
                  }
               }
            });
         }
         
         
         
         var fileLikeObject = function (pathToFileOnXHRServer){
            this.pathToFileOnXHRServer = pathToFileOnXHRServer;
         };
         fileLikeObject.prototype.createReadStream = function (opts){
            if(opts.start > SIZE_OF_VIDEO_FILE){
               //console.log("opts.start > SIZE_OF_VIDEO_FILE there cb(null,null) every time");
               return (new MultiStream(function (cb){cb(null, null);}));
            }
            inCritical = true;
            //console.log(consoleCounter++ + " called createreadStream ");
            //console.log(consoleCounter++ + " opts.start: " + opts.start);
            //console.log(consoleCounter++ + " opts.end: " + opts.end);

            var thisRequest = new VideostreamRequestHandler(++globalvideostreamRequestNumber, opts, this);
           
            if(opts.end && !isNaN(opts.end)){
               thisRequest.end = opts.end + 1;
            } else {
               thisRequest.end = SIZE_OF_VIDEO_FILE;
            }
            
            var MyWriteableStream = function(highWaterMark){
               readableStream.Writable.call(this, highWaterMark);
            };
            util.inherits(MyWriteableStream, readableStream.Writable);
            MyWriteableStream.prototype._write = function(chunk, encoding, done){
               //console.log("MyWriteableStream _write is called");       
               if(thisRequest.start-thisRequest.oldStartWebTorrent < chunk.length){
                  ////////console.log("MyWriteableStream _write: pushing received data in answerStream")
                  bytesTakenFromWebTorrent += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
                  var streamHasMemoryLeft = thisRequest.answerStream.push(chunk.slice(thisRequest.start-thisRequest.oldStartWebTorrent, chunk.length));
                  thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
                  
                  if(streamHasMemoryLeft){            
                     if(thisRequest.currentCB !== null && thisRequest.start >= thisRequest.end){
                        var theCallbackFunction = thisRequest.currentCB;
                        thisRequest.currentCB = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
                        theCallbackFunction(null, res);
                     }
                  } else {
                     if(thisRequest.currentCB === null){
                        if(thisRequest.webTorrentStream){
                           thisRequest.webTorrentStream.pause();
                        }
                        thisRequest.noMoreData = true;
                     } else {
                        var theCallbackFunction = thisRequest.currentCB;
                        thisRequest.currentCB = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
                        theCallbackFunction(null, res);
                     }
                  }
                     thisRequest.start += chunk.length - (thisRequest.start-thisRequest.oldStartWebTorrent);
               }
               //ceckIfAnswerStreamReady(thisRequest);
               thisRequest.oldStartWebTorrent += chunk.length;
               done();
            };
            thisRequest.collectorStreamForWebtorrent = new MyWriteableStream({highWaterMark: 50000000});
            videostreamRequestHandlers.push(thisRequest);

            if(webTorrentFile && theTorrent.uploaded <= UPLOAD_LIMIT * theTorrent.downloaded + ADDITION_TO_UPLOAD_LIMIT){
               ////////console.log("after new videostreamRequest creating a corresponding webtorrent stream");
               ////console.log("opts.start: " + opts.start);
               ////console.log("webTorrentFile.length: " + webTorrentFile.length);
                
               var endCreateReadStream;
               if(thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE >= webTorrentFile.length-1){
                  endCreateReadStream = webTorrentFile.length-1;
               } else {
                  endCreateReadStream = thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE;
               }
               thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : endCreateReadStream});
               thisRequest.lastEndCreateReadStream = endCreateReadStream;
               thisRequest.oldStartWebTorrent = thisRequest.start;
               
               thisRequest.webTorrentStream.unpipe();
               thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
            }

            var multi = new MultiStream(function (cb){
               //console.log("ReadableStream request number " + thisRequest.readStreamNumber + "    does a cb request");
              
               if(thisRequest.end >= 0 && thisRequest.start >= thisRequest.end){
                  //console.log("called cb(null,null) from " + thisRequest.readStreamNumber); 
                  thisRequest.req = null;
                  return cb(null, null);
               }
              
               thisRequest.CBNumber++;
               if(consoleCounter<20){
                  //////console.log(consoleCounter++ + "    " + thisRequest.CBNumber + ". call of function(cb) from " + videostreamRequestNumber);
                  ////////console.log(consoleCounter++ + "    start: " + thisRequest.start);
               }
               thisRequest.currentCB = cb;
               thisRequest.noMoreData = false;
            
               if(!ceckIfAnswerStreamReady(thisRequest)){
                  if(thisRequest.webTorrentStream){
                     thisRequest.webTorrentStream.resume();
                  } else if(webTorrentFile){
                     ////////console.log("New cb function was called and I subsequently create a new torrentStream for it because non existed before for this videostreamRequest");
                     ////console.log("After new Multistream. thisRequest.start: " + thisRequest.start);
                     ////console.log("webTorrentFile.length: " + webTorrentFile.length);
                     var endCreateReadStream;
                     if(thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE >= webTorrentFile.length-1){
                        endCreateReadStream = webTorrentFile.length-1;
                     } else {
                        endCreateReadStream = thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE;
                     }
                     thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : endCreateReadStream});
                     thisRequest.lastEndCreateReadStream = endCreateReadStream;
                     thisRequest.oldStartWebTorrent = thisRequest.start;
                     
                     thisRequest.webTorrentStream.unpipe();
                     thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
                  }

                  if(deliveryByServer && inCritical && !thisRequest.XHRConducted){
                     conductXHR(thisRequest);
                  }
               }
            });
            ////////console.log(consoleCounter++ + " terminate createReadStream");
            var destroy = multi.destroy;
            multi.destroy = function(){
               if (thisRequest.req) {
                  thisRequest.req.destroy();
               }
               destroy.call(multi);
            };
            return multi;
         };
        
         
            
         function frequentlyCheckIfNewCreateReadStreamNecessary(){
               if(videoCompletelyLoaded){
                  return;
               }        
               if(myVideo.duration){
                  var timeRanges = myVideo.buffered;          
                  for (var i = 0, length = timeRanges.length; i < length; i++){
                     if (myVideo.currentTime >= timeRanges.start(i) && myVideo.currentTime <= timeRanges.end(i)+3) {
                        if (timeRanges.end(i) - myVideo.currentTime <= DOWNLOAD_FROM_P2P_TIME_RANGE) {
                           for (var i = 0, length = videostreamRequestHandlers.length; i < length; i++) {
                              var thisRequest = videostreamRequestHandlers[i];
                              
                              if(thisRequest.currentCB !== null && thisRequest.start > thisRequest.lastEndCreateReadStream && thisRequest.start < thisRequest.videoFileSize){
                                 var endCreateReadStream;
                                 if(thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE >= webTorrentFile.length-1){
                                    endCreateReadStream = webTorrentFile.length-1;
                                 } else {
                                    endCreateReadStream = thisRequest.start + CREATE_READSTREAM_REQUEST_SIZE;
                                 }                
                                 thisRequest.webTorrentStream = webTorrentFile.createReadStream({"start" : thisRequest.start, "end" : endCreateReadStream});
                                 thisRequest.oldStartWebTorrent = thisRequest.start;
                                 thisRequest.webTorrentStream.unpipe();
                                 thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
                              }
                           }
                        }
                     }
                  }
                  setTimeout(frequentlyCheckIfNewCreateReadStreamNecessary, CHECK_IF_NEW_CREATE_READSTREAM_NECESSARY_INTERVAL);
               }
            }   
         
         
         function ceckIfAnswerStreamReady(thisRequest){
            ////////console.log("At the beginning of thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
            ////////console.log("In ceckIfAnswerStreamReady of videostreamRequest number " + thisRequest.readStreamNumber +  ". thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream + "     thisRequest.currentCB: " + thisRequest.currentCB);
            if (thisRequest.currentCB && ((thisRequest.bytesInAnswerStream >= THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM) || (thisRequest.start >= SIZE_OF_VIDEO_FILE))){
               ////////console.log("answerStream from videostream Request number " + thisRequest.readStreamNumber + " and CB number " + thisRequest.CBNumber + " gets returned");
               // //////console.log("Returing answerStream out of ceckIfAnswerStreamReady()");
               var theCallbackFunction = thisRequest.currentCB;
               thisRequest.currentCB = null;
               thisRequest.answerStream.push(null);
               if (thisRequest.webTorrentStream){
                  thisRequest.webTorrentStream.pause();
               }
               thisRequest.bytesInAnswerStream = 0;
               var res = thisRequest.answerStream;
               thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
               //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
               theCallbackFunction(null, res);
               return true;
            }
            return false;
         }

         function chokeIfNecessary(){
               if (theTorrent && theTorrent.uploaded >= theTorrent.downloaded * UPLOAD_LIMIT + ADDITION_TO_UPLOAD_LIMIT) {
                  /* mache ich schon in einer anderen frequent methode
                  if(videoCompletelyLoaded){
                     theTorrent.destroy();
                     delete webTorrentClient;
                     endStreaming = true;
                     return;
                  }
                  */
                  for (var i = 0, length = wires.length; i < length; i++){
                     //console.log("I choked a peer");
                     wires[i].choke();
                  }
               }
               setTimeout(chokeIfNecessary, CHOKE_IF_NECESSARY_INTERVAL);
            }

         function updateChart(){
               if(endStreaming){
                  return;
               }
               if(theTorrent && webTorrentFile){
                  document.getElementById("WebTorrent-received").innerHTML = "webTorrentFile.length: " + webTorrentFile.length + "\n torrent.downloaded: " + theTorrent.downloaded + "\n torrent.uploaded: " + theTorrent.uploaded + "\n torrent.progress: " + theTorrent.progress + "\n Bytes received from server: " + bytesReceivedFromServer + "\n Bytes taken from server delivery: " + bytesTakenFromServer + "\n Bytes taken from WebTorrent delivery: " + bytesTakenFromWebTorrent;
               }
               setTimeout(updateChart, UPDATE_CHART_INTERVAL);
         }
          
         function VideostreamRequestHandler(readStreamNumber, opts, self) {
            this.readStreamNumber = readStreamNumber;
            this.opts = opts;
            this.start = opts.start || 0;
            this.oldStartWebTorrent = -42;
            this.oldStartServer = -42;
            this.currentCB = null;
            this.CBNumber = 0;
            this.webTorrentStream = null;
            this.answerStream = new MyReadableStream({highWaterMark: 5000000});
            this.bytesInAnswerStream = 0;
            this.collectorStreamForWebtorrent = null;
            this.XHRConducted = false;
            this.end = -42;
            this.self = self;
            this.bytesTakenFromWebTorrent = 0;
            this.bytesTakenFromServer = 0;
            this.noMoreData = false;
            this.req = null;
            this.lastEndCreateReadStream = -42;
         }

         function frequentlyCeckIfAnswerStreamReady(){
               if(videoCompletelyLoaded){
                  return;
               }
               for (var i = 0, length = videostreamRequestHandlers.length; i < length; i++) {
                  ceckIfAnswerStreamReady(videostreamRequestHandlers[i]);
               }
               setTimeout(frequentlyCeckIfAnswerStreamReady, CHECK_IF_ANSWERSTREAM_READY_INTERVAL);
         }

         function checkIfBufferFullEnough(){
               //console.log("checkIfBufferFullEnough is called");
               if(videoCompletelyLoaded){
                  return;
               }
               //console.log("video.duration: " + myVideo.duration);
               if(myVideo.duration){
                  var timeRanges = myVideo.buffered;
                  if(timeRanges.length >= 1){
                     //console.log("timeRanges.start(0): " + timeRanges.start(0));
                     //console.log("timeRanges.end(0): " + timeRanges.end(0));
                     
                     if(timeRanges.start(0) == 0 && timeRanges.end(0) == myVideo.duration){
                       // console.log("In checkIfBufferFullEnough: callback should be called");
                        videoCompletelyLoaded = true;
                        if(callback){
                           if(endIfVideoLoaded){
                              callback();
                           } else {
                              callback(theTorrent);
                           }
                        }
                        if(endIfVideoLoaded){
                           if(theTorrent){
                              theTorrent.destroy();
                              delete webTorrentClient;
                           }
                           endStreaming = true;
                           return;                 
                        } 
                     }
                  }
                  inCritical = true;              
                  for (var i = 0, length = timeRanges.length; i < length; i++) {
                     ////////console.log("Time range number " + i + ": start(" + timeRanges.start(i) + ") end(" + timeRanges.end(i) + ")");
                     if (myVideo.currentTime >= timeRanges.start(i) && myVideo.currentTime <= timeRanges.end(i)) {
                        if (timeRanges.end(i) - myVideo.currentTime >= DOWNLOAD_FROM_SERVER_TIME_RANGE) {
                           inCritical = false;
                           ////////console.log("I set inCritical to false");
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
               }
               setTimeout(checkIfBufferFullEnough, CHECK_IF_BUFFER_FULL_ENOUGH_INTERVAL);
            }

         function conductXHR(thisRequest) {
            if(thisRequest.currentCB === null){
               return;
            }
            thisRequest.XHRConducted = true;
            var reqStart = thisRequest.start;
            var reqEnd = reqStart + XHR_REQUEST_SIZE;

            if (thisRequest.end >= 0 && reqEnd > thisRequest.end) {
               reqEnd = thisRequest.end;
            }
            if (reqStart >= reqEnd) {
               thisRequest.req = null;
               //console.log("called cb(null,null)");
               return thisRequest.currentCB(null, null);
            }

            /* glaube ich unnötiger und/oder gefährlicher müll
            if (reqStart >= reqEnd) {
            req = null;
            return thisRequest.currentCB(null, null);
            }
            */
            if (consoleCounter < 10000000) {
               //////////console.log(consoleCounter++ + "  videoStream " + thisRequest.readStreamNumber + "  CB number " + thisRequest.CBNumber + "    reqStart: " + reqStart);
               //////////console.log(consoleCounter++ + "  Multistream " + thisRequest.readStreamNumber + "   CB number " + thisRequest.CBNumber + "    reqEnd: " + reqEnd);
            }

            var XHRDataHandler = function (chunk){
               bytesReceivedFromServer += chunk.length;
               //console.log("ReadableStream request number " + thisRequest.readStreamNumber + " received a chunk of length " + chunk.length);
               if(thisRequest.noMoreData){
                  thisRequest.oldStartServer += chunk.length;
                  return;
               }
               if (thisRequest.start - thisRequest.oldStartServer < chunk.length){         
                  bytesTakenFromServer += chunk.length - (thisRequest.start - thisRequest.oldStartServer);
                  thisRequest.bytesInAnswerStream += chunk.length - (thisRequest.start - thisRequest.oldStartServer);
                  var myBuffer = chunk.slice(thisRequest.start - thisRequest.oldStartServer, chunk.length);
                  //console.log("In XHRDataHandler   myBuffer.length: " + myBuffer.length);
                  var StreamHasMemoryLeft = thisRequest.answerStream.push(myBuffer);         
                  if(!StreamHasMemoryLeft){
                     if(thisRequest.currentCB !== null){
                        var theCallbackFunction = thisRequest.currentCB;
                        thisRequest.currentCB = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
                        theCallbackFunction(null, res); 
                     } else {
                        thisRequest.noMoreData = true;
                        if(thisRequest.webTorrentStream){
                           thisRequest.webTorrentStream.pause();
                        }
                     }
                  } else {
                     if (thisRequest.start >= SIZE_OF_VIDEO_FILE && thisRequest.currentCB !== null){
                        var theCallbackFunction = thisRequest.currentCB;
                        thisRequest.currentCB = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
                        theCallbackFunction(null, res);
                     }
                  } 
                  thisRequest.start += chunk.length - (thisRequest.start - thisRequest.oldStartServer);            
               }
               thisRequest.oldStartServer += chunk.length;
            }

            var XHREnd = function (){
               //console.log("ReadableStream request number " + thisRequest.readStreamNumber + " XHREnd");
               if (consoleCounter < 1000000000000){
                  //////////console.log("XHREnd from videostreamRequest number " + thisRequest.readStreamNumber);
               }
               if(thisRequest.bytesInAnswerStream > 0 && thisRequest.currentCB !== null){
                  thisRequest.answerStream.push(null);
                  thisRequest.bytesInAnswerStream = 0;
                  var res = thisRequest.answerStream;
                  thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                  var theCallbackFunction = thisRequest.currentCB;
                  thisRequest.currentCB = null;
                  //console.log("XHREnd: called CB with data out of answerStream from videostreamRequest number " + thisRequest.readStreamNumber);
                  theCallbackFunction(null, res);
               }
               thisRequest.XHRConducted = false;
            }  
            
            thisRequest.oldStartServer = reqStart;
            
            //console.log("At htto.get   reqStart: " + reqStart + "     reqEnd: " + reqEnd);

                  
            var XHROptionObject = {
               path: thisRequest.self.pathToFileOnXHRServer,
               headers: {
                  range: 'bytes=' + reqStart + '-' + (reqEnd-1)
               }
            };
            if(XHRServerURL){
               XHROptionObject.hostname = XHRServerURL;
               XHROptionObject.port = XHR_PORT;
            }
            
            thisRequest.req = http.get(XHROptionObject, function (res){
                  var contentRange = res.headers['content-range'];
                  if (contentRange) {
                     thisRequest.fileSize = parseInt(contentRange.split('/')[1], 10);
                  }
                  //////////console.log("I return currentCB with http response stream");
                  ////////////console.log("function(res) is executed from readstream number " + createReadStreamCounter + " and CB number " + thisCBNumber);
                  res.on('end', XHREnd);
                  res.on('data', XHRDataHandler);
               }
            );
         }
         frequentlyCheckIfNewCreateReadStreamNecessary();
         chokeIfNecessary();
         updateChart();
         frequentlyCeckIfAnswerStreamReady();
         checkIfBufferFullEnough();

         //////console.log("I call Videostream constructor");
         if(hashValue){
            Videostream(new fileLikeObject(hashValue), myVideo);
         } else {
            Videostream(new fileLikeObject(pathToFileOnXHRServer), myVideo);
         }
      }


      function addSimplePeerInstance(simplePeerInstance, options, callback){
         // The method add a simplePeer to the WebTorrent swarm instance
         if(theTorrent){
            if(theTorrent.infoHash){
               theTorrent.addPeer(simplePeerInstance);
               if(callback){
                  callback();
               }
            } else {
               theTorrent.on('infoHash', function() {theTorrent.addPeer(simplePeerInstance); if(callback){callback()}});
            }
         } else {
            var pair = [];
            pair.push(simplePeerInstance);
            pair.push(callback);
            peersToAdd.push(pair);
         }
      }


      function on(type, callback){
         // call callback when event of type "type" happend
         // bisher nur das event "foundNewPeerViaTracker" geplant
      }
   })();
}
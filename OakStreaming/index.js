var http = require('http');
var MultiStream = require('multistream');
var util = require('util');
var readableStream = require('readable-stream');
var Videostream = require('videostream');
var ut_pex = require('ut_pex');
var WebTorrent = require('webtorrent');
var SimplePeer = require('simple-peer');
var parseTorrent = require('parse-torrent');


 /**
 * @module FVSL
 */
module.exports = FVSL;


 /**
 * Creates a new FVSL instance which has the methods streamVideo, loadVideo, createSignalingData, createSignalingDataResponse, processSignalingResponse and several simple get methods  
 * @constructor
 */ 
function FVSL(OakName){
   var self = this;
   (function(){
      var peerId = Math.floor(Math.random() * Math.pow(10,300) + 1);   
      console.log("Version: Raider   In OakStreaming constructor. this.name: " + OakName);
      var OakName = OakName || "NoName FVSL instance";
      
      // Only methods should be part of the API, i.e. only methods should be publically accessible.
      // Every method should have access to these variables. Therefore they are definied at this high scope.
      var simplePeerCreationCounter = 0;
      var connectionsWaitingForSignalingData = [];
      var theTorrent = null;
      var peersToAdd = [];
      var bytesReceivedFromServer = 0;
      var notificationsBecauseNewWires = 0;
      var SIZE_OF_VIDEO_FILE = 0;
      
      self.streamVideo = streamVideo;
      self.loadVideo = loadVideo;
      self.forTesting_connectedToNewWebTorrentPeer = null;
                
      self.get_number_of_bytes_downloaded_from_server = function(){
         return bytesReceivedFromServer;
      };
      
      self.get_number_of_bystes_downloaded_P2P = function(){
         if(theTorrent){
            return theTorrent.downloaded;
         } else {
            return 0;
         }
      };
      
      self.get_number_of_bytes_uploaded_P2P = function(){
         if(theTorrent){
            return theTorrent.uploaded;
         } else {
            return 0;
         }
      };
      
      self.get_percentage_downloaded_of_torrent = function(){
         if(theTorrent){
            return theTorrent.progress;
         } else {
            return 0;
         }
      };
      
      self.get_file_size = function(){
         return SIZE_OF_VIDEO_FILE;
      };
      
      // This method creates (WebRTC-)signaling data that can be put into createSignalingDataResponse method of another FVSL instance to manually connected FVSL instances 
      self.createSignalingData = function (callback){
         var alreadyCalledCallback = false;
         var oakNumber = simplePeerCreationCounter;
         console.log("In createSignalingData for oakNumber: " + oakNumber);
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
 
      // This method creates (WebRTC-)signaling data as a response to singaling data from createSignalingDataResponse method of another FVSL instance.
      // This mehtod returns new (WebRTC-)signaling data which has to put into processSignalingResponse method of the FVSL instance which created the original singaling data.
      self.createSignalingDataResponse = function (signalingData, callback){
         var oakNumber = signalingData.oakNumber;
         console.log("In createSignalingDataResponse. In the beginning oakNumber: " + oakNumber);
         delete signalingData.oakNumber;
         
         var myPeer = new SimplePeer({initiator: false, tickle: false});
         var index = simplePeerCreationCounter;
         connectionsWaitingForSignalingData[index] = myPeer;
         simplePeerCreationCounter++;
         
         myPeer.on('signal', function (answerSignalingData){
            console.log("In createSignalingDataResponse, after onSignal oakNumber: " + oakNumber);
            answerSignalingData.oakNumber = oakNumber;
            console.log("In createSignalingDataResponse,  object that is returned with callback: " + JSON.stringify(answerSignalingData));
            callback(answerSignalingData);
         });
         myPeer.signal(signalingData);
         
         var self = this;
         myPeer.on('connect', function(){
            self.addSimplePeerInstance(connectionsWaitingForSignalingData[index], {}, function(){console.log("addSimplePeerInstance ended");});
         });
      };
      

      // This method finally establishes a Web-RTC connection between the two FVSL instances. From now on both FVSL instances exchange video fragments.
      self.processSignalingResponse = function (signalingData, callback){
         console.log("In processSignalingResponse,  signalingData paramter: " + JSON.stringify(signalingData));
         var oakNumber = signalingData.oakNumber;
         delete signalingData.oakNumber;
         console.log("In processSignalingResponse,  oakNumber: " + oakNumber);
         console.log("connectionsWaitingForSignalingData: " + connectionsWaitingForSignalingData);
         var self = this;
         (connectionsWaitingForSignalingData[oakNumber]).on('connect', function (){
            console.log('Established a simple-peer connection');
            self.addSimplePeerInstance(connectionsWaitingForSignalingData[oakNumber]);
            connectionsWaitingForSignalingData[oakNumber] = undefined;
            callback();
         });
         console.log("In processSignalingResponse,  object that is passed to .signal(): " + JSON.stringify(signalingData));
         connectionsWaitingForSignalingData[oakNumber].signal(signalingData);
      };
       
       /**
       * @typedef Stream_Information_Object
       * @type {object}
       * @property {number} video_file_size - The size in byte of the video file that was passed as an argument.
       */
       
      /**
       * @callback OakStreaming~streamVideoFinished
       * @param {Stream_Information_Object} stream_information_object - An object that other clients/peers can pass as an argument to their loadVideo method to download the video from other clients/peers and/or a Web Server.
       */ 

      /**
       * Streams a video file to all other clients/peers.
       * @param {object} video_file - The video file that should be streamed to the other clients/peers. This paramter can either be a {@link https://developer.mozilla.org/en-US/docs/Web/API/File |W3C File object}, a {@link https://developer.mozilla.org/en-US/docs/Web/API/FileList |W3C FileList}, a {@link https://nodejs.org/api/buffer.html |Node Buffer object} or a {@link https://nodejs.org/api/stream.html#stream_class_stream_readable |Readable stream object}.
       * @param {object} [options] - Options for the creation of the Stream_Information_Object, that after its creation gets passed as an argument to the callback function.
       * @param {string} options.path_to_file_on_XHR_server - The path that will be used for the XML HTTP Request (XHR). A valid path would be, for example, "/videos/aVideoFile.mp4". It is not necessary to set both the pathToFileOnXHRServer and the hashValue paramter for successfull XHR requests. If this property and the hashValue property is undefined, no video data will be requested from the server.
       * @param {string} options.hash_value - Hash value of the video file that should by requested from the SVSL WebServer. It is not necessary to set both the pathToFileOnXHRServer and the hashValue paramter for successfull XHR requests. If this property and the hashValue property is undefined, no video data will be requested from the server. 
       * @param {string} options.XHR_server_URL - URL of a XHR server that can serve the video file. If this property is not set, XHR will be send to the Web server that served the Web page.
       * @param {number} options.XHR_port - Port that will be used when communicating with the XHR server that was specified in the XHRServerURL property. This property should only be set when the XHRServerURL property is set too. The default value is 80.
       * @param {number} options.download_from_p2p_time_range - How many seconds of video playback must be buffered in advance such that no more data streams are requested from the WebTorrent network. The default value is 20 (seconds).
       * @param {number} options.create_readStream_request_size - The size of the byte range requests to the WebTorrent network. The default value is 5000000 (bytes).
       * @param {number} options.download_from_server_time_range - How many seconds of video playback must be buffered in advance such that no more data is requested from the XHR server. The default value is 5 (seconds).
       * @param {number} options.peer_upload_limit_multiplier - The FVSL client will severly throttle the video data upload to other peers when (bytes_uploaded_to_other_peers * peer_upload_limit_multiplier + peer_upload_limit_addition >=  bytes_downloaded_from_other_peers) and stop the throtting as soon as this inequality is no longer true. The default value for peer_upload_limit_multiplier is 2.
       * @param {number} options.peer_upload_limit_addition - The FVSL client will severly throttle the video data upload to other peers when (bytes_uploaded_to_other_peers * peer_upload_limit_multiplier + peer_upload_limit_addition >=  bytes_downloaded_from_other_peers) and stop the throtting as soon as this inequality is no longer true. the default value for peer_upload_limit_addition is 500000 (byte).
       * @param {string[][]} options.webTorrent_trackers - Array of arrays of WebTorrent tracking server URLs (strings). These WebTorrent trackers will be used to connect to other FVSL instances.
       * @param {OakStreaming~streamVideoFinished} callback - This callback function gets called with the generated Stream_Information_Object at the end of the execution of streamVideo.
       */
      function streamVideo(video_file, options, callback, returnTorrent, destroyTorrent){ 
         var webTorrentClient = new WebTorrent();
         //console.log("streamVideo is executed");
         //console.log("videoFile: " + videoFile);
         //console.log("options: " + options);
         //console.log("callback: " + callback);         
          
         var stream_information_object = options
             
         if(video_file){
            var seedingOptions = {};
            seedingOptions.announceList = options.webTorrent_trackers;

            var self = this; 
            webTorrentClient.seed(video_file, seedingOptions, function(torrent){
               console.log("torrent file is seeded");
               
               /* K42 Maybe I will need this later
               var torrentFileAsBlobURL = torrent.torrentFileBlobURL;
               var xhr = new XMLHttpRequest();
               var XHROrMethodEndHappend = false;
               xhr.open('GET', torrentFileAsBlobURL, true);
               xhr.responseType = 'blob';
               xhr.onload = function(e) {
                 if (this.status == 200) {
                   stream_information_object.torrentAsBlob = this.response;
                   if(XHROrMethodEndHappend){
                      callback(stream_information_object);
                   } else {
                      XHROrMethodEndHappend = true;
                   }
                 }
               };
               xhr.send();
               */
               
               SIZE_OF_VIDEO_FILE = torrent.files[0].length;
               stream_information_object.size_of_video_file = torrent.files[0].length;
               stream_information_object.magnetURI = torrent.magnetURI;
               stream_information_object.infoHash = torrent.infoHash;
               // stream_information_object.parsedTorrent =  parseTorrent(torrent.torrentFile); // K42
               // var bufferTorrent = parseTorrent(stream_information_object.parsedTorrent); K42
              
               
               console.log("In streamVideo    " + self.OakName + ".forTesting_connectedToNewWebTorrentPeer gets created");
               // This function calls the callback function when this FVSL instance already connected to another peer
               // or as soon as it connects to another peer.
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
               
               // This is necessary such that the forTesting_connectedToNewWebTorrentPeer function knows how many peers already connected to this FVSL instance.
               torrent.on('wire', function (wire){
                  notificationsBecauseNewWires++;  
               });          
                        
               console.log("Creaded stream_information_object:\n" + JSON.stringify(stream_information_object));
               
               // For some Jasmine tests it is appropriate that the torrent gets destroyed immediately after the stream_information_object has been created. The destruction of the torrent stops the seeding.
               if(returnTorrent === "It's a test"){
                  if(destroyTorrent){
                     notificationsBecauseNewWires = 0;
                     torrent.destroy();
                     delete webTorrentClient;
                  }
                  callback(stream_information_object, torrent);
               } else {
                  callback(stream_information_object);
                  return stream_information_object;
               }
            });
         } else {
            callback(stream_information_object);
            /* K42
            if(XHROrMethodEndHappend){
               callback(stream_information_object);
            } else {
                XHROrMethodEndHappend = true;
            }
            */
         }  
      }


      /**
       * @callback OakStreaming~loadedVideoFinished
       */ 
       
      /**
       * Streams a video file to all other clients/peers.
       * @param {Stream_Information_Object} stream_information_object - This object contains all data that is needed to initiate loading the video from other peers and/or a Web server. Stream_Information_Object's can be created by the {@link streamVideo|streamVideo} method.
       * @param {OakStreaming~loadedVideoFinished} callback - This callback gets called when the video has been loaded entirely into the buffer of the video player.
       * @param {boolean} end_streaming_when_video_loaded - If this argument is true, all uploading to other peers is permanently cancelled and all processing of the loadVideo method permanently stopped as soon as the video has been loaded completely into the buffer of the video player.
       */
      function loadVideo(stream_information_object, callback, end_streaming_when_video_loaded){       
         console.log("loadVideo is called");
         //console.log("option paramter:\n" + JSON.stringify(stream_information_object));
         
         // All these declared varibales until 'var self = this' are intended to be constants
         var deliveryByServer = (stream_information_object.path_to_file_on_XHR_server || stream_information_object.hash_value) ? true : false;
         var deliveryByWebtorrent = stream_information_object.magnetURI ? true : false;
         var XHRServerURL = stream_information_object.XHR_server_URL || false;
         var XHR_PORT = stream_information_object.XHR_port || 80;
         var pathToFileOnXHRServer = stream_information_object.path_to_file_on_XHR_server;      
         var hashValue = stream_information_object.hash_value;
         //var webTorrentTrackers = stream_information_object.webTorrent_trackers;
         var MAGNET_URI = stream_information_object.magnetURI;
         // var THE_RECEIVED_TORRENT_FILE = stream_information_object.parsedTorrent;    K42
         SIZE_OF_VIDEO_FILE = stream_information_object.size_of_video_file;

         var DOWNLOAD_FROM_P2P_TIME_RANGE = stream_information_object.download_from_p2p_time_range || 20;
         var CREATE_READSTREAM_REQUEST_SIZE = stream_information_object.create_readStream_request_size || 50000000;
         
         var DOWNLOAD_FROM_SERVER_TIME_RANGE = stream_information_object.download_from_server_time_range || 5;
         var UPLOAD_LIMIT = stream_information_object.peer_upload_limit_multiplier || 2;
         var ADDITION_TO_UPLOAD_LIMIT = stream_information_object.peer_upload_limit_addition || 500000;
         
         
         var XHR_REQUEST_SIZE = stream_information_object.xhrRequestSize || 50000; // in byte
         var THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM = stream_information_object.thresholdForReturningAnswerStream || 50000; // in byte

         var CHECK_IF_BUFFER_FULL_ENOUGH_INTERVAL = stream_information_object.checkIfBufferFullEnoughInterval || 300; // in miliseconds
         var CHECK_IF_ANSWERSTREAM_READY_INTERVAL = stream_information_object.checkIfAnswerstreamReadyInterval || 200; // in miliseconds
         var UPDATE_CHART_INTERVAL = stream_information_object.updateChartInterval || 1000; // in miliseconds
         var CHOKE_IF_NECESSARY_INTERVAL = stream_information_object.chokeIfNecessaryInterval || 500; // in miliseconds
         var CHECK_IF_NEW_CREATE_READSTREAM_NECESSARY_INTERVAL = stream_information_object.checkIfNewCreateReadstreamInterval || 500 ;
         
         
         // From here on most newly declared variables are not indeted to function as constants
         // These variables are declared in this high scope in order to allow every function that is declared in loadVideo to access and manipulate these variables
         var self = this;
         var endStreaming = false;
         var webTorrentClient = null;
         var wires = []; // a wire is a connection to another peer out of the WebTorrent network
         var globalvideostreamRequestNumber = 0;
         bytesReceivedFromServer = 0; // This variable gets only initialized not declared
         var webTorrentFile;
         var videostreamRequestHandlers = [];
         var inCritical = true; // incritical means that XHR requests will be conducted because there is less than DOWNLOAD_FROM_SERVER_TIME_RANGE seconds of video playback buffered.
         var videoCompletelyLoaded = false;
         var bytesTakenFromWebTorrent = 0;
         var bytesTakenFromServer = 0;
         var consoleCounter = 0; // This variable is only for debugging purposes
         
      
         var myVideo = document.querySelector('video');
         myVideo.addEventListener('error', function (err){
            console.error(myVideo.error);
         });
         
         // Node.js readable streams are used to buffer video data before it gets put into the source buffer
         function MyReadableStream(options){
            readableStream.Readable.call(this, options);
         }
         util.inherits(MyReadableStream, readableStream.Readable);
         MyReadableStream.prototype._read = function(size){};
         
        
         if(deliveryByWebtorrent){
            console.log("entered if(deliveryByWebtorrent)");
            webTorrentClient = new WebTorrent();
                    
            var webTorrentOptions = {};
            
            /* Weiß nicht mehr warum das hier steht
            if(stream_information_object.pathToFileToSeed){
               webTorrentOptions.path = stream_information_object.pathToFileToSeed;
            }
            */
            //var url = URL.createObjectURL(stream_information_object.torrentAsBlob);   K42
            
            
            // A magnetURI contains URLs to tracking servers and the info hash of the torrent.
            //The client receives the complete torrent file from a tracking server.
            webTorrentClient.add(MAGNET_URI, webTorrentOptions, function (torrent){
               // From this point on the WebTorrent instance will download video data from the WebTorrent network in the background in a rarest-peace-first manner as fast as possible.
               // Sequential stream request like createreadstrime are prioritized over this rarest-peace-first background downloading.
               
               console.log("webTorrentClient.add   torrent meta data ready");         
               theTorrent = torrent;
               webTorrentFile = torrent.files[0];
               
               // Peers which used the offered methods to manually connect to this FVSL instance
               // before a torrent file was loaded are added now to the set of peers that are used for video data exchange.
               for(var j=0; j< peersToAdd.length; j++){
                  theTorrent.addPeer(peersToAdd[j][0]);
                  if(peersToAdd[j][1]){
                     (peersToAdd[j][1])();
                  }
               } 

               // This function has the same purpose 
               console.log("In loadVideo    " + self.OakName + ".forTesting_connectedToNewWebTorrentPeer gets created");
               // This function calls the callback function when this FVSL instance already connected to another peer
               // or as soon as it connects to another peer.
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
                  
                  // This activates the ut_pex extension for this peer
                  // which is necessary to exchange peers between WebTorrent instances
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

               // The Videostream object conducts, depending on the current playback position, creaReadstream requests for video data that the loadVideo method has to answer in order to play back the video successfully
               // The Videostream object probably has been created during the time webTorrentClient.add was called until its called the callback function.
               // In this time the VideoStream object created by the videostream library probably has conducted some createReadstream requests whose handlers are saved in the videostreamRequestHandlers array.
               // For these requests we now intialize WebTorrent streams.
               for(var i=0, length=videostreamRequestHandlers.length; i<length; i++){
                  var thisRequest = videostreamRequestHandlers[i];
                  
                  // To answer a createReadStream request a Multistream (https://www.npmjs.com/package/multistream) is returned which requests a Node readableStream as soon as its buffer has went dry.
                  // The current callback which should be called with the created readableStream is saved in currentlyExpectedCallback
                  if(thisRequest.currentlyExpectedCallback !== null){
                     console.log("In onTorrent nachträglich webtorrent stream erzeugen  thisRequest.start: " + thisRequest.start);
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
                        if(thisRequest.currentlyExpectedCallback !== null && thisRequest.start > thisRequest.lastEndCreateReadStream && thisRequest.start < thisRequest.videoFileSize){
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
                     
                     // Every videostreamRequestHandler has to save the byte index that it expects next
                     thisRequest.oldStartWebTorrent = thisRequest.start;
                     
                     // Data that is received from the WebTorrent readable gets immmediately pumped into a writeable stream called  collectorStreamForWebtorrent which processes the new data.
                     thisRequest.webTorrentStream.pipe(thisRequest.collectorStreamForWebtorrent);
                  }
               }
            });
         }
         
         
         
         var fileLikeObject = function (pathToFileOnXHRServer){
            this.pathToFileOnXHRServer = pathToFileOnXHRServer;
         };
         // The VideoStream object will call createReadStream several times with different values for the start property of ops.
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
           
            // Everytime I printed out the value of opts.end is was NaN.
            // I suppose that should be interpreted as "till the end of the file"
            // Of course, our returned stream should, nevertheless, not buffer a giant amount of video data in advance but instead retrieve and put out chunks of video data on-demand
            if(opts.end && !isNaN(opts.end)){
               thisRequest.end = opts.end + 1;
            } else {
               thisRequest.end = SIZE_OF_VIDEO_FILE;
            }
            
            
            // This writeable Node.js stream will process every data that is received from sequential WebTorrent streams
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
                     if(thisRequest.currentlyExpectedCallback !== null && thisRequest.start >= thisRequest.end){
                        var theCallbackFunction = thisRequest.currentlyExpectedCallback;
                        thisRequest.currentlyExpectedCallback = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.createReadStreamNumber);
                        theCallbackFunction(null, res);
                     }
                  } else {
                     if(thisRequest.currentlyExpectedCallback === null){
                        if(thisRequest.webTorrentStream){
                           thisRequest.webTorrentStream.pause();
                        }
                        thisRequest.noMoreData = true;
                     } else {
                        var theCallbackFunction = thisRequest.currentlyExpectedCallback;
                        thisRequest.currentlyExpectedCallback = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.createReadStreamNumber);
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

            // A new Multistream gets created which will be the answer the the request from the VideoStream request
            var multi = new MultiStream(function (cb){
               //console.log("ReadableStream request number " + thisRequest.createReadStreamNumber + "    does a cb request");
              
               if(thisRequest.end >= 0 && thisRequest.start >= thisRequest.end){
                  //console.log("called cb(null,null) from " + thisRequest.createReadStreamNumber); 
                  thisRequest.req = null;
                  return cb(null, null);
               }
              
               thisRequest.CallbackNumber++;
               if(consoleCounter<20){
                  //////console.log(consoleCounter++ + "    " + thisRequest.CallbackNumber + ". call of function(cb) from " + videostreamRequestNumber);
                  ////////console.log(consoleCounter++ + "    start: " + thisRequest.start);
               }
               thisRequest.currentlyExpectedCallback = cb;
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
        
         
         // This function frequently checks if less than DOWNLOAD_FROM_P2P_TIME_RANGE seconds of video data is buffered in advance.
         // If it is the case this function conducts a new sequential byte range request to the WebTorrent network
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
                              
                              if(thisRequest.currentlyExpectedCallback !== null && thisRequest.start > thisRequest.lastEndCreateReadStream && thisRequest.start < thisRequest.videoFileSize){
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
         
         // This function checks for a given videostreamRequestHandler if we have called enough video data to call the callback function.
         // If it is the case, the callback function gets called togehter with the buffered data.
         function ceckIfAnswerStreamReady(thisRequest){
            ////////console.log("At the beginning of thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream);
            ////////console.log("In ceckIfAnswerStreamReady of videostreamRequest number " + thisRequest.createReadStreamNumber +  ". thisRequest.bytesInAnswerStream: " + thisRequest.bytesInAnswerStream + "     thisRequest.currentlyExpectedCallback: " + thisRequest.currentlyExpectedCallback);
            if (thisRequest.currentlyExpectedCallback && ((thisRequest.bytesInAnswerStream >= THRESHOLD_FOR_RETURNING_OF_ANSWER_STREAM) || (thisRequest.start >= SIZE_OF_VIDEO_FILE))){
               ////////console.log("answerStream from videostream Request number " + thisRequest.createReadStreamNumber + " and CB number " + thisRequest.CallbackNumber + " gets returned");
               // //////console.log("Returing answerStream out of ceckIfAnswerStreamReady()");
               var theCallbackFunction = thisRequest.currentlyExpectedCallback;
               thisRequest.currentlyExpectedCallback = null;
               thisRequest.answerStream.push(null);
               if (thisRequest.webTorrentStream){
                  thisRequest.webTorrentStream.pause();
               }
               thisRequest.bytesInAnswerStream = 0;
               var res = thisRequest.answerStream;
               thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
               //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.createReadStreamNumber);
               theCallbackFunction(null, res);
               return true;
            }
            return false;
         }

         // This function frequently checks if video data upload should be throttled because the peer_upload_limit is reached
         // If it should be throttled, then every peer gets choked which means there will be no more data send to other peers for approximately 800 milliseconds.
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
         
         function VideostreamRequestHandler(createReadStreamNumber, opts, self) {
            this.createReadStreamNumber = createReadStreamNumber;
            this.opts = opts;
            this.start = opts.start || 0;
            this.oldStartWebTorrent = -42;
            this.oldStartServer = -42;
            this.currentlyExpectedCallback = null;
            this.CallbackNumber = 0;
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

         // This function frequently checks for every videostreamRequestHandler if there is enough data buffer to call the corresponding callback function with the buffered data
         function frequentlyCeckIfAnswerStreamReady(){
               if(videoCompletelyLoaded){
                  return;
               }
               for (var i = 0, length = videostreamRequestHandlers.length; i < length; i++) {
                  ceckIfAnswerStreamReady(videostreamRequestHandlers[i]);
               }
               setTimeout(frequentlyCeckIfAnswerStreamReady, CHECK_IF_ANSWERSTREAM_READY_INTERVAL);
         }

         // The job of this function is to frequently check to things.
         // First, if the video is completely loaded.
         // Second, if less than DOWNLOAD_FROM_SERVER_TIME_RANGE seconds of video playback are buffered in advance.
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
                           if(end_streaming_when_video_loaded){
                              callback();
                           } else {
                              callback(theTorrent);
                           }
                        }
                        if(end_streaming_when_video_loaded){
                           if(theTorrent){
                              theTorrent.destroy();
                              delete webTorrentClient;
                           }
                           endStreaming = true;
                           return;                 
                        } 
                     }
                  }
                  
                  // From here on it is checked wether there are less seconds buffered than DOWNLOAD_FROM_SERVER_TIME_RANGE
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
                        if (videostreamRequestHandlers[j].currentlyExpectedCallback !== null && videostreamRequestHandlers[j].XHRConducted === false) {
                           conductXHR(videostreamRequestHandlers[j]);
                        }
                     }
                  }
               }
               setTimeout(checkIfBufferFullEnough, CHECK_IF_BUFFER_FULL_ENOUGH_INTERVAL);
            }

         
         // This function conductes a XHR reuqest for the videostreamRequestHandler which is handed over to the function as its first and only paramter.
         function conductXHR(thisRequest) {
            if(thisRequest.currentlyExpectedCallback === null){
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
               return thisRequest.currentlyExpectedCallback(null, null);
            }

            /* glaube ich unnötiger und/oder gefährlicher müll
            if (reqStart >= reqEnd) {
            req = null;
            return thisRequest.currentlyExpectedCallback(null, null);
            }
            */
            if (consoleCounter < 10000000) {
               //////////console.log(consoleCounter++ + "  videoStream " + thisRequest.createReadStreamNumber + "  CB number " + thisRequest.CallbackNumber + "    reqStart: " + reqStart);
               //////////console.log(consoleCounter++ + "  Multistream " + thisRequest.createReadStreamNumber + "   CB number " + thisRequest.CallbackNumber + "    reqEnd: " + reqEnd);
            }

            var XHRDataHandler = function (chunk){
               bytesReceivedFromServer += chunk.length;
               //console.log("ReadableStream request number " + thisRequest.createReadStreamNumber + " received a chunk of length " + chunk.length);
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
                     if(thisRequest.currentlyExpectedCallback !== null){
                        var theCallbackFunction = thisRequest.currentlyExpectedCallback;
                        thisRequest.currentlyExpectedCallback = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.createReadStreamNumber);
                        theCallbackFunction(null, res); 
                     } else {
                        thisRequest.noMoreData = true;
                        if(thisRequest.webTorrentStream){
                           thisRequest.webTorrentStream.pause();
                        }
                     }
                  } else {
                     if (thisRequest.start >= SIZE_OF_VIDEO_FILE && thisRequest.currentlyExpectedCallback !== null){
                        var theCallbackFunction = thisRequest.currentlyExpectedCallback;
                        thisRequest.currentlyExpectedCallback = null;
                        thisRequest.answerStream.push(null);
                        thisRequest.bytesInAnswerStream = 0;
                        var res = thisRequest.answerStream;
                        thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                        //console.log("called CB with data out of answerStream from videostreamRequest number " + thisRequest.createReadStreamNumber);
                        theCallbackFunction(null, res);
                     }
                  } 
                  thisRequest.start += chunk.length - (thisRequest.start - thisRequest.oldStartServer);            
               }
               thisRequest.oldStartServer += chunk.length;
            }

            var XHREnd = function (){
               //console.log("ReadableStream request number " + thisRequest.createReadStreamNumber + " XHREnd");
               if (consoleCounter < 1000000000000){
                  //////////console.log("XHREnd from videostreamRequest number " + thisRequest.createReadStreamNumber);
               }
               if(thisRequest.bytesInAnswerStream > 0 && thisRequest.currentlyExpectedCallback !== null){
                  thisRequest.answerStream.push(null);
                  thisRequest.bytesInAnswerStream = 0;
                  var res = thisRequest.answerStream;
                  thisRequest.answerStream = new MyReadableStream({highWaterMark: 5000000});
                  var theCallbackFunction = thisRequest.currentlyExpectedCallback;
                  thisRequest.currentlyExpectedCallback = null;
                  //console.log("XHREnd: called CB with data out of answerStream from videostreamRequest number " + thisRequest.createReadStreamNumber);
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
                  //////////console.log("I return currentlyExpectedCallback with http response stream");
                  ////////////console.log("function(res) is executed from readstream number " + createReadStreamCounter + " and CB number " + thisCallbackNumber);
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

      // This function adds a simple-peer connection to the WebTorrent swarm of the FVSL instance.
      // A simple-peer is a wrapper for a Web-RTC connection.
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
   })();
}
var theVideoFileSize = 788493;


describe("Testing if manuallyAddingPeer methods", function(){   
   var twoPeersAreConnected = false;
   var threePeersAreConnected = false;
   var twoPeersStreamedToAnother = false;
   var testTorrentA, testTorrentB;
   
   it("can establish a WebTorrent connection between two OakStreaming instances", function(done){
      expect(true).toBe(true); // every Jasmine spec has to have an expect expression
      
      /*
      var receivedCallbacks = 0;    
            
      var tryToSetCallbackA = (function(){
         return function(){
            if(myStreamingA.forTesting_connectedToNewWebTorrentPeer){
               console.log(" callback of myStreamingA.forTesting_connectedToNewWebTorrentPeer is set");
               myStreamingA.forTesting_connectedToNewWebTorrentPeer(function(){
                  if(receivedCallbacks === 1){
                     twoPeersAreConnected = true;
                     done();
                  } else {
                     receivedCallbacks++;
                  }
               });
            } else {
               console.log("tryToSetCallbackA setTimeout is set");
               setTimeout(tryToSetCallbackA, 500);
            }
         };
      })();
      tryToSetCallbackA();
      
      
      var tryToSetCallbackB = (function(){
         return function(){
            if(myStreamingB.forTesting_connectedToNewWebTorrentPeer){
                  console.log("callback of myStreamingB.forTesting_connectedToNewWebTorrentPeer is set");
                  myStreamingB.forTesting_connectedToNewWebTorrentPeer(function(){
                     if(receivedCallbacks === 1){
                        twoPeersAreConnected = true;            
                        done();
                     } else {
                        receivedCallbacks++;
                     }
                  });
            } else {
               console.log("tryToSetCallbackB setTimeout is set");
               setTimeout(tryToSetCallbackB, 500);
            }         
         };
      })();
      tryToSetCallbackB();
      */

      myStreamingA.createSignalingData(function(signalingData){
         myStreamingB.createSignalingDataResponse(signalingData, function(signalingDataResponse){
            myStreamingA.processSignalingResponse(signalingDataResponse, function(){console.log("Peers are connected"); twoPeersAreConnected = true; done();});
         });
      });
   }, 20000);

  
   it("can successfully connect two OakStreaming instances for streaming", function(done){
      expect(true).toBe(true); // every Jasmine spec has to have an expect expression
      
      
      function callback(streamInformationObject, torrent){
         console.log("In the second spec the callback from streamVideo is called");
         myStreamingB.loadVideo(streamInformationObject, function(torrent){twoPeersStreamedToAnother = true; done();}, false);
      }
      
      function streamWhenConnectionEstablished(res){
         if(twoPeersAreConnected){
            console.log("Two peers are connected");
            myStreamingA.streamVideo(res, {}, callback, "It's a test", false);
            // {webTorrentTrackers: [["ws://localhost:8081"]]}
         } else {
            setTimeout(function(){streamWhenConnectionEstablished(res);}, 2000);
         }
      }
      
      http.get({
         hostname: 'localhost',
         port: 8080,
         path: '/example.mp4',
         headers: {
            range: 'bytes=' + 0 + '-' + theVideoFileSize-1
         }
      }, function (res){
            streamWhenConnectionEstablished(res);
      });
   }, 40000);

   it("can automatically establish WebTorrent connections between three OakStreaming instances", function(done){
      expect(true).toBe(true); // every Jasmine spec has to have an expect expression  
                
      var receivedCallbacks = 0;     
    
    
      function checkIfnewConnectionsAreCreated(){
         if(twoPeersStreamedToAnother){
            myStreamingA.forTesting_connectedToNewWebTorrentPeer(function(){
               if(receivedCallbacks === 2){
                  threePeersAreConnected = true;
                  done();
               } else {
                  receivedCallbacks++;
               }
            });
            myStreamingB.forTesting_connectedToNewWebTorrentPeer(function(){
               if(receivedCallbacks === 2){
                  threePeersAreConnected = true;            
                  done();
               } else {
                  receivedCallbacks++;
               }
            });
         } else {
            setTimeout(checkIfnewConnectionsAreCreated, 500);
         }
      }
      checkIfnewConnectionsAreCreated();
      
      /* I think not needed
      myStreamingC.forTesting_connectedToNewWebTorrentPeer(function(){
         if(receivedCallbacks === 4){
            threePeersAreConnected = true;            
            done();
         } else {
            receivedCallbacks++;
         }
      });
      */
    
      myStreamingA.createSignalingData(function(signalingData){
         myStreamingC.createSignalingDataResponse(signalingData, function(signalingDataResponse){
            myStreamingA.processSignalingResponse(signalingDataResponse, function(){console.log("For third spec peers connected"); done();});
         });
      });    
   }, 25000);

 
   it("can successfully connect three OakStreaming instances for streaming", function(done){
      expect(true).toBe(true); // every Jasmine spec has to have an expect expression   
      var oneStreamingCompleted = false;
      var testTorrent;
      
      function callback(streamInformationObject, torrent){
         testTorrent = torrent;
         myStreamingA.loadVideo(streamInformationObject, function(){
            if(oneStreamingCompleted){
               testTorrent.destroy();
               done();
            } else {
               oneStreamingCompleted = true;
            }
         }, true);
         myStreamingB.loadVideo(streamInformationObject,  function(){
            if(oneStreamingCompleted){
               testTorrent.destroy();
               done();
            } else {
               oneStreamingCompleted = true;
            }
         }, true);
      }
      
      function streamWhenConnectionEstablished(res){
         if(threePeersAreConnected){
            myStreamingC.streamVideo(res, {webTorrentTrackers: [["ws://localhost:8081"]]}, callback, "It's a test", false);
         } else {
            setTimeout(function (){streamWhenConnectionEstablished(res);}, 500);
         }
      }
      
      http.get({
         hostname: 'localhost',
         port: 8080,
         path: '/example.mp4',
         headers: {
            range: 'bytes=' + 0 + '-' + theVideoFileSize-1
         }
      }, function (res){
            streamWhenConnectionEstablished(res);
      });
   }, 30000);
});   


describe("Testing if streamVideo method", function(){
   var myStreaming = new OakStreaming();
      
   it("creates streamInformationObject correctly",  function(done){     
      function callback (streamInformationObject){
         expect(streamInformationObject.videoFileSize).toEqual(theVideoFileSize);
         expect(streamInformationObject.XHRPath).toMatch("/example.mp4");
         done();
      }
      http.get({
         hostname: 'localhost',
         port: 8080,
         path: '/example.mp4',
         headers: {
            range: 'bytes=' + 0 + '-' + theVideoFileSize-1
         }
      }, function (res){
         testTorrent = myStreaming.streamVideo(res, {XHRPath : "/example.mp4", webTorrentTrackers: [["ws://localhost:8081"]]}, callback, "It's a test", true);
      });
   }, 30000); 
});

describe("Testing if loadVideo method", function(){
   var myStreaming = new OakStreaming();
   var myStreaming2 = new OakStreaming();
   var myStreaming3 = new OakStreaming();
   
   it("loads the video fast enough via server delivery", function(done){
      expect(true).toBe(true); // necessary because Jasmine wants at least one expect per it.
      myStreaming.loadVideo({XHRPath : "/example2.mp4", videoFileSize : theVideoFileSize}, done);
   }, 10000);
     
   describe("loads the video fast enough via WebTorrent delivery", function(){
      it("with one seeder and one downloader", function(done){
         expect(true).toBe(true); // every Jasmine spec has to have an expect expression
         
         req = http.get({
            hostname: 'localhost',
            port: 8080,
            path: "/example.mp4",
            headers: {
                range: 'bytes=' + 0 + '-' + theVideoFileSize-1
            }
         }, function (res) {  
               myStreaming.streamVideo(res, {webTorrentTrackers: [["ws://localhost:8081"]]},  function(streamInformationObject){
                  myStreaming2.loadVideo(streamInformationObject, done);  
               });
         });
      }, 15000); 
      
      it("with two seeders and one downloader", function(done){
         expect(true).toBe(true); // every Jasmine spec has to have an expect expression
         
         function callback(streamInformationObject){
            myStreaming2.loadVideo(streamInformationObject, function(){
               myStreaming3.loadVideo(streamInformationObject, done);
            });
         }
         
         req = http.get({
            hostname: 'localhost',
            port: 8080,
            path: "/example.mp4",
            headers: {
                range: 'bytes=' + 0 + '-' + theVideoFileSize-1
            }
         }, function (res) {  
               myStreaming.streamVideo(res, {webTorrentTrackers: [["ws://localhost:8081"]]}, callback);
         });
      }, 20000);  

      it("with one seeder and two downloaders", function(done){
         expect(true).toBe(true); // every Jasmine spec has to have an expect expression
         var numberOfCompletedDownloads = 0;
         
         function checkIfSpecFinished(){
            if(++numberOfCompletedDownloads >= 2){
               done();
            }
         }       
         function callback(streamInformationObject){
            myStreaming2.loadVideo(streamInformationObject, checkIfSpecFinished); 
            myStreaming3.loadVideo(streamInformationObject, checkIfSpecFinished);
         }       
         req = http.get({
            hostname: 'localhost',
            port: 8080,
            path: "/example.mp4",
            headers: {
                range: 'bytes=' + 0 + '-' + theVideoFileSize-1
            }
         }, function (res) {  
               myStreaming.streamVideo(res, {webTorrentTrackers: [["ws://localhost:8081"]]}, callback);
         });
      }, 20000);    
   });
   
   it("loads the video fast enough via peer-assisted delivery", function(done){
      expect(true).toBe(true); // every Jasmine spec has to have an expect expression
      req = http.get({
         hostname: 'localhost',
         port: 8080,
         path: "/example.mp4",
         headers: {
             range: 'bytes=' + 0 + '-' + theVideoFileSize-1
         }
      }, function (res) {
         var webTorrentClient = new WebTorrent();
         webTorrentClient.seed(res, function onSeed (torrent){
            myStreaming.loadVideo({XHRPath: "/example3.mp4", torrentFile : torrent.torrentFile, webTorrentTrackers: [["ws://localhost:8081"]], videoFileSize : theVideoFileSize}, done);            
         });
      });
   }, 20000);
});
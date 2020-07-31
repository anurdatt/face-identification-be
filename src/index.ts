import * as path from 'path'
import express from 'express';
import * as faceapi from 'face-api.js'
import { canvas, faceDetectionNet, faceDetectionOptions } from './commons';
import * as http from 'http'
import socket from 'socket.io'
import * as cv from "opencv4nodejs";
import * as fs from "fs";
import Jimp from 'jimp';

import { empRoutes } from './routes/emp-routes'
//var NodeWebcam = require( "node-webcam" );


//Default options

// var opts = {

//     //Picture related

//     //width: 1280,
//     width: 320,

//     //height: 720,
//     height: 240,

//     quality: 100,

//     // Number of frames to capture
//     // More the frames, longer it takes to capture
//     // Use higher framerate for quality. Ex: 60

//     frames: 60,


//     //Delay in seconds to take shot
//     //if the platform supports miliseconds
//     //use a float (0.1)
//     //Currently only on windows

//     delay: 0,


//     //Save shots in memory

//     saveShots: true,


//     // [jpeg, png] support varies
//     // Webcam.OutputTypes

//     output: "jpeg",


//     //Which camera to use
//     //Use Webcam.list() for results
//     //false for default device

//     device: false,


//     // [location, buffer, base64]
//     // Webcam.CallbackReturnTypes

//     //callbackReturn: "location",
//     callbackReturn: "base64",


//     //Logging

//     verbose: false

// };


//Creates webcam instance

//var Webcam:any = null //NodeWebcam.create( opts );


//const cv = require('opencv.js')

// // Define a global variable 'Module' with a method 'onRuntimeInitialized':
// var Module = {
//   onRuntimeInitialized() {
//     // this is our application:
//     console.log(cv.getBuildInformation())
//   }
// }
// // Load 'opencv.js' assigning the value to the global variable 'cv'
// var cv = require('../libs/opencv.js')

const onvif = require('node-onvif');
const RTSPStream = require('node-rtsp-stream')
 
console.log('Start the discovery process.');
// Find the ONVIF network cameras.
// It will take about 3 seconds.
onvif.startProbe().then((device_info_list:any) => {
  console.log(device_info_list.length + ' devices were found.');
  // Show the device name and the URL of the end point.
  device_info_list.forEach((info:any) => {
    console.log('- ' + info.urn);
    console.log('  - ' + info.name);
    console.log('  - ' + info.xaddrs[0]);
  });
}).catch((error:any) => {
  console.error(error);
});


interface RTSPStreamingObject {
  device: any,
  stream: any
}
var rtspStreaming: RTSPStreamingObject | null = null;

interface OnvifSnapshotObject {
  device:any,
  resolution: any
}

var onvifSnapshot:OnvifSnapshotObject | null = null;

var port = process.env.PORT;
if (port == null || port == "") {
  port = "3000";
}

//require("@tensorflow/tfjs-node");
//const tf = require("@tensorflow/tfjs");

//console.log(cv.getBuildInformation());
const app = express()
const server = new http.Server(app)
const io = socket(server)
var wCap:any //new cv.VideoCapture(0)

//wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
//wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)

const FPS = 10

// ssd_mobilenetv1 options
let minConfidence = 0.5

// tiny_face_detector options
let inputSize = 192 //224
let scoreThreshold = 0.5

//const options = new faceapi.MtcnnOptions(mtcnnForwardParams)
//const options = new faceapi.SsdMobilenetv1Options({ minConfidence })
const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
var process_id:any, onvif_process_id:any = null


class Queue<T>  {
    static MAX_ENTRIES = 10
    constructor(private data: Array<T> = new Array(),
      private numEntries: number = 0) {
    }
  
    insert(entry:T):void {
      if (this.numEntries >= Queue.MAX_ENTRIES) {
        this.remove()
      }
      this.data.push(entry)
      this.numEntries++
    }
  
    remove():T | undefined {
      this.numEntries--
      return this.data.shift()
    }
  
    findOccurence(key:string, value:string):number {
      return this.data.map(el => el[key]).reduce((total, cur) => {
        if(cur === value) return total + 1
        else return total
      }, 0)
    }

    findOccurenceOfLabelWithAvgDist(keyLabel:string, valueLabel:string, keyDist:string, valueDist:number): 
    {occurence: number, avgDist: number} {
      return this.data.reduce((total, cur) => {
        if(cur[keyLabel] === valueLabel) 
          return {
                  occurence: total.occurence + 1, 
                  avgDist: (cur[keyDist] + total.avgDist*total.occurence) / (total.occurence + 1)
                 }
        else return total
      }, {occurence: 0, avgDist: valueDist} )
    }
}
 
//instantiate a Queue object for holding the matches
var matchQueue = new Queue<faceapi.FaceMatch>()

// declare the labeled face descriptor container
var labeledFDs: faceapi.LabeledFaceDescriptors[]
  
async function getLabeledFaceDescriptors(): Promise<faceapi.LabeledFaceDescriptors[]> {
  
  const labels = ['Mithai', 'Kaushik', 'Kaushik-Masked', 'Arnab', 'Suparna', 'Tatai', 'Tatai-Masked'] // 'raj', 'leonard', 'howard']
  
  const labeledFaceDescriptors = await Promise.all(
    labels.map(async label => {
      // fetch image data from urls and convert blob to HTMLImage element
      //const imgUrl = `assets/${label}.jpg`
      const imgPath = `../ref_images/${label}.jpg`
      const img = await canvas.loadImage(path.join(__dirname, imgPath))//faceapi.fetchImage(imgUrl)
  
      // detect the face with the highest score in the image and compute it's landmarks and face descriptor
      const fullFaceDescription = await faceapi.detectSingleFace(img)  //SSD
      //const fullFaceDescription = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512}))
      .withFaceLandmarks()
      .withFaceDescriptor()
  
      if (!fullFaceDescription) {
        throw new Error(`no faces detected for ${label}`)
      }
  
      const faceDescriptors = [fullFaceDescription.descriptor]
      return new faceapi.LabeledFaceDescriptors(label, faceDescriptors)
    })
  )
  
  return labeledFaceDescriptors
}

//const initialize = async () => {
  console.log('loading model and initializing reference images')
  Promise.all( [
    faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, '../weights') ),
    faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, '../weights')),
    faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, '../weights')),
    faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, '../weights'))//,
    //getLabeledFaceDescriptors()
  ]
  )
  .then(async (res)=> {
    //Load reference images and label FDs
    labeledFDs = await getLabeledFaceDescriptors()
    //labeledFDs = res[4]
    console.log('Finished loading model and initializing reference images')
  })
  .catch((error) => {
    console.error('Error loading model and initializing reference images')
  })
//}


app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:4200"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


app.use('/api/emp', empRoutes)


app.get('/', async (req, res) => {
  const command = req.query.command
  if (command === 'start') {
    console.log('received start command')
    if (process_id) {
      clearInterval(process_id)
    }
    
    startProcess()
    res.status(200).send({status: 'done'})   
  }
  else if (command === 'stop') {
    console.log('received stop command')
    if (process_id) {
      clearInterval(process_id)
      process_id = null
      // Webcam.clear()
      // Webcam = null
      wCap.release()
      wCap = undefined
    }
    res.status(200).send({status: 'done'})   
  }
  else if (command === 'start_rtsp') {
    console.log('received start_rtsp command')
    stopRTSPStreaming()
    startRTSPStreaming((data, error) => {
      if (error) {
        console.error('Failed to Start RTSP Streaming! ', error)
        res.status(500).send({status: 'failed'})
        return;

      }
      else {
        rtspStreaming = data
        //console.log(JSON.stringify(rtspStreaming, null, '  '))
      }
      res.status(200).send({status: 'done'})   
    }) //Add CB TODO
    
  }
  else if (command === 'stop_rtsp') {
    console.log('received stop_rtsp command')
    stopRTSPStreaming()
    res.status(200).send({status: 'done'})   
  }
  else if (command === 'start_onvif') {
    console.log('received start_onvif command')
    if (onvif_process_id) {
      clearInterval(onvif_process_id)
    }
    
    startOnvifProcess()
    res.status(200).send({status: 'done'})   
  }
  else if (command === 'stop_onvif') {
    console.log('received stop_onvif command')
    if (onvif_process_id) {
      clearInterval(onvif_process_id)
      onvif_process_id = null
      
    }
    res.status(200).send({status: 'done'})   
  }

  
})


app.get('/onvif/take_snapshot', (req, res) => {
  takeOnvifSnapshot((data, err) => {
    if (err) {
      res.status(500).send(err)
    }
    else {
      const str = Buffer.from(data, "binary").toString("base64")
      res.status(200).send(str)
    }
  })
})

const startProcess = () => {
    var count = 0

    if (wCap == undefined) {
      wCap = new cv.VideoCapture(0)
    
      wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
    
      wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)
    }
    
    // if (Webcam = null) {
    //   Webcam = NodeWebcam.create( opts );
    // }

    process_id = setInterval(async () => {
        const frame = wCap.read()
        /*const data = new Uint8Array(frame.cvtColor(cv.COLOR_BGR2RGB).getData().buffer)
        const frameTensor = faceapi.tf.tensor3d(data, [frame.rows, frame.cols, 3])
    
        console.log ('#############Here i am 1###########')
        const fullFaceDescriptions = await faceapi.detectAllFaces(frameTensor, options)
        .withFaceLandmarks()
        .withFaceDescriptors()
    
        console.log ('#############Here i am 2###########')
        const fullFaceDrawBoxes = fullFaceDescriptions
        .map(res => res.detection.box)
        .map((box, i) => new faceapi.draw.DrawBox(box, { label: "Unknown" }))
        console.log ('#############Here i am###########')
        const outCanvas = faceapi.createCanvasFromMedia(
            new canvas.ImageData(new Uint8ClampedArray(data.subarray, data.byteOffset, data.byteLength), 
            frame.cols, frame.rows))
        console.log ('#############Here i am after canvas 1###########')
        fullFaceDrawBoxes.forEach(drawBox => drawBox.draw(outCanvas))
        console.log ('#############Here i am after canvas 2###########') */
        
        const data = cv.imencode('.jpg', frame) /*(outCanvas as any)
        .toBuffer('image/jpeg')*/
        .toString("base64")
        
        // NodeWebcam.capture("test_picture", opts, async function(err: any, data: any) {
        //   if (err) {
        //     io.emit('error', err)
        //   }

        //console.log ('#############Here i am after canvas 3###########')
        const input = new canvas.Image();
        input.src = Buffer.from(data, 'base64');
        input.width = frame.cols; //opts.width
        input.height = frame.rows; //opts.height

        const outCanvas = faceapi.createCanvasFromMedia(input)
        //console.log ('#############Here i am after canvas 1###########')
        
        //const frameTensor3D = tf.browser.fromPixels(outCanvas);
        //const unint8data = new Uint8Array(frame/* .cvtColor(cv.COLOR_BGR2RGB) */.getData().buffer)
        //const frameTensor3D = faceapi.tf.tensor3d(unint8data, [frame.rows, frame.cols, 3])

        const fullFaceDescriptions = await faceapi.detectAllFaces(input, options)
        .withFaceLandmarks()
        .withFaceDescriptors();
        //console.log(JSON.stringify(fullFaceDescriptions))
        
        //const dims = faceapi.matchDimensions(outCanvas, data, true)

        if (fullFaceDescriptions && fullFaceDescriptions.length > 0) {
            //const resizedResult = faceapi.resizeResults(fullFaceDescriptions, dims)
            faceapi.draw.drawDetections(outCanvas, fullFaceDescriptions)
            //faceapi.draw.drawFaceLandmarks(outCanvas, fullFaceDescriptions)

            //console.log(JSON.stringify(labeledFD))

            // 0.6 is a good distance threshold value to judge
            // whether the descriptors match or not
            const maxDescriptorDistance = 0.6
            const minDescriptorDistance = 0.3
            const fraction = (maxDescriptorDistance - minDescriptorDistance) / Queue.MAX_ENTRIES
            const faceMatcher = new faceapi.FaceMatcher(labeledFDs, maxDescriptorDistance)
            fullFaceDescriptions.map(fd => faceMatcher.findBestMatch(fd.descriptor))
            .forEach((bestMatch, i) => {

              const {occurence, avgDist} = matchQueue.findOccurenceOfLabelWithAvgDist('label', bestMatch.label, 
              'distance', maxDescriptorDistance)
              
              console.log(`occurence = ${occurence}, avgDist = ${avgDist}, 
              label = ${bestMatch.label}, score = ${bestMatch.distance}`)
              const margin:number = (((maxDescriptorDistance - avgDist)
                                    /(maxDescriptorDistance - minDescriptorDistance))
                                    * Queue.MAX_ENTRIES + occurence) / 2
              
              const box = fullFaceDescriptions[i].detection.box
              var label
              if (bestMatch.distance <= (minDescriptorDistance + margin*fraction)) {
                label = bestMatch.toString()  
                //matchQueue.insert(bestMatch)
              }
              else {
                label = "unknown"
              }
              
              const drawBox = new faceapi.draw.DrawBox(box, { label })
              drawBox.draw(outCanvas)
              matchQueue.insert(bestMatch)

            })
        }

        const ctx = outCanvas.getContext('2d')
        if (ctx)
        ctx.fillText(""+count,100,40);
        const image = (outCanvas as any)
        .toBuffer('image/jpeg')
        .toString("base64")

        io.emit('image', image)
        console.log(count++)
      //})
    }, 1000/FPS)
}

const startRTSPStreaming = (cb: (data: RTSPStreamingObject | null, err: any) 
=> void) => {

  //if (rtspStreaming) return cb(rtspStreaming, null);

  // Create an OnvifDevice object
  let device = new onvif.OnvifDevice({
    xaddr: 'http://192.168.43.1:8080/onvif/device_service',
    user : '',
    pass : ''
  });
  
  // Initialize the OnvifDevice object
  device.init().then((info:any) => {
    // Show the detailed information of the device.
    console.log(JSON.stringify(info, null, '  '));

    // Get the UDP stream URL
    let url = device.getUdpStreamUrl();
    console.log(url);
    if (url != null && url != undefined) {
      const stream = new RTSPStream({
        name: 'mobile_cam',
        streamUrl: url, //'rtsp://192.168.43.1:8080/h264_ulaw.sdp',
        wsPort: 9999,
        ffmpegOptions: { // options ffmpeg flags
          '-stats': '', // an option with no neccessary value uses a blank string
          '-r': 30, // options with required values specify the value after the key
          '-s': '680x360',
          '-an': '',
          '-rtsp_transport': 'udp',
          //'-q': 25,
          //'-pix_fmt': 'yuvj420p',
          //'-profile:v': 'high',
          //'-level:v': 4.1,
          //'-preset': 'ultrafast',
          //'-tune': 'zerolatency',
          //'-vcodec': 'libx264',
          //'-b:v': '512k',
          //'-flush_packets': 0,
          //'-c:v': 'copy'

          //-profile:v high -pix_fmt yuvj420p -level:v 4.1 -preset ultrafast -tune zerolatency -vcodec libx264 -r 10 -b:v 512k -s 640x360 -acodec aac -ac 2 -ab 32k -ar 44100 -f mpegts -flush_packets 0
        }
      })
      return cb({device, stream}, null)
    }
    return cb({device, stream:null}, null)
  }).catch((error:any) => {
    console.error('ONVIF Error - ' + error);
    return cb(null, error)
  });


}

const stopRTSPStreaming = () => {
  if (rtspStreaming) {
    if (rtspStreaming.stream) {
      rtspStreaming.stream.stop()
      rtspStreaming.stream = null
    }
      
    if (rtspStreaming.device) {
      //rtspStreaming.device.kill()
      rtspStreaming.device = null
    }
    rtspStreaming = null
  }
 
}


const startOnvifProcess = () => {
  var count = 0

  // if (wCap == undefined) {
  //   wCap = new cv.VideoCapture(0)
  
  //   wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
  
  //   wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)
  // }
  

  onvif_process_id = setInterval(async () => {
      //takeOnvifSnapshot(async (img, err) => {
        const img = await takeOnvifSnapshotSync()
        //yconst img = fs.readFileSync('a.jpg', {encoding: 'binary'})
        // if (err) {
        //   console.error('Error in Onvif Snapshot')
        // }
        // else {
          const data = Buffer.from(img, "binary")//.toString("base64")
          //console.log ('#############Here i am after canvas 3###########')
          const input = new canvas.Image();
          input.src = data //Buffer.from(data, 'base64');
          input.width = onvifSnapshot?.resolution.width; //opts.width
          input.height = onvifSnapshot?.resolution.height; //opts.height

          const outCanvas = faceapi.createCanvasFromMedia(input)
          //console.log ('#############Here i am after canvas 1###########')
        
          const fullFaceDescriptions = await faceapi.detectAllFaces(input, options)
          .withFaceLandmarks()
          .withFaceDescriptors();
          //console.log(JSON.stringify(fullFaceDescriptions))
        
          if (fullFaceDescriptions && fullFaceDescriptions.length > 0) {
              //const resizedResult = faceapi.resizeResults(fullFaceDescriptions, dims)
              faceapi.draw.drawDetections(outCanvas, fullFaceDescriptions)
              //faceapi.draw.drawFaceLandmarks(outCanvas, fullFaceDescriptions)

              //console.log(JSON.stringify(labeledFD))

              // 0.6 is a good distance threshold value to judge
              // whether the descriptors match or not
              const maxDescriptorDistance = 0.6
              const minDescriptorDistance = 0.3
              const fraction = (maxDescriptorDistance - minDescriptorDistance) / Queue.MAX_ENTRIES
              const faceMatcher = new faceapi.FaceMatcher(labeledFDs, maxDescriptorDistance)
              fullFaceDescriptions.map(fd => faceMatcher.findBestMatch(fd.descriptor))
              .forEach((bestMatch, i) => {

                const {occurence, avgDist} = matchQueue.findOccurenceOfLabelWithAvgDist('label', bestMatch.label, 
                'distance', maxDescriptorDistance)
                
                console.log(`occurence = ${occurence}, avgDist = ${avgDist}, 
                label = ${bestMatch.label}, score = ${bestMatch.distance}`)
                const margin:number = (((maxDescriptorDistance - avgDist)
                                      /(maxDescriptorDistance - minDescriptorDistance))
                                      * Queue.MAX_ENTRIES + occurence) / 2
                
                const box = fullFaceDescriptions[i].detection.box
                var label
                if (bestMatch.distance <= (minDescriptorDistance + margin*fraction)) {
                  label = bestMatch.toString()  
                  //matchQueue.insert(bestMatch)
                }
                else {
                  label = "unknown"
                }
                
                const drawBox = new faceapi.draw.DrawBox(box, { label })
                drawBox.draw(outCanvas)
                matchQueue.insert(bestMatch)

              })
          }

          const ctx = outCanvas.getContext('2d')
          if (ctx)
          ctx.fillText(""+count,100,40);
          const image = (outCanvas as any)
          .toBuffer('image/jpeg')

          fs.writeFileSync('s.jpg', image, {encoding: 'binary'})
          //.toString("base64")

          //io.emit('image_onvif', image)
          console.log(count++)
        //})
        //}
      //})
      
      
      
  }, 1000/FPS)
}

const takeOnvifSnapshot = (cb: (data: any, err: any) => void) => {

  let aPromise: any

  //if (rtspStreaming || ovifSnapshotDevice) {
    aPromise = new Promise((resolve, reject) => {
      if (rtspStreaming || onvifSnapshot) {
      let device = rtspStreaming?.device
      if (device != null && device != undefined) {
        return resolve(device)
      }
      else if (onvifSnapshot) {
        return resolve(onvifSnapshot.device)
      }
      else {
        return reject('Error: Existing RTSPstreaming object or OnvifSnapshot device empty!')
      }
      
  //  });
  }
  else {
    //aPromise = new Promise((resolve, reject) => {
      // Create an OnvifDevice object
      let device = new onvif.OnvifDevice({
        xaddr: 'http://192.168.43.1:8080/onvif/device_service',
        user : '',
        pass : ''
      });
      
      // Initialize the OnvifDevice object
      device.init()
      .then((info:any) => {
        // Show the detailed information of the device.
        console.log(JSON.stringify(info, null, '  '));
        onvifSnapshot = {device: device, resolution: null};
        return resolve(device)
      })
      .catch((error: any) => {
        return reject(error)
      })
    //})
  }
})

  aPromise
  .then((device: any) => {
    return device.fetchSnapshot()
  })
  .then((res: any) => {
    // Save the data to a file
    //console.log('Onvif snapshot taken')
    fs.writeFileSync('snapshot.jpg', res.body, {encoding: 'binary'})
    cb(res.body, null)
  })
  .catch((error: any) => {
    console.error(error)
    cb(null, error)
  })

}

const takeOnvifSnapshotSync = async () => {

  //let aPromise: any
  let device: any
  //if (rtspStreaming || ovifSnapshotDevice) {
    //aPromise = new Promise(async (resolve, reject) => {
      if (rtspStreaming || onvifSnapshot) {
      device = rtspStreaming?.device
      // if (device != null && device != undefined) {
      //   return resolve(device)
      // }
      // else if (ovifSnapshotDevice) {
      //   return resolve(ovifSnapshotDevice)
      // }
      // else {
      //   return reject('Error: Existing RTSPstreaming object or OnvifSnapshot device empty!')
      // }

      if(!device || device == undefined) {
        device = onvifSnapshot?.device
      }
      
  //  });
  }
  else {
    //aPromise = new Promise((resolve, reject) => {
      // Create an OnvifDevice object
      device = new onvif.OnvifDevice({
        xaddr: 'http://192.168.43.1:8080/onvif/device_service',
        user : '',
        pass : ''
      });
      
      // Initialize the OnvifDevice object
      let info = await device.init()
      //.then((info:any) => {
        // Show the detailed information of the device.
        console.log(JSON.stringify(info, null, '  '));
        
        // Get the current profile
        let profile = device.getCurrentProfile();
        // Show the video resolution of the current profile
        let reso = profile['video']['encoder']['resolution'];
        // console.log('- Before: ' + reso['width'] + ' x ' + reso['height']);
        
        // // Get a list of the profiles set in the device
        // let profile_list = device.getProfileList();
        
        // // Find the profile whose video resolution is the smallest
        // let min_square = 4000 * 2000;
        // let min_index = 0;
        // //console.log('############profile_list.length =' + profile_list.length)
        // for(let i=0; i<profile_list.length; i++) {
        //   //console.log('##########i=' + i)
        //   //console.log(JSON.stringify(profile_list[i]['video'], null, '  '))
        //   if (profile_list[i]['video']['encoder'] == null) continue
        //   let resolution = profile_list[i]['video']['encoder']['resolution'];
        //   let square = resolution['width'] * resolution['height'];
        //   //console.log('##########square=' + square)
        //   if(square < min_square) {
        //     min_square = square;
        //     min_index = i;
        //   }
        // }
        // // Change the current profile
        // profile = device.changeProfile(min_index);
        // Show the video resolution
        reso = profile['video']['encoder']['resolution'];
        // console.log('- After: ' + reso['width'] + ' x ' + reso['height']);


        onvifSnapshot = {device: device, resolution: reso}
        //return resolve(device)
      //})
      //.catch((error: any) => {
      //  return reject(error)
      //})
    //})
  }
//})


  //const device:any = await aPromise
  const res:any = await device.fetchSnapshot()

  //var out = res.body
  //if (onvifSnapshot && onvifSnapshot.resolution && onvifSnapshot.resolution.width > 1000) {
    //console.log('HIGH resolution image!!!!!!!!!!')
    // let imgBuf = await Jimp.read(res.body)
    // // .then(lenna => {
    // //   return lenna
    // //     .resize(256, 256) // resize
    // //     .quality(60) // set JPEG quality
    // //     .greyscale() // set greyscale
    // //     .write('lena-small-bw.jpg'); // save
    // // })
    // // .catch(err => {
    // //   console.error(err);
    // // });
    // out = await imgBuf.resize(800, 600).getBufferAsync(Jimp.MIME_JPEG)
    // if (onvifSnapshot) {
    //   onvifSnapshot.resolution.width = 800
    //   onvifSnapshot.resolution.height = 600
    // }
    
  //}
  
  // Save the data to a file
  //console.log('Onvif snapshot taken')
  //fs.writeFileSync('snapshot.jpg', res.body, {encoding: 'binary'})
  //return out

  return res.body
}


server.listen(port)
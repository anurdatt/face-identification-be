import * as faceutil from "./face-util";
import * as wcutil from "../shared/webcam-util";
import * as ipcutil from "../shared/ipcam-util";
import * as fsdbutil from "../shared/fsdb-util";
import * as fs from "fs";
var process_id:any, onvif_process_id:any

const FPS = 10

faceutil.init(fsdbutil.loadProfile())

const startProcess = (io:any) => {
    var count = 0

    wcutil.initialize()

    process_id = setInterval(async () => {
        
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

        const frame = wcutil.readFrame()
        let processedImage = await faceutil.getRecognizedImage(frame.data, {
            reso: {
                width: frame.cols, 
                height: frame.rows
            },
            count
        })
        
        io.emit('image', processedImage.image)
        console.log(count++)
      //})
    }, 1000/FPS)
}

const startRTSPStreaming = () => {
    return ipcutil.startRTSPStreaming()
}

const stopRTSPStreaming = () => {
    ipcutil.stopRTSPStreaming()
}


const startOnvifProcess = (io:any) => {
    var count = 0
  
    // if (wCap == undefined) {
    //   wCap = new cv.VideoCapture(0)
    
    //   wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
    
    //   wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)
    // }
    
  
    onvif_process_id = setInterval(async () => {
        //takeOnvifSnapshot(async (img, err) => {
          const imgObj = await ipcutil.takeOnvifSnapshotSync()
          //yconst img = fs.readFileSync('a.jpg', {encoding: 'binary'})
          // if (err) {
          //   console.error('Error in Onvif Snapshot')
          // }
          // else {
  
            const data = Buffer.from(imgObj.image, "binary").toString("base64")
  
            let processedImage = await faceutil.getRecognizedImage(data, {
                reso:{
                  width: imgObj.resolution.width,
                  height: imgObj.resolution.height
                },
                count
            })
  
            fs.writeFileSync('s.jpg', Buffer.from(processedImage.image, "base64"))
            //.toString("base64")
  
            //io.emit('image_onvif', image)
            console.log(count++)
          //})
          //}
        //})
        
        
        
    }, 1000/FPS)
}

  
const executeCommand = (command:any, opts: any) => {
    if (command === 'start') {
        console.log('received start command')
        if (process_id) {
          clearInterval(process_id)
        }
        
        startProcess(opts?.io)
        return true
    }
    else if (command === 'stop') {
        console.log('received stop command')
        if (process_id) {
          clearInterval(process_id)
          process_id = null
          wcutil.reset()
        }
        return true  
    }
    else if (command === 'start_rtsp') {
        console.log('received start_rtsp command')
        stopRTSPStreaming()
        return startRTSPStreaming(/* (data, error) => {
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
        } */) //Add CB TODO
        
    }
    else if (command === 'stop_rtsp') {
        console.log('received stop_rtsp command')
        stopRTSPStreaming()
        return true   
    } 
    else if (command === 'start_onvif') {
      console.log('received start_onvif command')
      if (onvif_process_id) {
        clearInterval(onvif_process_id)
      }
      
      startOnvifProcess(opts?.io)
      return true   
    }
    else if (command === 'stop_onvif') {
      console.log('received stop_onvif command')
      if (onvif_process_id) {
        clearInterval(onvif_process_id)
        onvif_process_id = null
        
      }
      return true   
    }
    else {
        return false
    }
}

const takeOnvifSnapshot = (cb: (data: any, err: any) => void) => {
    return ipcutil.takeOnvifSnapshot(async (imgObj, err) => {
      if (err) {
        cb(null, err)
      }
      else {

        const data = Buffer.from(imgObj.image, "binary").toString("base64")
  
        const processedImage = await faceutil.getFaceDetectedImage(data, {
                reso:{
                  width: imgObj.resolution.width,
                  height: imgObj.resolution.height
                },
                onlyDetect: true
            })
        //const str = data //Buffer.from(processedImage.image, "binary").toString("base64")
        cb({image: data, detected: processedImage.detected}, null)
      }
    })
}

const updateProfile = async (name:string, images:string[]) => {

  const labeledFD = await faceutil.getLabeledFaceDescriptors(name, images)
  fsdbutil.saveProfile(labeledFD)

  //faceutil.addLabeledFaceDescriptor(labeledFD)
  faceutil.loadAllLabeledFaceDescriptors(fsdbutil.loadProfile())
}

const fetchLabeledFDs = (fromMemory:boolean, cb: any) => {
  if (fromMemory) {
    cb(faceutil.fetchAllLabeledFDs(), null)
  }
  else {
    cb(fsdbutil.loadProfile(), null)
  }
}
export { executeCommand, takeOnvifSnapshot, updateProfile, fetchLabeledFDs }
import * as path from 'path'
import express from 'express';
import * as cv from 'opencv4nodejs'
import * as faceapi from 'face-api.js'
import { canvas, faceDetectionNet, faceDetectionOptions } from './commons';
import * as http from 'http'
import socket from 'socket.io'

//require("@tensorflow/tfjs-node");
//const tf = require("@tensorflow/tfjs");

const app = express()
const server = new http.Server(app)
const io = socket(server)
var wCap:any //new cv.VideoCapture(0)

//wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
//wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)

const FPS = 30

// ssd_mobilenetv1 options
let minConfidence = 0.5

// tiny_face_detector options
let inputSize = 192 //224
let scoreThreshold = 0.5

//const options = new faceapi.MtcnnOptions(mtcnnForwardParams)
//const options = new faceapi.SsdMobilenetv1Options({ minConfidence })
const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
var process:any = null


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

app.get('/', async (req, res) => {
  const command = req.query.command
  if (command === 'start') {
    console.log('received start command')
    if (process) {
      clearInterval(process)
    }
    
    startProcess()
  }
  else if (command === 'stop') {
    console.log('received stop command')
    if (process) {
      clearInterval(process)
      process = null
      wCap.release()
      wCap = undefined
    }
  }
  res.status(200).send({status: 'done'})   
})

const startProcess = () => {
    var count = 0

    if (wCap == undefined) {
      wCap = new cv.VideoCapture(0)
    
      wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
    
      wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)
    }
    

    process = setInterval(async () => {
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
        //console.log ('#############Here i am after canvas 3###########')
        const input = new canvas.Image();
        input.src = Buffer.from(data, 'base64');
        input.width = frame.cols;
        input.height = frame.rows;

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
    }, 1000/FPS)
}


server.listen(3000)
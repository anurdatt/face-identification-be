import * as path from 'path'
import * as faceapi from 'face-api.js'
import { canvas, faceDetectionNet, faceDetectionOptions } from '../commons';
import * as fs from 'fs';

// ssd_mobilenetv1 options
let minConfidence = 0.5

// tiny_face_detector options
let inputSize = 192 //224
let scoreThreshold = 0.5

//const options = new faceapi.MtcnnOptions(mtcnnForwardParams)
//const options = new faceapi.SsdMobilenetv1Options({ minConfidence })
const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })

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
var labeledFDs: faceapi.LabeledFaceDescriptors[] = []
  
async function getAllLabeledFaceDescriptors(): Promise<faceapi.LabeledFaceDescriptors[]> {
  
  //const labels = ['Mithai'] //, 'Kaushik', 'Kaushik-Masked', 'Arnab', 'Suparna', 'Tatai', 'Tatai-Masked'] // 'raj', 'leonard', 'howard']
  const entries = fs.readFileSync(path.join(__dirname,'../../ref_images/image sets/val.txt')).toString().split("\n");
  for(const i in entries) {
      console.log(entries[i]);
  }
  const labeledFaceDescriptors = await Promise.all(
    entries.map(async entry => {
      const label = entry.substr(0, 8)
      //console.log(label)
      // fetch image data from urls and convert blob to HTMLImage element
      //const imgUrl = `assets/${label}.jpg`
      const imgPath = `../../ref_images/aglined faces/${label}.jpg`
      const img = await canvas.loadImage(path.join(__dirname, imgPath))//faceapi.fetchImage(imgUrl)
  
      //console.log(img)
      // detect the face with the highest score in the image and compute it's landmarks and face descriptor
      const fullFaceDescription = await faceapi.detectSingleFace(img)  //SSD
      //const fullFaceDescription = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512}))
      .withFaceLandmarks()
      .withFaceDescriptor()
  
      //console.log(fullFaceDescription)
      //try{
        if (!fullFaceDescription) {
          throw new Error(`no faces detected for ${label}`)
        }
        const faceDescriptors = [fullFaceDescription.descriptor]
        return new faceapi.LabeledFaceDescriptors(label, faceDescriptors)
      //} catch(e) {
      //  console.error(e)
      //}
      
      //return new faceapi.LabeledFaceDescriptors(label, new Float32Array[0])
      
    })
  )
  
  return labeledFaceDescriptors
}

function init(profileList:any) {
//const initialize = async () => {
  console.log('loading model and initializing reference images')
  Promise.all( [
    faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, '../../weights') ),
    faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, '../../weights')),
    faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, '../../weights')),
    faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, '../../weights'))//,
    //getLabeledFaceDescriptors()
  ]
  )
  .then(async (res)=> {
    //Load reference images and label FDs
    //labeledFDs = await getAllLabeledFaceDescriptors()
    loadAllLabeledFaceDescriptors(profileList)
    /* let allProfileLFDs =  profileList.map((profile: { label: string, descriptors:[] }) => {
      let fds:Float32Array[] = []
      for (let i=0; i<profile.descriptors.length; i++) {
        fds.push(new Float32Array(profile.descriptors[i]))
      }
      //console.log('fds = '+ JSON.stringify(fds))
      return new faceapi.LabeledFaceDescriptors(profile.label, fds)
    })
    //console.log('allProfileLFDs = ', JSON.stringify(allProfileLFDs)) 
    //labeledFDs = profileList
    labeledFDs = labeledFDs.concat(allProfileLFDs) */
    console.log('Finished loading model and initializing reference images')
    //console.log('labeledFDs = ', JSON.stringify(labeledFDs)) 
  })
  .catch((error) => {
    console.error('Error loading model and initializing reference images', error)
  })
//}
}

async function getLabeledFaceDescriptors(label:string, images:string[])
:Promise<faceapi.LabeledFaceDescriptors> {

  const faceDescriptors = await Promise.all(images.map(async (image) => {
    const input = new canvas.Image();
    input.src = Buffer.from(image, 'base64');
    input.width = 1920; 
    input.height = 1080;

    // detect the face with the highest score in the image and compute it's landmarks and face descriptor
    const fullFaceDescription = await faceapi.detectSingleFace(input)  //SSD
    //const fullFaceDescription = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512}))
    .withFaceLandmarks()
    .withFaceDescriptor()

    if (!fullFaceDescription) {
      throw new Error(`no faces detected for ${label}`)
    }

    return fullFaceDescription.descriptor
  })
  )
  return new faceapi.LabeledFaceDescriptors(label, faceDescriptors)
}

async function getRecognizedImage(data:string, opts?:{}) {

    //console.log ('#############Here i am after canvas 3###########')
    const input = new canvas.Image();
    input.src = Buffer.from(data, 'base64');
    input.width = opts && opts.hasOwnProperty('reso') ? opts['reso'].width: 640; 
    input.height = opts && opts.hasOwnProperty('reso') ? opts['reso'].height: 360;

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

    let bestMatchLabel = "", sureMatchLabel = ""

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
          bestMatchLabel = bestMatch.label
          const {occurence, avgDist} = matchQueue.findOccurenceOfLabelWithAvgDist('label', bestMatch.label, 
          'distance', maxDescriptorDistance)
          
          console.log(`occurence = ${occurence}, avgDist = ${avgDist}, 
          label = ${bestMatch.label}, score = ${bestMatch.distance}`)
          const margin:number = (((maxDescriptorDistance - avgDist)
                                /(maxDescriptorDistance - minDescriptorDistance))
                                * Queue.MAX_ENTRIES + occurence) / 2
          
          const box = fullFaceDescriptions[i].detection.box
          
          if (bestMatch.distance <= (minDescriptorDistance + margin*fraction)) {
            sureMatchLabel = bestMatch.toString()  
            //matchQueue.insert(bestMatch)
          }
          else {
            sureMatchLabel = "unknown"
          }
          
          const drawBox = new faceapi.draw.DrawBox(box, { label: sureMatchLabel })
          drawBox.draw(outCanvas)
          matchQueue.insert(bestMatch)

        })
    }

    if (opts && opts.hasOwnProperty('count')) {
        const ctx = outCanvas.getContext('2d')
        if (ctx)
        ctx.fillText(""+opts['count'],100,40);
    }
    
    const image = (outCanvas as any)
    .toBuffer('image/jpeg')
    .toString("base64")

    return { image, bestMatchLabel, sureMatchLabel };

}


async function getFaceDetectedImage(data:string, opts?:{}) {

  //console.log ('#############Here i am after canvas 3###########')
  const input = new canvas.Image();
  input.src = Buffer.from(data, 'base64');
  input.width = opts && opts.hasOwnProperty('reso') ? opts['reso'].width: 640; 
  input.height = opts && opts.hasOwnProperty('reso') ? opts['reso'].height: 360;

  const outCanvas = faceapi.createCanvasFromMedia(input)

  const fullFaceDescriptions = await faceapi.detectAllFaces(input)
  .withFaceLandmarks()
  .withFaceDescriptors();
  //console.log(JSON.stringify(fullFaceDescriptions))

  let detected = false
  if (fullFaceDescriptions && fullFaceDescriptions.length > 0) {
      //const resizedResult = faceapi.resizeResults(fullFaceDescriptions, dims)
      detected = true

      if ( opts && opts.hasOwnProperty('onlyDetect') && !opts['onlyDetect'] )
        faceapi.draw.drawDetections(outCanvas, fullFaceDescriptions)
  }

  const image = (outCanvas as any)
  .toBuffer('image/jpeg')
  .toString("base64")

  return { image, detected };

}


function addLabeledFaceDescriptors(labeledFD:any) {
  labeledFDs.push(labeledFD)

  console.log(JSON.stringify(labeledFDs, null, '  '))
}

function loadAllLabeledFaceDescriptors(profileList:any) {
  /* labeledFDs = profileList.map((profile: { label: string, descriptors:[] }) => {
    let fds:Float32Array[] = []
    for (let i=0; i<profile.descriptors.length; i++) {
      fds.push(new Float32Array(profile.descriptors[i]))
    }
    
    return new faceapi.LabeledFaceDescriptors(profile.label, fds)
    
  })
 */
  let allProfileLFDs =  profileList.map((profile: { label: string, descriptors:[] }) => {
    let fds:Float32Array[] = []
    for (let i=0; i<profile.descriptors.length; i++) {
      fds.push(new Float32Array(profile.descriptors[i]))
    }
    //console.log('fds = '+ JSON.stringify(fds))
    return new faceapi.LabeledFaceDescriptors(profile.label, fds)
  })
  //console.log('allProfileLFDs = ', JSON.stringify(allProfileLFDs)) 
  //labeledFDs = profileList
  labeledFDs = labeledFDs.concat(allProfileLFDs)

  //console.log(JSON.stringify(labeledFDs, null, '  '))
}

function fetchAllLabeledFDs() {
  return labeledFDs;
}

export { init, 
  getRecognizedImage, 
  getFaceDetectedImage, 
  getLabeledFaceDescriptors, 
  addLabeledFaceDescriptors, 
  loadAllLabeledFaceDescriptors,
  fetchAllLabeledFDs }
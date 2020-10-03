// import * as cv from "opencv4nodejs";

// var wCap:any //new cv.VideoCapture(0)
// var process_id:any

// //wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
// //wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)

// function initialize() {
//     if (wCap == undefined) {
//         wCap = new cv.VideoCapture(0)
      
//         wCap.set(cv.CAP_PROP_FRAME_WIDTH, 320)
      
//         wCap.set(cv.CAP_PROP_FRAME_HEIGHT, 240)
//     }
      
//       // if (Webcam = null) {
//       //   Webcam = NodeWebcam.create( opts );
//       // }   
  
// }

// function reset() {
//     // Webcam.clear()
//     // Webcam = null
//     wCap.release()
//     wCap = undefined
// }

// function readFrame():{data:string, rows:number, cols:number} {
//     const frame = wCap.read()

//     const data = cv.imencode('.jpg', frame) /*(outCanvas as any)
//         .toBuffer('image/jpeg')*/
//         .toString("base64")
    
//     return { data, cols:frame.cols, rows: frame.rows }
// }

// export { initialize, readFrame, reset }
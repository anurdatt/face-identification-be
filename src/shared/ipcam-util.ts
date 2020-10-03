const onvif = require('node-onvif');
const RTSPStream = require('node-rtsp-stream')
import * as fs from "fs";
import Jimp from 'jimp';

 
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

const startRTSPStreaming = () => {

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
      rtspStreaming = {device, stream}
      return true
    }
    rtspStreaming = {device, stream:null}
    return true
  }).catch((error:any) => {
    console.error('ONVIF Error - ' + error);
    rtspStreaming = null
    return false
  });
  return true
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
          // Get the current profile
          let profile = device.getCurrentProfile();
          // Show the video resolution of the current profile
          let reso = profile['video']['encoder']['resolution'];
          onvifSnapshot = {device: device, resolution: reso};
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
      //fs.writeFileSync('snapshot.jpg', res.body, {encoding: 'binary'})

      cb({ 
        image: res.body, 
        resolution: onvifSnapshot && onvifSnapshot.resolution ? onvifSnapshot.resolution : { width: 1920, height: 1080 }
        }, null)
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
          // reso = profile['video']['encoder']['resolution'];
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
  
    return { 
        image: res.body, 
        resolution: onvifSnapshot && onvifSnapshot.resolution ? onvifSnapshot.resolution : { width: 1920, height: 1080 }
    }
  }
  
export { startRTSPStreaming, stopRTSPStreaming, takeOnvifSnapshot, takeOnvifSnapshotSync }
import express from 'express'
import * as camHelper from "../shared/cam-helper";
const camRoutes = express.Router();

camRoutes.get('/', (req, res) => {
  const command = req.query.command  
  const io = req.app['io']

  if (camHelper.executeCommand(command, {io})) {
    res.status(200).send({status: "done"})
  }
  else {
    res.status(500).send({status: "failed"})
  }
})

camRoutes.get('/onvif/take_snapshot', (req, res) => {
  camHelper.takeOnvifSnapshot((data, err) => {
    if (err) {
      res.status(500).send(err)
    }
    else {
      //const str = Buffer.from(data, "binary").toString("base64")
      res.status(200).send(data)
    }
  })
})

camRoutes.get('/face/fetch_labeled_fds', (req, res) => {
  camHelper.fetchLabeledFDs(new Boolean(req.query.memory).valueOf(), (data: any, err: any) => {
    if (err) {
      res.status(500).send(err)
    }
    else {
      //console.log('Returning labeled fds = ' + JSON.stringify(data))
      res.status(200).send(data)
    }
  })
})

export { camRoutes }
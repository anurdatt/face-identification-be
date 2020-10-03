import express from 'express';
import * as http from 'http'

import { empRoutes } from './routes/emp-routes'
import { camRoutes } from './routes/cam-routes';

import socket from 'socket.io'

const fileUpload = require('express-fileupload');

var port = process.env.PORT;
if (port == null || port == "") {
  port = "3000";
}

const app = express()
const server = new http.Server(app)

app.use(fileUpload())

var bodyParser = require('body-parser');
app.use(bodyParser.json({ extended: true , parameterLimit: 50000 , limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true , parameterLimit: 50000 , limit: '10mb' }));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:4200"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const io = socket(server)
//app.set('io', io)
app['io'] = io
app.use('/api/emp', empRoutes)
app.use('/api/cam', camRoutes)

server.listen(port)
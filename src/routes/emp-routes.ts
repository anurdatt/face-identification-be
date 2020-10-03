import express from 'express'
import * as empHelper from "../shared/emp-helper"
import * as camHelper from "../shared/cam-helper";
//import * as fsdbUtil from  "../shared/fsdb-util";

const empRoutes = express.Router();

empRoutes.get('/', (req, res) => {
    res.status(200).send(empHelper.fetchEmployees().filter((emp: empHelper.IEmployee) => !emp.profiled))
})

empRoutes.post('/:id/updateProfile', (req, res) => {
    const empId = req.params.id
    console.log(JSON.stringify(empHelper.fetchEmployees(), null, '  '))
    const empUpdate: empHelper.IEmployee[] 
    = empHelper.fetchEmployees()
               .filter((emp: empHelper.IEmployee) => emp.id == parseInt(empId))
    if (empUpdate && empUpdate.length > 0) {
        console.log('Employee found, going to update profile..')
        camHelper.updateProfile(empUpdate[0].name, req.body.images)
    }
    res.status(200).send({status: "done"})
})

empRoutes.post('/uploadCSV', (req, res) => {
    
    console.log(req['files']); // list of the files
    console.log(req.body); // request body, like email

    empHelper.saveEmployees(req.body.email, req['files'].empdata.data)
    res.status(200).send({status: "done"})
})

empRoutes.get('/downloadSampleCSV', (req, res) => {
    const csvString = empHelper.getSampleEmployees()
    res.status(200).send(Buffer.from(csvString))
})


//module.exports = { empRoutes }
export { empRoutes }
import express from 'express'
import * as employees from '../models/employees.json'

const empRoutes = express.Router();

empRoutes.get('/', (req, res) => {
    res.status(200).send(employees.employeeList)
})

empRoutes.post('/:id/updateProfile', (req, res) => {
    const empId = req.params.id
    
})
//module.exports = { empRoutes }
export { empRoutes }
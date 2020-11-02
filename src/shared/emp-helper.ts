import * as fsdbUtil from  "../shared/fsdb-util";
import * as genUtil from  "../shared/general-util";
import { employeeList } from "../models/employee.json"
export interface IEmployee {
    id: number
    name: string
    deptId: number
    profiled: boolean
}

class Employee implements IEmployee {
    id: number
    name: string
    deptId: number
    profiled: boolean
    constructor() {
        this.id = 0
        this.name = "Dummy"
        this.deptId = 0
        this.profiled = false
    };
}

//**helper functions below**// 
const fetchEmployees = ():IEmployee[] => {
    const empList:IEmployee[] = fsdbUtil.loadEmployees()
    const profList:[] = fsdbUtil.loadProfile()
    return empList.map((emp:IEmployee) => {
        const found = profList.find((prof:any) => prof.label == emp.name) 
        if (found && found != undefined) {
            emp.profiled = true
        }
        else {
            emp.profiled = false
        }
        return emp
    })
}

const saveEmployees = (uploader:string, csvData:Buffer) => {
    console.log(uploader, csvData.toString())
    const employeeList = genUtil.csvToJson<IEmployee>(() => new Employee(), csvData)
    fsdbUtil.saveEmployees({ uploader, employeeList })
    // const testJson = [
    //     {
    //         "id": 1,
    //         "name": "Anuran",
    //         "deptId": 1
    //     },
    //     {
    //         "id": 2,
    //         "name": "Kaushik",
    //         "deptId": 2
    //     },
    //     {
    //         "id": 3,
    //         "name": "Arnab",
    //         "deptId": 1
    //     },
    //     {
    //         "id": 4,
    //         "name": "Krishna",
    //         "deptId": 1
    //     },
    //     {
    //         "id": 5,
    //         "name": "Anandamay",
    //         "deptId":2
    //     }
    //     ]

    //    genUtil.jsonToCsv(testJson)
}

const getSampleEmployees = (): string => {
    //const empList:[] = fsdbUtil.loadEmployees()
    return genUtil.jsonToCsv(employeeList)
}

export { fetchEmployees, saveEmployees, getSampleEmployees }